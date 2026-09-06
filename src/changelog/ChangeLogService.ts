import { ChangeLogEntry } from '../dao/models/ChangeLogEntry.ts';
import { ChangeLogEntryType } from '../dao/models/ChangeLogEntryType.ts';
import { ChangeLogStateKey } from '../dao/models/ChangeLogStateKey.ts';
import { OutboxRecord } from '../dao/models/OutboxRecord.ts';
import { SettingKey } from '../dao/models/SettingKey.ts';
import { Transaction } from '../dao/models/Transaction.ts';
import { getConnection } from '../dao/ConnectionManager.ts';
import * as appliedEntryRepository from '../dao/service/AppliedEntryDaoService.ts';
import * as changeLogStateRepository from '../dao/service/ChangeLogStateDaoService.ts';
import * as outboxRepository from '../dao/service/OutboxDaoService.ts';
import * as settingsRepository from '../dao/service/SettingsDaoService.ts';
import * as transactionRepository from '../dao/service/TransactionDaoService.ts';
import { notifyAppliedChanges } from './AppliedChangesNotifier.ts';
import { ExchangeResult } from './ExchangeResult.ts';
import { GitHubApiError } from './GitHubApiError.ts';
import { DEVICES_DIRECTORY } from './RepositoryConfig.ts';
import * as gitHubClient from './GitHubClient.ts';

/**
 * Соответствие пути файла в репозитории его blob sha на момент последнего чтения.
 */
type FileShas = Record<string, string>;

/**
 * Собрать имя месячного файла по моменту изменения.
 *
 * Время берётся в UTC, чтобы устройства в разных часовых поясах
 * не раскладывали одну и ту же запись по разным файлам.
 *
 * @param timestamp момент изменения.
 * @returns имя вида "2026-09".
 */
