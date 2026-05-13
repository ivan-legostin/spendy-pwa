import { useEffect, useState } from 'react'
import * as Icons from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import type { Category } from '../dao/models/Category'
import { TransactionType } from '../dao/models/TransactionType'
import { getAllCategories } from '../dao/service/CategoryDaoService'
import { saveTransactions } from '../dao/service/TransactionDaoService'
import BottomSheet from '../components/BottomSheet'
import './AddScreen.css'

function getTodayStr(): string {
  return new Date().toISOString().split('T')[0]
}

function CalendarPopup({ date, onSelect, onClose }: Readonly<{ date: string; onSelect: (date: string) => void; onClose: () => void }>) {
  const [viewDate, setViewDate] = useState(() => {
    const [y, m] = date.split('-').map(Number)
    return new Date(y, m - 1, 1)
  })

  const year = viewDate.getFullYear()
  const month = viewDate.getMonth()
  const firstDayOfWeek = (new Date(year, month, 1).getDay() + 6) % 7
  const daysInMonth = new Date(year, month + 1, 0).getDate()

  const cells: (number | null)[] = []
  for (let i = 0; i < firstDayOfWeek; i++) cells.push(null)
  for (let d = 1; d <= daysInMonth; d++) cells.push(d)

  const monthLabel = viewDate.toLocaleDateString('ru-RU', { month: 'long', year: 'numeric' })
  const todayStr = getTodayStr()

  const toDateStr = (d: number) =>
    `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`

  return (
    <BottomSheet ariaLabel="Выбор даты" onClose={onClose} withBackdrop>
      <div className="calendar">
        <div className="calendar__header">
          <button className="calendar__nav" onPointerDown={() => setViewDate(new Date(year, month - 1, 1))}>‹</button>
          <span className="calendar__month">{monthLabel}</span>
          <button className="calendar__nav" onPointerDown={() => setViewDate(new Date(year, month + 1, 1))}>›</button>
        </div>
        <div className="calendar__weekdays">
          {['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'].map(d => (
            <span key={d} className="calendar__weekday">{d}</span>
          ))}
        </div>
        <div className="calendar__grid">
          {cells.map((day, i) => (
            <button
              key={day !== null ? `day-${day}` : `empty-${i}`}
              className={[
                'calendar__day',
                day === null ? 'calendar__day--empty' : '',
                day !== null && toDateStr(day) === date ? 'calendar__day--selected' : '',
                day !== null && toDateStr(day) === todayStr && toDateStr(day) !== date ? 'calendar__day--today' : '',
              ].filter(Boolean).join(' ')}
              disabled={day === null}
              onPointerDown={() => { if (day) onSelect(toDateStr(day)) }}
            >
              {day ?? ''}
            </button>
          ))}
        </div>
      </div>
    </BottomSheet>
  )
}

function NumPad({ onPress }: Readonly<{ onPress: (key: string) => void }>) {
  const keys = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '.', '0', '⌫']
  return (
    <div className="numpad">
      {keys.map(key => (
        <button key={key} className="numpad__key" onPointerDown={() => onPress(key)}>
          {key}
        </button>
      ))}
    </div>
  )
}

