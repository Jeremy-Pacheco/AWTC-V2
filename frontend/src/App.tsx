import { BrowserRouter, Routes, Route } from "react-router-dom";
import { useEffect } from "react";
import NavBar from "./components/NavBar";
import InfoBanner from "./components/InfoBanner";
import DemoBanner from "./components/DemoBanner";
import Footer from "./components/Footer";
import FloatingMessageButton from "./components/FloatingMessageButton";
import Home from "./pages/Home";
import Volunteering from "./pages/Volunteering";
import MoreInfo from "./pages/MoreInfo";
import Dashboard from "./pages/Dashboard";
import AboutUs from "./pages/AboutUs";
import Privacy from "./pages/Privacy";
import Terms from "./pages/Terms";
import Messages from "./pages/Messages";
import { subscribeUserToPush, isNotificationSupported } from "./services/notificationService";
import { initAuthCheck, startTokenRefresh } from "./utils/auth";
import AuthProvider from "./context/AuthProvider";
import ProtectedRoute from "./components/ProtectedRoute";
import './i18n';

//TODO: Import other pages when you have them
function App() {
  // Renew an expired access token with the refresh cookie on startup, then
  // keep it fresh while the app is open (SEC-18)
  useEffect(() => {
    void initAuthCheck();
    return startTokenRefresh();
  }, []);

  // Subscribe to push notifications when user is logged in
  useEffect(() => {
    const setupPushNotifications = async () => {
      try {
        console.log('🔔 Setting up push notifications...');
        
        // Check if user is logged in
        const token = localStorage.getItem('jwtToken');
        const userRole = localStorage.getItem('userRole');
        
        console.log('Token exists:', !!token);
        console.log('User role:', userRole);
        
        if (!token || !userRole) {
          console.log('❌ User not logged in, skipping push notifications');
          return; // User not logged in
        }
        
        // Check if browser supports notifications
        if (!isNotificationSupported()) {
          console.log('❌ Push notifications not supported in this browser');
          return;
        }

        console.log('✅ All checks passed, requesting notification permission in 2 seconds...');
        
        // Don't ask immediately, wait a bit for better UX
        setTimeout(async () => {
          console.log('⏰ Requesting notification permission now...');
          await subscribeUserToPush(token);
        }, 2000);
        
      } catch (error) {
        console.error('❌ Error setting up push notifications:', error);
      }
    };

    setupPushNotifications();
  }, []);

  return (
    <BrowserRouter>
      <AuthProvider>
      <div className="flex flex-col min-h-screen">
        <NavBar />
        <DemoBanner />
        <InfoBanner />
        <main className="grow">
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/home" element={<Home />} />
            <Route path="/aboutus" element={<AboutUs />} />
            <Route path="/volunteering" element={<Volunteering />} />
            <Route path="/moreinfo" element={<MoreInfo />} />
            <Route path="/privacy" element={<Privacy />} />
            <Route path="/terms" element={<Terms />} />
            <Route path="/dashboard" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
            <Route path="/messages" element={<ProtectedRoute roles={["admin", "coordinator"]}><Messages /></ProtectedRoute>} />
          </Routes>
        </main>
        <Footer />
        <FloatingMessageButton />
      </div>
      </AuthProvider>
    </BrowserRouter>
  );
}

export default App;
