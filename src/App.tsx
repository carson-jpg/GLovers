import React from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/hooks/useAuth";
import Index from "./pages/Index";
import Auth from "./pages/Auth";
import Inbox from "./pages/Inbox";
import Chat from "./pages/Chat";
import Profile from "./pages/Profile";
import Timeline from "./pages/Timeline";
import PublicProfile from "./pages/PublicProfile";
import CreateProfile from "./pages/CreateProfile";
import Subscription from "./pages/Subscription";
import Payment from "./pages/Payment";
import Discover from "./pages/Discover";
import CallLogs from "./pages/CallLogs";
import NotFound from "./pages/NotFound";
import MobileNav from "./components/MobileNav";
import { Capacitor } from "@capacitor/core";
import { MobileUtils } from "./lib/mobile-utils";

const queryClient = new QueryClient();

// Check if running in Capacitor (mobile app)
const isMobileApp = Capacitor.isNativePlatform();

// Pages that should show mobile navigation
const showMobileNav = isMobileApp && !['/auth', '/chat', '/create-profile', '/subscription', '/payment'].some(path =>
  window.location.pathname.includes(path)
);

const App = () => (
  <QueryClientProvider client={queryClient}>
    <AuthProvider>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <div className={`${isMobileApp ? 'mobile-container' : ''} ${isMobileApp ? 'mobile-safe-area' : ''}`}>
          <BrowserRouter
            future={{
              v7_startTransition: true,
              v7_relativeSplatPath: true
            }}
          >
            <div className={`${isMobileApp ? 'pb-16' : ''}`}>
              <Routes>
                <Route path="/" element={<Index />} />
                <Route path="/auth" element={<Auth />} />
                <Route path="/inbox" element={<Inbox />} />
                <Route path="/chat/:chatId" element={<Chat />} />
                <Route path="/profile" element={<Profile />} />
                <Route path="/discover" element={<Discover />} />
                <Route path="/timeline" element={<Timeline />} />
                <Route path="/profile/:userId" element={<PublicProfile />} />
                <Route path="/create-profile" element={<CreateProfile />} />
                <Route path="/subscription" element={<Subscription />} />
                <Route path="/payment" element={<Payment />} />
                <Route path="/call-logs" element={<CallLogs />} />
                {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
                <Route path="*" element={<NotFound />} />
              </Routes>
            </div>
            {showMobileNav && <MobileNav />}
          </BrowserRouter>
        </div>
      </TooltipProvider>
    </AuthProvider>
  </QueryClientProvider>
);

export default App;