import * as React from "react"
import * as DialogPrimitive from "@radix-ui/react-dialog"
import { X } from "lucide-react"
import { cn } from "@/lib/utils"

const ScrollableDialog = DialogPrimitive.Root

const ScrollableDialogTrigger = DialogPrimitive.Trigger

const ScrollableDialogPortal = DialogPrimitive.Portal

const ScrollableDialogClose = DialogPrimitive.Close

const ScrollableDialogOverlay = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Overlay>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Overlay>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Overlay
    ref={ref}
    className={cn(
      "fixed inset-0 z-50 bg-black/80 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0",
      className
    )}
    {...props}
  />
))
ScrollableDialogOverlay.displayName = DialogPrimitive.Overlay.displayName

const ScrollableDialogContent = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Content> & {
    size?: "sm" | "md" | "lg" | "xl" | "2xl" | "3xl" | "4xl" | "full"
  }
>(({ className, children, size = "lg", ...props }, ref) => {
  const sizeClasses = {
    sm: "max-w-sm",
    md: "max-w-md", 
    lg: "max-w-lg",
    xl: "max-w-xl",
    "2xl": "max-w-2xl",
    "3xl": "max-w-3xl",
    "4xl": "max-w-4xl",
    full: "max-w-[95vw]"
  }

  return (
    <ScrollableDialogPortal>
      <ScrollableDialogOverlay />
      <DialogPrimitive.Content
        ref={ref}
        className={cn(
          "fixed left-[50%] top-[50%] z-50 grid w-full translate-x-[-50%] translate-y-[-50%] border bg-background shadow-lg duration-200 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[state=closed]:slide-out-to-left-1/2 data-[state=closed]:slide-out-to-top-[48%] data-[state=open]:slide-in-from-left-1/2 data-[state=open]:slide-in-from-top-[48%] sm:rounded-lg",
          "flex flex-col max-h-[90vh]",
          sizeClasses[size],
          className
        )}
        {...props}
      >
        {children}
        <DialogPrimitive.Close className="absolute right-4 top-4 z-[60] rounded-sm opacity-70 ring-offset-background transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:pointer-events-none data-[state=open]:bg-accent data-[state=open]:text-muted-foreground">
          <X className="h-4 w-4" />
          <span className="sr-only">Close</span>
        </DialogPrimitive.Close>
      </DialogPrimitive.Content>
    </ScrollableDialogPortal>
  )
})
ScrollableDialogContent.displayName = DialogPrimitive.Content.displayName

const ScrollableDialogHeader = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn(
      "flex flex-col space-y-1.5 text-center sm:text-left",
      "flex-shrink-0 p-6 pb-4 border-b",
      className
    )}
    {...props}
  />
))
ScrollableDialogHeader.displayName = "ScrollableDialogHeader"

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

const ScrollableDialogFooter = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn(
      "flex flex-col-reverse sm:flex-row sm:justify-end sm:space-x-2",
      "flex-shrink-0 p-6 pt-4 border-t bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60",
      className
    )}
    {...props}
  />
))
ScrollableDialogFooter.displayName = "ScrollableDialogFooter"

const ScrollableDialogTitle = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Title>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Title>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Title
    ref={ref}
    className={cn(
      "text-lg font-semibold leading-none tracking-tight",
      className
    )}
    {...props}
  />
))
ScrollableDialogTitle.displayName = DialogPrimitive.Title.displayName

const ScrollableDialogDescription = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Description>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Description>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Description
    ref={ref}
    className={cn("text-sm text-muted-foreground", className)}
    {...props}
  />
))
ScrollableDialogDescription.displayName = DialogPrimitive.Description.displayName

export {
  ScrollableDialog,
  ScrollableDialogPortal,
  ScrollableDialogOverlay,
  ScrollableDialogClose,
  ScrollableDialogTrigger,
  ScrollableDialogContent,
  ScrollableDialogHeader,
  ScrollableDialogBody,
  ScrollableDialogFooter,
  ScrollableDialogTitle,
  ScrollableDialogDescription,
}
