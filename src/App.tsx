import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { MainLayout } from "./components/layout/MainLayout";
import { AuthProvider } from "./providers/auth-provider";
import Dashboard from "./pages/Dashboard";
import Artists from "./pages/Artists";
import Artworks from "./pages/Artworks";
import Locations from "./pages/Locations";
import Projects from "./pages/Projects";
import ProjectDetail from "./pages/ProjectDetail";
import Documents from "./pages/Documents";
import NotFound from "./pages/NotFound";
import Auth from "./pages/Auth";
import RequestPasswordResetPage from "./pages/RequestPasswordReset";
import UpdatePasswordPage from "./pages/UpdatePassword";
import { RequireAuth } from "./components/auth/RequireAuth";
import UserSignup from "./pages/UserSignup";
import Collections from "./pages/Collections";
import Profile from "./pages/Profile";
import EmailConfirmation from "./pages/EmailConfirmation";
import PDFTemplates from "./pages/PDFTemplates";
import Upload from "./pages/Upload";
import FileTransfer from "./pages/FileTransfer";
import ManageAllWebsites from "./pages/ManageAllWebsites";
import PublicCollectionView from "./pages/PublicCollectionView";
import EditCollectionWebsite from "./pages/EditCollectionWebsite";
import BackupExportPage from "./pages/BackupExport";
import { LoadingProvider } from "./contexts/loading-context";
import { LoadingOverlay } from "./components/ui/loading-overlay";
import { ErrorBoundary } from "./components/ui/error-boundary";
import { logger } from "@/lib/logger";


// Create a new QueryClient with enhanced error handling
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 2,
      refetchOnWindowFocus: false,
      meta: {
        onError: (error: Error) => {
          logger.error("Query error:", error);
        }
      }
    },
    mutations: {
      meta: {
        onError: (error: Error) => {
          logger.error("Mutation error:", error);
        }
      }
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
                  <Route path="/request-password-reset" element={<RequestPasswordResetPage />} />
                  <Route path="/update-password" element={<UpdatePasswordPage />} />
                  <Route path="/email-confirmation" element={<EmailConfirmation />} />
                  <Route path="/view-collection/:slug" element={<PublicCollectionView />} />
                  <Route element={<RequireAuth><MainLayout /></RequireAuth>}>
                    <Route path="/" element={<Dashboard />} />
                    <Route path="/artists" element={<Artists />} />
                    <Route path="/artworks" element={<Artworks />} />
                    <Route path="/collections" element={<Collections />} />
                    <Route path="/projects" element={<Projects />} />
                    <Route path="/projects/:id" element={<ProjectDetail />} />
                    <Route path="/locations" element={<Locations />} />
                    <Route path="/documents" element={<Documents />} />
                    <Route path="/signup" element={<UserSignup />} />
                    <Route path="/profile" element={<Profile />} />
                    <Route path="/pdf/:type/:id" element={<PDFTemplates />} />
                    <Route path="/upload" element={<Upload />} />
                    <Route path="/file-transfer" element={<FileTransfer />} />
                    <Route path="/manage-websites" element={<ManageAllWebsites />} />
                    <Route path="/manage-websites/:websiteId/edit" element={<EditCollectionWebsite />} />
                    <Route path="/backup" element={<BackupExportPage />} />
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
