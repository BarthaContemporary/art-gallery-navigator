
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/providers/auth-provider";
import { useAuth } from "@/hooks/use-auth";
import { useNotifications } from "@/hooks/use-notifications";
import { useEffect } from "react";
import { MainLayout } from "@/components/layout/MainLayout";
import Dashboard from "@/pages/Dashboard";
import Artists from "@/pages/Artists";
import Artworks from "@/pages/Artworks";
import Collections from "@/pages/Collections";
import Documents from "@/pages/Documents";
import Locations from "@/pages/Locations";
import Projects from "@/pages/Projects";
import ProjectDetail from "@/pages/ProjectDetail";
import Chat from "@/pages/Chat";
import Upload from "@/pages/Upload";
import Auth from "@/pages/Auth";
import Profile from "@/pages/Profile";
import NotFound from "@/pages/NotFound";
import PDFTemplates from "@/pages/PDFTemplates";
import BackupExport from "@/pages/BackupExport";
import EmailConfirmation from "@/pages/EmailConfirmation";
import RequestPasswordReset from "@/pages/RequestPasswordReset";
import UpdatePassword from "@/pages/UpdatePassword";
import FileTransfer from "@/pages/FileTransfer";
import UserSignup from "@/pages/UserSignup";
import PublicCollectionView from "@/pages/PublicCollectionView";
import EditCollectionWebsite from "@/pages/EditCollectionWebsite";
import ManageAllWebsites from "@/pages/ManageAllWebsites";
import { RequireAuth } from "@/components/auth/RequireAuth";

const queryClient = new QueryClient();

function AppContent() {
  const { user } = useAuth();
  const { requestPermission, isSupported } = useNotifications();

  useEffect(() => {
    // Request notification permission when user logs in
    if (user && isSupported) {
      // Only request if permission hasn't been granted or denied yet
      if (Notification.permission === 'default') {
        requestPermission();
      }
    }
  }, [user, isSupported, requestPermission]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100">
      <Routes>
        {/* Public routes */}
        <Route path="/auth" element={<Auth />} />
        <Route path="/email-confirmation" element={<EmailConfirmation />} />
        <Route path="/request-password-reset" element={<RequestPasswordReset />} />
        <Route path="/update-password" element={<UpdatePassword />} />
        <Route path="/signup" element={<UserSignup />} />
        <Route path="/collection/:slug" element={<PublicCollectionView />} />
        
        {/* Protected routes */}
        <Route path="/" element={<RequireAuth><MainLayout /></RequireAuth>}>
          <Route index element={<Dashboard />} />
          <Route path="artists" element={<Artists />} />
          <Route path="artworks" element={<Artworks />} />
          <Route path="collections" element={<Collections />} />
          <Route path="documents" element={<Documents />} />
          <Route path="locations" element={<Locations />} />
          <Route path="projects" element={<Projects />} />
          <Route path="projects/:id" element={<ProjectDetail />} />
          <Route path="chat" element={<Chat />} />
          <Route path="upload" element={<Upload />} />
          <Route path="profile" element={<Profile />} />
          <Route path="pdf-templates" element={<PDFTemplates />} />
          <Route path="backup-export" element={<BackupExport />} />
          <Route path="file-transfer" element={<FileTransfer />} />
          <Route path="edit-collection-website/:id" element={<EditCollectionWebsite />} />
          <Route path="manage-all-websites" element={<ManageAllWebsites />} />
        </Route>
        
        <Route path="*" element={<NotFound />} />
      </Routes>
      <Toaster />
      <Sonner />
    </div>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <AuthProvider>
          <TooltipProvider>
            <AppContent />
          </TooltipProvider>
        </AuthProvider>
      </BrowserRouter>
    </QueryClientProvider>
  );
}

export default App;
