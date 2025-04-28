
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { MainLayout } from "./components/layout/MainLayout";
import { AuthProvider } from "./hooks/use-auth";
import Dashboard from "./pages/Dashboard";
import Artists from "./pages/Artists";
import Artworks from "./pages/Artworks";
import Locations from "./pages/Locations";
import Documents from "./pages/Documents";
import NotFound from "./pages/NotFound";
import Auth from "./pages/Auth";
import { RequireAuth } from "./components/auth/RequireAuth";
import UserSignup from "./pages/UserSignup";
import Collections from "./pages/Collections";
import Profile from "./pages/Profile";
import EmailConfirmation from "./pages/EmailConfirmation";
import PDFTemplates from "./pages/PDFTemplates";
import Upload from "./pages/Upload";
import FileTransfer from "./pages/FileTransfer";
import { LoadingProvider } from "./contexts/loading-context";
import { LoadingOverlay } from "./components/ui/loading-overlay";
import { ErrorBoundary } from "./components/ui/error-boundary";

// Create a new QueryClient to manage our React Query state
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false,
      useErrorBoundary: true
    }
  }
});

const App = () => (
  <ErrorBoundary>
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <ErrorBoundary>
          <AuthProvider>
            <LoadingProvider>
              <TooltipProvider>
                <Toaster />
                <Sonner />
                <LoadingOverlay />
                <Routes>
                  <Route path="/auth" element={<Auth />} />
                  <Route path="/email-confirmation" element={<EmailConfirmation />} />
                  <Route element={<RequireAuth><MainLayout /></RequireAuth>}>
                    <Route path="/" element={<Dashboard />} />
                    <Route path="/artists" element={<Artists />} />
                    <Route path="/artworks" element={<Artworks />} />
                    <Route path="/collections" element={<Collections />} />
                    <Route path="/locations" element={<Locations />} />
                    <Route path="/documents" element={<Documents />} />
                    <Route path="/signup" element={<UserSignup />} />
                    <Route path="/profile" element={<Profile />} />
                    <Route path="/pdf/:type/:id" element={<PDFTemplates />} />
                    <Route path="/upload" element={<Upload />} />
                    <Route path="/file-transfer" element={<FileTransfer />} />
                  </Route>
                  <Route path="*" element={<NotFound />} />
                </Routes>
              </TooltipProvider>
            </LoadingProvider>
          </AuthProvider>
        </ErrorBoundary>
      </BrowserRouter>
    </QueryClientProvider>
  </ErrorBoundary>
);

export default App;
