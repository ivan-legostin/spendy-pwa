import { Transaction } from '../dao/models/Transaction';
import { Category } from '../dao/models/Category';
import { TransactionType } from '../dao/models/TransactionType';

function formatDate(timestamp: number): string {
  const d = new Date(timestamp);
  const day = String(d.getUTCDate()).padStart(2, '0');
  const month = String(d.getUTCMonth() + 1).padStart(2, '0');
  return `${day}.${month}.${d.getUTCFullYear()}`;
}

/**
 * Сформировать CSV-файл из транзакций и инициировать его скачивание.
 *
 * @param transactions список транзакций для экспорта.
 * @param categories список всех категорий.
 */
export function exportToCsv(transactions: Transaction[], categories: Category[]): void {
  const categoryMap = new Map(categories.map(c => [c.id, c]));
  const sorted = [...transactions].sort((a, b) => b.date - a.date);

  const rows = sorted.map(tx => {
    const category = categoryMap.get(tx.categoryId);
    const type = category?.type === TransactionType.income ? 'Доходы' : 'Расходы';
    return [
      formatDate(tx.date),
      tx.title,
      tx.amount.toFixed(1),
      category?.title ?? '',
      type,
      tx.note ?? '',
    ].map(v => `"${v}"`).join(',');
  });

  const csv = ['Дата,Название,Сумма,Категория,Тип,Комментарий', ...rows].join('\n');

  const today = new Date();
  const yyyy = today.getFullYear();
  const mm = String(today.getMonth() + 1).padStart(2, '0');
  const dd = String(today.getDate()).padStart(2, '0');

  const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8;' }));
  const a = document.createElement('a');
  a.href = url;
  a.download = `spendy_${yyyy}-${mm}-${dd}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}
