import { ChangeLogEntry } from '../models/ChangeLogEntry.ts';
import { OutboxRecord } from '../models/OutboxRecord.ts';
import { ReadWriteTransaction, getConnection } from '../ConnectionManager.ts';

/**
 * Добавить записи в исходящий журнал в рамках уже открытой транзакции БД.
 *
 * Транзакция передаётся снаружи намеренно: запись журнала и изменение самой
 * транзакции должны попадать в БД атомарно, иначе сбой между двумя записями
 * рассинхронизирует состояние приложения и журнал.
 *
 * @param databaseTransaction транзакция БД, включающая хранилище outbox.
 * @param entries записи журнала для добавления.
 * @returns promise'ы добавления каждой записи — их нужно дождаться вместе с databaseTransaction.done.
 */
export function saveAll(
  databaseTransaction: ReadWriteTransaction,
  entries: ChangeLogEntry[],
): Promise<IDBValidKey>[] {
  const store = databaseTransaction.objectStore('outbox');
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
 * @param databaseTransaction транзакция БД, включающая хранилище outbox.
 * @param sequences порядковые номера отправленных записей.
 * @returns promise'ы удаления каждой записи — их нужно дождаться вместе с databaseTransaction.done.
 */
export function deleteAllById(
  databaseTransaction: ReadWriteTransaction,
  sequences: number[],
): Promise<void>[] {
  const store = databaseTransaction.objectStore('outbox');
  return sequences.map(sequence => store.delete(sequence));
}
