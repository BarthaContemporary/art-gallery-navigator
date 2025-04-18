import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { MainLayout } from "./components/layout/MainLayout";
import Dashboard from "./pages/Dashboard";
import Artists from "./pages/Artists";
import Artworks from "./pages/Artworks";
import Exhibitions from "./pages/Exhibitions";
import Locations from "./pages/Locations";
import Clients from "./pages/Clients";
import Sales from "./pages/Sales";
import Documents from "./pages/Documents";
import Index from "./pages/Index";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Index />} />
          <Route element={<MainLayout />}>
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="/artists" element={<Artists />} />
            <Route path="/artworks" element={<Artworks />} />
            <Route path="/exhibitions" element={<Exhibitions />} />
            <Route path="/locations" element={<Locations />} />
            <Route path="/clients" element={<Clients />} />
            <Route path="/sales" element={<Sales />} />
            <Route path="/documents" element={<Documents />} />
          </Route>
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
