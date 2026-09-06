import { ChangeLogStateKey } from '../models/ChangeLogStateKey.ts';
import { getConnection } from '../ConnectionManager.ts';

/**
 * Получить значение служебного состояния обмена журналом.
 *
 * @param key ключ состояния.
 * @returns promise, завершающийся значением либо undefined, если обмена ещё не было.
 */
export async function getChangeLogState<T>(key: ChangeLogStateKey): Promise<T | undefined> {
  const connection = await getConnection();
  const record = await connection.get('changeLogState', key);
  return record?.value as T | undefined;
}

/**
 * Сохранить значение служебного состояния обмена журналом.
 *
 * @param key ключ состояния.
 * @param value сохраняемое значение.
 * @returns promise, завершающийся после записи данных в БД.
 */
export async function saveChangeLogState(key: ChangeLogStateKey, value: unknown): Promise<void> {
  const connection = await getConnection();
  await connection.put('changeLogState', { key, value });
}
