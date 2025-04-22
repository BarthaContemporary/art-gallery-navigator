
import { LogOut } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";

export function MainLayout({ children }: { children: React.ReactNode }) {
  const { signOut } = useAuth();

  return (
    <div className="flex h-screen">
      <div className="flex-1 flex flex-col">
        <header className="h-16 border-b px-4 flex items-center justify-end">
          <Button 
            variant="ghost" 
            size="sm"
            onClick={signOut}
            className="gap-2"
          >
            <LogOut className="h-4 w-4" />
            Logout
          </Button>
        </header>
        <main className="flex-1 overflow-auto">
          {children}
        </main>
      </div>
    </div>
  );
}
