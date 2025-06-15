
import * as React from "react";
import { cn } from "@/lib/utils";

/**
 * A scrollable dialog body container intended for use inside ScrollableDialog.
 * Applies correct height and overflow (overflow-y-auto) and handles scroll indicators.
 * Uses IntersectionObserver to detect when scroll position is at the top/bottom.
 */
const ScrollableDialogBody = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement> & {
    showScrollIndicator?: boolean;
  }
>(({ className, children, showScrollIndicator = true, ...props }, forwardedRef) => {
  const [isScrollable, setIsScrollable] = React.useState(false);
  const [isScrolledToTop, setIsScrolledToTop] = React.useState(true);
  const [isScrolledToBottom, setIsScrolledToBottom] = React.useState(false);
  const internalRef = React.useRef<HTMLDivElement>(null);
  const topSentinelRef = React.useRef<HTMLDivElement>(null);
  const bottomSentinelRef = React.useRef<HTMLDivElement>(null);

  // Support ref forwarding
  React.useImperativeHandle(forwardedRef, () => internalRef.current as HTMLDivElement | null);

  React.useEffect(() => {
    const element = internalRef.current;
    if (!element) return;

    // Check if content is scrollable
    const checkScrollable = () => {
      setIsScrollable(element.scrollHeight > element.clientHeight);
    };

    const resizeObserver = new ResizeObserver(checkScrollable);
    resizeObserver.observe(element);

    // IntersectionObserver for scroll position
    let intersectionObserver: IntersectionObserver;
    if (typeof window !== "undefined" && "IntersectionObserver" in window) {
      intersectionObserver = new IntersectionObserver(
        (entries) => {
          entries.forEach((entry) => {
            if (entry.target === topSentinelRef.current) {
              setIsScrolledToTop(entry.isIntersecting);
            }
            if (entry.target === bottomSentinelRef.current) {
              setIsScrolledToBottom(entry.isIntersecting);
            }
          });
        },
        { root: element, threshold: 0.95 }
      );

      if (topSentinelRef.current) intersectionObserver.observe(topSentinelRef.current);
      if (bottomSentinelRef.current) intersectionObserver.observe(bottomSentinelRef.current);
    }

    // Initial check
    checkScrollable();

    return () => {
      resizeObserver.disconnect();
      if (intersectionObserver) intersectionObserver.disconnect();
    };
  }, [children]);

  // Fallback scroll detection (works even if IntersectionObserver fails)
  const fallbackOnScroll = React.useCallback(() => {
    const element = internalRef.current;
    if (!element) return;
    setIsScrolledToTop(element.scrollTop === 0);
    setIsScrolledToBottom(
      Math.abs(element.scrollHeight - element.scrollTop - element.clientHeight) < 2
    );
  }, []);

  React.useEffect(() => {
    const element = internalRef.current;
    if (!element) return;
    element.addEventListener("scroll", fallbackOnScroll, { passive: true });
    return () => {
      element.removeEventListener("scroll", fallbackOnScroll);
    };
  }, [fallbackOnScroll]);

  // Use a static class for height/overflow; dialog parent handles available height.
  return (
    <div className="relative flex-1 min-h-0">
      {showScrollIndicator && isScrollable && !isScrolledToTop && (
        <div className="absolute top-0 left-0 right-0 h-4 bg-gradient-to-b from-background to-transparent z-20 pointer-events-none" />
      )}
      <div
        ref={internalRef}
        className={cn(
          "overflow-y-auto px-6 py-4 flex-1 min-h-0", // flex-1 ensures it expands properly
          className
        )}
        tabIndex={0}
        {...props}
      >
        <div ref={topSentinelRef} style={{ height: 1 }} />
        {children}
        <div ref={bottomSentinelRef} style={{ height: 1 }} />
      </div>
      {showScrollIndicator && isScrollable && !isScrolledToBottom && (
        <div className="absolute bottom-0 left-0 right-0 h-4 bg-gradient-to-t from-background to-transparent z-20 pointer-events-none" />
      )}
    </div>
  );
});
ScrollableDialogBody.displayName = "ScrollableDialogBody";

export { ScrollableDialogBody };

