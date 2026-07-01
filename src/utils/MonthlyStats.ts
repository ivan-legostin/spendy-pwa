import type { Transaction } from '../dao/models/Transaction'
import type { Category } from '../dao/models/Category'
import { TransactionType } from '../dao/models/TransactionType'

/**
 * Суммы доходов и расходов за один месяц.
 */
export interface MonthSums {
  income: number
  expense: number
}

/**
 * Посчитать суммы доходов и расходов по каждому месяцу одного года.
 *
 * @param transactions транзакции года.
 * @param categoryMap категории по идентификатору (для определения типа операции).
 * @returns карта «номер месяца (1–12) → суммы доходов и расходов».
 */
export function calcMonthSums(transactions: Transaction[], categoryMap: Map<string, Category>): Map<number, MonthSums> {
  const sums = new Map<number, MonthSums>()
  for (const tx of transactions) {
    const month = new Date(tx.date).getUTCMonth() + 1
    let entry = sums.get(month)
    if (!entry) {
      entry = { income: 0, expense: 0 }
      sums.set(month, entry)
    }
    if (categoryMap.get(tx.categoryId)?.type === TransactionType.income) entry.income += tx.amount
    else entry.expense += tx.amount
  }
  return sums
}

/**
 * Точка помесячной динамики: итоги одного месяца.
 */
export interface MonthlyDynamicsPoint {
  /** Год месяца (например, 2026). */
  year: number
  /** Номер месяца, 1–12. */
  month: number
  /** Сумма доходов за месяц. */
  income: number
  /** Сумма расходов за месяц. */
  expense: number
  /** Прибыль за месяц: доход минус расход (может быть отрицательной). */
  profit: number
}

/**
 * Построить непрерывный помесячный ряд итогов по всей истории транзакций.
 *
 * Ряд идёт от самого раннего месяца с операциями до самого позднего включительно;
 * месяцы без операций заполняются нулями, чтобы на графике не было разрывов по времени.
 *
 * @param transactions все транзакции.
 * @param categoryMap категории по идентификатору (для определения типа операции).
 * @returns упорядоченный по времени массив помесячных итогов; пустой, если транзакций нет.
 */
export function buildMonthlyDynamicsSeries(
  transactions: Transaction[],
  categoryMap: Map<string, Category>,
): MonthlyDynamicsPoint[] {
  if (transactions.length === 0) return []

  // Порядковый номер месяца (год * 12 + индекс месяца) удобен и для суммирования,
  // и для заполнения пропусков сплошным диапазоном.
  const sumsByOrdinal = new Map<number, MonthSums>()
  let minOrdinal = Infinity
  let maxOrdinal = -Infinity

  for (const tx of transactions) {
    const date = new Date(tx.date)
    const ordinal = date.getUTCFullYear() * 12 + date.getUTCMonth()
    let entry = sumsByOrdinal.get(ordinal)
    if (!entry) {
      entry = { income: 0, expense: 0 }
      sumsByOrdinal.set(ordinal, entry)
    }
    if (categoryMap.get(tx.categoryId)?.type === TransactionType.income) entry.income += tx.amount
    else entry.expense += tx.amount
    if (ordinal < minOrdinal) minOrdinal = ordinal
    if (ordinal > maxOrdinal) maxOrdinal = ordinal
  }

  const series: MonthlyDynamicsPoint[] = []
  for (let ordinal = minOrdinal; ordinal <= maxOrdinal; ordinal++) {
    const sums = sumsByOrdinal.get(ordinal)
    const income = sums?.income ?? 0
    const expense = sums?.expense ?? 0
    series.push({
      year: Math.floor(ordinal / 12),
      month: (ordinal % 12) + 1,
      income,
      expense,
      profit: income - expense,
    })
  }
  return series
}
