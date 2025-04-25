
import { cn } from "@/lib/utils";

export const getSidebarLinkClasses = (isActive: boolean) => {
  return cn(
    "flex items-center gap-3 w-full no-underline hover:no-underline active:no-underline focus:no-underline",
    isActive ? "bg-primary text-primary-foreground shadow" : "text-gray-800"
  );
};

