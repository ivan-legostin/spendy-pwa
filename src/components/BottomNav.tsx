import { NavLink } from 'react-router-dom'
import { Home, Plus, Settings } from 'lucide-react'
import './BottomNav.css'

export default function BottomNav() {
  return (
    <nav className="bottom-nav">
      <NavLink
        to="/"
        className={({ isActive }) => `bottom-nav__link${isActive ? ' active' : ''}`}
      >
        <Home size={30} />
      </NavLink>

      <NavLink
        to="/add"
        className={({ isActive }) => `bottom-nav__link${isActive ? ' active' : ''}`}
        aria-label="Добавить транзакцию"
      >
        <div className="bottom-nav__fab-icon">
          <Plus size={22} strokeWidth={2} />
        </div>
      </NavLink>

      <NavLink
        to="/settings"
        className={({ isActive }) => `bottom-nav__link${isActive ? ' active' : ''}`}
      >
        <Settings size={30} />
      </NavLink>
    </nav>
  )
}
