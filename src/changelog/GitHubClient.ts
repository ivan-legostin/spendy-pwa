import { GitHubApiError } from './GitHubApiError.ts';
import { REPOSITORY_BRANCH, REPOSITORY_NAME, REPOSITORY_OWNER } from './RepositoryConfig.ts';
import { decodeBase64ToUtf8, encodeUtf8ToBase64 } from '../utils/Base64.ts';

const API_ORIGIN = 'https://api.github.com';
const REPOSITORY_PATH = `/repos/${REPOSITORY_OWNER}/${REPOSITORY_NAME}`;

/**
 * Файл репозитория с меткой его текущей версии.
 */
export interface RemoteFile {
  /**
   * Содержимое файла.
   */
  text: string;
  /**
   * Blob sha — версия файла, с которой прочитано содержимое.
   * Нужна при записи: GitHub отклонит запись, если в репозитории уже другая версия.
   */
  sha: string;
}

interface TreeResponse {
  truncated: boolean;
  tree: { path: string; type: string; sha: string }[];
}

interface ContentsResponse {
  content: string;
  encoding: string;
  sha: string;
}

interface BlobResponse {
  content: string;
  encoding: string;
}

interface WriteResponse {
  content: { sha: string };
}

/**
 * Выполнить запрос к API GitHub.
 *
 * @param token personal access token.
 * @param path путь запроса относительно api.github.com.
 * @param init параметры fetch.
 * @returns promise, завершающийся ответом — в том числе неуспешным.
 */
async function request(token: string, path: string, init?: RequestInit): Promise<Response> {
  try {
    return await fetch(`${API_ORIGIN}${path}`, {
      ...init,
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'application/vnd.github+json',
        'X-GitHub-Api-Version': '2022-11-28',
        ...init?.headers,
      },
    });
  } catch {
    throw new GitHubApiError(0, 'Нет соединения с GitHub');
  }
}

/**
 * Прочитать пояснение к неуспешному ответу.
 *
 * @param response неуспешный ответ.
 * @returns сообщение GitHub либо пустая строка, если тело не разобралось.
 */
async function readErrorMessage(response: Response): Promise<string> {
  try {
    const body = await response.json();
    return typeof body?.message === 'string' ? body.message : '';
  } catch {
    return '';
  }
}

/**
 * Собрать ошибку с понятным пользователю объяснением.
 *
 * @param response неуспешный ответ.
 * @param message сообщение GitHub.
 * @returns ошибка для выброса.
 */
function buildError(response: Response, message: string): GitHubApiError {
  const isRateLimited = response.headers.get('x-ratelimit-remaining') === '0';
  switch (response.status) {
    case 401:
      return new GitHubApiError(401, 'Токен GitHub недействителен или истёк');
    case 403:
      return new GitHubApiError(403, isRateLimited
        ? 'Исчерпан лимит запросов к GitHub, попробуйте позже'
        : 'У токена нет прав на этот репозиторий');
    case 404:
      return new GitHubApiError(404, `Репозиторий ${REPOSITORY_OWNER}/${REPOSITORY_NAME} не найден или недоступен токену`);
    case 409:
      return new GitHubApiError(409, 'Файл в репозитории изменился с момента чтения');
    default:
      return new GitHubApiError(response.status, `Ошибка GitHub ${response.status}${message ? `: ${message}` : ''}`);
  }
}

/**
 * Выбросить ошибку по неуспешному ответу.
 *
 * @param response неуспешный ответ.
 */
async function fail(response: Response): Promise<never> {
  throw buildError(response, await readErrorMessage(response));
}

/**
 * Прочитать содержимое объекта-файла напрямую.
 *
 * Contents API отдаёт содержимое только для файлов до мегабайта, у Git Blobs API
 * потолок сто мегабайт. Журнал за месяц массового импорта мегабайт перешагивает.
 *
 * @param token personal access token.
 * @param sha blob sha объекта.
 * @returns promise, завершающийся содержимым файла.
 */
async function readBlob(token: string, sha: string): Promise<string> {
  const response = await request(token, `${REPOSITORY_PATH}/git/blobs/${sha}`);
  if (!response.ok) {
    await fail(response);
  }

  const body: BlobResponse = await response.json();
  if (body.encoding !== 'base64') {
    throw new GitHubApiError(response.status, `Содержимое пришло в неизвестной кодировке: ${body.encoding}`);
  }
  return decodeBase64ToUtf8(body.content);
}

/**
 * Получить список файлов репозитория с их версиями одним запросом.
 *
 * Позволяет не скачивать файлы, чей blob sha не изменился с прошлого чтения.
 *
 * @param token personal access token.
 * @returns promise, завершающийся соответствием пути файла его blob sha.
 */
export async function readTree(token: string): Promise<Map<string, string>> {
  const response = await request(token, `${REPOSITORY_PATH}/git/trees/${REPOSITORY_BRANCH}?recursive=1`);

  if (!response.ok) {
    const message = await readErrorMessage(response);
    // В репозитории без единого коммита дерева ещё нет — это не ошибка,
    // первый же файл создастся при отправке.
    if (/empty/i.test(message)) {
      return new Map();
    }
    throw buildError(response, message);
  }

  const body: TreeResponse = await response.json();
  if (body.truncated) {
    throw new GitHubApiError(response.status, 'Список файлов репозитория пришёл обрезанным');
  }

  return new Map(body.tree.filter(item => item.type === 'blob').map(item => [item.path, item.sha]));
}

/**
 * Прочитать файл репозитория.
 *
 * @param token personal access token.
 * @param path путь файла в репозитории.
 * @returns promise, завершающийся содержимым файла либо null, если файла ещё нет.
 */
export async function readFile(token: string, path: string): Promise<RemoteFile | null> {
  const response = await request(token, `${REPOSITORY_PATH}/contents/${path}?ref=${REPOSITORY_BRANCH}`);

  if (response.status === 404) {
    return null;
  }
  if (!response.ok) {
    await fail(response);
  }

  const body: ContentsResponse = await response.json();
  const text = body.encoding === 'base64'
    ? decodeBase64ToUtf8(body.content)
    : await readBlob(token, body.sha);

  return { text, sha: body.sha };
}

/**
 * Записать файл в репозиторий.
 *
 * @param token personal access token.
 * @param path путь файла в репозитории.
 * @param text новое содержимое файла целиком.
 * @param commitMessage сообщение коммита.
 * @param sha версия файла, поверх которой идёт запись; не указывается при создании файла.
 * @returns promise, завершающийся blob sha записанного файла.
 */
export async function writeFile(
  token: string,
  path: string,
  text: string,
  commitMessage: string,
  sha?: string,
): Promise<string> {
  const response = await request(token, `${REPOSITORY_PATH}/contents/${path}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      message: commitMessage,
      content: encodeUtf8ToBase64(text),
      branch: REPOSITORY_BRANCH,
      ...(sha ? { sha } : {}),
    }),
  });

  if (!response.ok) {
    await fail(response);
  }

  const body: WriteResponse = await response.json();
  return body.content.sha;
}
