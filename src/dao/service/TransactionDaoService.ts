import { Transaction } from '../models/Transaction.ts';
import { getConnection } from '../ConnectionManager.ts';

/**
 * Сохранить список транзакций в БД.
 *
 * @param entities транзакции для сохранения.
 * @returns promise, завершающийся после записи данных в БД.
 */
export async function saveTransactions(entities: Transaction[]): Promise<void> {
  const connection = await getConnection();
  const transaction = connection.transaction('transactions', 'readwrite');
  await Promise.all([...entities.map(e => transaction.store.put(e)), transaction.done]);
}

/**
 * Получить все транзакции из БД.
 *
 * @returns promise, завершающийся списком всех транзакций.
 */
export async function getAllTransactions(): Promise<Transaction[]> {
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
export async function getTransactionsByMonth(year: number, month: number): Promise<Transaction[]> {
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
export async function getTransactionsByDay(year: number, month: number, day: number): Promise<Transaction[]> {
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
export async function getTransactionsByPeriod(
  startYear: number, startMonth: number,
  endYear: number, endMonth: number,
): Promise<Transaction[]> {
  const start = Date.UTC(startYear, startMonth - 1, 1)
  const end = Date.UTC(endYear, endMonth, 1)
  const range = IDBKeyRange.bound(start, end, false, true)
  const connection = await getConnection()
  return connection.getAllFromIndex('transactions', 'date', range)
}

/**
 * Удалить транзакцию из БД по идентификатору.
 *
 * @param id идентификатор транзакции.
 * @returns promise, завершающийся после удаления записи.
 */
export async function deleteTransaction(id: string): Promise<void> {
  const connection = await getConnection();
  await connection.delete('transactions', id);
}

/**
 * Обновить транзакцию в БД.
 *
 * @param entity обновлённая модель транзакции.
 * @returns promise, завершающийся после сохранения изменений.
 */
export async function updateTransaction(entity: Transaction): Promise<void> {
  const connection = await getConnection();
  await connection.put('transactions', entity);
}

/**
 * Удалить все транзакции из БД.
 *
 * @returns promise, завершающийся после очистки хранилища.
 */
export async function clearTransactions(): Promise<void> {
  const connection = await getConnection();
  await connection.clear('transactions');
}
