import {
  BrowserRouter,
  Routes,
  Route,
  Navigate,
} from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "sonner";

import MainLayout from "@/layouts/MainLayout";
import AuthLayout from "@/layouts/AuthLayout";
import RequireAuth from "@/components/auth/RequireAuth";
import GuestOnly from "@/components/auth/GuestOnly";
import { AuthProvider } from "@/contexts/auth-context";
import Home from "@/pages/Home";
import Artists from "@/pages/Artists";
import ArtistDetails from "@/pages/ArtistDetails";
import Artworks from "@/pages/Artworks";
import ArtworkDetails from "@/pages/ArtworkDetails";
import Locations from "@/pages/Locations";
import Login from "@/pages/Login";
import Register from "@/pages/Register";
import Profile from "@/pages/Profile";
import EditProfile from "@/pages/EditProfile";
import Users from "@/pages/Users";
import Collections from "@/pages/Collections";
import CollectionDetails from "@/pages/CollectionDetails";
import Documents from "@/pages/Documents";
import Projects from "@/pages/Projects";
import ProjectDetails from "@/pages/ProjectDetails";
import Sales from "@/pages/Sales";
import Exhibitions from "@/pages/Exhibitions";
import ExhibitionDetails from "@/pages/ExhibitionDetails";
import Settings from "@/pages/Settings";
import DeletionRequests from "@/pages/DeletionRequests";
import Uploads from "@/pages/Uploads";
import Chat from "@/pages/Chat";
import PushNotifications from "@/pages/PushNotifications";
import Appointments from "@/pages/Appointments";
import BookAppointment from "@/pages/BookAppointment";

const queryClient = new QueryClient();

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <AuthProvider>
          <Toaster />
          <Routes>
            <Route path="/" element={
              <RequireAuth>
                <MainLayout>
                  <Home />
                </MainLayout>
              </RequireAuth>
            } />
            <Route path="/artists" element={
              <RequireAuth>
                <MainLayout>
                  <Artists />
                </MainLayout>
              </RequireAuth>
            } />
            <Route path="/artists/:artistId" element={
              <RequireAuth>
                <MainLayout>
                  <ArtistDetails />
                </MainLayout>
              </RequireAuth>
            } />
            <Route path="/artworks" element={
              <RequireAuth>
                <MainLayout>
                  <Artworks />
                </MainLayout>
              </RequireAuth>
            } />
            <Route path="/artworks/:artworkId" element={
              <RequireAuth>
                <MainLayout>
                  <ArtworkDetails />
                </MainLayout>
              </RequireAuth>
            } />
            <Route path="/locations" element={
              <RequireAuth>
                <MainLayout>
                  <Locations />
                </MainLayout>
              </RequireAuth>
            } />
            <Route path="/login" element={
              <GuestOnly>
                <AuthLayout>
                  <Login />
                </AuthLayout>
              </GuestOnly>
            } />
            <Route path="/register" element={
              <GuestOnly>
                <AuthLayout>
                  <Register />
                </AuthLayout>
              </GuestOnly>
            } />
            <Route path="/profile" element={
              <RequireAuth>
                <MainLayout>
                  <Profile />
                </MainLayout>
              </RequireAuth>
            } />
            <Route path="/profile/edit" element={
              <RequireAuth>
                <MainLayout>
                  <EditProfile />
                </MainLayout>
              </RequireAuth>
            } />
            <Route path="/users" element={
              <RequireAuth roles={['gallery_admin']}>
                <MainLayout>
                  <Users />
                </MainLayout>
              </RequireAuth>
            } />
            <Route path="/collections" element={
              <RequireAuth>
                <MainLayout>
                  <Collections />
                </MainLayout>
              </RequireAuth>
            } />
            <Route path="/collections/:collectionId" element={
              <RequireAuth>
                <MainLayout>
                  <CollectionDetails />
                </MainLayout>
              </RequireAuth>
            } />
            <Route path="/documents" element={
              <RequireAuth>
                <MainLayout>
                  <Documents />
                </MainLayout>
              </RequireAuth>
            } />
            <Route path="/projects" element={
              <RequireAuth>
                <MainLayout>
                  <Projects />
                </MainLayout>
              </RequireAuth>
            } />
            <Route path="/projects/:projectId" element={
              <RequireAuth>
                <MainLayout>
                  <ProjectDetails />
                </MainLayout>
              </RequireAuth>
            } />
            <Route path="/sales" element={
              <RequireAuth>
                <MainLayout>
                  <Sales />
                </MainLayout>
              </RequireAuth>
            } />
             <Route path="/exhibitions" element={
              <RequireAuth>
                <MainLayout>
                  <Exhibitions />
                </MainLayout>
              </RequireAuth>
            } />
             <Route path="/exhibitions/:exhibitionId" element={
              <RequireAuth>
                <MainLayout>
                  <ExhibitionDetails />
                </MainLayout>
              </RequireAuth>
            } />
            <Route path="/settings" element={
              <RequireAuth>
                <MainLayout>
                  <Settings />
                </MainLayout>
              </RequireAuth>
            } />
            <Route path="/deletion-requests" element={
              <RequireAuth roles={['gallery_admin']}>
                <MainLayout>
                  <DeletionRequests />
                </MainLayout>
              </RequireAuth>
            } />
            <Route path="/uploads" element={
              <RequireAuth>
                <MainLayout>
                  <Uploads />
                </MainLayout>
              </RequireAuth>
            } />
            <Route path="/chat" element={
              <RequireAuth>
                <MainLayout>
                  <Chat />
                </MainLayout>
              </RequireAuth>
            } />
             <Route path="/push-notifications" element={
              <RequireAuth>
                <MainLayout>
                  <PushNotifications />
                </MainLayout>
              </RequireAuth>
            } />
            <Route path="/appointments" element={
              <RequireAuth>
                <MainLayout>
                  <Appointments />
                </MainLayout>
              </RequireAuth>
            } />
            <Route path="/book-appointment" element={<BookAppointment />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </AuthProvider>
      </BrowserRouter>
    </QueryClientProvider>
  );
}

export default App;
