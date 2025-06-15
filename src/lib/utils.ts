
import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function getTruncatedTitleWithYear(title: string | null | undefined, year: string | number | null, maxLength = 26) {
  if (!title) return year ? `Untitled, ${year}` : "Untitled";
  const yearStr = year ? `, ${year}` : "";
  const remaining = maxLength - yearStr.length;
  let displayTitle = title.length > remaining ? title.slice(0, Math.max(0, remaining - 3)) + "..." : title;
  return `${displayTitle}${yearStr}`;
}
