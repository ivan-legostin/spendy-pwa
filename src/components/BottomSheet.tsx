import React, { forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react'
import './BottomSheet.css'

interface BottomSheetProps {
  ariaLabel: string
  onClose: () => void
  scrollableRef?: React.RefObject<HTMLElement>
  withBackdrop?: boolean
  zIndex?: number
  className?: string
  children: React.ReactNode
}

export interface BottomSheetHandle {
  close: () => void
}

const BottomSheet = forwardRef<BottomSheetHandle, BottomSheetProps>(function BottomSheet(
  { ariaLabel, onClose, scrollableRef, withBackdrop, zIndex, className, children },
  ref
) {
  const [isClosing, setIsClosing] = useState(false)
  const [isBackdropClosing, setIsBackdropClosing] = useState(false)
  const dialogRef = useRef<HTMLDialogElement>(null)
  const dragState = useRef({ startY: 0, isDragging: false })

  const handleClose = () => setIsClosing(true)
  const handleAnimationEnd = () => { if (isClosing) onClose() }

  useImperativeHandle(ref, () => ({ close: handleClose }))

  const snapBack = () => {
    const dialog = dialogRef.current
    if (!dialog) return
    dialog.style.transition = 'transform 0.3s ease'
    dialog.style.transform = 'translateY(0)'
    setTimeout(() => {
      if (dialogRef.current) {
        dialogRef.current.style.transform = ''
        dialogRef.current.style.transition = ''
      }
    }, 300)
  }

  const handleTouchStart = (e: React.TouchEvent) => {
    if ((scrollableRef?.current?.scrollTop ?? 0) > 0) return
    dragState.current = { startY: e.touches[0].clientY, isDragging: true }
  }

  useEffect(() => {
    const dialog = dialogRef.current
    if (!dialog) return
    const onTouchMove = (e: TouchEvent) => {
      if (!dragState.current.isDragging) return
      const delta = e.touches[0].clientY - dragState.current.startY
      if (delta <= 0) return
      e.preventDefault()
      dialog.style.transition = 'none'
      dialog.style.transform = `translateY(${delta}px)`
    }
    dialog.addEventListener('touchmove', onTouchMove, { passive: false })
    return () => dialog.removeEventListener('touchmove', onTouchMove)
  }, [])

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (!dragState.current.isDragging) return
    dragState.current.isDragging = false
    const delta = e.changedTouches[0].clientY - dragState.current.startY
    const dialog = dialogRef.current
    if (!dialog) return
    if (delta > 100) {
      setIsBackdropClosing(true)
      dialog.style.transition = 'transform 0.3s ease'
      dialog.style.transform = 'translateY(100%)'
      setTimeout(() => onClose(), 300)
    } else {
      snapBack()
    }
  }

  const handleTouchCancel = () => {
    dragState.current.isDragging = false
    snapBack()
  }

  const dialogClassName = ['bottom-sheet', isClosing ? 'bottom-sheet--closing' : '', className ?? '']
    .filter(Boolean)
    .join(' ')

  return (
    <>
      {withBackdrop && <div aria-hidden="true" className={`bottom-sheet__backdrop${(isClosing || isBackdropClosing) ? ' bottom-sheet__backdrop--closing' : ''}`} style={zIndex != null ? { zIndex: zIndex - 1 } : undefined} onPointerDown={handleClose} />}
      <dialog
        ref={dialogRef}
        open
        aria-label={ariaLabel}
        className={dialogClassName}
        style={zIndex != null ? { zIndex } : undefined}
        onClose={handleClose}
        onAnimationEnd={handleAnimationEnd}
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
        onTouchCancel={handleTouchCancel}
      >
        <div className="bottom-sheet__handle" />
        {children}
      </dialog>
    </>
  )
})

export default BottomSheet
