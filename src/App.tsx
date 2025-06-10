
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
import { AuthProvider } from "@/providers/auth-provider";
import Dashboard from "@/pages/Dashboard";
import Artists from "@/pages/Artists";
import Artworks from "@/pages/Artworks";
import Collections from "@/pages/Collections";
import Documents from "@/pages/Documents";
import Projects from "@/pages/Projects";
import Locations from "@/pages/Locations";
import Profile from "@/pages/Profile";
import Auth from "@/pages/Auth";
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
                  <Dashboard />
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
            <Route path="/artworks" element={
              <RequireAuth>
                <MainLayout>
                  <Artworks />
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
            <Route path="/locations" element={
              <RequireAuth>
                <MainLayout>
                  <Locations />
                </MainLayout>
              </RequireAuth>
            } />
            <Route path="/profile" element={
              <RequireAuth>
                <MainLayout>
                  <Profile />
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
            <Route path="/auth" element={<Auth />} />
            <Route path="/book-appointment" element={<BookAppointment />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </AuthProvider>
      </BrowserRouter>
    </QueryClientProvider>
  );
}

export default App;
