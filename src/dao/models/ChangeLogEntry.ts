import { ChangeLogEntryType } from './ChangeLogEntryType.ts';
import { Transaction } from './Transaction.ts';

/**
 * Запись журнала изменений.
 */
export interface ChangeLogEntry {
  /**
   * Действие над транзакцией.
   */
  type: ChangeLogEntryType;
  /**
   * Идентификатор транзакции, которой касается запись.
   */
  transactionId: string;
  /**
   * Момент изменения в виде Unix timestamp (миллисекунды).
   * По нему разрешаются конфликты: для каждой транзакции побеждает запись с наибольшим timestamp.
   */
  timestamp: number;
  /**
   * Полный снимок транзакции. Отсутствует у записи об удалении.
   */
  transaction?: Transaction;
}
