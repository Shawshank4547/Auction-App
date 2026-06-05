import React, { useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate, Outlet } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import useAuthStore from './store/authStore';
import socketService from './services/socketService';

// Pages
import LoginPage from './pages/LoginPage';
import RegisterPage from './pages/RegisterPage';
import OTPVerifyPage from './pages/OTPVerifyPage';
import DashboardPage from './pages/DashboardPage';
import AuctionsListPage from './pages/AuctionsListPage';
import AuctionDetailPage from './pages/AuctionDetailPage';
import CreateAuctionPage from './pages/CreateAuctionPage';
import AuctionManagePage from './pages/AuctionManagePage';
import LiveAuctionPage from './pages/LiveAuctionPage';
import AdminPage from './pages/AdminPage';

// Layout
import Layout from './components/shared/Layout';

const RequireAuth: React.FC = () => {
  const { user, accessToken } = useAuthStore();
  if (!user || !accessToken) return <Navigate to="/login" replace />;
  return <Outlet />;
};

const RequireGuest: React.FC = () => {
  const { user } = useAuthStore();
  if (user) return <Navigate to="/dashboard" replace />;
  return <Outlet />;
};

const RequireRole: React.FC<{ roles: string[] }> = ({ roles }) => {
  const { user } = useAuthStore();
  if (!user || !roles.includes(user.role)) return <Navigate to="/dashboard" replace />;
  return <Outlet />;
};

const WithLayout: React.FC = () => (
  <Layout>
    <Outlet />
  </Layout>
);

const App: React.FC = () => {
  const { accessToken } = useAuthStore();

  useEffect(() => {
    if (accessToken) {
      socketService.connect(accessToken);
    }
    return () => {};
  }, [accessToken]);

  return (
    <BrowserRouter>
      <Toaster
        position="top-right"
        toastOptions={{
          style: { background: '#1f2937', color: '#f9fafb', border: '1px solid #374151' },
          success: { iconTheme: { primary: '#4ade80', secondary: '#1f2937' } },
          error: { iconTheme: { primary: '#f87171', secondary: '#1f2937' } },
        }}
      />

      <Routes>
        {/* Public routes */}
        <Route element={<RequireGuest />}>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/register" element={<RegisterPage />} />
          {/* OTP page is semi-public — accessible without auth but guarded inside by pendingOtp state */}
          <Route path="/verify-otp" element={<OTPVerifyPage />} />
        </Route>

        {/* Live auction - full screen */}
        <Route element={<RequireAuth />}>
          <Route path="/auctions/:id/live" element={<LiveAuctionPage />} />
        </Route>

        {/* Protected routes with layout */}
        <Route element={<RequireAuth />}>
          <Route element={<WithLayout />}>
            <Route path="/dashboard" element={<DashboardPage />} />
            <Route path="/auctions" element={<AuctionsListPage />} />
            <Route path="/auctions/:id" element={<AuctionDetailPage />} />
            <Route path="/auctions/:id/manage" element={<AuctionManagePage />} />

            <Route element={<RequireRole roles={['organizer', 'super_admin']} />}>
              <Route path="/auctions/new" element={<CreateAuctionPage />} />
            </Route>

            <Route element={<RequireRole roles={['super_admin']} />}>
              <Route path="/admin" element={<AdminPage />} />
            </Route>
          </Route>
        </Route>

        <Route path="/" element={<Navigate to="/dashboard" replace />} />
        <Route path="*" element={<Navigate to="/dashboard" replace />} />
      </Routes>
    </BrowserRouter>
  );
};

export default App;