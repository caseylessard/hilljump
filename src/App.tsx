import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { useAnalytics } from "@/hooks/useAnalytics";
import Ranking from "./pages/Ranking";
import Home from "./pages/Home";
import AdminDashboard from "./pages/AdminDashboard";

import NotFound from "./pages/NotFound";
import Profile from "./pages/Profile";
import Auth from "./pages/Auth";
import Options from "./pages/Options";
import Crypto from "./pages/Crypto";
import Portfolio from "./pages/Portfolio";
import Bots from "./pages/Bots";
import Breakout from "./pages/Breakout";
import PrivacyPolicy from "./pages/PrivacyPolicy";
import TermsOfService from "./pages/TermsOfService";

const queryClient = new QueryClient();

const AppContent = () => {
  useAnalytics(); // Auto-track page views
  
  return (
    <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/ranking" element={<Ranking />} />
          <Route path="/portfolio" element={<Portfolio />} />
          <Route path="/bots" element={<Bots />} />
          <Route path="/breakout" element={<Breakout />} />
          <Route path="/options" element={<Options />} />
          <Route path="/crypto" element={<Crypto />} />
          <Route path="/profile" element={<Profile />} />
          <Route path="/admin" element={<AdminDashboard />} />
          <Route path="/auth" element={<Auth />} />
          <Route path="/privacy" element={<PrivacyPolicy />} />
          <Route path="/terms" element={<TermsOfService />} />
          {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
          <Route path="*" element={<NotFound />} />
        </Routes>
  );
};

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AppContent />
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
