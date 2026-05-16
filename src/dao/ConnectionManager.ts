import { openDB, IDBPDatabase } from 'idb';
import { Category } from './models/Category';
import { Transaction } from './models/Transaction';
import { TransactionType } from './models/TransactionType';

const DB_NAME = 'spendy-db';
const DB_VERSION = 5;

const DEFAULT_CATEGORIES: Category[] = [
  // Категории расходов
  { id: crypto.randomUUID(), title: 'Продукты',    icon: 'ShoppingCart',    type: TransactionType.expense, priority: 0, colorHex: '#86EFAC' },
  { id: crypto.randomUUID(), title: 'Транспорт',   icon: 'Car',             type: TransactionType.expense, priority: 1, colorHex: '#A78BFA' },
  { id: crypto.randomUUID(), title: 'Еда вне дома', icon: 'UtensilsCrossed', type: TransactionType.expense, priority: 2, colorHex: '#67E8F9' },
  { id: crypto.randomUUID(), title: 'Покупки',     icon: 'ShoppingBag',     type: TransactionType.expense, priority: 3, colorHex: '#60A5FA' },
  { id: crypto.randomUUID(), title: 'Дом',         icon: 'Home',            type: TransactionType.expense, priority: 4, colorHex: '#5AC8FA' },
  { id: crypto.randomUUID(), title: 'Квартплата',  icon: 'Building2',       type: TransactionType.expense, priority: 5, colorHex: '#34D399' },
  { id: crypto.randomUUID(), title: 'Медицина',    icon: 'HeartPulse',      type: TransactionType.expense, priority: 6, colorHex: '#818CF8' },
  { id: crypto.randomUUID(), title: 'Аптеки',      icon: 'Pill',            type: TransactionType.expense, priority: 7, colorHex: '#5856D6' },
  // Категории доходов
  { id: crypto.randomUUID(), title: 'Зарплата',    icon: 'CreditCard',      type: TransactionType.income,  priority: 0, colorHex: '#86EFAC' },
  { id: crypto.randomUUID(), title: 'Инвестиции',  icon: 'Briefcase',       type: TransactionType.income,  priority: 1, colorHex: '#5AC8FA' },
];

const DEFAULT_TRANSACTIONS: Transaction[] = [
  { id: crypto.randomUUID(), title: 'Продукты',  amount: 18500,  date: Date.UTC(2026, 4, 3), categoryId: DEFAULT_CATEGORIES[0].id, note: '' },
  { id: crypto.randomUUID(), title: 'Такси',     amount: 4200,   date: Date.UTC(2026, 4, 2), categoryId: DEFAULT_CATEGORIES[1].id, note: '' },
  { id: crypto.randomUUID(), title: 'Зарплата',  amount: 95000,  date: Date.UTC(2026, 4, 1), categoryId: DEFAULT_CATEGORIES[8].id, note: '' },
  { id: crypto.randomUUID(), title: 'Дивиденды', amount: 12500,  date: Date.UTC(2026, 3, 30), categoryId: DEFAULT_CATEGORIES[9].id, note: '' },
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
      async upgrade(connection, oldVersion, _, transaction) {
        if (oldVersion < 1) {
          const txStore = connection.createObjectStore('transactions', { keyPath: 'id' });
          txStore.createIndex('date', 'date');
          DEFAULT_TRANSACTIONS.forEach(tx => txStore.add(tx));
          const catStore = connection.createObjectStore('categories', { keyPath: 'id' });
          DEFAULT_CATEGORIES.forEach(cat => catStore.add(cat));
        }

        if (oldVersion === 1) {
          connection.deleteObjectStore('categories');
          const catStore = connection.createObjectStore('categories', { keyPath: 'id' });
          DEFAULT_CATEGORIES.forEach(cat => catStore.add(cat));
        }

        if (oldVersion === 2) {
          transaction.objectStore('transactions').createIndex('date', 'date');
        }

        if (oldVersion < 4) {
          const store = transaction.objectStore('transactions');
          const all = await store.getAll();
          for (const tx of all) {
            if (/^\d{4}-\d{2}-\d{2}$/.test(tx.date)) {
              await store.put({ ...tx, date: `${tx.date}T00:00:00.000Z` });
            }
          }
        }

        if (oldVersion < 5) {
          const store = transaction.objectStore('transactions');
          const all = await store.getAll();
          for (const tx of all) {
            if (typeof tx.date === 'string') {
              await store.put({ ...tx, date: new Date(tx.date).getTime() });
            }
          }
        }
      },
    });
  }

  return connectionPromise;
}
