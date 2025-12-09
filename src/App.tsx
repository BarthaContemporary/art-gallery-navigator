
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
import ProjectDetail from "@/pages/ProjectDetail";
import Locations from "@/pages/Locations";
import Profile from "@/pages/Profile";
import Auth from "@/pages/Auth";
import GoogleCalendarAppointments from "@/pages/GoogleCalendarAppointments";
import BookAppointment from "@/pages/BookAppointment";
import ManageWebsites from "@/pages/ManageWebsites";
import EditCollectionWebsite from "@/pages/EditCollectionWebsite";
import PublicCollectionView from "@/pages/PublicCollectionView";
import CRMLayout from "@/pages/crm/CRMLayout";
import ContactsPage from "@/pages/crm/ContactsPage";
import OrganizationsPage from "@/pages/crm/OrganizationsPage";
import ListsPage from "@/pages/crm/ListsPage";
import CampaignsPage from "@/pages/crm/CampaignsPage";
import PipelinesPage from "@/pages/crm/PipelinesPage";
import ContactDetailPage from "@/pages/crm/ContactDetailPage";
import Chat from "@/pages/Chat";
import { GlobalDialogRenderer } from "@/components/artworks/dialogs/GlobalDialogRenderer";
import {
  AdminLayout,
  OverviewPage as AdminOverviewPage,
  UsersPage as AdminUsersPage,
  IntegrationsPage as AdminIntegrationsPage,
  SettingsPage as AdminSettingsPage,
  LogsPage as AdminLogsPage
} from "@/pages/admin";
import ViewerLayout from "@/pages/viewer/ViewerLayout";
import ViewerArtworksPage from "@/pages/viewer/ViewerArtworksPage";
import ViewerArtworkDetailPage from "@/pages/viewer/ViewerArtworkDetailPage";
import ViewerSettingsPage from "@/pages/viewer/ViewerSettingsPage";
import PublicArtworkViewer from "@/pages/PublicArtworkViewer";

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
                <GlobalDialogRenderer />
              <Routes>
                <Route path="/auth" element={<Auth />} />
                <Route path="/book-appointment" element={<BookAppointment />} />
                <Route path="/w/:slug" element={<PublicArtworkViewer />} />
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
                  <Route path="projects/:id" element={<ProjectDetail />} />
                  <Route path="locations" element={<Locations />} />
                  <Route path="profile" element={<Profile />} />
                  <Route path="appointments" element={<GoogleCalendarAppointments />} />
                  <Route path="crm" element={<CRMLayout />}>
                    <Route index element={<ContactsPage />} />
                    <Route path="contacts/:id" element={<ContactDetailPage />} />
                    <Route path="organizations" element={<OrganizationsPage />} />
                    <Route path="lists" element={<ListsPage />} />
                    <Route path="campaigns" element={<CampaignsPage />} />
                    <Route path="pipelines" element={<PipelinesPage />} />
                  </Route>
                  <Route path="chat" element={<Chat />} />
                  <Route path="admin" element={<AdminLayout />}>
                    <Route index element={<AdminOverviewPage />} />
                    <Route path="users" element={<AdminUsersPage />} />
                    <Route path="integrations" element={<AdminIntegrationsPage />} />
                    <Route path="settings" element={<AdminSettingsPage />} />
                    <Route path="logs" element={<AdminLogsPage />} />
                  </Route>
                  <Route path="viewer" element={<ViewerLayout />}>
                    <Route index element={<ViewerArtworksPage />} />
                    <Route path=":id" element={<ViewerArtworkDetailPage />} />
                    <Route path="settings" element={<ViewerSettingsPage />} />
                  </Route>
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
