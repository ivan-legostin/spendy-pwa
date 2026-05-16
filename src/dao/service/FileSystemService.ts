import { getConnection } from '../ConnectionManager.ts';
import { buildCsv } from '../../utils/CsvExporter.ts';
import { Transaction } from '../models/Transaction.ts';
import { Category } from '../models/Category.ts';

// Дополняет неполные типы DOM: методы существуют в браузере, но отсутствуют в определениях TypeScript.
interface ExtendedFileHandle extends FileSystemFileHandle {
  queryPermission(descriptor: { mode: 'read' | 'readwrite' }): Promise<PermissionState>;
  requestPermission(descriptor: { mode: 'read' | 'readwrite' }): Promise<PermissionState>;
}

// Заглушка для window.showSaveFilePicker: позволяет вызвать метод, отсутствующий в типах DOM.
interface FileSavePicker {
  showSaveFilePicker(options?: {
    suggestedName?: string;
    types?: Array<{ description?: string; accept: Record<string, string[]> }>;
  }): Promise<ExtendedFileHandle>;
}

/**
 * Статус автосохранения.
 */
export interface FileSystemStatus {
  fileName: string | null;
  lastSaveTime: number | null;
  lastSaveError: string | null;
}

/**
 * Проверить поддержку File System Access API текущим браузером.
 *
 * @returns признак поддержки API.
 */
export function isSupported(): boolean {
  return 'showSaveFilePicker' in window;
}

/**
 * Прочитать значение настройки из store settings по ключу.
 *
 * @param key ключ настройки.
 * @returns promise, завершающийся значением настройки или null если запись не найдена.
 */
async function getSettingByKey<T>(key: string): Promise<T | null> {
  const connection = await getConnection();
  const record = await connection.get('settings', key);
  return (record?.value ?? null) as T | null;
}

async function putSetting(key: string, value: unknown): Promise<void> {
  const connection = await getConnection();
  await connection.put('settings', { key, value });
}

async function getStoredFileHandle(): Promise<ExtendedFileHandle | null> {
  return getSettingByKey<ExtendedFileHandle>('fileHandle');
}

async function writeToFile(handle: ExtendedFileHandle): Promise<void> {
  const connection = await getConnection();
  const [transactions, categories]: [Transaction[], Category[]] = await Promise.all([
    connection.getAll('transactions'),
    connection.getAll('categories'),
  ]);
  const csv = buildCsv(transactions, categories);
  const writable = await handle.createWritable();
  await writable.write(csv);
  await writable.close();
  await putSetting('lastSaveTime', Date.now());
  await putSetting('lastSaveError', null);
}

/**
 * Открыть диалог выбора файла, сохранить дескриптор и выполнить первичную запись CSV.
 *
 * @returns promise, завершающийся после первой записи в выбранный файл.
 */
export async function selectFile(): Promise<void> {
  const picker = window as unknown as FileSavePicker;

  const handle = await picker.showSaveFilePicker({
    suggestedName: 'spendy_transactions.csv',
    types: [{ description: 'CSV', accept: { 'text/csv': ['.csv'] } }],
  });

  await putSetting('fileHandle', handle);
  await putSetting('fileName', handle.name);
  await putSetting('lastSaveError', null);
  await writeToFile(handle);
}

/**
 * Запросить разрешение на запись к сохранённому файлу и выполнить сохранение.
 *
 * Должен вызываться из обработчика пользовательского события.
 *
 * @returns promise, завершающийся признаком успешного получения разрешения.
 */
export async function requestAccess(): Promise<boolean> {
  const fileHandler = await getStoredFileHandle();
  if (!fileHandler) return false;

  const permission = await fileHandler.requestPermission({ mode: 'readwrite' });
  if (permission === 'granted') {
    await writeToFile(fileHandler);
  }

  return permission === 'granted';
}

/**
 * Получить текущее состояние разрешения на запись.
 *
 * @returns promise, завершающийся состоянием разрешения или null если файл не выбран.
 */
export async function getPermissionState(): Promise<PermissionState | null> {
  const handle = await getStoredFileHandle();
  if (!handle) return null;
  return handle.queryPermission({ mode: 'readwrite' });
}

/**
 * Автоматически сохранить все транзакции в выбранный файл.
 *
 * Если файл не выбран — завершается без действий.
 * Если разрешение отозвано или файл недоступен — сохраняет текст ошибки в настройки.
 *
 * @returns promise, завершающийся после записи или сохранения ошибки.
 */
export async function autoSave(): Promise<void> {
  const handle = await getStoredFileHandle();
  if (!handle) return;

  const permission = await handle.queryPermission({ mode: 'readwrite' });
  if (permission !== 'granted') {
    await putSetting('lastSaveError', 'Нет доступа к файлу. Перейдите в Настройки и подтвердите доступ.');
    return;
  }

  try {
    await writeToFile(handle);
  } catch {
    await putSetting('lastSaveError', 'Не удалось записать файл. Возможно, он был удалён или перемещён.');
  }
}

/**
 * Получить статус автосохранения.
 *
 * @returns promise, завершающийся объектом с именем файла, временем и ошибкой последнего сохранения.
 */
export async function getStatus(): Promise<FileSystemStatus> {
  const [fileName, lastSaveTime, lastSaveError] = await Promise.all([
    getSettingByKey<string>('fileName'),
    getSettingByKey<number>('lastSaveTime'),
    getSettingByKey<string>('lastSaveError'),
  ]);

  return { fileName, lastSaveTime, lastSaveError };
}
