
import * as React from "react"
import { cn } from "@/lib/utils"

const ScrollableDialogBody = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement> & {
    showScrollIndicator?: boolean
  }
>(({ className, children, showScrollIndicator = true, ...props }, forwardedRef) => {
  const [isScrollable, setIsScrollable] = React.useState(false)
  const [isScrolledToTop, setIsScrolledToTop] = React.useState(true)
  const [isScrolledToBottom, setIsScrolledToBottom] = React.useState(false)
  const internalRef = React.useRef<HTMLDivElement>(null)

  // Unified ref forwarding/combining for outside access + internal
  React.useImperativeHandle(forwardedRef, () => internalRef.current as HTMLDivElement | null);

  React.useEffect(() => {
    const element = internalRef.current
    if (!element) return

    const checkScrollable = () => {
      const scrollable = element.scrollHeight > element.clientHeight
      setIsScrollable(scrollable)

      if (scrollable) {
        const isAtTop = element.scrollTop === 0
        const isAtBottom = element.scrollTop + element.clientHeight >= element.scrollHeight - 1
        setIsScrolledToTop(isAtTop)
        setIsScrolledToBottom(isAtBottom)
      } else {
        setIsScrolledToTop(true)
        setIsScrolledToBottom(true)
      }
    }

    const handleScroll = () => {
      checkScrollable()
    }

    checkScrollable()
    element.addEventListener('scroll', handleScroll)

    const resizeObserver = new ResizeObserver(checkScrollable)
    resizeObserver.observe(element)

    return () => {
      element.removeEventListener('scroll', handleScroll)
      resizeObserver.disconnect()
    }
  }, [children])

  return (
    <div className="relative flex-1 min-h-0">
      {showScrollIndicator && isScrollable && !isScrolledToTop && (
        <div className="absolute top-0 left-0 right-0 h-4 bg-gradient-to-b from-background to-transparent z-10 pointer-events-none" />
      )}
      <div
        ref={internalRef}
        className={cn(
          "flex-1 overflow-y-auto px-6 py-4",
          "scrollbar-thin scrollbar-thumb-muted scrollbar-track-transparent",
          className
        )}
        {...props}
      >
        {children}
      </div>
      {showScrollIndicator && isScrollable && !isScrolledToBottom && (
        <div className="absolute bottom-0 left-0 right-0 h-4 bg-gradient-to-t from-background to-transparent z-10 pointer-events-none" />
      )}
    </div>
  )
})
ScrollableDialogBody.displayName = "ScrollableDialogBody"

export { ScrollableDialogBody }
