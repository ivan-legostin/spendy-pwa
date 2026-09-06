import { Transaction } from '../models/Transaction.ts';
import { ReadWriteTransaction, getConnection } from '../ConnectionManager.ts';

/**
 * Получить все транзакции из БД.
 *
 * @returns promise, завершающийся списком всех транзакций.
 */
export async function findAll(): Promise<Transaction[]> {
  const connection = await getConnection();
  return connection.getAll('transactions');
}

/**
 * Получить транзакции за указанный месяц из БД.
 *
 * @param year год.
 * @param month номер месяца (1–12).
 * @returns promise, завершающийся списком транзакций за месяц.
 */
export async function findAllByMonth(year: number, month: number): Promise<Transaction[]> {
  const start = Date.UTC(year, month - 1, 1);
  const end = Date.UTC(year, month, 1);
  const range = IDBKeyRange.bound(start, end, false, true);
  const connection = await getConnection();
  return connection.getAllFromIndex('transactions', 'date', range);
}

/**
 * Получить транзакции за указанный день из БД.
 *
 * @param year год.
 * @param month номер месяца (1–12).
 * @param day число месяца (1–31).
 * @returns promise, завершающийся списком транзакций за день.
 */
export async function findAllByDay(year: number, month: number, day: number): Promise<Transaction[]> {
  const start = Date.UTC(year, month - 1, day);
  const end = Date.UTC(year, month - 1, day + 1);
  const range = IDBKeyRange.bound(start, end, false, true);
  const connection = await getConnection();
  return connection.getAllFromIndex('transactions', 'date', range);
}

/**
 * Получить транзакции за указанный период из БД.
 *
 * @param startYear год начала периода.
 * @param startMonth номер месяца начала периода (1–12).
 * @param endYear год конца периода.
 * @param endMonth номер месяца конца периода (1–12).
 * @returns promise, завершающийся списком транзакций за период.
 */
export async function findAllByPeriod(
  startYear: number, startMonth: number,
  endYear: number, endMonth: number,
): Promise<Transaction[]> {
  const start = Date.UTC(startYear, startMonth - 1, 1);
  const end = Date.UTC(endYear, endMonth, 1);
  const range = IDBKeyRange.bound(start, end, false, true);
  const connection = await getConnection();
  return connection.getAllFromIndex('transactions', 'date', range);
}

/**
 * Получить идентификаторы всех транзакций в рамках уже открытой транзакции БД.
 *
 * Нужно перед массовым удалением: на каждую транзакцию потребуется запись журнала,
 * а прочитать идентификаторы отдельным запросом нельзя — между чтением и удалением
 * список успел бы измениться.
 *
 * @param databaseTransaction транзакция БД, включающая хранилище транзакций.
 * @returns promise, завершающийся списком идентификаторов.
 */
export async function findAllIds(databaseTransaction: ReadWriteTransaction): Promise<string[]> {
  const keys = await databaseTransaction.objectStore('transactions').getAllKeys();
  return keys as string[];
}

/**
 * Сохранить транзакции в рамках уже открытой транзакции БД.
 *
 * @param databaseTransaction транзакция БД, включающая хранилище транзакций.
 * @param entities транзакции для сохранения.
 * @returns promise'ы записи каждой транзакции — их нужно дождаться вместе с databaseTransaction.done.
 */
export function saveAll(
  databaseTransaction: ReadWriteTransaction,
  entities: Transaction[],
): Promise<IDBValidKey>[] {
  const store = databaseTransaction.objectStore('transactions');
  return entities.map(entity => store.put(entity));
}

/**
 * Удалить транзакцию по идентификатору в рамках уже открытой транзакции БД.
 *
 * @param databaseTransaction транзакция БД, включающая хранилище транзакций.
 * @param id идентификатор транзакции.
 * @returns promise, завершающийся после удаления записи.
 */
export function deleteById(databaseTransaction: ReadWriteTransaction, id: string): Promise<void> {
  return databaseTransaction.objectStore('transactions').delete(id);
}

/**
 * Удалить все транзакции в рамках уже открытой транзакции БД.
 *
 * @param databaseTransaction транзакция БД, включающая хранилище транзакций.
 * @returns promise, завершающийся после очистки хранилища.
 */
export function deleteAll(databaseTransaction: ReadWriteTransaction): Promise<void> {
  return databaseTransaction.objectStore('transactions').clear();
}
