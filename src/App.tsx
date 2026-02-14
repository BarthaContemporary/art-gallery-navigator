
import React, { Suspense, lazy } from "react";
import {
  BrowserRouter,
  Routes,
  Route,
  Navigate,
} from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "sonner";
import { HelmetProvider } from "react-helmet-async";

import { MainLayout } from "@/components/layout/MainLayout";
import { RequireAuth } from "@/components/auth/RequireAuth";
import { AuthProvider } from "@/providers/auth-provider";
import { LoadingProvider } from "@/contexts/loading-context";
import { SecurityProvider } from "@/components/security/SecurityProvider";
import { CurrencyProvider } from "@/contexts/CurrencyContext";
import { GlobalDialogRenderer } from "@/components/artworks/dialogs/GlobalDialogRenderer";
import { Loader2 } from "lucide-react";

// Lazy-loaded pages
const Dashboard = lazy(() => import("@/pages/Dashboard"));
const Artists = lazy(() => import("@/pages/Artists"));
const Artworks = lazy(() => import("@/pages/Artworks"));
const Collections = lazy(() => import("@/pages/Collections"));
const Documents = lazy(() => import("@/pages/Documents"));
const FileSharing = lazy(() => import("@/pages/FileSharing"));
const Projects = lazy(() => import("@/pages/Projects"));
const ProjectDetail = lazy(() => import("@/pages/ProjectDetail"));
const Locations = lazy(() => import("@/pages/Locations"));
const Profile = lazy(() => import("@/pages/Profile"));
const Auth = lazy(() => import("@/pages/Auth"));
const GoogleCalendarAppointments = lazy(() => import("@/pages/GoogleCalendarAppointments"));
const BookAppointment = lazy(() => import("@/pages/BookAppointment"));
const ManageWebsites = lazy(() => import("@/pages/ManageWebsites"));
const EditCollectionWebsite = lazy(() => import("@/pages/EditCollectionWebsite"));
const PublicCollectionView = lazy(() => import("@/pages/PublicCollectionView"));
const Chat = lazy(() => import("@/pages/Chat"));
const PublicArtworkViewer = lazy(() => import("@/pages/PublicArtworkViewer"));
const PublicationViewer = lazy(() => import("@/pages/PublicationViewer"));

// CRM pages
const CRMLayout = lazy(() => import("@/pages/crm/CRMLayout"));
const ContactsPage = lazy(() => import("@/pages/crm/ContactsPage"));
const OrganizationsPage = lazy(() => import("@/pages/crm/OrganizationsPage"));
const OrganizationDetailPage = lazy(() => import("@/pages/crm/OrganizationDetailPage"));
const ListsPage = lazy(() => import("@/pages/crm/ListsPage"));
const ListDetailPage = lazy(() => import("@/pages/crm/ListDetailPage"));
const CampaignsPage = lazy(() => import("@/pages/crm/CampaignsPage"));
const PipelinesPage = lazy(() => import("@/pages/crm/PipelinesPage"));
const ContactDetailPage = lazy(() => import("@/pages/crm/ContactDetailPage"));

// Admin pages
const AdminLayout = lazy(() => import("@/pages/admin").then(m => ({ default: m.AdminLayout })));
const AdminOverviewPage = lazy(() => import("@/pages/admin").then(m => ({ default: m.OverviewPage })));
const AdminUsersPage = lazy(() => import("@/pages/admin").then(m => ({ default: m.UsersPage })));
const AdminIntegrationsPage = lazy(() => import("@/pages/admin").then(m => ({ default: m.IntegrationsPage })));
const AdminSettingsPage = lazy(() => import("@/pages/admin").then(m => ({ default: m.SettingsPage })));
const AdminLogsPage = lazy(() => import("@/pages/admin").then(m => ({ default: m.LogsPage })));
const Publications = lazy(() => import("@/pages/admin/Publications"));
const PublicationEditor = lazy(() => import("@/pages/admin/PublicationEditor"));
const PublicationLeads = lazy(() => import("@/pages/admin/PublicationLeads"));

// Viewer pages
const ViewerLayout = lazy(() => import("@/pages/viewer/ViewerLayout"));
const ViewerArtworksPage = lazy(() => import("@/pages/viewer/ViewerArtworksPage"));
const ViewerArtworkDetailPage = lazy(() => import("@/pages/viewer/ViewerArtworkDetailPage"));

// Audio pages
const AudioLibrary = lazy(() => import("@/pages/audio/AudioLibrary"));
const AudioTrackDetail = lazy(() => import("@/pages/audio/AudioTrackDetail"));
const AudioCollectionPage = lazy(() => import("@/pages/audio/AudioCollectionPage"));
const AudioTrackEmbed = lazy(() => import("@/pages/audio/embed/AudioTrackEmbed"));
const AudioCollectionEmbed = lazy(() => import("@/pages/audio/embed/AudioCollectionEmbed"));
const AdminAudioPage = lazy(() => import("@/pages/admin/AdminAudioPage"));

const queryClient = new QueryClient();

function PageLoader() {
  return (
    <div className="flex items-center justify-center min-h-[50vh]">
      <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
    </div>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <HelmetProvider>
        <LoadingProvider>
          <BrowserRouter>
            <AuthProvider>
              <CurrencyProvider>
                <SecurityProvider>
                  <Toaster />
                  <GlobalDialogRenderer />
                <Suspense fallback={<PageLoader />}>
                <Routes>
                  <Route path="/auth" element={<Auth />} />
                  <Route path="/book-appointment" element={<BookAppointment />} />
                  <Route path="/w/:slug" element={<PublicArtworkViewer />} />
                  <Route path="/view-collection/:slug" element={<PublicCollectionView />} />
                  <Route path="/p/:slug" element={<PublicationViewer />} />
                  <Route path="/audio" element={<AudioLibrary />} />
                  <Route path="/audio/tracks/:slug" element={<AudioTrackDetail />} />
                  <Route path="/audio/collections/:slug" element={<AudioCollectionPage />} />
                  <Route path="/embed/audio/track/:slug" element={<AudioTrackEmbed />} />
                  <Route path="/embed/audio/collection/:slug" element={<AudioCollectionEmbed />} />
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
                      <Route path="organizations/:id" element={<OrganizationDetailPage />} />
                      <Route path="lists" element={<ListsPage />} />
                      <Route path="lists/:id" element={<ListDetailPage />} />
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
                    <Route path="admin/publications" element={<Publications />} />
                    <Route path="admin/audio" element={<AdminAudioPage />} />
                    <Route path="admin/publications/:id" element={<PublicationEditor />} />
                    <Route path="admin/publications/:id/leads" element={<PublicationLeads />} />
                    <Route path="viewer" element={<ViewerLayout />}>
                      <Route index element={<ViewerArtworksPage />} />
                      <Route path=":id" element={<ViewerArtworkDetailPage />} />
                    </Route>
                    <Route path="manage-websites" element={<ManageWebsites />} />
                    <Route path="manage-websites/:websiteId/edit" element={<EditCollectionWebsite />} />
                  </Route>
                  <Route path="*" element={<Navigate to="/" replace />} />
                </Routes>
                </Suspense>
                </SecurityProvider>
              </CurrencyProvider>
            </AuthProvider>
          </BrowserRouter>
        </LoadingProvider>
      </HelmetProvider>
    </QueryClientProvider>
  );
}

export default App;
