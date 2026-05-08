import React, { useEffect, useRef, useState } from 'react'
import * as Icons from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import type { Transaction } from '../dao/models/Transaction'
import type { Category } from '../dao/models/Category'
import { TransactionType } from '../dao/models/TransactionType'
import { getTransactionsByMonth } from '../dao/service/TransactionDaoService'
import { getAllCategories } from '../dao/service/CategoryDaoService'
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
 * Элемент транзакции в списке последних операций.
 *
 * @param transaction модель транзакции из БД.
 * @param category модель категории из БД.
 */
function TransactionItem({ transaction, category }: Readonly<{ transaction: Transaction; category: Category | undefined }>) {
  const Icon = (Icons[category?.icon as keyof typeof Icons] as LucideIcon | undefined) ?? Icons.CreditCard
  const type = category?.type ?? TransactionType.expense

  return (
    <div className="transaction-item">
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
    </div>
  )
}

function AllTransactionsSheet({ transactions, categoryMap, onClose }: Readonly<{
  transactions: Transaction[]
  categoryMap: Map<string, Category>
  onClose: () => void
}>) {
  const [isClosing, setIsClosing] = useState(false)
  const dialogRef = useRef<HTMLDialogElement>(null)
  const listRef = useRef<HTMLDivElement>(null)
  const dragState = useRef({ startY: 0, isDragging: false })

  const sorted = [...transactions].sort((a, b) => b.date.localeCompare(a.date))

  const handleClose = () => setIsClosing(true)
  const handleAnimationEnd = () => { if (isClosing) onClose() }

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

  const snapBack = () => {
    const dialog = dialogRef.current
    if (!dialog) return
    dialog.style.transition = 'transform 0.3s ease'
    dialog.style.transform = 'translateY(0)'
    setTimeout(() => {
      if (dialogRef.current) {
        dialogRef.current.style.transform = ''
        dialogRef.current.style.transition = ''
      }
    }, 300)
  }

  const handleTouchStart = (e: React.TouchEvent) => {
    if ((listRef.current?.scrollTop ?? 0) > 0) return
    dragState.current = { startY: e.touches[0].clientY, isDragging: true }
  }

  useEffect(() => {
    const dialog = dialogRef.current
    if (!dialog) return
    const onTouchMove = (e: TouchEvent) => {
      if (!dragState.current.isDragging) return
      const delta = e.touches[0].clientY - dragState.current.startY
      if (delta <= 0) return
      e.preventDefault()
      dialog.style.transition = 'none'
      dialog.style.transform = `translateY(${delta}px)`
    }
    dialog.addEventListener('touchmove', onTouchMove, { passive: false })
    return () => dialog.removeEventListener('touchmove', onTouchMove)
  }, [])

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (!dragState.current.isDragging) return
    dragState.current.isDragging = false
    const delta = e.changedTouches[0].clientY - dragState.current.startY
    const dialog = dialogRef.current
    if (!dialog) return
    if (delta > 100) {
      dialog.style.transition = 'transform 0.3s ease'
      dialog.style.transform = 'translateY(100%)'
      setTimeout(() => onClose(), 300)
    } else {
      snapBack()
    }
  }

  const handleTouchCancel = () => {
    dragState.current.isDragging = false
    snapBack()
  }

  return (
    <dialog
      ref={dialogRef}
      open
      aria-label="Все операции"
      className={`all-tx-sheet${isClosing ? ' all-tx-sheet--closing' : ''}`}
      onClose={handleClose}
      onAnimationEnd={handleAnimationEnd}
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
      onTouchCancel={handleTouchCancel}
    >
      <div className="all-tx-sheet__handle" />
      <div className="all-tx-sheet__header">
        <button className="all-tx-sheet__close" onClick={handleClose}>✕</button>
      </div>
      <div className="all-tx-sheet__list" ref={listRef}>
        {[...grouped.entries()].map(([dateKey, txs]) => (
          <div key={dateKey} className="tx-group">
            <div className="tx-group__header">
              <span className="tx-group__date">{getDayLabel(dateKey, txs[0].date)}</span>
              <span className="tx-group__total">{formatDayTotal(txs)}</span>
            </div>
            {txs.map(tx => (
              <TransactionItem key={tx.id} transaction={tx} category={categoryMap.get(tx.categoryId)} />
            ))}
          </div>
        ))}
      </div>
    </dialog>
  )
}

/**
 * Главный экран приложения.
 */
export default function HomeScreen() {
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [allTxOpen, setAllTxOpen] = useState(false)

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
          <TransactionItem key={tx.id} transaction={tx} category={categoryMap.get(tx.categoryId)} />
        ))}
      </div>

      {allTxOpen && (
        <AllTransactionsSheet
          transactions={transactions}
          categoryMap={categoryMap}
          onClose={() => setAllTxOpen(false)}
        />
      )}
    </div>
  )
}
