import { useEffect, useState } from 'react'
import * as Icons from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import type { Transaction } from '../dao/models/Transaction'
import type { Category } from '../dao/models/Category'
import { TransactionType } from '../dao/models/TransactionType'
import { getAllTransactions } from '../dao/service/TransactionDaoService'
import { getAllCategories } from '../dao/service/CategoryDaoService'
import './HomeScreen.css'

function formatAmount(amount: number, type: TransactionType): string {
  const formatted = amount.toLocaleString('ru-RU')
  return type === TransactionType.expense ? `-${formatted} ₽` : `${formatted} ₽`
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('en-US', {
    month: 'short', day: '2-digit', year: 'numeric',
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
        <span className="transaction-item__title">{transaction.title}</span>
        <span className="transaction-item__category">{category?.title ?? '—'}</span>
      </div>
      <div className="transaction-item__right">
        <span className={`transaction-item__amount transaction-item__amount--${type}`}>{formatAmount(transaction.amount, type)}</span>
        <span className="transaction-item__date">{formatDate(transaction.date)}</span>
      </div>
    </div>
  )
}

/**
 * Главный экран приложения.
 */
export default function HomeScreen() {
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [categories, setCategories] = useState<Category[]>([])

  useEffect(() => {
    Promise.all([getAllTransactions(), getAllCategories()]).then(([txs, cats]) => {
      setTransactions(txs)
      setCategories(cats)
    })
  }, [])

  const categoryMap = new Map(categories.map(c => [c.id, c]))

  const currentMonth = new Date().toISOString().slice(0, 7)
  const currentMonthTx = transactions.filter(tx => tx.date.startsWith(currentMonth))

  const totalIncome = currentMonthTx
    .filter(tx => categoryMap.get(tx.categoryId)?.type === TransactionType.income)
    .reduce((sum, tx) => sum + tx.amount, 0)

  const totalSpent = currentMonthTx
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
          <button className="home__see-all">Все операции &gt;</button>
        </div>
        {recentTransactions.map(tx => (
          <TransactionItem key={tx.id} transaction={tx} category={categoryMap.get(tx.categoryId)} />
        ))}
      </div>
    </div>
  )
}
