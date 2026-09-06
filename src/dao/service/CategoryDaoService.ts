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
