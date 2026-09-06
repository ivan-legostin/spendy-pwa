import { ChangeLogEntry } from '../models/ChangeLogEntry.ts';
import { ReadWriteTransaction, getConnection } from '../ConnectionManager.ts';

/**
 * Получить все транзакции с временными метками их изменений.
 * Для каждой транзакции хранится наиболее свежая временная метка изменений.
 *
 * @returns promise, завершающийся соответствием идентификатора транзакции моменту применённой записи.
 */
export async function findAll(): Promise<Map<string, number>> {
  const connection = await getConnection();
  const records = await connection.getAll('appliedEntries');
  return new Map(records.map(record => [record.key as string, record.timestamp as number]));
}

/**
 * Запомнить моменты применённых записей журнала в рамках уже открытой транзакции БД.
 *
 * @param databaseTransaction транзакция БД, включающая хранилище применённых записей.
 * @param entries применённые записи журнала.
 * @returns promise'ы записи каждой отметки — их нужно дождаться вместе с databaseTransaction.done.
 */
export function saveAll(
  databaseTransaction: ReadWriteTransaction,
  entries: ChangeLogEntry[],
): Promise<IDBValidKey>[] {
  const store = databaseTransaction.objectStore('appliedEntries');
  return entries.map(entry => store.put({ key: entry.transactionId, timestamp: entry.timestamp }));
}
