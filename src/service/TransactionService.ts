import { ChangeLogEntry } from '../dao/models/ChangeLogEntry.ts';
import { ChangeLogEntryType } from '../dao/models/ChangeLogEntryType.ts';
import { Transaction } from '../dao/models/Transaction.ts';
import { ReadWriteTransaction, getConnection } from '../dao/ConnectionManager.ts';
import * as outboxRepository from '../dao/service/OutboxDaoService.ts';
import * as transactionRepository from '../dao/service/TransactionDaoService.ts';

/**
 * Хранилища, которые меняются вместе при любой правке транзакций:
 * сама транзакция и запись о ней в исходящем журнале.
 */
const STORES = ['transactions', 'outbox'];

/**
 * Открыть транзакцию БД сразу над обоими хранилищами.
 *
 * @returns транзакция БД, охватывающая транзакции и исходящий журнал.
 */
async function openDatabaseTransaction(): Promise<ReadWriteTransaction> {
  const connection = await getConnection();
  return connection.transaction(STORES, 'readwrite');
}

/**
 * Собрать запись журнала о создании или изменении транзакции.
 *
 * @param entity транзакция целиком.
 * @param timestamp момент изменения.
 * @returns запись журнала.
 */
function buildUpsertEntry(entity: Transaction, timestamp: number): ChangeLogEntry {
  return { type: ChangeLogEntryType.upsert, transactionId: entity.id, timestamp, transaction: entity };
}

/**
 * Собрать запись журнала об удалении транзакции.
 *
 * @param transactionId идентификатор удаляемой транзакции.
 * @param timestamp момент удаления.
 * @returns запись журнала.
 */
function buildDeleteEntry(transactionId: string, timestamp: number): ChangeLogEntry {
  return { type: ChangeLogEntryType.delete, transactionId, timestamp };
}

/**
 * Сохранить транзакцию и записать изменение в журнал.
 *
 * Годится и для создания, и для правки: запись кладётся целиком поверх прежней.
 *
 * @param entity транзакция для сохранения.
 * @returns promise, завершающийся после записи данных в БД.
 */
export async function save(entity: Transaction): Promise<void> {
  await saveAll([entity]);
}

/**
 * Сохранить транзакции и записать изменения в журнал.
 *
 * @param entities транзакции для сохранения.
 * @returns promise, завершающийся после записи данных в БД.
 */
export async function saveAll(entities: Transaction[]): Promise<void> {
  const timestamp = Date.now();
  const entries = entities.map(entity => buildUpsertEntry(entity, timestamp));
  const databaseTransaction = await openDatabaseTransaction();
  await Promise.all([
    ...transactionRepository.saveAll(databaseTransaction, entities),
    ...outboxRepository.saveAll(databaseTransaction, entries),
    databaseTransaction.done,
  ]);
}

/**
 * Удалить транзакцию и записать удаление в журнал.
 *
 * @param transactionId идентификатор транзакции.
 * @returns promise, завершающийся после удаления записи.
 */
export async function deleteById(transactionId: string): Promise<void> {
  const timestamp = Date.now();
  const databaseTransaction = await openDatabaseTransaction();
  await Promise.all([
    transactionRepository.deleteById(databaseTransaction, transactionId),
    ...outboxRepository.saveAll(databaseTransaction, [buildDeleteEntry(transactionId, timestamp)]),
    databaseTransaction.done,
  ]);
}

/**
 * Удалить все транзакции и записать удаление каждой в журнал.
 *
 * Записи журнала обязательны: без них на другом устройстве стёртые транзакции
 * вернутся при следующем обмене — там про очистку никто не узнает.
 *
 * @returns promise, завершающийся после очистки хранилища.
 */
export async function deleteAll(): Promise<void> {
  const timestamp = Date.now();
  const databaseTransaction = await openDatabaseTransaction();
  const transactionIds = await transactionRepository.findAllIds(databaseTransaction);
  const entries = transactionIds.map(transactionId => buildDeleteEntry(transactionId, timestamp));
  await Promise.all([
    transactionRepository.deleteAll(databaseTransaction),
    ...outboxRepository.saveAll(databaseTransaction, entries),
    databaseTransaction.done,
  ]);
}
