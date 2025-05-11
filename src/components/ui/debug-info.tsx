
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { ChevronDown, ChevronUp, Bug } from "lucide-react";

interface DebugInfoProps {
  data: any;
  title?: string;
  showInProduction?: boolean;
}

export function DebugInfo({ 
  data, 
  title = "Debug Info",
  showInProduction = false 
}: DebugInfoProps) {
  const [isOpen, setIsOpen] = useState(false);
  
  // Only show in development by default
  const isDevelopment = process.env.NODE_ENV === "development";
  if (!showInProduction && !isDevelopment) {
    return null;
  }

  return (
    <Card className="my-4 border-dashed border-yellow-500">
      <CardHeader className="py-2 px-4 bg-yellow-50 dark:bg-yellow-900/20">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Bug className="h-4 w-4 text-yellow-600" />
            <CardTitle className="text-sm text-yellow-800 dark:text-yellow-400">{title}</CardTitle>
          </div>
          <Collapsible open={isOpen} onOpenChange={setIsOpen}>
            <CollapsibleTrigger asChild>
              <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                {isOpen ? (
                  <ChevronUp className="h-4 w-4" />
                ) : (
                  <ChevronDown className="h-4 w-4" />
                )}
              </Button>
            </CollapsibleTrigger>
            <CollapsibleContent>
              <CardContent className="p-4">
                <pre className="text-xs overflow-auto max-h-[300px] p-2 bg-slate-100 dark:bg-slate-900 rounded">
                  {JSON.stringify(data, null, 2)}
                </pre>
              </CardContent>
            </CollapsibleContent>
          </Collapsible>
        </div>
      </CardHeader>
    </Card>
  );
}