function buildMonthKey(timestamp: number): string {
  const date = new Date(timestamp);
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}`;
}

/**
 * Собрать путь файла журнала в репозитории.
 *
 * @param deviceId идентификатор устройства.
 * @param monthKey месяц вида "2026-09".
 * @returns путь вида "devices/ivan-iphone/2026-09.ndjson".
 */
function buildFilePath(deviceId: string, monthKey: string): string {
  return `${DEVICES_DIRECTORY}/${deviceId}/${monthKey}.ndjson`;
}

/**
 * Дописать строки к содержимому файла.
 *
 * @param existingText прежнее содержимое либо undefined, если файла ещё нет.
 * @param lines добавляемые строки.
 * @returns новое содержимое файла целиком.
 */
function appendLines(existingText: string | undefined, lines: string[]): string {
  const prefix = existingText && !existingText.endsWith('\n') ? `${existingText}\n` : existingText ?? '';
  return `${prefix}${lines.join('\n')}\n`;
}

/**
 * Дописать записи журнала в файл репозитория.
 *
 * При конфликте версий файл перечитывается и записи дописываются к актуальному
 * содержимому: повтор с прежним текстом затёр бы чужую запись.
 *
 * @param token personal access token.
 * @param path путь файла в репозитории.
 * @param lines добавляемые строки.
 * @param commitMessage сообщение коммита.
 * @returns promise, завершающийся blob sha записанного файла.
 */
async function appendToFile(token: string, path: string, lines: string[], commitMessage: string): Promise<string> {
  const attemptCount = 2;
  for (let attempt = 1; attempt <= attemptCount; attempt++) {
    const file = await gitHubClient.readFile(token, path);
    try {
      return await gitHubClient.writeFile(token, path, appendLines(file?.text, lines), commitMessage, file?.sha);
    } catch (error) {
      const isLastAttempt = attempt === attemptCount;
      if (isLastAttempt || !(error instanceof GitHubApiError) || error.status !== 409) {
        throw error;
      }
    }
  }
  throw new GitHubApiError(409, `Не удалось записать ${path}: файл меняется быстрее, чем мы успеваем его дописать`);
}

/**
 * Разложить записи исходящего журнала по месяцам.
 *
 * @param records записи исходящего журнала.
 * @returns соответствие месяца записям за него, месяцы по возрастанию.
 */
function groupByMonth(records: OutboxRecord[]): Map<string, OutboxRecord[]> {
  const grouped = new Map<string, OutboxRecord[]>();
  for (const record of records) {
    const monthKey = buildMonthKey(record.entry.timestamp);
    const monthRecords = grouped.get(monthKey);
    if (monthRecords) {
      monthRecords.push(record);
    } else {
      grouped.set(monthKey, [record]);
    }
  }
  return new Map([...grouped].sort(([left], [right]) => left.localeCompare(right)));
}

/**
 * Отправить накопленные записи журнала в репозиторий.
 *
 * Файл дописывается, отметки о применении ставятся и записи убираются из
 * исходящего журнала помесячно: сбой на одном месяце не отменяет уже отправленные.
 *
 * @param token personal access token.
 * @param deviceId идентификатор устройства.
 * @param fileShas кеш версий файлов, обновляется на месте.
 * @returns promise, завершающийся числом отправленных записей.
 */
async function push(token: string, deviceId: string, fileShas: FileShas): Promise<number> {
  const records = await outboxRepository.findAll();
  if (records.length === 0) {
    return 0;
  }

  const connection = await getConnection();
  let sentCount = 0;

  for (const [monthKey, monthRecords] of groupByMonth(records)) {
    const path = buildFilePath(deviceId, monthKey);
    const entries = monthRecords.map(record => record.entry);
    const lines = entries.map(entry => JSON.stringify(entry));

    // Если файл уже читали целиком, всё лежащее в нём применено или отброшено,
    // и новую версию можно запомнить — чтение его пропустит. Если не читали,
    // версию запоминать нельзя: в файле остаются наши же прежние записи,
    // ещё не применённые к этой БД — так бывает после переустановки приложения.
    const wasFileRead = path in fileShas;
    const sha = await appendToFile(token, path, lines, `${deviceId}: ${entries.length} записей за ${monthKey}`);
    if (wasFileRead) {
      fileShas[path] = sha;
    }

    // Отметка о применении ставится сразу: иначе следующее чтение вернёт нам
    // собственные записи и применит их поверх состояния, которое уже новее.
    const databaseTransaction = connection.transaction(['outbox', 'appliedEntries'], 'readwrite');
    await Promise.all([
      ...outboxRepository.deleteAllById(databaseTransaction, monthRecords.map(record => record.sequence)),
      ...appliedEntryRepository.saveAll(databaseTransaction, entries),
      databaseTransaction.done,
    ]);

    sentCount += entries.length;
  }

  return sentCount;
}

/**
 * Проверить, что разобранная строка — запись журнала.
 *
 * Без проверки строка вида "{}" дала бы запись без идентификатора, и БД
 * отвергла бы её как недопустимый ключ, сорвав обмен целиком.
 *
 * @param value результат разбора строки.
 * @returns true, если значение годится в качестве записи журнала.
 */
function isChangeLogEntry(value: unknown): value is ChangeLogEntry {
  const entry = value as ChangeLogEntry;
  return typeof entry?.transactionId === 'string'
    && typeof entry.timestamp === 'number'
    && Object.values(ChangeLogEntryType).includes(entry.type);
}

/**
 * Разобрать содержимое файла журнала.
 *
 * Повреждённая строка пропускается: одна испорченная запись не должна
 * останавливать обмен целиком.
 *
 * @param text содержимое файла.
 * @param entries список, в который добавляются разобранные записи.
 * @returns число строк, которые не удалось разобрать.
 */
function parseEntries(text: string, entries: ChangeLogEntry[]): number {
  let brokenLineCount = 0;
  for (const line of text.split('\n')) {
    if (line.trim().length === 0) {
      continue;
    }
    try {
      const value: unknown = JSON.parse(line);
      if (isChangeLogEntry(value)) {
        entries.push(value);
      } else {
        brokenLineCount++;
      }
    } catch {
      brokenLineCount++;
    }
  }
  return brokenLineCount;
}

/**
 * Оставить по каждой транзакции самую свежую запись.
 *
 * @param entries записи из прочитанных файлов.
 * @returns соответствие идентификатора транзакции победившей записи.
 */
function selectLatestEntries(entries: ChangeLogEntry[]): Map<string, ChangeLogEntry> {
  const latest = new Map<string, ChangeLogEntry>();
  for (const entry of entries) {
    const current = latest.get(entry.transactionId);
    if (!current || entry.timestamp > current.timestamp) {
      latest.set(entry.transactionId, entry);
    }
  }
  return latest;
}

/**
 * Проверить, устарела ли запись журнала — то есть применялась ли к этой транзакции более поздняя.
 *
 * @param appliedTimestamps моменты последних применённых записей.
 * @param entry проверяемая запись журнала.
 * @returns true, если запись применять не нужно.
 */
function isEntryOutdated(appliedTimestamps: Map<string, number>, entry: ChangeLogEntry): boolean {
  const appliedTimestamp = appliedTimestamps.get(entry.transactionId);
  return appliedTimestamp !== undefined && appliedTimestamp >= entry.timestamp;
}

/**
 * Применить записи с других устройств к локальной БД.
 *
 * Пишет мимо исходящего журнала: иначе полученные записи уехали бы обратно
 * отправителю, и обмен зациклился бы.
 *
 * @param entries записи для применения.
 * @returns promise, завершающийся после записи данных в БД.
 */
async function applyRemoteEntries(entries: ChangeLogEntry[]): Promise<void> {
  const connection = await getConnection();
  const databaseTransaction = connection.transaction(['transactions', 'appliedEntries'], 'readwrite');

  const saved = entries
    .filter(entry => entry.type === ChangeLogEntryType.upsert && entry.transaction)
    .map(entry => entry.transaction as Transaction);
  const deleted = entries.filter(entry => entry.type === ChangeLogEntryType.delete);

  await Promise.all([
    ...transactionRepository.saveAll(databaseTransaction, saved),
    ...deleted.map(entry => transactionRepository.deleteById(databaseTransaction, entry.transactionId)),
    ...appliedEntryRepository.saveAll(databaseTransaction, entries),
    databaseTransaction.done,
  ]);
}

/**
 * Прочитать изменившиеся файлы репозитория и применить их записи.
 *
 * @param token personal access token.
 * @param fileShas кеш версий файлов, обновляется на месте.
 * @returns promise, завершающийся результатом чтения без учёта отправки.
 */
async function pull(token: string, fileShas: FileShas): Promise<Omit<ExchangeResult, 'sentCount'>> {
  const tree = await gitHubClient.readTree(token);
  const logPaths = [...tree.keys()]
    .filter(path => path.startsWith(`${DEVICES_DIRECTORY}/`) && path.endsWith('.ndjson'))
    .sort();
  const changedPaths = logPaths.filter(path => fileShas[path] !== tree.get(path));

  const entries: ChangeLogEntry[] = [];
  let brokenLineCount = 0;
  for (const path of changedPaths) {
    const file = await gitHubClient.readFile(token, path);
    if (file) {
      brokenLineCount += parseEntries(file.text, entries);
    }
  }

  const appliedTimestamps = await appliedEntryRepository.findAll();
  const applicable = [...selectLatestEntries(entries).values()]
    .filter(entry => !isEntryOutdated(appliedTimestamps, entry));

  if (applicable.length > 0) {
    await applyRemoteEntries(applicable);
    notifyAppliedChanges();
  }

  // Кеш версий обновляется только после успешного применения:
  // иначе сбой на середине навсегда пропустил бы непрочитанные файлы.
  for (const path of changedPaths) {
    fileShas[path] = tree.get(path) as string;
  }

  return {
    appliedCount: applicable.length,
    totalFileCount: logPaths.length,
    readPaths: changedPaths,
    brokenLineCount,
  };
}

/**
 * Обмен, выполняющийся прямо сейчас, либо null.
 */
let runningExchange: Promise<ExchangeResult> | null = null;

/**
 * Признак того, что во время текущего обмена поступила заявка на следующий.
 */
let isRerunRequested = false;

/**
 * Обменяться журналом изменений с репозиторием: отправить свои записи, применить чужие.
 *
 * Одновременно выполняется не более одного обмена: два параллельных отправили бы
 * исходящий журнал дважды и продублировали строки в файле. Заявка, поступившая во
 * время работы, не теряется — она выполняется следующим заходом, потому что могла
 * принести правки, сделанные уже после начала текущего обмена.
 *
 * @returns promise, завершающийся итогом обмена.
 */
export function exchangeChanges(): Promise<ExchangeResult> {
  if (runningExchange) {
    isRerunRequested = true;
    return runningExchange;
  }

  runningExchange = (async () => {
    try {
      let result = await runExchange();
      while (isRerunRequested) {
        isRerunRequested = false;
        result = await runExchange();
      }
      return result;
    } finally {
      isRerunRequested = false;
      runningExchange = null;
    }
  })();

  return runningExchange;
}

/**
 * Выполнить один обмен: отправить свои записи, применить чужие.
 *
 * Порядок важен: сначала отправка. Тогда собственные изменения уже отмечены
 * применёнными, и чтение не вернёт их обратно поверх более свежего состояния.
 *
 * @returns promise, завершающийся итогом обмена.
 */
async function runExchange(): Promise<ExchangeResult> {
  const token = await settingsRepository.getSetting<string>(SettingKey.githubToken);
  if (!token) {
    throw new Error('Не указан токен GitHub');
  }

  const deviceId = await settingsRepository.getSetting<string>(SettingKey.deviceId);
  if (!deviceId) {
    throw new Error('Не указано имя устройства');
  }

  const fileShas = { ...(await changeLogStateRepository.getChangeLogState<FileShas>(ChangeLogStateKey.remoteFileShas) ?? {}) };

  const sentCount = await push(token, deviceId, fileShas);
  const received = await pull(token, fileShas);

  await changeLogStateRepository.saveChangeLogState(ChangeLogStateKey.remoteFileShas, fileShas);
  await changeLogStateRepository.saveChangeLogState(ChangeLogStateKey.lastExchangeTimestamp, Date.now());

  return { sentCount, ...received };
}
