import { useEffect, useRef, useState, type FormEvent } from 'react'
import { PieChart, Pie, ResponsiveContainer } from 'recharts'
import * as Icons from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import type { Transaction } from '../dao/models/Transaction'
import type { Category } from '../dao/models/Category'
import { TransactionType } from '../dao/models/TransactionType'
import { getTransactionsByMonth, deleteTransaction, updateTransaction } from '../dao/service/TransactionDaoService'
import { getAllCategories } from '../dao/service/CategoryDaoService'
import BottomSheet, { type BottomSheetHandle } from '../components/BottomSheet'
import './HomeScreen.css'

function formatAmount(amount: number, type: TransactionType): string {
  const formatted = amount.toLocaleString('ru-RU')
  return type === TransactionType.expense ? `-${formatted} ₽` : `${formatted} ₽`
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
        <span className="summary-card__label">Траты</span>
      </button>
      <button type="button" className="summary-card__tile summary-card__tile--clickable" onClick={onIncomeClick}>
        <span className="summary-card__value">{income.toLocaleString('ru-RU')} ₽</span>
        <span className="summary-card__label">Доходы</span>
      </button>
    </div>
  )
}

const MONTH_NAMES = ['Янв', 'Фев', 'Мар', 'Апр', 'Май', 'Июн', 'Июл', 'Авг', 'Сен', 'Окт', 'Ноя', 'Дек']

function MonthPickerSheet({ year, month, onClose, onChange }: Readonly<{
  year: number
  month: number
  onClose: () => void
  onChange: (year: number, month: number) => void
}>) {
  const now = new Date()
  const [pickerYear, setPickerYear] = useState(year)

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
          return (
            <button
              key={m}
              type="button"
              className={`month-picker__cell${isSelected ? ' month-picker__cell--selected' : ''}`}
              disabled={isDisabled}
              onClick={() => { onChange(pickerYear, m); onClose() }}
            >
              {name}
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
  const swipeStartX = useRef(0)

  const categoryMap = new Map(categories.map(c => [c.id, c]))

  const handleChartSwipeStart = (e: React.TouchEvent) => {
    swipeStartX.current = e.touches[0].clientX
  }

  const handleChartSwipeEnd = (e: React.TouchEvent) => {
    const delta = e.changedTouches[0].clientX - swipeStartX.current
    if (Math.abs(delta) < 50) return
    if (delta > 0) {
      if (selectedMonth === 1) { setSelectedYear(y => y - 1); setSelectedMonth(12) }
      else setSelectedMonth(m => m - 1)
    } else {
      const now = new Date()
      if (selectedYear === now.getFullYear() && selectedMonth === now.getMonth() + 1) return
      if (selectedMonth === 12) { setSelectedYear(y => y + 1); setSelectedMonth(1) }
      else setSelectedMonth(m => m + 1)
    }
  }

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
        <div className="breakdown-sheet__chart" onTouchStart={handleChartSwipeStart} onTouchEnd={handleChartSwipeEnd}>
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

/**
 * Главный экран приложения.
 */
export default function HomeScreen() {
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [selectedTx, setSelectedTx] = useState<Transaction | null>(null)
  const [openSheet, setOpenSheet] = useState<TransactionType | null>(null)

  useEffect(() => {
    const now = new Date()
    Promise.all([
      getTransactionsByMonth(now.getFullYear(), now.getMonth() + 1),
      getAllCategories(),
    ]).then(([txs, cats]) => {
      setTransactions(txs)
      setCategories(cats)
    })
  }, [])

  const categoryMap = new Map(categories.map(c => [c.id, c]))

  const totalIncome = transactions
    .filter(tx => categoryMap.get(tx.categoryId)?.type === TransactionType.income)
    .reduce((sum, tx) => sum + tx.amount, 0)

  const totalSpent = transactions
    .filter(tx => categoryMap.get(tx.categoryId)?.type === TransactionType.expense)
    .reduce((sum, tx) => sum + tx.amount, 0)

  const sorted = [...transactions].sort((a, b) => b.date - a.date)

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
    <div className="home">
      <h1 className="home__title">Главная</h1>
      <SummaryCard
        income={totalIncome}
        spent={totalSpent}
        onExpenseClick={() => setOpenSheet(TransactionType.expense)}
        onIncomeClick={() => setOpenSheet(TransactionType.income)}
      />
      <div className="home__tx-scroll" data-scroll="true">
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
  )
}
