
import React from "react";
import { Button } from "@/components/ui/button";
import { AlertTriangle, RefreshCw } from "lucide-react";
import { logger } from "@/lib/logger";

interface DocumentsErrorBoundaryProps {
  children: React.ReactNode;
}

interface DocumentsErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
  errorInfo: React.ErrorInfo | null;
}

export class DocumentsErrorBoundary extends React.Component<
  DocumentsErrorBoundaryProps,
  DocumentsErrorBoundaryState
> {
  constructor(props: DocumentsErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }

  static getDerivedStateFromError(error: Error): DocumentsErrorBoundaryState {
    return { hasError: true, error, errorInfo: null };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo): void {
    logger.error("Documents Error Boundary caught error:", error, errorInfo);
    console.error("Documents page error details:", {
      error: error.message,
      stack: error.stack,
      componentStack: errorInfo.componentStack
    });
    this.setState({ errorInfo });
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex flex-col items-center justify-center min-h-[50vh] p-6 text-center">
          <AlertTriangle className="h-12 w-12 text-red-500 mb-4" />
          <h2 className="text-2xl font-bold mb-2">Documents Failed to Load</h2>
          <p className="text-muted-foreground mb-4 max-w-md">
            There was an error loading the documents page. This might be due to authentication, 
            database connectivity, or component issues.
          </p>
          <div className="text-sm text-left bg-gray-100 p-3 rounded mb-4 max-w-md">
            <strong>Error:</strong> {this.state.error?.message}
          </div>
          <div className="flex gap-2">
            <Button
              onClick={() => {
                this.setState({ hasError: false, error: null, errorInfo: null });
                window.location.reload();
              }}
              variant="default"
            >
              <RefreshCw className="h-4 w-4 mr-2" />
              Reload Page
            </Button>
            <Button
              onClick={() => this.setState({ hasError: false, error: null, errorInfo: null })}
              variant="outline"
            >
              Try Again
            </Button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
