import { createContext, useContext } from 'react'
import type { Transaction } from '../dao/models/Transaction'
import type { Category } from '../dao/models/Category'

/**
 * Данные текущего года, загружаемые один раз на главном экране и доступные
 * вложенным компонентам (например, month-picker) без проброса через пропсы.
 */
export interface CurrentYearData {
  /** Текущий год (например, 2026). */
  year: number
  /** Все транзакции за текущий год, поддерживаемые в актуальном состоянии. */
  transactions: Transaction[]
  /** Все категории. */
  categories: Category[]
}

const CurrentYearDataContext = createContext<CurrentYearData | null>(null)

export default CurrentYearDataContext

/**
 * Получить данные текущего года из контекста.
 *
 * @returns транзакции текущего года и категории.
 * @throws если вызвано вне CurrentYearDataContext.Provider.
 */
export function useCurrentYearData(): CurrentYearData {
  const data = useContext(CurrentYearDataContext)
  if (!data) {
    throw new Error('useCurrentYearData должен использоваться внутри CurrentYearDataContext.Provider')
  }
  return data
}
