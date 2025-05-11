
import { AlertTriangle, RefreshCw, Home } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter, CardHeader } from "@/components/ui/card";
import { useNavigate } from "react-router-dom";

interface ErrorDisplayProps {
  error: Error | string | null;
  resetError?: () => void;
  title?: string;
  showHomeButton?: boolean;
  showRefreshButton?: boolean;
}

export function ErrorDisplay({
  error,
  resetError,
  title = "Something went wrong",
  showHomeButton = true,
  showRefreshButton = true,
}: ErrorDisplayProps) {
  const navigate = useNavigate();
  const errorMessage = error instanceof Error ? error.message : error;

  return (
    <Card className="border-red-200 shadow-md max-w-md mx-auto">
      <CardHeader className="bg-red-50 dark:bg-red-900/20 flex flex-row items-center gap-3 pb-2">
        <AlertTriangle className="h-5 w-5 text-red-600" />
        <h3 className="font-semibold text-red-800 dark:text-red-300">{title}</h3>
      </CardHeader>
      <CardContent className="pt-4 pb-2">
        <p className="text-sm text-gray-600 dark:text-gray-300 mb-2">
          {errorMessage || "An unexpected error occurred"}
        </p>
        
        {process.env.NODE_ENV === 'development' && error instanceof Error && error.stack && (
          <details className="mt-2">
            <summary className="text-xs text-gray-500 cursor-pointer">Error details</summary>
            <pre className="text-xs mt-2 p-2 bg-gray-100 dark:bg-gray-800 rounded overflow-auto max-h-[200px]">
              {error.stack}
            </pre>
          </details>
        )}
      </CardContent>
      <CardFooter className="flex justify-end gap-2 pt-2 pb-4">
        {showHomeButton && (
          <Button 
            variant="outline" 
            size="sm"
            onClick={() => navigate("/")}
            className="text-xs"
          >
            <Home className="h-3.5 w-3.5 mr-1" />
            Home
          </Button>
        )}
        
        {showRefreshButton && (
          <Button 
            variant="default" 
            size="sm"
            onClick={() => {
              if (resetError) {
                resetError();
              } else {
                window.location.reload();
              }
            }}
            className="text-xs"
          >
            <RefreshCw className="h-3.5 w-3.5 mr-1" />
            Retry
          </Button>
        )}
      </CardFooter>
    </Card>
  );
}
