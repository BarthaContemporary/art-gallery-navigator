
import * as React from "react"
import { cn } from "@/lib/utils"

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

export { ScrollableDialogHeader }
