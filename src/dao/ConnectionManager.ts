import { openDB, IDBPDatabase } from 'idb';
import { Category } from '../models/Category';
import { TransactionType } from '../models/TransactionType';

const DB_NAME = 'spendy-db';
const DB_VERSION = 1;

const DEFAULT_CATEGORIES: Category[] = [
  // Категории расходов
  { id: crypto.randomUUID(), title: 'Продукты',    icon: 'cart.fill',                           type: TransactionType.expense, priority: 0, colorHex: '#86EFAC' },
  { id: crypto.randomUUID(), title: 'Транспорт',   icon: 'car.badge.gearshape.fill',            type: TransactionType.expense, priority: 1, colorHex: '#A78BFA' },
  { id: crypto.randomUUID(), title: 'Еда вне дома', icon: 'takeoutbag.and.cup.and.straw.fill', type: TransactionType.expense, priority: 2, colorHex: '#67E8F9' },
  { id: crypto.randomUUID(), title: 'Покупки',     icon: 'bag.fill',                            type: TransactionType.expense, priority: 3, colorHex: '#60A5FA' },
  { id: crypto.randomUUID(), title: 'Дом',         icon: 'house.fill',                          type: TransactionType.expense, priority: 4, colorHex: '#5AC8FA' },
  { id: crypto.randomUUID(), title: 'Квартплата',  icon: 'building.2.fill',                     type: TransactionType.expense, priority: 5, colorHex: '#34D399' },
  { id: crypto.randomUUID(), title: 'Медицина',    icon: 'heart.text.clipboard.fill',           type: TransactionType.expense, priority: 6, colorHex: '#818CF8' },
  { id: crypto.randomUUID(), title: 'Аптеки',      icon: 'pills.fill',                          type: TransactionType.expense, priority: 7, colorHex: '#5856D6' },
  // Категории доходов
  { id: crypto.randomUUID(), title: 'Зарплата',    icon: 'creditcard.fill',                     type: TransactionType.income,  priority: 0, colorHex: '#86EFAC' },
  { id: crypto.randomUUID(), title: 'Инвестиции',  icon: 'briefcase.fill',                      type: TransactionType.income,  priority: 1, colorHex: '#5AC8FA' },
];

/**
 * Инициализированное соединение.
 */
let connectionPromise: Promise<IDBPDatabase> | null = null;

/**
 * Получить соединение с БД.
 *
 * @returns promise, завершающийся единственным экземпляром соединения с БД.
 */
export function getConnection(): Promise<IDBPDatabase> {
  if (!connectionPromise) {
    connectionPromise = openDB(DB_NAME, DB_VERSION, {
      upgrade(connection) {
        if (!connection.objectStoreNames.contains('transactions')) {
          connection.createObjectStore('transactions', { keyPath: 'id' });
        }

        if (!connection.objectStoreNames.contains('categories')) {
          const store = connection.createObjectStore('categories', { keyPath: 'id' });
          DEFAULT_CATEGORIES.forEach(cat => store.add(cat));
        }
      },
    });
  }

  return connectionPromise;
}
