/**
 * Modern Minimalist Image Loading Animation
 * Clean, elegant loading indicator for image viewers
 */

import { cn } from "@/lib/utils";

interface ImageLoaderProps {
  className?: string;
  dark?: boolean;
  size?: "sm" | "md" | "lg";
}

export function ImageLoader({ className, dark = false, size = "md" }: ImageLoaderProps) {
  const sizeClasses = {
    sm: "w-8 h-8",
    md: "w-12 h-12",
    lg: "w-16 h-16",
  };

  const dotSizes = {
    sm: "w-1.5 h-1.5",
    md: "w-2 h-2",
    lg: "w-2.5 h-2.5",
  };

  return (
    <div className={cn("flex items-center justify-center", className)}>
      <div className={cn("relative", sizeClasses[size])}>
        {/* Pulsing ring */}
        <div
          className={cn(
            "absolute inset-0 rounded-full animate-ping opacity-20",
            dark ? "bg-white" : "bg-foreground"
          )}
          style={{ animationDuration: "2s" }}
        />
        
        {/* Rotating dots */}
        <div className="absolute inset-0 animate-spin" style={{ animationDuration: "1.5s" }}>
          {[0, 1, 2, 3].map((i) => (
            <div
              key={i}
              className={cn(
                "absolute rounded-full",
                dotSizes[size],
                dark ? "bg-white" : "bg-foreground"
              )}
              style={{
                top: "50%",
                left: "50%",
                transform: `rotate(${i * 90}deg) translateY(-${size === "sm" ? 12 : size === "md" ? 18 : 24}px) translateX(-50%)`,
                opacity: 0.3 + (i * 0.2),
              }}
            />
          ))}
        </div>

        {/* Center dot with pulse */}
        <div
          className={cn(
            "absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full animate-pulse",
            size === "sm" ? "w-2 h-2" : size === "md" ? "w-3 h-3" : "w-4 h-4",
            dark ? "bg-white/80" : "bg-foreground/80"
          )}
        />
      </div>
    </div>
  );
}

/**
 * Shimmer loading effect for image placeholders
 */
export function ImageShimmer({ className, dark = false }: { className?: string; dark?: boolean }) {
  return (
    <div
      className={cn(
        "relative overflow-hidden",
        dark ? "bg-white/5" : "bg-foreground/5",
        className
      )}
    >
      <div
        className={cn(
          "absolute inset-0 -translate-x-full animate-[shimmer_2s_infinite]",
          dark
            ? "bg-gradient-to-r from-transparent via-white/10 to-transparent"
            : "bg-gradient-to-r from-transparent via-foreground/10 to-transparent"
        )}
      />
    </div>
  );
}

/**
 * Minimal bar loader
 */
export function BarLoader({ className, dark = false }: { className?: string; dark?: boolean }) {
  return (
    <div className={cn("flex items-center justify-center gap-1", className)}>
      {[0, 1, 2, 3, 4].map((i) => (
        <div
          key={i}
          className={cn(
            "w-1 rounded-full animate-pulse",
            dark ? "bg-white" : "bg-foreground"
          )}
          style={{
            height: `${12 + Math.sin(i * 0.8) * 8}px`,
            animationDelay: `${i * 0.15}s`,
            animationDuration: "0.8s",
          }}
        />
      ))}
    </div>
  );
}