export default function AddScreen() {
  const [type, setType] = useState<TransactionType>(TransactionType.expense)
  const [categories, setCategories] = useState<Category[]>([])
  const [selectedCategory, setSelectedCategory] = useState<Category | null>(null)
  const [amount, setAmount] = useState('')
  const [date, setDate] = useState(getTodayStr)
  const [note, setNote] = useState('')
  const [calendarOpen, setCalendarOpen] = useState(false)
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    getAllCategories().then(setCategories)
  }, [])

  const filteredCategories = categories
    .filter(c => c.type === type)
    .sort((a, b) => a.priority - b.priority)

  const amountValue = parseFloat(amount) || 0
  const canSave = selectedCategory !== null && amountValue > 0

  function handleTypeSwitch(newType: TransactionType) {
    setType(newType)
    setSelectedCategory(null)
  }

  function handleNumpad(key: string) {
    if (key === '⌫') {
      setAmount(prev => prev.slice(0, -1))
      return
    }
    if (key === '.') {
      if (amount.includes('.')) return
      setAmount(prev => prev === '' ? '0.' : prev + '.')
      return
    }
    if (amount === '0') {
      setAmount(key)
      return
    }
    const dotIndex = amount.indexOf('.')
    if (dotIndex !== -1 && amount.length - dotIndex > 2) return
    if (amount.replace('.', '').length >= 10) return
    setAmount(prev => prev + key)
  }

  async function handleSave() {
    if (!canSave) return
    await saveTransactions([{
      id: crypto.randomUUID(),
      title: selectedCategory.title,
      amount: amountValue,
      date: new Date(`${date}T${new Date().toISOString().slice(11)}`).getTime(),
      categoryId: selectedCategory.id,
      note,
    }])
    setSelectedCategory(null)
    setAmount('')
    setDate(getTodayStr())
    setNote('')
    setSaved(true)
    setTimeout(() => setSaved(false), 1000)
  }

  let saveSuffix = ''
  if (saved) saveSuffix = ' add__save--saved'
  else if (canSave) saveSuffix = ' add__save--active'

  const displayAmount = (() => {
    const raw = amount === '' ? '0' : amount
    const [int, dec] = raw.split('.')
    const formatted = int.replace(/\B(?=(\d{3})+(?!\d))/g, ' ')
    return dec !== undefined ? `${formatted}.${dec}` : formatted
  })()

  return (
    <div className="add">
      <div className="add__top" data-scroll="true">
        <div className="add__toggle">
          <button
            className={`add__toggle-btn${type === TransactionType.expense ? ' add__toggle-btn--active' : ''}`}
            onPointerDown={() => handleTypeSwitch(TransactionType.expense)}
          >
            Траты
          </button>
          <button
            className={`add__toggle-btn${type === TransactionType.income ? ' add__toggle-btn--active' : ''}`}
            onPointerDown={() => handleTypeSwitch(TransactionType.income)}
          >
            Доходы
          </button>
        </div>

        <div className="add__categories">
          {filteredCategories.map(cat => {
            const Icon = (Icons[cat.icon as keyof typeof Icons] as LucideIcon | undefined) ?? Icons.CreditCard
            const isSelected = selectedCategory?.id === cat.id
            return (
              <button
                key={cat.id}
                className={`category-item${isSelected ? ' category-item--selected' : ''}`}
                onPointerDown={() => setSelectedCategory(cat)}
              >
                <div
                  className="category-item__icon"
                  style={{ background: isSelected ? '#2D7FF9' : '#2c2c2e' }}
                >
                  <Icon size={22} color={isSelected ? '#fff' : '#94a3b8'} />
                </div>
                <span className="category-item__title">{cat.title}</span>
              </button>
            )
          })}
        </div>
      </div>

      <div className="add__bottom">
        <div className="add__amount">{displayAmount} ₽</div>

        <div className="add__meta">
          <button className="add__date-btn" onPointerDown={() => setCalendarOpen(true)}>
            <Icons.CalendarDays size={20} color="#94a3b8" />
          </button>
          <input
            className="add__note"
            type="text"
            placeholder="Комментарий"
            value={note}
            onChange={e => setNote(e.target.value)}
          />
        </div>

        <NumPad onPress={handleNumpad} />

        <button
          className={`add__save${saveSuffix}`}
          disabled={!canSave && !saved}
          onPointerDown={handleSave}
        >
          Сохранить
        </button>
      </div>

      {calendarOpen && (
        <CalendarPopup
          date={date}
          onSelect={setDate}
          onClose={() => setCalendarOpen(false)}
        />
      )}
    </div>
  )
}
