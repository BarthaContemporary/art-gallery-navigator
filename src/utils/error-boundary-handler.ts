/**
 * Enhanced error handling and reporting
 */

export interface ErrorInfo {
  componentStack: string;
  errorBoundary?: string;
}

export interface ErrorReport {
  message: string;
  stack?: string;
  componentStack?: string;
  timestamp: number;
  userAgent: string;
  url: string;
  userId?: string;
}

class ErrorReporter {
  private static instance: ErrorReporter;
  private errors: ErrorReport[] = [];
  private maxErrors = 50;

  static getInstance(): ErrorReporter {
    if (!ErrorReporter.instance) {
      ErrorReporter.instance = new ErrorReporter();
    }
    return ErrorReporter.instance;
  }

  captureError(error: Error, errorInfo?: ErrorInfo, userId?: string) {
    const report: ErrorReport = {
      message: error.message,
      stack: error.stack,
      componentStack: errorInfo?.componentStack,
      timestamp: Date.now(),
      userAgent: navigator.userAgent,
      url: window.location.href,
      userId,
    };

    this.errors.push(report);

    // Keep only recent errors
    if (this.errors.length > this.maxErrors) {
      this.errors = this.errors.slice(-this.maxErrors);
    }

    // Log in development
    if (process.env.NODE_ENV === 'development') {
      console.error('Error captured:', report);
    }

    // In production, you would send this to your error reporting service
    this.reportToService(report);
  }

  private async reportToService(report: ErrorReport) {
    // Only report in production to avoid spam during development
    if (process.env.NODE_ENV !== 'production') return;

    try {
      // Here you would integrate with your error reporting service
      // e.g., Sentry, LogRocket, Bugsnag, etc.
      console.log('Would report error to service:', report);
    } catch (error) {
      // Fail silently to avoid infinite error loops
    }
  }

  getRecentErrors(): ErrorReport[] {
    return [...this.errors].reverse();
  }

  clearErrors() {
    this.errors = [];
  }
}

export default ErrorReporter;
