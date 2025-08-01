
import * as React from "react";
import { cn } from "@/lib/utils";

/**
 * A basic scrollable dialog body for use inside ScrollableDialog.
 * Fills and scrolls as intended, leaves all spacing to children.
 */
const ScrollableDialogBody = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, children, ...props }, forwardedRef) => {
  return (
    <div
      ref={forwardedRef}
      className={cn(
        "flex-1 min-h-0 overflow-y-auto scrollbar-thin scrollbar-thumb-muted scrollbar-track-transparent", // Always fill and scroll
        className
      )}
      tabIndex={0}
      {...props}
    >
      {children}
    </div>
  );
});
ScrollableDialogBody.displayName = "ScrollableDialogBody";

export { ScrollableDialogBody };
