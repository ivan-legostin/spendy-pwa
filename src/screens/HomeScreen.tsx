import { useEffect, useRef, useState, type FormEvent } from 'react'
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

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('ru-RU', {
    day: 'numeric', month: 'long',
  })
}

/**
 * Элемент с суммой расходов и доходов.
 * @param income сумма доходов.
 * @param spent сумма расходов.
 */
function SummaryCard({ income, spent }: Readonly<{ income: number; spent: number }>) {
  return (
    <div className="summary-card">
      <div className="summary-card__tile">
        <span className="summary-card__value">{spent.toLocaleString('ru-RU')} ₽</span>
        <span className="summary-card__label">Траты</span>
      </div>
      <div className="summary-card__tile">
        <span className="summary-card__value">{income.toLocaleString('ru-RU')} ₽</span>
        <span className="summary-card__label">Доходы</span>
      </div>
    </div>
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
  const [date, setDate] = useState(transaction.date)
  const [categoryId, setCategoryId] = useState(transaction.categoryId)
  const [note, setNote] = useState(transaction.note)

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const updated: Transaction = { ...transaction, amount: Number(amount), date, categoryId, note }
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
  const [isConfirmingDelete, setIsConfirmingDelete] = useState(false)

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
              <span className={`tx-detail-sheet__amount tx-detail-sheet__amount--${type}`}>
                {formatAmount(transaction.amount, type)}
              </span>
            </div>
          </div>
          <div className="tx-detail-sheet__meta">
            <div className="tx-detail-sheet__meta-row">
              <span className="tx-detail-sheet__meta-label">Дата</span>
              <span className="tx-detail-sheet__meta-value">{formatDate(transaction.date)}</span>
            </div>
            {transaction.note && (
              <div className="tx-detail-sheet__meta-row">
                <span className="tx-detail-sheet__meta-label">Заметка</span>
                <span className="tx-detail-sheet__meta-value">{transaction.note}</span>
              </div>
            )}
          </div>
          <div className="tx-detail-sheet__actions">
            <button className="tx-detail-sheet__btn tx-detail-sheet__btn--edit" onClick={() => setIsEditing(true)}>
              Редактировать
            </button>
            {isConfirmingDelete ? (
              <div className="tx-detail-sheet__confirm">
                <span className="tx-detail-sheet__confirm-text">Удалить операцию?</span>
                <div className="tx-detail-sheet__confirm-btns">
                  <button className="tx-detail-sheet__btn tx-detail-sheet__btn--secondary" onClick={() => setIsConfirmingDelete(false)}>
                    Отмена
                  </button>
                  <button className="tx-detail-sheet__btn tx-detail-sheet__btn--delete-confirm" onClick={handleDelete}>
                    Удалить
                  </button>
                </div>
              </div>
            ) : (
              <button className="tx-detail-sheet__btn tx-detail-sheet__btn--delete" onClick={() => setIsConfirmingDelete(true)}>
                Удалить
              </button>
            )}
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

function AllTransactionsSheet({ transactions, categoryMap, categories, onClose, onDeleted, onUpdated }: Readonly<{
  transactions: Transaction[]
  categoryMap: Map<string, Category>
  categories: Category[]
  onClose: () => void
  onDeleted: (id: string) => void
  onUpdated: (tx: Transaction) => void
}>) {
  const listRef = useRef<HTMLDivElement>(null)
  const [selectedTx, setSelectedTx] = useState<Transaction | null>(null)

  const sorted = [...transactions].sort((a, b) => b.date.localeCompare(a.date))

  const todayKey = new Date().toLocaleDateString('en-CA')
  const yesterdayKey = new Date(Date.now() - 86_400_000).toLocaleDateString('en-CA')

  const grouped = new Map<string, Transaction[]>()
  for (const tx of sorted) {
    const key = tx.date.slice(0, 10)
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

  const getDayLabel = (dateKey: string, date: string) => {
    if (dateKey === todayKey) return 'Сегодня'
    if (dateKey === yesterdayKey) return 'Вчера'
    return formatDate(date)
  }

  return (
    <>
      <BottomSheet withBackdrop ariaLabel="Все операции" onClose={onClose} scrollableRef={listRef} className="all-tx-sheet">
        <div className="all-tx-sheet__list" data-scroll="true" ref={listRef}>
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
      </BottomSheet>
      {selectedTx && (
        <TransactionDetailSheet
          transaction={selectedTx}
          category={categoryMap.get(selectedTx.categoryId)}
          categories={categories}
          onClose={() => setSelectedTx(null)}
          onDeleted={(id) => { setSelectedTx(null); onDeleted(id) }}
          onUpdated={(tx) => { setSelectedTx(null); onUpdated(tx) }}
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
  const [allTxOpen, setAllTxOpen] = useState(false)
  const [selectedTx, setSelectedTx] = useState<Transaction | null>(null)

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

  const recentTransactions = [...transactions]
    .sort((a, b) => b.date.localeCompare(a.date))
    .slice(0, 5)

  const handleDeleted = (id: string) => setTransactions(prev => prev.filter(tx => tx.id !== id))
  const handleUpdated = (updated: Transaction) => setTransactions(prev => prev.map(tx => tx.id === updated.id ? updated : tx))

  return (
    <div className="home">
      <h1 className="home__title">Главная</h1>
      <SummaryCard income={totalIncome} spent={totalSpent} />
      <div className="home__transactions">
        <div className="home__transactions-header">
          <h2 className="home__transactions-title">Операции</h2>
          <button className="home__see-all" onClick={() => setAllTxOpen(true)}>Все операции &gt;</button>
        </div>
        {recentTransactions.map(tx => (
          <TransactionItem
            key={tx.id}
            transaction={tx}
            category={categoryMap.get(tx.categoryId)}
            onClick={() => setSelectedTx(tx)}
          />
        ))}
      </div>

      {allTxOpen && (
        <AllTransactionsSheet
          transactions={transactions}
          categoryMap={categoryMap}
          categories={categories}
          onClose={() => setAllTxOpen(false)}
          onDeleted={handleDeleted}
          onUpdated={handleUpdated}
        />
      )}

      {selectedTx && !allTxOpen && (
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
