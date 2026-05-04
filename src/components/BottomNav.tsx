import { NavLink } from 'react-router-dom'
import { Home, Plus, Settings } from 'lucide-react'
import './BottomNav.css'

export default function BottomNav() {
  return (
    <nav className="bottom-nav">
      <NavLink to="/" className="bottom-nav__link">
        <Home size={24} />
        <span>Home</span>
      </NavLink>

      <NavLink to="/add" className="bottom-nav__fab">
        <Plus size={22} strokeWidth={2} />
      </NavLink>

      <NavLink to="/settings" className="bottom-nav__link">
        <Settings size={24} />
        <span>Settings</span>
      </NavLink>
    </nav>
  )
}
