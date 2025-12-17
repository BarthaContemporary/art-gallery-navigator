import { cn } from "@/lib/utils";

export const getSidebarLinkClasses = (isActive: boolean) => {
  return cn(
    "flex items-center gap-3 w-full no-underline hover:no-underline active:no-underline focus:no-underline rounded-xl transition-all duration-200",
    isActive 
      ? "bg-slate-900 text-white shadow-sm" 
      : "text-slate-700 hover:bg-slate-100 hover:text-slate-900 active:bg-slate-200 active:scale-[0.98]"
  );
};