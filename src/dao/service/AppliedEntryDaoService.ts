import { IDBPTransaction } from 'idb';
import { ChangeLogEntry } from '../models/ChangeLogEntry.ts';
import { getConnection } from '../ConnectionManager.ts';

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
 * @param transaction транзакция БД, включающая хранилище применённых записей.
 * @param entries применённые записи журнала.
 * @returns promise'ы записи каждой отметки — их нужно дождаться вместе с transaction.done.
 */
export function saveAll(
  transaction: IDBPTransaction<unknown, string[], 'readwrite'>,
  entries: ChangeLogEntry[],
): Promise<IDBValidKey>[] {
  const store = transaction.objectStore('appliedEntries');
  return entries.map(entry => store.put({ key: entry.transactionId, timestamp: entry.timestamp }));
}

/**
 * Проверить, устарела ли запись журнала — то есть применялась ли к этой транзакции более поздняя.
 *
 * @param appliedTimestamps моменты последних применённых записей.
 * @param entry проверяемая запись журнала.
 * @returns true, если запись применять не нужно.
 */
export function isEntryOutdated(appliedTimestamps: Map<string, number>, entry: ChangeLogEntry): boolean {
  const appliedTimestamp = appliedTimestamps.get(entry.transactionId);
  return appliedTimestamp !== undefined && appliedTimestamp >= entry.timestamp;
}
