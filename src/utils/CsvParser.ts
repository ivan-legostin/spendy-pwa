import { Category } from '../dao/models/Category';
import { Transaction } from '../dao/models/Transaction';
import { TransactionType } from '../dao/models/TransactionType';

export interface CsvParseResult {
  transactions: Transaction[];
  categories: Category[];
}

const CATEGORY_COLORS = [
  '#F9E4B7', '#D4EDD4', '#E0D4F5', '#FFD6D6', '#D4EAF5',
  '#F5E6D4', '#D4F5F0', '#F5D4E8', '#E8F5D4', '#D4D4F5',
];

function parseRow(line: string): string[] {
  const result: string[] = [];
  let current = '';
  let insideQuote = false;

  for (const char of line) {
    if (char === '"') {
      insideQuote = !insideQuote;
    } else if (char === ',' && !insideQuote) {
      result.push(current);
      current = '';
    } else {
      current += char;
    }
  }
  result.push(current);
  return result;
}

function convertDate(dateStr: string): string {
  const [day, month, year] = dateStr.split('.');
  return `${year}-${month}-${day}`;
}

/**
 * Разобрать текст CSV и вернуть транзакции и категории.
 * Если при разборе найдена категория, которая отсутствует в БД, она будет создана.
 *
 * @param csvText текст CSV-файла в формате: Дата, Название, Сумма, Категория, Тип, Комментарий.
 * @param existingCategories категории, уже сохранённые в БД, для поиска по названию.
 * @returns транзакции и новые категории.
 */
export function parseCsv(csvText: string, existingCategories: Category[]): CsvParseResult {
  const lines = csvText.trim().split('\n').slice(1);

  const categoryMap = new Map<string, Category>();
  const transactions: Transaction[] = [];

  lines.forEach((line) => {
    const [date, title, amount, categoryName, typeStr, note] = parseRow(line);
    const type = typeStr === 'Доходы' ? TransactionType.income : TransactionType.expense;

    if (!categoryMap.has(categoryName)) {
      const existing = existingCategories.find(c => c.title === categoryName);
      categoryMap.set(categoryName, existing ?? {
        id: crypto.randomUUID(),
        title: categoryName,
        icon: '',
        type,
        priority: categoryMap.size + 1,
        colorHex: CATEGORY_COLORS[categoryMap.size % CATEGORY_COLORS.length],
      });
    }

    const category = categoryMap.get(categoryName)!;

    transactions.push({
      id: crypto.randomUUID(),
      title,
      amount: parseFloat(amount),
      date: convertDate(date),
      categoryId: category.id,
      note,
    });
  });

  const newCategories = Array.from(categoryMap.values())
    .filter(c => !existingCategories.some(e => e.id === c.id));

  return {
    transactions,
    categories: newCategories,
  };
}
