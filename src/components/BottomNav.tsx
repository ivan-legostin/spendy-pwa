import { useState } from 'react'
import { NavLink } from 'react-router-dom'
import { Home, Plus, Settings } from 'lucide-react'
import './BottomNav.css'

export default function BottomNav() {
  const [pressedPath, setPressedPath] = useState<string | null>(null)

  const handleTouchStart = (path: string) => {
    setPressedPath(path)
    setTimeout(() => setPressedPath(null), 150)
  }

  return (
    <nav className="bottom-nav">
      <NavLink
        to="/"
        className={({ isActive }) =>
          `bottom-nav__link${isActive ? ' active' : ''}${pressedPath === '/' ? ' pressing' : ''}`
        }
        onTouchStart={() => handleTouchStart('/')}
      >
        <Home size={30} />
      </NavLink>

      <NavLink
        to="/add"
        className={({ isActive }) =>
          `bottom-nav__link${isActive ? ' active' : ''}${pressedPath === '/add' ? ' pressing' : ''}`
        }
        onTouchStart={() => handleTouchStart('/add')}
        aria-label="Добавить транзакцию"
      >
        <div className="bottom-nav__fab-icon">
          <Plus size={22} strokeWidth={2} />
        </div>
      </NavLink>

      <NavLink
        to="/settings"
        className={({ isActive }) =>
          `bottom-nav__link${isActive ? ' active' : ''}${pressedPath === '/settings' ? ' pressing' : ''}`
        }
        onTouchStart={() => handleTouchStart('/settings')}
      >
        <Settings size={30} />
      </NavLink>
    </nav>
  )
}
