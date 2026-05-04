import { NavLink } from 'react-router-dom'
import { Home, Plus, Settings } from 'lucide-react'
import './BottomNav.css'

export default function BottomNav() {
  return (
    <nav className="bottom-nav">
      <NavLink to="/" className="bottom-nav__link">
        <Home size={30} />
        <span>Главная</span>
      </NavLink>

      <NavLink to="/add" className="bottom-nav__fab" aria-label="Добавить транзакцию">
        <Plus size={30} strokeWidth={1.5} />
      </NavLink>

      <NavLink to="/settings" className="bottom-nav__link">
        <Settings size={30} />
        <span>Настройки</span>
      </NavLink>
    </nav>
  )
}
