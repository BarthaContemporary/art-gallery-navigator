import { cn } from "@/lib/utils";

export const getSidebarLinkClasses = (isActive: boolean) => {
  return cn(
    "flex items-center gap-3 w-full no-underline hover:no-underline active:no-underline focus:no-underline rounded-xl transition-all duration-200",
    isActive 
      ? "bg-primary text-primary-foreground shadow-sm" 
      : "text-foreground hover:bg-secondary active:bg-secondary-hover active:scale-[0.98]"
  );
};