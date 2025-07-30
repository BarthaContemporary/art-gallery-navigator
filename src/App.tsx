
import {
  BrowserRouter,
  Routes,
  Route,
  Navigate,
} from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "sonner";

import { MainLayout } from "@/components/layout/MainLayout";
import { RequireAuth } from "@/components/auth/RequireAuth";
import { AdminRoute } from "@/components/auth/AdminRoute";
import { AuthProvider } from "@/providers/auth-provider";
import { LoadingProvider } from "@/contexts/loading-context";
import { SecurityProvider } from "@/components/security/SecurityProvider";
import { CurrencyProvider } from "@/contexts/CurrencyContext";
import Dashboard from "@/pages/Dashboard";
import Artists from "@/pages/Artists";
import Artworks from "@/pages/Artworks";
import Collections from "@/pages/Collections";
import Documents from "@/pages/Documents";
import FileSharing from "@/pages/FileSharing";
import Projects from "@/pages/Projects";
import Locations from "@/pages/Locations";
import Profile from "@/pages/Profile";
import Auth from "@/pages/Auth";
import GoogleCalendarAppointments from "@/pages/GoogleCalendarAppointments";
import BookAppointment from "@/pages/BookAppointment";
import UserSignup from "@/pages/UserSignup";
import ManageWebsites from "@/pages/ManageWebsites";
import EditCollectionWebsite from "@/pages/EditCollectionWebsite";
import PublicCollectionView from "@/pages/PublicCollectionView";
import CRM from "@/pages/CRM";
import Chat from "@/pages/Chat";

const queryClient = new QueryClient();

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <LoadingProvider>
        <BrowserRouter>
          <AuthProvider>
            <CurrencyProvider>
              <SecurityProvider>
                <Toaster />
              <Routes>
                <Route path="/auth" element={<Auth />} />
                <Route path="/book-appointment" element={<BookAppointment />} />
                <Route path="/view-collection/:slug" element={<PublicCollectionView />} />
                <Route path="/" element={
                  <RequireAuth>
                    <MainLayout />
                  </RequireAuth>
                }>
                  <Route index element={<Dashboard />} />
                  <Route path="artists" element={<Artists />} />
                  <Route path="artworks" element={<Artworks />} />
                  <Route path="collections" element={<Collections />} />
                  <Route path="documents" element={<Navigate to="/file-sharing" replace />} />
                  <Route path="file-sharing" element={<FileSharing />} />
                  <Route path="projects" element={<Projects />} />
                  <Route path="locations" element={<Locations />} />
                  <Route path="profile" element={<Profile />} />
                  <Route path="appointments" element={<GoogleCalendarAppointments />} />
                  <Route path="crm" element={<CRM />} />
                  <Route path="chat" element={<Chat />} />
                  <Route path="admin" element={<UserSignup />} />
                  <Route path="settings" element={<UserSignup />} />
                  <Route path="manage-websites" element={<ManageWebsites />} />
                  <Route path="manage-websites/:websiteId/edit" element={<EditCollectionWebsite />} />
                </Route>
                <Route path="*" element={<Navigate to="/" replace />} />
              </Routes>
              </SecurityProvider>
            </CurrencyProvider>
          </AuthProvider>
        </BrowserRouter>
      </LoadingProvider>
    </QueryClientProvider>
  );
}

export default App;
