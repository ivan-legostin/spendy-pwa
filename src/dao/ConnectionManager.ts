import { openDB, IDBPDatabase, IDBPTransaction } from 'idb';
import { Category } from './models/Category';
import { TransactionType } from './models/TransactionType';

/**
 * Транзакция БД, открытая на запись сразу в несколько хранилищ.
 *
 * Изменение сущности и запись журнала должны попасть в БД атомарно,
 * поэтому транзакцию открывает слой сервисов и передаёт в DAO.
 */
export type ReadWriteTransaction = IDBPTransaction<unknown, string[], 'readwrite'>;

const DB_NAME = 'spendy-db';
const DB_VERSION = 9;

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

/**
 * Инициализированное соединение.
 */
let connectionPromise: Promise<IDBPDatabase> | null = null;

/**
 * Получить соединение с БД.
 *
 * Перед установкой соединения проверяется наличие таблиц в БД и их генерация в случае отсутствия.
 * Хранилище категорий наполняется стандартным набором; транзакции приезжают
 * из журнала изменений при первом обмене.
 *
 * @returns promise, завершающийся единственным экземпляром соединения с БД.
 */
export function getConnection(): Promise<IDBPDatabase> {
  if (!connectionPromise) {
    connectionPromise = openDB(DB_NAME, DB_VERSION, {
      upgrade(connection) {
        if (!connection.objectStoreNames.contains('transactions')) {
          connection.createObjectStore('transactions', { keyPath: 'id' }).createIndex('date', 'date');
        }
        if (!connection.objectStoreNames.contains('categories')) {
          const categoryStore = connection.createObjectStore('categories', { keyPath: 'id' });
          DEFAULT_CATEGORIES.forEach(category => categoryStore.add(category));
        }
        for (const name of ['settings', 'outbox', 'appliedEntries', 'changeLogState']) {
          if (!connection.objectStoreNames.contains(name)) {
            connection.createObjectStore(name, name === 'outbox'
              ? { keyPath: 'sequence', autoIncrement: true }
              : { keyPath: 'key' });
          }
        }
      },
    });
  }

  return connectionPromise;
}
