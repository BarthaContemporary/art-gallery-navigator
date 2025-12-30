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
    sm: 32,
    md: 48,
    lg: 64,
  };

  const strokeWidth = {
    sm: 2,
    md: 2.5,
    lg: 3,
  };

  const radius = {
    sm: 12,
    md: 18,
    lg: 24,
  };

  const circumference = 2 * Math.PI * radius[size];
  const dashLength = circumference * 0.25;

  return (
    <div className={cn("flex items-center justify-center", className)}>
      <div className={cn("relative flex items-center justify-center", sizeClasses[size])}>
        {/* Static track ring */}
        <svg
          className="absolute"
          width={ringSize[size]}
          height={ringSize[size]}
          viewBox={`0 0 ${ringSize[size]} ${ringSize[size]}`}
        >
          <circle
            cx={ringSize[size] / 2}
            cy={ringSize[size] / 2}
            r={radius[size]}
            fill="none"
            stroke={dark ? "rgba(255,255,255,0.15)" : "rgba(0,0,0,0.1)"}
            strokeWidth={strokeWidth[size]}
          />
        </svg>

        {/* Animated arc */}
        <svg
          className="absolute animate-elegant-orbit"
          width={ringSize[size]}
          height={ringSize[size]}
          viewBox={`0 0 ${ringSize[size]} ${ringSize[size]}`}
          style={{ transform: 'rotate(-90deg)' }}
        >
          <circle
            cx={ringSize[size] / 2}
            cy={ringSize[size] / 2}
            r={radius[size]}
            fill="none"
            stroke={dark ? "rgba(255,255,255,0.8)" : "rgba(0,0,0,0.6)"}
            strokeWidth={strokeWidth[size]}
            strokeLinecap="round"
            strokeDasharray={`${dashLength} ${circumference - dashLength}`}
          />
        </svg>
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
