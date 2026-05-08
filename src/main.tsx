import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import App from './App.tsx'
import './App.css'

// Блокирует pull-to-refresh и bounce-эффект на iOS Safari (overscroll-behavior: none там не работает).
// Скроллируемые контейнеры помечаются атрибутом data-scroll — это дешевле, чем обход DOM с getComputedStyle.
document.addEventListener('touchmove', (e) => {
  if (!(e.target as Element).closest('[data-scroll]')) {
    if (e.cancelable) e.preventDefault()
  }
}, { passive: false })

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter basename="/spendy-pwa/">
      <App />
    </BrowserRouter>
  </StrictMode>,
)
