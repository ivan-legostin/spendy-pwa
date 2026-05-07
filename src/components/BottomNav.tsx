import { NavLink } from 'react-router-dom'
import { Home, Plus, Settings } from 'lucide-react'
import './BottomNav.css'

export default function BottomNav() {
  return (
    <nav className="bottom-nav">
      <NavLink to="/" className="bottom-nav__link">
        <Home size={30} />
      </NavLink>

      <NavLink to="/add" className="bottom-nav__link" aria-label="Добавить транзакцию">
        <div className="bottom-nav__fab-icon">
          <Plus size={22} strokeWidth={2} />
        </div>
      </NavLink>

      <NavLink to="/settings" className="bottom-nav__link">
        <Settings size={30} />
      </NavLink>
    </nav>
  )
}
