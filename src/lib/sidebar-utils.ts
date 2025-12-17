import { cn } from "@/lib/utils";

export const getSidebarLinkClasses = (isActive: boolean) => {
  return cn(
    "flex items-center gap-3 w-full no-underline hover:no-underline active:no-underline focus:no-underline rounded-xl transition-all duration-200",
    isActive 
      ? "bg-primary text-primary-foreground shadow-sm" 
      : "text-white/90 hover:bg-white/10 hover:text-white active:bg-white/15 active:scale-[0.98]"
  );
};