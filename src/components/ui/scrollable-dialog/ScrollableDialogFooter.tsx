
import * as React from "react"
import { cn } from "@/lib/utils"

const ScrollableDialogFooter = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn(
      // Always stays at the bottom (sibling of main body), no blur, just padding.
      "flex flex-col-reverse sm:flex-row sm:justify-end sm:space-x-2 flex-shrink-0 px-6 py-4 border-t bg-background",
      className
    )}
    {...props}
  />
))
ScrollableDialogFooter.displayName = "ScrollableDialogFooter"

export { ScrollableDialogFooter }
