import { NavLink } from 'react-router-dom'
import { Home, Plus, Settings } from 'lucide-react'
import './BottomNav.css'

export default function BottomNav() {
  return (
    <nav className="bottom-nav">
      <div className="bottom-nav__inner">
      <NavLink
        to="/"
        className={({ isActive }) => `bottom-nav__link${isActive ? ' active' : ''}`}
      >
        <div className="bottom-nav__icon">
          <Home size={36} />
        </div>
        <span className="bottom-nav__label">Главная</span>
      </NavLink>

      <NavLink
        to="/add"
        className={({ isActive }) => `bottom-nav__link bottom-nav__link--fab${isActive ? ' active' : ''}`}
        aria-label="Добавить транзакцию"
      >
        <div className="bottom-nav__fab-icon">
          <Plus size={26} strokeWidth={2} />
        </div>
      </NavLink>

      <NavLink
        to="/settings"
        className={({ isActive }) => `bottom-nav__link${isActive ? ' active' : ''}`}
      >
        <div className="bottom-nav__icon">
          <Settings size={36} />
        </div>
        <span className="bottom-nav__label">Настройки</span>
      </NavLink>
      </div>
    </nav>
  )
}
