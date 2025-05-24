import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { MainLayout } from "./components/layout/MainLayout";
import { AuthProvider } from "./providers/auth-provider"; // Updated import path
import Dashboard from "./pages/Dashboard";
import Artists from "./pages/Artists";
import Artworks from "./pages/Artworks";
import Locations from "./pages/Locations";
import Projects from "./pages/Projects";
import ProjectDetail from "./pages/ProjectDetail";
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
import ManageAllWebsites from "./pages/ManageAllWebsites"; // Added import
import PublicCollectionView from "./pages/PublicCollectionView"; // Added import
import { LoadingProvider } from "./contexts/loading-context";
import { LoadingOverlay } from "./components/ui/loading-overlay";
import { ErrorBoundary } from "./components/ui/error-boundary";

// Create a new QueryClient with enhanced error handling
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 2,
      refetchOnWindowFocus: false,
      // Updated to use newer meta pattern for onError
      meta: {
        onError: (error: Error) => {
          console.error("Query error:", error);
        }
      }
    },
    mutations: {
      // Updated to use newer meta pattern for onError
      meta: {
        onError: (error: Error) => {
          console.error("Mutation error:", error);
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
              {/* Removed ProjectMembersProvider wrapper */}
              <TooltipProvider>
                <Toaster />
                <Sonner />
                <LoadingOverlay />
                <Routes>
                  <Route path="/auth" element={<Auth />} />
                  <Route path="/email-confirmation" element={<EmailConfirmation />} />
                  <Route path="/view-collection/:slug" element={<PublicCollectionView />} /> {/* Added new public route */}
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
                    <Route path="/manage-websites" element={<ManageAllWebsites />} /> {/* Added route */}
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
