/**
 * Elegant Minimalist Image Loading Animation
 * Refined, subtle loading indicator for image viewers
 */

import { cn } from "@/lib/utils";

interface ImageLoaderProps {
  className?: string;
  dark?: boolean;
  size?: "sm" | "md" | "lg";
}

export function ImageLoader({ className, dark = false, size = "md" }: ImageLoaderProps) {
  const sizeClasses = {
    sm: "w-10 h-10",
    md: "w-14 h-14",
    lg: "w-20 h-20",
  };

  const ringSize = {
    sm: "w-8 h-8",
    md: "w-12 h-12",
    lg: "w-16 h-16",
  };

  const strokeWidth = {
    sm: 1.5,
    md: 2,
    lg: 2.5,
  };

  return (
    <div className={cn("flex items-center justify-center", className)}>
      <div className={cn("relative flex items-center justify-center", sizeClasses[size])}>
        {/* Outer breathing ring */}
        <div
          className={cn(
            "absolute rounded-full border animate-elegant-breathe",
            ringSize[size],
            dark ? "border-white/30" : "border-foreground/20"
          )}
        />
        
        {/* Orbiting arc */}
        <svg
          className={cn("absolute animate-elegant-orbit", ringSize[size])}
          viewBox="0 0 50 50"
        >
          <circle
            cx="25"
            cy="25"
            r="20"
            fill="none"
            stroke={dark ? "rgba(255,255,255,0.7)" : "rgba(0,0,0,0.5)"}
            strokeWidth={strokeWidth[size]}
            strokeLinecap="round"
            strokeDasharray="30 100"
          />
        </svg>

        {/* Center dot */}
        <div
          className={cn(
            "rounded-full animate-elegant-fade",
            size === "sm" ? "w-1.5 h-1.5" : size === "md" ? "w-2 h-2" : "w-2.5 h-2.5",
            dark ? "bg-white" : "bg-foreground"
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
            "w-1 h-3 rounded-full animate-bar-pulse",
            dark ? "bg-white" : "bg-foreground"
          )}
          style={{
            animationDelay: `${i * 0.15}s`,
          }}
        />
      ))}
    </div>
  );
}
