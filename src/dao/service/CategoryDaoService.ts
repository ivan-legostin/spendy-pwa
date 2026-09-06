import { Category } from '../models/Category.ts';
import { getConnection } from '../ConnectionManager.ts';

/**
 * Получить все категории из БД.
 *
 * @returns promise, завершающийся списком всех категорий.
 */
export async function findAll(): Promise<Category[]> {
  const connection = await getConnection();
  return connection.getAll('categories');
}

/**
 * Сохранить список категорий в БД.
 *
 * @param entities категории для сохранения.
 * @returns promise, завершающийся после записи данных в БД.
 */
export async function saveAll(entities: Category[]): Promise<void> {
  const connection = await getConnection();
  const databaseTransaction = connection.transaction('categories', 'readwrite');
  await Promise.all([...entities.map(entity => databaseTransaction.store.put(entity)), databaseTransaction.done]);
}
