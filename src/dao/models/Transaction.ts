/**
 * Финансовая транзакция.
 */
export interface Transaction {
  /**
   * Уникальный идентификатор.
   */
  id: string;
  /**
   * Название транзакции.
   */
  title: string;
  /**
   * Сумма транзакции.
   */
  amount: number;
  /**
   * Дата транзакции в виде Unix timestamp (миллисекунды).
   */
  date: number;
  /**
   * Идентификатор категории.
   */
  categoryId: string;
  /**
   * Комментарий к транзакции.
   */
  note: string;
}
