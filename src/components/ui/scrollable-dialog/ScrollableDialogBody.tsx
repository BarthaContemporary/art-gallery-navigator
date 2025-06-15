
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
  const topSentinelRef = React.useRef<HTMLDivElement>(null)
  const bottomSentinelRef = React.useRef<HTMLDivElement>(null)

  // Unified ref forwarding/combining for outside access + internal
  React.useImperativeHandle(forwardedRef, () => internalRef.current as HTMLDivElement | null);

  React.useEffect(() => {
    const element = internalRef.current
    if (!element) return

    const checkScrollable = () => {
      const scrollable = element.scrollHeight > element.clientHeight
      setIsScrollable(scrollable)
    }

    const resizeObserver = new ResizeObserver(checkScrollable)
    resizeObserver.observe(element)

    const intersectionObserver = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.target === topSentinelRef.current) {
            setIsScrolledToTop(entry.isIntersecting)
          }
          if (entry.target === bottomSentinelRef.current) {
            setIsScrolledToBottom(entry.isIntersecting)
          }
        })
      },
      { root: element, threshold: 0.9 }
    )

    if (topSentinelRef.current) intersectionObserver.observe(topSentinelRef.current)
    if (bottomSentinelRef.current) intersectionObserver.observe(bottomSentinelRef.current)

    // Initial check
    checkScrollable()

    return () => {
      resizeObserver.disconnect()
      intersectionObserver.disconnect()
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
          className
        )}
        {...props}
      >
        <div ref={topSentinelRef} style={{ height: "1px" }} />
        {children}
        <div ref={bottomSentinelRef} style={{ height: "1px" }} />
      </div>
      {showScrollIndicator && isScrollable && !isScrolledToBottom && (
        <div className="absolute bottom-0 left-0 right-0 h-4 bg-gradient-to-t from-background to-transparent z-10 pointer-events-none" />
      )}
    </div>
  )
})
ScrollableDialogBody.displayName = "ScrollableDialogBody"

export { ScrollableDialogBody }
