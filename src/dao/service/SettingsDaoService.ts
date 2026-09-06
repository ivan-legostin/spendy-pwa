import { SettingKey } from '../models/SettingKey.ts';
import { getConnection } from '../ConnectionManager.ts';

/**
 * Получить значение настройки.
 *
 * @param key ключ настройки.
 * @returns promise, завершающийся значением настройки либо undefined, если она не задана.
 */
export async function getSetting<T>(key: SettingKey): Promise<T | undefined> {
  const connection = await getConnection();
  const record = await connection.get('settings', key);
  return record?.value as T | undefined;
}

/**
 * Сохранить значение настройки.
 *
 * @param key ключ настройки.
 * @param value сохраняемое значение.
 * @returns promise, завершающийся после записи данных в БД.
 */
export async function saveSetting(key: SettingKey, value: unknown): Promise<void> {
  const connection = await getConnection();
  await connection.put('settings', { key, value });
}
