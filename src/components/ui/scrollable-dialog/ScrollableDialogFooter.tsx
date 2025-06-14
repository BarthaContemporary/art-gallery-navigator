
import * as React from "react"
import { cn } from "@/lib/utils"

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

export { ScrollableDialogFooter }
