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
 * Удалить все транзакции из БД.
 *
 * @returns promise, завершающийся после очистки хранилища.
 */
export async function clearTransactions(): Promise<void> {
  const connection = await getConnection();
  await connection.clear('transactions');
}
