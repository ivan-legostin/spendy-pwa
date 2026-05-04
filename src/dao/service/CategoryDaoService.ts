import { Category } from '../models/Category.ts';
import { getConnection } from '../ConnectionManager.ts';

/**
 * Сохранить список категорий в БД.
 *
 * @param entities категории для сохранения.
 * @returns promise, завершающийся после записи данных в БД.
 */
export async function saveCategories(entities: Category[]): Promise<void> {
  const connection = await getConnection();
  const transaction = connection.transaction('categories', 'readwrite');
  await Promise.all([...entities.map(e => transaction.store.put(e)), transaction.done]);
}

/**
 * Получить все категории из БД.
 *
 * @returns promise, завершающийся списком всех категорий.
 */
export async function getAllCategories(): Promise<Category[]> {
  const connection = await getConnection();
  return connection.getAll('categories');
}
