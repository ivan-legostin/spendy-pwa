import { openDB, IDBPDatabase } from 'idb';
import { Category } from './models/Category';
import { Transaction } from './models/Transaction';
import { TransactionType } from './models/TransactionType';

const DB_NAME = 'spendy-db';
const DB_VERSION = 6;

const DEFAULT_CATEGORIES: Category[] = [
  // Категории расходов
  { id: 'e53fce9a-ae6a-48d6-97af-10c254cb3eb7', title: 'Продукты',    icon: 'ShoppingCart',    type: TransactionType.expense, priority: 0, colorHex: '#86EFAC' },
  { id: '2d4add3e-0a19-4afd-9849-b8de3001002a', title: 'Транспорт',   icon: 'Car',             type: TransactionType.expense, priority: 1, colorHex: '#A78BFA' },
  { id: 'ecdc9428-5e70-4481-a436-7103244d4b18', title: 'Еда вне дома', icon: 'UtensilsCrossed', type: TransactionType.expense, priority: 2, colorHex: '#67E8F9' },
  { id: '4a16fbc4-8bf3-410d-aab9-fb4ef5aad998', title: 'Покупки',     icon: 'ShoppingBag',     type: TransactionType.expense, priority: 3, colorHex: '#60A5FA' },
  { id: '2cd9c601-670d-4a09-a13b-b8524c9f48f5', title: 'Дом',         icon: 'Home',            type: TransactionType.expense, priority: 4, colorHex: '#5AC8FA' },
  { id: '9092d86e-10ec-4b96-9be4-ccce2642b3f4', title: 'Квартплата',  icon: 'Building2',       type: TransactionType.expense, priority: 5, colorHex: '#34D399' },
  { id: '12324a78-2694-49b3-8d8f-95289569c6de', title: 'Медицина',    icon: 'HeartPulse',      type: TransactionType.expense, priority: 6, colorHex: '#818CF8' },
  { id: '84f5eb22-5af5-41a5-9971-dcfb53793fad', title: 'Аптеки',      icon: 'Pill',            type: TransactionType.expense, priority: 7, colorHex: '#5856D6' },
  // Категории доходов
  { id: 'bac8a619-4723-48ff-a448-03057eeb7ff8', title: 'Зарплата',    icon: 'CreditCard',      type: TransactionType.income,  priority: 0, colorHex: '#86EFAC' },
  { id: '42ddc9f4-985e-4896-a040-4e4a5adca5ad', title: 'Инвестиции',  icon: 'Briefcase',       type: TransactionType.income,  priority: 1, colorHex: '#5AC8FA' },
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

        if (oldVersion < 6) {
          const categoryStore = transaction.objectStore('categories');
          const transactionStore = transaction.objectStore('transactions');
          const categories = await categoryStore.getAll();

          // Категория, уже получившая константный id, занимает его: одноимённый дубликат,
          // созданный пользователем вручную, не должен на него претендовать.
          const occupiedDefaultIds = new Set<string>(
            categories.map(category => category.id).filter(id => DEFAULT_CATEGORIES.some(it => it.id === id)),
          );
          const replacedCategoryIds = new Map<string, string>();

          for (const category of categories) {
            const defaultCategory = DEFAULT_CATEGORIES.find(it =>
              it.title === category.title && it.type === category.type && !occupiedDefaultIds.has(it.id),
            );
            if (!defaultCategory) continue;

            occupiedDefaultIds.add(defaultCategory.id);
            replacedCategoryIds.set(category.id, defaultCategory.id);
            await categoryStore.delete(category.id);
            await categoryStore.put({ ...category, id: defaultCategory.id });
          }

          for (const tx of await transactionStore.getAll()) {
            const replacedCategoryId = replacedCategoryIds.get(tx.categoryId);
            if (replacedCategoryId) {
              await transactionStore.put({ ...tx, categoryId: replacedCategoryId });
            }
          }
        }
      },
    });
  }

  return connectionPromise;
}
