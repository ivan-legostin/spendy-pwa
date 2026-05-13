import { Routes, Route, useLocation } from 'react-router-dom'
import { useRegisterSW } from 'virtual:pwa-register/react'
import BottomNav from './components/BottomNav'
import HomeScreen from './screens/HomeScreen'
import AddScreen from './screens/AddScreen'
import SettingsScreen from './screens/SettingsScreen'

export default function App() {
  const location = useLocation()

  const {
    needRefresh: [needRefresh],
    updateServiceWorker,
  } = useRegisterSW()

  return (
    <div className="app">
      <main>
        <Routes key={location.pathname}>
          <Route path="/" element={<HomeScreen />} />
          <Route path="/add" element={<AddScreen />} />
          <Route path="/settings" element={<SettingsScreen />} />
        </Routes>
      </main>

      <BottomNav />

      {needRefresh && (
        <div className="update-banner">
          <span>Доступно обновление</span>
          <button onPointerDown={() => updateServiceWorker(true)}>Обновить</button>
        </div>
      )}
    </div>
  )
}
