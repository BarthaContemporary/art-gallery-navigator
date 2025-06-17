
import * as React from "react";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { cn } from "@/lib/utils";
import { ScrollableDialogOverlay } from "./ScrollableDialogOverlay";
import { ScrollableDialogPortal } from "./ScrollableDialogPortal";

/**
 * Content root for the ScrollableDialog.
 * Sets up proper max height using 90vh as a fallback for all browsers;
 * parent component must ensure correct flex layout for children.
 */
const ScrollableDialogContent = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Content> & {
    size?: "sm" | "md" | "lg" | "xl" | "2xl" | "3xl" | "4xl" | "full";
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
    full: "max-w-[95vw]",
  };

  return (
    <ScrollableDialogPortal>
      <ScrollableDialogOverlay />
      <DialogPrimitive.Content
        ref={ref}
        className={cn(
          // Position and animation
          "fixed left-[50%] top-[50%] z-50 grid w-full translate-x-[-50%] translate-y-[-50%] border bg-background shadow-lg duration-200",
          "data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[state=closed]:slide-out-to-left-1/2 data-[state=closed]:slide-out-to-top-[48%] data-[state=open]:slide-in-from-left-1/2 data-[state=open]:slide-in-from-top-[48%]",
          // Layout
          "flex flex-col max-h-[90vh] sm:rounded-lg", // Use 90vh for better cross-browser support; parent handles flex
          sizeClasses[size],
          className
        )}
        {...props}
      >
        {children}
      </DialogPrimitive.Content>
    </ScrollableDialogPortal>
  );
});
ScrollableDialogContent.displayName = DialogPrimitive.Content.displayName;

export { ScrollableDialogContent };
