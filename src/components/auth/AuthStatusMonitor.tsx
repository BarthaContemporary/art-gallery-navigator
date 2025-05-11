
import { useEffect, useState } from "react";
import { useAuth } from "@/hooks/use-auth";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter, CardHeader } from "@/components/ui/card";
import { RefreshCw, AlertCircle, CheckCircle2 } from "lucide-react";

// This component is only shown in development mode
export function AuthStatusMonitor() {
  const { user, session } = useAuth();
  const [lastEvent, setLastEvent] = useState<string | null>(null);
  const [statusChecked, setStatusChecked] = useState(false);
  const [isHealthy, setIsHealthy] = useState<boolean | null>(null);
  
  // Only show in development
  if (process.env.NODE_ENV !== "development") {
    return null;
  }
  
  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      setLastEvent(event);
      console.log("Auth event:", event);
    });
    
    return () => {
      subscription.unsubscribe();
    };
  }, []);
  
  const checkAuthStatus = async () => {
    setStatusChecked(true);
    try {
      const { data } = await supabase.auth.getSession();
      console.log("Current session:", data.session);
      setIsHealthy(true);
    } catch (error) {
      console.error("Auth check failed:", error);
      setIsHealthy(false);
    }
  };
  
  return (
    <Card className="fixed bottom-4 right-4 w-64 shadow-lg border-yellow-200 bg-white/90 backdrop-blur-sm z-50">
      <CardHeader className="py-2 px-3 bg-yellow-50 border-b border-yellow-100">
        <div className="flex justify-between items-center">
          <h3 className="text-xs font-semibold text-yellow-800">Auth Status Monitor</h3>
          {isHealthy !== null && (
            isHealthy ? 
              <CheckCircle2 className="h-4 w-4 text-green-500" /> : 
              <AlertCircle className="h-4 w-4 text-red-500" />
          )}
        </div>
      </CardHeader>
      <CardContent className="p-3 text-xs space-y-2">
        <div>
          <span className="font-semibold">User:</span> {user ? "Authenticated" : "Not authenticated"}
        </div>
        <div>
          <span className="font-semibold">Session:</span> {session ? "Active" : "None"}
        </div>
        {lastEvent && (
          <div>
            <span className="font-semibold">Last event:</span> {lastEvent}
          </div>
        )}
      </CardContent>
      <CardFooter className="p-2 pt-0 flex justify-end">
        <Button size="sm" variant="outline" onClick={checkAuthStatus} className="text-xs h-7">
          <RefreshCw className="h-3 w-3 mr-1" />
          Check Status
        </Button>
      </CardFooter>
    </Card>
  );
}
