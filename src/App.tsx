import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import Ranking from "./pages/Ranking";


import NotFound from "./pages/NotFound";
import Profile from "./pages/Profile";
import Auth from "./pages/Auth";
import Options from "./pages/Options";
import Crypto from "./pages/Crypto";
import Portfolio from "./pages/Portfolio";
import Bots from "./pages/Bots";
import Breakout from "./pages/Breakout";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Ranking />} />
          <Route path="/portfolio" element={<Portfolio />} />
          <Route path="/bots" element={<Bots />} />
          <Route path="/breakout" element={<Breakout />} />
          <Route path="/options" element={<Options />} />
          <Route path="/crypto" element={<Crypto />} />
          <Route path="/profile" element={<Profile />} />
          <Route path="/auth" element={<Auth />} />
          {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
