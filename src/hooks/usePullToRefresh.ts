import { useEffect, useRef, useState, type RefObject, type TouchEvent } from 'react'

/** Насколько далеко нужно потянуть, чтобы обновление сработало. */
const PULL_THRESHOLD_PX = 70

/** Дальше этого список не оттягивается, сколько ни тяни. */
const MAX_PULL_PX = 110

/** Высота полоски, пока идёт обновление. */
const REFRESHING_HEIGHT_PX = 44

/**
 * Замедление: палец проходит вдвое больший путь, чем сдвигается список.
 * Без него жест ощущается срывающимся.
 */
const DAMPING = 0.5

/**
 * Сколько времени полоска обновления держится на экране минимум.
 *
 * Обмен часто завершается за десятки миллисекунд — без этой задержки
 * иконка мигает и жест выглядит рваным.
 */
const MIN_REFRESH_DURATION_MS = 600

/**
 * Состояние жеста «потянуть вниз для обновления».
 */
export interface PullToRefresh {
  /** На сколько пикселей сейчас оттянут список. */
  pullDistance: number
  /** Идёт ли обновление. */
  isRefreshing: boolean
  /** Пройден ли порог — то есть сработает ли обновление, если отпустить сейчас. */
  isReadyToRefresh: boolean
  /** Тянут ли список прямо сейчас — на время жеста анимация высоты выключается. */
  isPulling: boolean
  /** Повесить на прокручиваемый контейнер. */
  handleTouchStart: (event: TouchEvent) => void
  /** Повесить на прокручиваемый контейнер. */
  handleTouchEnd: (event: TouchEvent) => void
}

/**
 * Жест «потянуть вниз для обновления» на прокручиваемом контейнере.
 *
 * Жест начинается только при прокрутке в самом верху — иначе он отбирал бы
 * у пользователя обычную прокрутку списка вверх.
 *
 * @param scrollableRef контейнер, который прокручивается и за который тянут.
 * @param refresh что выполнить по достижении порога.
 * @returns состояние жеста и обработчики для контейнера.
 */
export function usePullToRefresh(
  scrollableRef: RefObject<HTMLElement>,
  refresh: () => Promise<unknown>,
): PullToRefresh {
  const [pullDistance, setPullDistance] = useState(0)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [isPulling, setIsPulling] = useState(false)
  const gesture = useRef({ startY: 0, isDragging: false })

  useEffect(() => {
    const scrollable = scrollableRef.current
    if (!scrollable) return

    const onTouchMove = (event: globalThis.TouchEvent) => {
      if (!gesture.current.isDragging) return
      const delta = event.touches[0].clientY - gesture.current.startY
      if (delta <= 0) {
        setPullDistance(0)
        return
      }
      // Иначе браузер начнёт собственную прокрутку и жест оборвётся на полпути.
      if (event.cancelable) event.preventDefault()
      setPullDistance(Math.min(delta * DAMPING, MAX_PULL_PX))
    }

    scrollable.addEventListener('touchmove', onTouchMove, { passive: false })
    return () => scrollable.removeEventListener('touchmove', onTouchMove)
  }, [scrollableRef])

  const handleTouchStart = (event: TouchEvent) => {
    if (isRefreshing) return
    if ((scrollableRef.current?.scrollTop ?? 0) > 0) return
    gesture.current = { startY: event.touches[0].clientY, isDragging: true }
    setIsPulling(true)
  }

  const handleTouchEnd = () => {
    if (!gesture.current.isDragging) return
    gesture.current.isDragging = false
    setIsPulling(false)

    if (pullDistance < PULL_THRESHOLD_PX) {
      setPullDistance(0)
      return
    }

    setIsRefreshing(true)
    setPullDistance(REFRESHING_HEIGHT_PX)
    Promise.all([
      refresh().catch(() => undefined),
      new Promise(resolve => setTimeout(resolve, MIN_REFRESH_DURATION_MS)),
    ]).then(() => {
      setIsRefreshing(false)
      setPullDistance(0)
    })
  }

  return {
    pullDistance,
    isRefreshing,
    isReadyToRefresh: pullDistance >= PULL_THRESHOLD_PX,
    isPulling,
    handleTouchStart,
    handleTouchEnd,
  }
}
