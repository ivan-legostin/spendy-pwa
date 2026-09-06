import { IDBPTransaction } from 'idb';
import { ChangeLogEntry } from '../models/ChangeLogEntry.ts';
import { OutboxRecord } from '../models/OutboxRecord.ts';
import { getConnection } from '../ConnectionManager.ts';

/**
 * Транзакция БД, открытая на запись сразу в несколько хранилищ.
 */
export type ReadWriteTransaction = IDBPTransaction<unknown, string[], 'readwrite'>;

/**
 * Добавить записи в исходящий журнал в рамках уже открытой транзакции БД.
 *
 * Транзакция передаётся снаружи намеренно: запись журнала и изменение самой
 * транзакции должны попадать в БД атомарно, иначе сбой между двумя записями
 * рассинхронизирует состояние приложения и журнал.
 *
 * @param transaction транзакция БД, включающая хранилище outbox.
 * @param entries записи журнала для добавления.
 * @returns promise'ы добавления каждой записи — их нужно дождаться вместе с transaction.done.
 */
export function saveAll(
  transaction: ReadWriteTransaction,
  entries: ChangeLogEntry[],
): Promise<IDBValidKey>[] {
  const store = transaction.objectStore('outbox');
  return entries.map(entry => store.add({ entry }));
}

/**
 * Получить записи, ещё не отправленные в репозиторий, в порядке их появления.
 *
 * @returns promise, завершающийся списком записей исходящего журнала.
 */
export async function findAll(): Promise<OutboxRecord[]> {
  const connection = await getConnection();
  return connection.getAll('outbox');
}

/**
 * Получить количество записей, ещё не отправленных в репозиторий.
 *
 * @returns promise, завершающийся числом записей исходящего журнала.
 */
export async function count(): Promise<number> {
  const connection = await getConnection();
  return connection.count('outbox');
}

/**
 * Удалить из исходящего журнала записи, успешно отправленные в репозиторий.
 *
 * @param sequences порядковые номера отправленных записей.
 * @returns promise, завершающийся после удаления записей.
 */
export async function deleteAllById(sequences: number[]): Promise<void> {
  const connection = await getConnection();
  const transaction = connection.transaction('outbox', 'readwrite');
  await Promise.all([...sequences.map(sequence => transaction.store.delete(sequence)), transaction.done]);
}
