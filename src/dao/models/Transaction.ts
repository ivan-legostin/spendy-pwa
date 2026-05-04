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
   * Дата транзакции в формате YYYY-MM-DD.
   */
  date: string;
  /**
   * Идентификатор категории.
   */
  categoryId: string;
  /**
   * Комментарий к транзакции.
   */
  note: string;
}
