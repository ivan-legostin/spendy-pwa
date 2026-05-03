import { useRegisterSW } from 'virtual:pwa-register/react'

export default function App() {
  const {
    needRefresh: [needRefresh],
    updateServiceWorker,
  } = useRegisterSW()

  return (
    <div className="app">
      <h1>Spendy</h1>
      <p>Hello World!!</p>

      {needRefresh && (
        <div className="update-banner">
          <span>Доступно обновление</span>
          <button onClick={() => updateServiceWorker(true)}>Обновить</button>
        </div>
      )}
    </div>
  )
}
