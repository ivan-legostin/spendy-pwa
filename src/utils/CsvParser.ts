import { Category } from '../dao/models/Category';
import { Transaction } from '../dao/models/Transaction';
import { TransactionType } from '../dao/models/TransactionType';

export interface CsvParseError {
  line: number;
  message: string;
}

export interface CsvParseResult {
  transactions: Transaction[];
  categories: Category[];
  errors: CsvParseError[];
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

const DATE_PATTERN = /^\d{2}\.\d{2}\.\d{4}$/;

function convertDate(dateStr: string): number {
  const [day, month, year] = dateStr.split('.');
  return Date.UTC(Number(year), Number(month) - 1, Number(day));
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
  const errors: CsvParseError[] = [];

  lines.forEach((line, index) => {
    const lineNumber = index + 2; // +1 за заголовок, +1 за нумерацию с 1
    const [date, title, amount, categoryName, typeStr, note] = parseRow(line);

    if (!categoryName?.trim()) {
      errors.push({ line: lineNumber, message: 'не указана категория' });
      return;
    }

    if (!DATE_PATTERN.test(date)) {
      errors.push({ line: lineNumber, message: `неверный формат даты: "${date}", ожидается ДД.ММ.ГГГГ` });
      return;
    }

    const parsedAmount = parseFloat(amount);
    if (!isFinite(parsedAmount)) {
      errors.push({ line: lineNumber, message: `сумма не является числом: "${amount}"` });
      return;
    }

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
      amount: parsedAmount,
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
    errors,
  };
}
