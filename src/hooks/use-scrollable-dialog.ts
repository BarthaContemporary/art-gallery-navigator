
import { useCallback, useEffect, useRef, useState } from "react"

interface UseScrollableDialogOptions {
  restoreScrollPosition?: boolean
  scrollToErrorOnValidation?: boolean
  enableKeyboardNavigation?: boolean
}

export function useScrollableDialog(
  isOpen: boolean,
  options: UseScrollableDialogOptions = {}
) {
  const {
    restoreScrollPosition = false,
    scrollToErrorOnValidation = true,
    enableKeyboardNavigation = true
  } = options

  const scrollContainerRef = useRef<HTMLDivElement>(null)
  const [savedScrollPosition, setSavedScrollPosition] = useState(0)

  // Restore scroll position when dialog reopens
  useEffect(() => {
    if (isOpen && restoreScrollPosition && scrollContainerRef.current) {
      scrollContainerRef.current.scrollTop = savedScrollPosition
    }
  }, [isOpen, restoreScrollPosition, savedScrollPosition])

  // Save scroll position when dialog closes
  useEffect(() => {
    if (!isOpen && restoreScrollPosition && scrollContainerRef.current) {
      setSavedScrollPosition(scrollContainerRef.current.scrollTop)
    }
  }, [isOpen, restoreScrollPosition])

  // Scroll to top utility
  const scrollToTop = useCallback(() => {
    if (scrollContainerRef.current) {
      scrollContainerRef.current.scrollTo({
        top: 0,
        behavior: 'smooth'
      })
    }
  }, [])

  // Scroll to element utility
  const scrollToElement = useCallback((selector: string) => {
    if (!scrollContainerRef.current) return

    const element = scrollContainerRef.current.querySelector(selector)
    if (element) {
      element.scrollIntoView({
        behavior: 'smooth',
        block: 'nearest'
      })
    }
  }, [])

  // Scroll to first error
  const scrollToFirstError = useCallback(() => {
    scrollToElement('[data-error="true"], .error, [aria-invalid="true"]')
  }, [scrollToElement])

  // Keyboard navigation
  useEffect(() => {
    if (!enableKeyboardNavigation || !isOpen) return

    const handleKeyDown = (event: KeyboardEvent) => {
      if (!scrollContainerRef.current) return

      switch (event.key) {
        case 'Home':
          event.preventDefault()
          scrollToTop()
          break
        case 'End':
          event.preventDefault()
          scrollContainerRef.current.scrollTo({
            top: scrollContainerRef.current.scrollHeight,
            behavior: 'smooth'
          })
          break
        case 'PageUp':
          event.preventDefault()
          scrollContainerRef.current.scrollBy({
            top: -scrollContainerRef.current.clientHeight * 0.8,
            behavior: 'smooth'
          })
          break
        case 'PageDown':
          event.preventDefault()
          scrollContainerRef.current.scrollBy({
            top: scrollContainerRef.current.clientHeight * 0.8,
            behavior: 'smooth'
          })
          break
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [enableKeyboardNavigation, isOpen, scrollToTop])

  return {
    scrollContainerRef,
    scrollToTop,
    scrollToElement,
    scrollToFirstError
  }
}
