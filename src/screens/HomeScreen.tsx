import { useEffect, useMemo, useRef, useState, type FormEvent, type ReactNode } from 'react'
import { PieChart, Pie, ResponsiveContainer } from 'recharts'
import * as Icons from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import type { Transaction } from '../dao/models/Transaction'
import type { Category } from '../dao/models/Category'
import { TransactionType } from '../dao/models/TransactionType'
import { getTransactionsByMonth, getTransactionsByPeriod, deleteTransaction, updateTransaction } from '../dao/service/TransactionDaoService'
import { getAllCategories } from '../dao/service/CategoryDaoService'
import CurrentYearDataContext, { useCurrentYearData } from '../context/CurrentYearDataContext'
import BottomSheet, { type BottomSheetHandle } from '../components/BottomSheet'
import './HomeScreen.css'

function formatAmount(amount: number, type: TransactionType): string {
  const formatted = amount.toLocaleString('ru-RU')
  return type === TransactionType.expense ? `-${formatted} ₽` : `+${formatted} ₽`
}

/**
 * Компактное представление суммы для тесных мест (ячейка month-picker).
 * Например: 12 345 → «12к», 1 234 567 → «1,2м».
 */
function formatCompactAmount(value: number): string {
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1).replace('.', ',')}м`
  if (value >= 10_000) return `${Math.round(value / 1000)}к`
  if (value >= 1_000) return `${(value / 1000).toFixed(1).replace('.', ',')}к`
  return value.toLocaleString('ru-RU')
}

function formatDate(timestamp: number): string {
  return new Date(timestamp).toLocaleDateString('ru-RU', {
    day: 'numeric', month: 'long',
  })
}


/**
 * Элемент с суммой расходов и доходов.
 * @param income сумма доходов.
 * @param spent сумма расходов.
 * @param onExpenseClick обработчик нажатия на плитку трат.
 * @param onIncomeClick обработчик нажатия на плитку доходов.
 */
function SummaryCard({ income, spent, onExpenseClick, onIncomeClick }: Readonly<{
  income: number
  spent: number
  onExpenseClick: () => void
  onIncomeClick: () => void
}>) {
  return (
    <div className="summary-card">
      <button type="button" className="summary-card__tile summary-card__tile--clickable" onClick={onExpenseClick}>
        <span className="summary-card__value">{spent.toLocaleString('ru-RU')} ₽</span>
        <div className="summary-card__footer">
          <span className="summary-card__label">Траты</span>
          <Icons.ChevronRight size={14} className="summary-card__chevron" />
        </div>
      </button>
      <button type="button" className="summary-card__tile summary-card__tile--clickable" onClick={onIncomeClick}>
        <span className="summary-card__value">{income.toLocaleString('ru-RU')} ₽</span>
        <div className="summary-card__footer">
          <span className="summary-card__label">Доходы</span>
          <Icons.ChevronRight size={14} className="summary-card__chevron" />
        </div>
      </button>
    </div>
  )
}

const MONTH_NAMES = ['Янв', 'Фев', 'Мар', 'Апр', 'Май', 'Июн', 'Июл', 'Авг', 'Сен', 'Окт', 'Ноя', 'Дек']

interface MonthSums {
  income: number
  expense: number
}

/**
 * Посчитать суммы доходов и расходов по каждому месяцу года.
 *
 * @param transactions транзакции года.
 * @param categoryMap категории по идентификатору (для определения типа операции).
 * @returns карта «номер месяца (1–12) → суммы доходов и расходов».
 */
function calcMonthSums(transactions: Transaction[], categoryMap: Map<string, Category>): Map<number, MonthSums> {
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

function MonthPickerSheet({ year, month, onClose, onChange }: Readonly<{
  year: number
  month: number
  onClose: () => void
  onChange: (year: number, month: number) => void
}>) {
  const now = new Date()
  const [pickerYear, setPickerYear] = useState(year)
  const { year: currentYear, transactions: currentYearTransactions, categories } = useCurrentYearData()
  const [otherYearTransactions, setOtherYearTransactions] = useState<Transaction[]>([])

  // Транзакции текущего года берём из общих данных, остальные годы догружаем.
  const isCurrentYear = pickerYear === currentYear
  useEffect(() => {
    if (isCurrentYear) return
    let cancelled = false
    getTransactionsByPeriod(pickerYear, 1, pickerYear, 12).then(txs => {
      if (!cancelled) setOtherYearTransactions(txs)
    })
    return () => { cancelled = true }
  }, [pickerYear, isCurrentYear])

  const yearTransactions = isCurrentYear ? currentYearTransactions : otherYearTransactions
  const categoryMap = useMemo(() => new Map(categories.map(c => [c.id, c])), [categories])
  const monthSums = useMemo(() => calcMonthSums(yearTransactions, categoryMap), [yearTransactions, categoryMap])

  return (
    <BottomSheet withBackdrop zIndex={120} ariaLabel="Выбор месяца" onClose={onClose} className="month-picker-sheet">
      <div className="month-picker__header">
        <button type="button" className="month-picker__arrow" onClick={() => setPickerYear(y => y - 1)}>‹</button>
        <span className="month-picker__year">{pickerYear}</span>
        <button
          type="button"
          className="month-picker__arrow"
          onClick={() => setPickerYear(y => y + 1)}
          disabled={pickerYear >= now.getFullYear()}
        >›</button>
      </div>
      <div className="month-picker__grid">
        {MONTH_NAMES.map((name, i) => {
          const m = i + 1
          const isSelected = pickerYear === year && m === month
          const isDisabled = pickerYear > now.getFullYear() || (pickerYear === now.getFullYear() && m > now.getMonth() + 1)
          const sums = monthSums.get(m)
          return (
            <button
              key={m}
              type="button"
              className={`month-picker__cell${isSelected ? ' month-picker__cell--selected' : ''}`}
              disabled={isDisabled}
              onClick={() => { onChange(pickerYear, m); onClose() }}
            >
              <span className="month-picker__cell-name">{name}</span>
              {sums && (sums.expense > 0 || sums.income > 0) && (
                <span className="month-picker__cell-sums">
                  {sums.income > 0 && (
                      <span className="month-picker__cell-sum month-picker__cell-sum--income">+{formatCompactAmount(sums.income)}</span>
                  )}
                  {sums.expense > 0 && (
                    <span className="month-picker__cell-sum month-picker__cell-sum--expense">−{formatCompactAmount(sums.expense)}</span>
                  )}
                </span>
              )}
            </button>
          )
        })}
      </div>
    </BottomSheet>
  )
}

function MonthSelector({ year, month, onChange }: Readonly<{
  year: number
  month: number
  onChange: (year: number, month: number) => void
}>) {
  const [open, setOpen] = useState(false)
  const label = new Date(year, month - 1, 1).toLocaleDateString('ru-RU', { month: 'long', year: 'numeric' })

  return (
    <>
      <button type="button" className="month-selector" onClick={() => setOpen(true)}>
        <span className="month-selector__label">{label}</span>
        <Icons.ChevronDown size={14} className="month-selector__chevron" />
      </button>
      {open && (
        <MonthPickerSheet
          year={year}
          month={month}
          onClose={() => setOpen(false)}
          onChange={onChange}
        />
      )}
    </>
  )
}

/**
 * Элемент транзакции в списке операций.
 *
 * @param transaction модель транзакции из БД.
 * @param category модель категории из БД.
 * @param onClick обработчик нажатия на элемент.
 */
function TransactionItem({ transaction, category, onClick }: Readonly<{
  transaction: Transaction
  category: Category | undefined
  onClick?: () => void
}>) {
  const Icon = (Icons[category?.icon as keyof typeof Icons] as LucideIcon | undefined) ?? Icons.CreditCard
  const type = category?.type ?? TransactionType.expense

  return (
    <button
      type="button"
      className={`transaction-item${onClick ? ' transaction-item--clickable' : ''}`}
      onClick={onClick}
    >
      <div className="transaction-item__icon">
        <Icon size={24}/>
      </div>
      <div className="transaction-item__info">
        <span className="transaction-item__title">{category?.title ?? '—'}</span>
        <span className="transaction-item__category">{transaction.note}</span>
      </div>
      <div className="transaction-item__right">
        <span className={`transaction-item__amount transaction-item__amount--${type}`}>{formatAmount(transaction.amount, type)}</span>
      </div>
    </button>
  )
}

function EditTransactionSheet({ transaction, categories, onClose, onSave }: Readonly<{
  transaction: Transaction
  categories: Category[]
  onClose: () => void
  onSave: (tx: Transaction) => void
}>) {
  const sheetRef = useRef<BottomSheetHandle>(null)
  const [amount, setAmount] = useState(String(transaction.amount))
  const [date, setDate] = useState(new Date(transaction.date).toLocaleDateString('en-CA'))
  const [categoryId, setCategoryId] = useState(transaction.categoryId)
  const [note, setNote] = useState(transaction.note)

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const updated: Transaction = { ...transaction, amount: Number(amount), date: new Date(date + 'T00:00:00.000Z').getTime(), categoryId, note }
    await updateTransaction(updated)
    onSave(updated)
  }

  return (
    <>
      <div aria-hidden="true" className="tx-sheet-overlay tx-sheet-overlay--top" onClick={() => sheetRef.current?.close()} />
      <BottomSheet ref={sheetRef} withBackdrop zIndex={104} ariaLabel="Редактировать операцию" onClose={onClose} className="edit-tx-sheet">
      <form className="edit-tx-sheet__form" onSubmit={handleSubmit}>
        <h2 className="edit-tx-sheet__title">Редактировать</h2>
        <div className="edit-tx-sheet__field">
          <label className="edit-tx-sheet__label" htmlFor="edit-amount">Сумма</label>
          <input
            id="edit-amount"
            className="edit-tx-sheet__input"
            type="number"
            inputMode="decimal"
            min="0"
            step="0.01"
            value={amount}
            onChange={e => setAmount(e.target.value)}
            required
          />
        </div>
        <div className="edit-tx-sheet__field">
          <label className="edit-tx-sheet__label" htmlFor="edit-date">Дата</label>
          <input
            id="edit-date"
            className="edit-tx-sheet__input"
            type="date"
            value={date}
            onChange={e => setDate(e.target.value)}
            required
          />
        </div>
        <div className="edit-tx-sheet__field">
          <label className="edit-tx-sheet__label" htmlFor="edit-category">Категория</label>
          <select
            id="edit-category"
            className="edit-tx-sheet__input"
            value={categoryId}
            onChange={e => setCategoryId(e.target.value)}
          >
            {categories.map(cat => (
              <option key={cat.id} value={cat.id}>{cat.title}</option>
            ))}
          </select>
        </div>
        <div className="edit-tx-sheet__field">
          <label className="edit-tx-sheet__label" htmlFor="edit-note">Заметка</label>
          <input
            id="edit-note"
            className="edit-tx-sheet__input"
            type="text"
            value={note}
            onChange={e => setNote(e.target.value)}
          />
        </div>
        <div className="edit-tx-sheet__footer">
          <button type="button" className="edit-tx-sheet__btn edit-tx-sheet__btn--cancel" onClick={onClose}>
            Отмена
          </button>
          <button type="submit" className="edit-tx-sheet__btn edit-tx-sheet__btn--save">
            Сохранить
          </button>
        </div>
      </form>
      </BottomSheet>
    </>
  )
}

function TransactionDetailSheet({ transaction, category, categories, onClose, onDeleted, onUpdated }: Readonly<{
  transaction: Transaction
  category: Category | undefined
  categories: Category[]
  onClose: () => void
  onDeleted: (id: string) => void
  onUpdated: (tx: Transaction) => void
}>) {
  const [isEditing, setIsEditing] = useState(false)

  const Icon = (Icons[category?.icon as keyof typeof Icons] as LucideIcon | undefined) ?? Icons.CreditCard
  const type = category?.type ?? TransactionType.expense

  const handleDelete = async () => {
    await deleteTransaction(transaction.id)
    onDeleted(transaction.id)
    onClose()
  }

  return (
    <>
      <BottomSheet withBackdrop zIndex={102} ariaLabel="Детали операции" onClose={onClose} className="tx-detail-sheet">
        <div className="tx-detail-sheet__content">
          <div className="tx-detail-sheet__header">
            <div className="transaction-item__icon">
              <Icon size={24} />
            </div>
            <div className="tx-detail-sheet__header-info">
              <span className="tx-detail-sheet__category">{category?.title ?? '—'}</span>
              {transaction.note && (
                <span className="tx-detail-sheet__note">{transaction.note}</span>
              )}
            </div>
            <span className={`tx-detail-sheet__amount tx-detail-sheet__amount--${type}`}>
              {formatAmount(transaction.amount, type)}
            </span>
          </div>
          <div className="tx-detail-sheet__actions">
            <button className="tx-detail-sheet__btn tx-detail-sheet__btn--edit" onClick={() => setIsEditing(true)}>
              Редактировать
            </button>
            <button className="tx-detail-sheet__btn tx-detail-sheet__btn--delete" onClick={handleDelete}>
              Удалить
            </button>
          </div>
        </div>
      </BottomSheet>
      {isEditing && (
        <EditTransactionSheet
          transaction={transaction}
          categories={categories}
          onClose={() => setIsEditing(false)}
          onSave={(updated) => {
            onUpdated(updated)
            onClose()
          }}
        />
      )}
    </>
  )
}


function CategoryBreakdownSheet({ type, categories, onClose, onDeleted, onUpdated }: Readonly<{
  type: TransactionType
  categories: Category[]
  onClose: () => void
  onDeleted: (id: string) => void
  onUpdated: (tx: Transaction) => void
}>) {
  const now = new Date()
  const [selectedYear, setSelectedYear] = useState(now.getFullYear())
  const [selectedMonth, setSelectedMonth] = useState(now.getMonth() + 1)
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedTx, setSelectedTx] = useState<Transaction | null>(null)
  const [activeCategory, setActiveCategory] = useState<string | null>(null)
  const listRef = useRef<HTMLDivElement>(null)
  const categoryRefs = useRef(new Map<string, HTMLDivElement>())

  const categoryMap = new Map(categories.map(c => [c.id, c]))

  useEffect(() => {
    setLoading(true)
    getTransactionsByMonth(selectedYear, selectedMonth).then(txs => {
      setTransactions(txs)
      setLoading(false)
    })
  }, [selectedYear, selectedMonth])

  const filtered = transactions.filter(tx => categoryMap.get(tx.categoryId)?.type === type)

  const grouped = new Map<string, { category: Category | undefined; txs: Transaction[] }>()
  for (const tx of filtered) {
    if (!grouped.has(tx.categoryId)) {
      grouped.set(tx.categoryId, { category: categoryMap.get(tx.categoryId), txs: [] })
    }
    grouped.get(tx.categoryId)!.txs.push(tx)
  }

  const groupedEntries = [...grouped.entries()]
    .sort((a, b) =>
      b[1].txs.reduce((s, t) => s + t.amount, 0) - a[1].txs.reduce((s, t) => s + t.amount, 0)
    )

  const total = filtered.reduce((s, t) => s + t.amount, 0)

  const chartData = groupedEntries.map(([catId, { category, txs }]) => ({
    name: category?.title ?? '—',
    value: txs.reduce((s, t) => s + t.amount, 0),
    categoryId: catId,
    fill: category?.colorHex ?? '#2D7FF9',
  }))

  const scrollToCategory = (categoryId: string) => {
    categoryRefs.current.get(categoryId)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    setActiveCategory(categoryId)
    setTimeout(() => setActiveCategory(id => id === categoryId ? null : id), 1500)
  }

  const title = type === TransactionType.expense ? 'Траты' : 'Доходы'

  const categoriesSection = (
    <div className="breakdown-sheet__categories">
      {groupedEntries.map(([catId, { category, txs }]) => {
        const catTotal = txs.reduce((s, t) => s + t.amount, 0)
        const Icon = (Icons[category?.icon as keyof typeof Icons] as LucideIcon | undefined) ?? Icons.CreditCard
        return (
          <div
            key={catId}
            className={`breakdown-cat${activeCategory === catId ? ' breakdown-cat--active' : ''}`}
            ref={el => { if (el) categoryRefs.current.set(catId, el); else categoryRefs.current.delete(catId) }}
          >
            <div className="breakdown-cat__header">
              <div className="breakdown-cat__icon">
                <Icon size={18} />
              </div>
              <span className="breakdown-cat__name">{category?.title ?? '—'}</span>
              <span className={`breakdown-cat__total breakdown-cat__total--${type}`}>
                {formatAmount(catTotal, type)}
              </span>
            </div>
            {[...txs].sort((a, b) => b.date - a.date).map(tx => (
              <button
                key={tx.id}
                type="button"
                className="breakdown-tx-item"
                onClick={() => setSelectedTx(tx)}
              >
                <div className="breakdown-tx-item__left">
                  <span className="breakdown-tx-item__date">{formatDate(tx.date)}</span>
                  {tx.note && <span className="breakdown-tx-item__note">{tx.note}</span>}
                </div>
                <span className={`breakdown-tx-item__amount breakdown-tx-item__amount--${type}`}>
                  {formatAmount(tx.amount, type)}
                </span>
              </button>
            ))}
          </div>
        )
      })}
    </div>
  )

  const renderContent = () => {
    if (loading) {
      return (
        <div className="breakdown-sheet__loading">
          <Icons.Loader2 size={24} className="breakdown-sheet__spinner" />
        </div>
      )
    }
    if (chartData.length === 0) {
      return <div className="breakdown-sheet__empty">Нет операций за этот период</div>
    }
    return (
      <>
        <div className="breakdown-sheet__chart">
          <div className="breakdown-sheet__donut-wrap">
            <ResponsiveContainer width="100%" height={220}>
              <PieChart>
                <Pie
                  data={chartData}
                  dataKey="value"
                  innerRadius={70}
                  outerRadius={100}
                  paddingAngle={2}
                  startAngle={90}
                  endAngle={-270}
                  onClick={(_, index) => scrollToCategory(chartData[index].categoryId)}
                  cursor="pointer"
                  strokeWidth={0}
                />
              </PieChart>
            </ResponsiveContainer>
            <div className="breakdown-sheet__donut-center" aria-hidden="true">
              <span className="breakdown-sheet__donut-total">{total.toLocaleString('ru-RU')} ₽</span>
              <span className="breakdown-sheet__donut-label">{title.toLowerCase()}</span>
            </div>
          </div>
          <div className="breakdown-sheet__legend">
            {chartData.map(entry => (
              <button
                key={entry.categoryId}
                type="button"
                className="breakdown-sheet__legend-item"
                onClick={() => scrollToCategory(entry.categoryId)}
              >
                <span className="breakdown-sheet__legend-dot" style={{ background: entry.fill }} />
                <span className="breakdown-sheet__legend-name">{entry.name}</span>
                <span className="breakdown-sheet__legend-pct">
                  {total > 0 ? Math.round((entry.value / total) * 100) : 0}%
                </span>
              </button>
            ))}
          </div>
        </div>
        {categoriesSection}
      </>
    )
  }

  return (
    <>
      <BottomSheet withBackdrop ariaLabel={title} onClose={onClose} scrollableRef={listRef} className="breakdown-sheet">
        <div className="breakdown-sheet__header">
          <h2 className="breakdown-sheet__title">{title}</h2>
          <MonthSelector
            year={selectedYear}
            month={selectedMonth}
            onChange={(y, m) => { setSelectedYear(y); setSelectedMonth(m) }}
          />
        </div>
        <div className="breakdown-sheet__scroll" ref={listRef} data-scroll="true">
          {renderContent()}
        </div>
      </BottomSheet>
      {selectedTx && (
        <TransactionDetailSheet
          transaction={selectedTx}
          category={categoryMap.get(selectedTx.categoryId)}
          categories={categories}
          onClose={() => setSelectedTx(null)}
          onDeleted={id => {
            setTransactions(prev => prev.filter(tx => tx.id !== id))
            setSelectedTx(null)
            onDeleted(id)
          }}
          onUpdated={tx => {
            setTransactions(prev => prev.map(t => t.id === tx.id ? tx : t))
            setSelectedTx(null)
            onUpdated(tx)
          }}
        />
      )}
    </>
  )
}

function isPeriodValid(p: { fromYear: number; fromMonth: number; toYear: number; toMonth: number }): boolean {
  return p.toYear > p.fromYear || (p.toYear === p.fromYear && p.toMonth >= p.fromMonth)
}

interface PeriodStats {
  income: number
  expense: number
}

function calcStats(txs: Transaction[], categoryMap: Map<string, Category>): PeriodStats {
  let income = 0, expense = 0
  for (const tx of txs) {
    if (categoryMap.get(tx.categoryId)?.type === TransactionType.income) income += tx.amount
    else expense += tx.amount
  }
  return { income, expense }
}

function formatPeriodLabel(fromYear: number, fromMonth: number, toYear: number, toMonth: number): string {
  const from = new Date(fromYear, fromMonth - 1, 1).toLocaleDateString('ru-RU', { month: 'short', year: 'numeric' })
  if (fromYear === toYear && fromMonth === toMonth) return from
  const to = new Date(toYear, toMonth - 1, 1).toLocaleDateString('ru-RU', { month: 'short', year: 'numeric' })
  return `${from} — ${to}`
}

function formatDelta(a: number, b: number): string {
  const delta = b - a
  if (delta === 0) return '—'
  const sign = delta > 0 ? '+' : '−'
  const abs = Math.abs(delta).toLocaleString('ru-RU')
  if (a === 0) return `${sign}${abs} ₽`
  const pct = Math.round(Math.abs(delta / a) * 100)
  return `${sign}${abs} ₽ / ${sign}${pct}%`
}

function ComparisonMetric({ icon, label, labelA, labelB, a, b, positiveWhenHigher }: Readonly<{
  icon: ReactNode
  label: string
  labelA: string
  labelB: string
  a: number
  b: number
  positiveWhenHigher: boolean
}>) {
  const delta = b - a
  const isPositive = positiveWhenHigher ? delta > 0 : delta < 0
  const sign = isPositive ? 'pos' : 'neg'
  const deltaClass = delta !== 0 ? ` comparison-metric__delta--${sign}` : ''
  return (
    <div className="comparison-metric">
      <div className="comparison-metric__header">
        <div className="comparison-metric__label-wrap">
          <div className="comparison-metric__icon">{icon}</div>
          <span className="comparison-metric__label">{label}</span>
        </div>
        <span className={`comparison-metric__delta${deltaClass}`}>{formatDelta(a, b)}</span>
      </div>
      <div className="comparison-metric__period-row">
        <span className="comparison-metric__period-label">{labelA}</span>
        <span className="comparison-metric__value">{a.toLocaleString('ru-RU')} ₽</span>
      </div>
      <div className="comparison-metric__period-row">
        <span className="comparison-metric__period-label">{labelB}</span>
        <span className="comparison-metric__value">{b.toLocaleString('ru-RU')} ₽</span>
      </div>
    </div>
  )
}


function AnalyticsBlockCard({ icon, title, subtitle, onClick }: Readonly<{
  icon: ReactNode
  title: string
  subtitle: string
  onClick: () => void
}>) {
  return (
    <button type="button" className="analytics-block" onClick={onClick}>
      <div className="analytics-block__icon">{icon}</div>
      <div className="analytics-block__info">
        <span className="analytics-block__title">{title}</span>
        <span className="analytics-block__subtitle">{subtitle}</span>
      </div>
      <Icons.ChevronRight size={18} className="analytics-block__chevron" />
    </button>
  )
}

function ComparisonSheet({ categories, onClose }: Readonly<{
  categories: Category[]
  onClose: () => void
}>) {
  const now = new Date()
  const scrollRef = useRef<HTMLDivElement>(null)
  const [periodA, setPeriodA] = useState({
    fromYear: now.getFullYear() - 1, fromMonth: 1,
    toYear: now.getFullYear() - 1, toMonth: now.getMonth() + 1,
  })
  const [periodB, setPeriodB] = useState({
    fromYear: now.getFullYear(), fromMonth: 1,
    toYear: now.getFullYear(), toMonth: now.getMonth() + 1,
  })
  const [statsA, setStatsA] = useState<PeriodStats | null>(null)
  const [statsB, setStatsB] = useState<PeriodStats | null>(null)
  const [loading, setLoading] = useState(true)
  const categoryMap = useMemo(() => new Map(categories.map(c => [c.id, c])), [categories])

  useEffect(() => {
    if (!isPeriodValid(periodA) || !isPeriodValid(periodB)) return
    setLoading(true)
    Promise.all([
      getTransactionsByPeriod(periodA.fromYear, periodA.fromMonth, periodA.toYear, periodA.toMonth),
      getTransactionsByPeriod(periodB.fromYear, periodB.fromMonth, periodB.toYear, periodB.toMonth),
    ]).then(([txsA, txsB]) => {
      setStatsA(calcStats(txsA, categoryMap))
      setStatsB(calcStats(txsB, categoryMap))
      setLoading(false)
    })
  }, [periodA, periodB, categoryMap])

  const bothValid = isPeriodValid(periodA) && isPeriodValid(periodB)

  const labelA = formatPeriodLabel(periodA.fromYear, periodA.fromMonth, periodA.toYear, periodA.toMonth)
  const labelB = formatPeriodLabel(periodB.fromYear, periodB.fromMonth, periodB.toYear, periodB.toMonth)

  return (
    <BottomSheet withBackdrop zIndex={102} ariaLabel="Сравнение периодов" onClose={onClose} scrollableRef={scrollRef} className="comparison-sheet">
      <div className="comparison-sheet__header">
        <h2 className="comparison-sheet__title">Сравнение периодов</h2>
      </div>
      <div className="comparison-sheet__scroll" ref={scrollRef} data-scroll="true">
        <div className="comparison-periods">
          <div className="comparison-period-card">
            <span className="comparison-period-card__label">Период А</span>
            <div className="comparison-period-card__selectors">
              <MonthSelector year={periodA.fromYear} month={periodA.fromMonth} onChange={(y, m) => setPeriodA(p => ({ ...p, fromYear: y, fromMonth: m }))} />
              <Icons.ArrowRight size={14} className="comparison-period-card__arrow" />
              <MonthSelector year={periodA.toYear} month={periodA.toMonth} onChange={(y, m) => setPeriodA(p => ({ ...p, toYear: y, toMonth: m }))} />
            </div>
          </div>
          <div className="comparison-period-card">
            <span className="comparison-period-card__label">Период Б</span>
            <div className="comparison-period-card__selectors">
              <MonthSelector year={periodB.fromYear} month={periodB.fromMonth} onChange={(y, m) => setPeriodB(p => ({ ...p, fromYear: y, fromMonth: m }))} />
              <Icons.ArrowRight size={14} className="comparison-period-card__arrow" />
              <MonthSelector year={periodB.toYear} month={periodB.toMonth} onChange={(y, m) => setPeriodB(p => ({ ...p, toYear: y, toMonth: m }))} />
            </div>
          </div>
        </div>
        {!bothValid && (
          <p className="comparison-sheet__error">Конечная дата не может быть раньше начальной</p>
        )}
        {bothValid && loading && (
          <div className="comparison-sheet__loading">
            <Icons.Loader2 size={24} className="breakdown-sheet__spinner" />
          </div>
        )}
        {bothValid && !loading && statsA && statsB && (
          <div className="comparison-results">
            <ComparisonMetric icon={<Icons.TrendingUp size={16} />} label="Доходы" labelA={labelA} labelB={labelB} a={statsA.income} b={statsB.income} positiveWhenHigher={true} />
            <ComparisonMetric icon={<Icons.TrendingDown size={16} />} label="Траты" labelA={labelA} labelB={labelB} a={statsA.expense} b={statsB.expense} positiveWhenHigher={false} />
            <ComparisonMetric icon={<Icons.Wallet size={16} />} label="Баланс" labelA={labelA} labelB={labelB} a={statsA.income - statsA.expense} b={statsB.income - statsB.expense} positiveWhenHigher={true} />
          </div>
        )}
      </div>
    </BottomSheet>
  )
}

function YearSelector({ year, onChange }: Readonly<{ year: number; onChange: (year: number) => void }>) {
  const maxYear = new Date().getFullYear()
  return (
    <div className="year-selector">
      <button type="button" className="year-selector__arrow" onClick={() => onChange(year - 1)}>‹</button>
      <span className="year-selector__label">{year}</span>
      <button type="button" className="year-selector__arrow" disabled={year >= maxYear} onClick={() => onChange(year + 1)}>›</button>
    </div>
  )
}

function TopTransactionsSheet({ categories, onClose }: Readonly<{
  categories: Category[]
  onClose: () => void
}>) {
  const scrollRef = useRef<HTMLDivElement>(null)
  const [year, setYear] = useState(new Date().getFullYear())
  const [allExpenses, setAllExpenses] = useState<Transaction[]>([])
  const [excludedCategories, setExcludedCategories] = useState<Set<string>>(new Set())
  const [filterOpen, setFilterOpen] = useState(false)
  const [loading, setLoading] = useState(true)
  const [selectedTx, setSelectedTx] = useState<Transaction | null>(null)
  const categoryMap = useMemo(() => new Map(categories.map(c => [c.id, c])), [categories])

  useEffect(() => {
    setLoading(true)
    setExcludedCategories(new Set())
    getTransactionsByPeriod(year, 1, year, 12).then(txs => {
      setAllExpenses(txs.filter(tx => categoryMap.get(tx.categoryId)?.type === TransactionType.expense))
      setLoading(false)
    })
  }, [year, categoryMap])

  const availableCategories = useMemo(() => {
    const seen = new Set<string>()
    const result: Category[] = []
    for (const tx of allExpenses) {
      if (!seen.has(tx.categoryId)) {
        seen.add(tx.categoryId)
        const cat = categoryMap.get(tx.categoryId)
        if (cat) result.push(cat)
      }
    }
    return result
  }, [allExpenses, categoryMap])

  const topTransactions = useMemo(() =>
    allExpenses
      .filter(tx => !excludedCategories.has(tx.categoryId))
      .sort((a, b) => b.amount - a.amount)
      .slice(0, 10),
    [allExpenses, excludedCategories]
  )

  const toggleCategory = (id: string) =>
    setExcludedCategories(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id); else next.add(id)
      return next
    })

  const renderContent = () => {
    if (loading) {
      return (
        <div className="comparison-sheet__loading">
          <Icons.Loader2 size={24} className="breakdown-sheet__spinner" />
        </div>
      )
    }
    if (allExpenses.length === 0) {
      return <div className="breakdown-sheet__empty">Нет операций за этот период</div>
    }
    if (topTransactions.length === 0) {
      return <div className="breakdown-sheet__empty">Все категории скрыты фильтром</div>
    }
    return (
      <div className="top-tx-list" ref={scrollRef} data-scroll="true">
        {topTransactions.map((tx, i) => {
          const category = categoryMap.get(tx.categoryId)
          const Icon = (Icons[category?.icon as keyof typeof Icons] as LucideIcon | undefined) ?? Icons.CreditCard
          const type = category?.type ?? TransactionType.expense
          return (
            <button key={tx.id} type="button" className="top-tx-item" onClick={() => setSelectedTx(tx)}>
              <span className="top-tx-item__rank">#{i + 1}</span>
              <div className="top-tx-item__icon">
                <Icon size={20} />
              </div>
              <div className="top-tx-item__info">
                <span className="top-tx-item__category">{category?.title ?? '—'}</span>
                {tx.note && <span className="top-tx-item__note">{tx.note}</span>}
              </div>
              <div className="top-tx-item__right">
                <span className={`top-tx-item__amount top-tx-item__amount--${type}`}>
                  {formatAmount(tx.amount, type)}
                </span>
                <span className="top-tx-item__date">{formatDate(tx.date)}</span>
              </div>
            </button>
          )
        })}
      </div>
    )
  }

  return (
    <>
      <BottomSheet withBackdrop zIndex={102} ariaLabel="Топ 10 трат" onClose={onClose} scrollableRef={scrollRef} className="top-tx-sheet">
        <div className="top-tx-sheet__header">
          <h2 className="top-tx-sheet__title">Топ 10 трат</h2>
          <div className="top-tx-sheet__controls">
            <YearSelector year={year} onChange={setYear} />
            <div className="top-tx-filter-wrap">
              {availableCategories.length > 0 && (
                <button
                  type="button"
                  className={`top-tx-filter-btn${excludedCategories.size > 0 ? ' top-tx-filter-btn--active' : ''}`}
                  onClick={() => setFilterOpen(o => !o)}
                >
                  <Icons.SlidersHorizontal size={15} />
                  {excludedCategories.size > 0 && (
                    <span className="top-tx-filter-badge">
                      {availableCategories.length - excludedCategories.size}/{availableCategories.length}
                    </span>
                  )}
                </button>
              )}
              {filterOpen && (
                <>
                  <div aria-hidden="true" className="top-tx-dropdown-overlay" onClick={() => setFilterOpen(false)} />
                  <div className="top-tx-dropdown">
                    {availableCategories.map(cat => {
                      const Icon = (Icons[cat.icon as keyof typeof Icons] as LucideIcon | undefined) ?? Icons.CreditCard
                      const isActive = !excludedCategories.has(cat.id)
                      return (
                        <button key={cat.id} type="button" className="top-tx-dropdown-item" onClick={() => toggleCategory(cat.id)}>
                          <Icon size={15} />
                          <span className="top-tx-dropdown-item__name">{cat.title}</span>
                          {isActive && <Icons.Check size={15} className="top-tx-dropdown-item__check" />}
                        </button>
                      )
                    })}
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
        {renderContent()}
      </BottomSheet>
      {selectedTx && (
        <TransactionDetailSheet
          transaction={selectedTx}
          category={categoryMap.get(selectedTx.categoryId)}
          categories={categories}
          onClose={() => setSelectedTx(null)}
          onDeleted={id => {
            setAllExpenses(prev => prev.filter(tx => tx.id !== id))
            setSelectedTx(null)
          }}
          onUpdated={tx => {
            setAllExpenses(prev => prev.map(t => t.id === tx.id ? tx : t))
            setSelectedTx(null)
          }}
        />
      )}
    </>
  )
}

function AnalyticsSheet({ categories, onClose }: Readonly<{ categories: Category[]; onClose: () => void }>) {
  const [comparisonOpen, setComparisonOpen] = useState(false)
  const [topTransactionsOpen, setTopTransactionsOpen] = useState(false)
  return (
    <>
      <BottomSheet withBackdrop ariaLabel="Аналитика" onClose={onClose} className="analytics-sheet">
        <h2 className="analytics-sheet__title">Аналитика</h2>
        <AnalyticsBlockCard
          icon={<Icons.ArrowLeftRight size={20} />}
          title="Сравнение периодов"
          subtitle="Сравните доходы и расходы за два периода"
          onClick={() => setComparisonOpen(true)}
        />
        <AnalyticsBlockCard
          icon={<Icons.Trophy size={20} />}
          title="Топ трат"
          subtitle="Самые крупные расходы за год"
          onClick={() => setTopTransactionsOpen(true)}
        />
      </BottomSheet>
      {comparisonOpen && (
        <ComparisonSheet categories={categories} onClose={() => setComparisonOpen(false)} />
      )}
      {topTransactionsOpen && (
        <TopTransactionsSheet categories={categories} onClose={() => setTopTransactionsOpen(false)} />
      )}
    </>
  )
}

/**
 * Главный экран приложения.
 */
export default function HomeScreen() {
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [selectedTx, setSelectedTx] = useState<Transaction | null>(null)
  const [openSheet, setOpenSheet] = useState<TransactionType | null>(null)
  const [analyticsOpen, setAnalyticsOpen] = useState(false)
  const scrollRef = useRef<HTMLDivElement>(null)
  const [scrollTopState, setScrollTopState] = useState<'hidden' | 'visible' | 'hiding'>('hidden')

  const handleScroll = () => {
    const scrolled = (scrollRef.current?.scrollTop ?? 0) > 300
    setScrollTopState(prev => {
      if (scrolled && prev === 'hidden') return 'visible'
      if (!scrolled && prev === 'visible') return 'hiding'
      return prev
    })
  }

  useEffect(() => {
    if (scrollTopState !== 'hiding') return
    const t = setTimeout(() => setScrollTopState('hidden'), 200)
    return () => clearTimeout(t)
  }, [scrollTopState])

  const now = new Date()
  const currentYear = now.getFullYear()
  const currentMonth = now.getMonth() + 1

  useEffect(() => {
    Promise.all([
      getTransactionsByPeriod(currentYear, 1, currentYear, 12),
      getAllCategories(),
    ]).then(([txs, cats]) => {
      setTransactions(txs)
      setCategories(cats)
    })
  }, [currentYear])

  const categoryMap = new Map(categories.map(c => [c.id, c]))

  // Список и summary на главном показывают только текущий месяц,
  // хотя в состоянии хранится весь год (для month-picker и переиспользования).
  const monthTransactions = transactions.filter(tx => {
    const d = new Date(tx.date)
    return d.getUTCFullYear() === currentYear && d.getUTCMonth() === currentMonth - 1
  })

  const yearData = useMemo(
    () => ({ year: currentYear, transactions, categories }),
    [currentYear, transactions, categories],
  )

  const totalIncome = monthTransactions
    .filter(tx => categoryMap.get(tx.categoryId)?.type === TransactionType.income)
    .reduce((sum, tx) => sum + tx.amount, 0)

  const totalSpent = monthTransactions
    .filter(tx => categoryMap.get(tx.categoryId)?.type === TransactionType.expense)
    .reduce((sum, tx) => sum + tx.amount, 0)

  const sorted = [...monthTransactions].sort((a, b) => b.date - a.date)

  const todayKey = new Date().toLocaleDateString('en-CA')
  const yesterdayKey = new Date(Date.now() - 86_400_000).toLocaleDateString('en-CA')

  const grouped = new Map<string, Transaction[]>()
  for (const tx of sorted) {
    const key = new Date(tx.date).toLocaleDateString('en-CA')
    if (!grouped.has(key)) grouped.set(key, [])
    grouped.get(key)!.push(tx)
  }

  const formatDayTotal = (txs: Transaction[]) => {
    const net = txs.reduce((sum, tx) => {
      const type = categoryMap.get(tx.categoryId)?.type ?? TransactionType.expense
      return type === TransactionType.income ? sum + tx.amount : sum - tx.amount
    }, 0)
    const sign = net >= 0 ? '+' : '−'
    return `${sign}${Math.abs(net).toLocaleString('ru-RU')} ₽`
  }

  const getDayLabel = (dateKey: string, timestamp: number) => {
    if (dateKey === todayKey) return 'Сегодня'
    if (dateKey === yesterdayKey) return 'Вчера'
    return formatDate(timestamp)
  }

  const handleDeleted = (id: string) => setTransactions(prev => prev.filter(tx => tx.id !== id))
  const handleUpdated = (updated: Transaction) => setTransactions(prev => prev.map(tx => tx.id === updated.id ? updated : tx))

  return (
    <CurrentYearDataContext.Provider value={yearData}>
    <div className="home">
      <div className="home__header">
        <h1 className="home__title">Главная</h1>
        <button type="button" className="home__analytics-btn" aria-label="Аналитика" onClick={() => setAnalyticsOpen(true)}>
          <Icons.BarChart2 size={22} />
        </button>
      </div>
      <SummaryCard
        income={totalIncome}
        spent={totalSpent}
        onExpenseClick={() => setOpenSheet(TransactionType.expense)}
        onIncomeClick={() => setOpenSheet(TransactionType.income)}
      />
      <div className="home__tx-scroll" data-scroll="true" ref={scrollRef} onScroll={handleScroll}>
        <div className="home__transactions">
          {[...grouped.entries()].map(([dateKey, txs]) => (
            <div key={dateKey} className="tx-group">
              <div className="tx-group__header">
                <span className="tx-group__date">{getDayLabel(dateKey, txs[0].date)}</span>
                <span className="tx-group__total">{formatDayTotal(txs)}</span>
              </div>
              {txs.map(tx => (
                <TransactionItem
                  key={tx.id}
                  transaction={tx}
                  category={categoryMap.get(tx.categoryId)}
                  onClick={() => setSelectedTx(tx)}
                />
              ))}
            </div>
          ))}
        </div>
      </div>

      {openSheet !== null && (
        <CategoryBreakdownSheet
          type={openSheet}
          categories={categories}
          onClose={() => setOpenSheet(null)}
          onDeleted={handleDeleted}
          onUpdated={handleUpdated}
        />
      )}

      {analyticsOpen && (
        <AnalyticsSheet categories={categories} onClose={() => setAnalyticsOpen(false)} />
      )}

      {scrollTopState !== 'hidden' && (
        <button
          type="button"
          className={`scroll-top-btn${scrollTopState === 'hiding' ? ' scroll-top-btn--hiding' : ''}`}
          aria-label="Наверх"
          onClick={() => scrollRef.current?.scrollTo({ top: 0, behavior: 'smooth' })}
        >
          <Icons.ChevronUp size={20} />
        </button>
      )}

      {selectedTx && openSheet === null && (
        <TransactionDetailSheet
          transaction={selectedTx}
          category={categoryMap.get(selectedTx.categoryId)}
          categories={categories}
          onClose={() => setSelectedTx(null)}
          onDeleted={handleDeleted}
          onUpdated={handleUpdated}
        />
      )}
    </div>
    </CurrentYearDataContext.Provider>
  )
}
