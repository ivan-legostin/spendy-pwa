import { TransactionType } from './TransactionType';

/**
 * Категория транзакции.
 */
export interface Category {
  /**
   * Уникальный идентификатор.
   */
  id: string;
  /**
   * Название категории.
   */
  title: string;
  /**
   * Название иконки.
   */
  icon: string;
  /**
   * Тип транзакции: расход или доход.
   */
  type: TransactionType;
  /**
   * Порядок отображения в списке.
   */
  priority: number;
  /**
   * Цвет в формате HEX.
   */
  colorHex: string;
}
