import { openDB, IDBPDatabase } from 'idb';
import { Category } from './models/Category';
import { Transaction } from './models/Transaction';
import { TransactionType } from './models/TransactionType';

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

const DEFAULT_TRANSACTIONS: Transaction[] = [
  { id: crypto.randomUUID(), title: 'Продукты',        amount: 18500,  date: '2026-05-03', categoryId: DEFAULT_CATEGORIES[0].id, note: '' },
  { id: crypto.randomUUID(), title: 'Такси',           amount: 4200,   date: '2026-05-02', categoryId: DEFAULT_CATEGORIES[1].id, note: '' },
  { id: crypto.randomUUID(), title: 'Зарплата',        amount: 95000,  date: '2026-05-01', categoryId: DEFAULT_CATEGORIES[8].id, note: '' },
  { id: crypto.randomUUID(), title: 'Дивиденды',       amount: 12500,  date: '2026-04-30', categoryId: DEFAULT_CATEGORIES[9].id, note: '' },
];

/**
 * Инициализированное соединение.
 */
let connectionPromise: Promise<IDBPDatabase> | null = null;

/**
 * Получить соединение с БД.
 *
 * Перед установкой соединения проверяется наличие таблиц в БД и их генерация в случае отсутствия.
 * Таблицы наполняются данными:
 *   1. Стандартные категории.
 *   2. Фейковые транзакции.
 *
 * @returns promise, завершающийся единственным экземпляром соединения с БД.
 */
export function getConnection(): Promise<IDBPDatabase> {
  if (!connectionPromise) {
    connectionPromise = openDB(DB_NAME, DB_VERSION, {
      upgrade(connection) {
        if (!connection.objectStoreNames.contains('transactions')) {
          const txStore = connection.createObjectStore('transactions', { keyPath: 'id' });
          DEFAULT_TRANSACTIONS.forEach(tx => txStore.add(tx));
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
