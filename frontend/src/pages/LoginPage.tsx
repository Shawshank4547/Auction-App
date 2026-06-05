import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Gavel } from 'lucide-react';
import { toast } from 'react-hot-toast';
import useAuthStore from '../store/authStore';
import Button from '../components/shared/Button';
import Input from '../components/shared/Input';

// Google Identity Services script is loaded in index.html (see note below)
declare const google: any;

const LoginPage: React.FC = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const { login, googleAuth, isLoading, setPendingOtp } = useAuthStore();
  const navigate = useNavigate();

  // Initialise Google Sign-In button after the GSI script loads
  useEffect(() => {
    const initGoogle = () => {
      if (typeof google === 'undefined') return;
      google.accounts.id.initialize({
        client_id: process.env.REACT_APP_GOOGLE_CLIENT_ID!,
        callback: handleGoogleCredential,
      });
      google.accounts.id.renderButton(
        document.getElementById('google-signin-btn'),
        {
          theme: 'filled_black',
          size: 'large',
          width: 340,
          text: 'signin_with',
          shape: 'rectangular',
        }
      );
    };

    // Script may already be loaded
    if (typeof google !== 'undefined') {
      initGoogle();
    } else {
      // Wait for script to load
      const interval = setInterval(() => {
        if (typeof google !== 'undefined') {
          clearInterval(interval);
          initGoogle();
        }
      }, 200);
      return () => clearInterval(interval);
    }
  }, []);

  const handleGoogleCredential = async (response: { credential: string }) => {
    try {
      const data = await googleAuth(response.credential);
      setPendingOtp({ userId: data.userId, email: data.email, name: data.name });
      navigate('/verify-otp?source=google');
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Google login failed');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await login(email, password);
      navigate('/dashboard');
    } catch (err: any) {
      const msg = err.response?.data?.message || 'Login failed';
      // If email not verified, backend returns 403 — redirect to OTP page
      if (err.response?.status === 403 && msg.includes('OTP')) {
        // We need userId — fetch it from a temporary endpoint or store it
        // For password flow, backend doesn't return userId on 403.
        // Show a message asking them to use the link sent to email.
        toast.error('Please verify your email first. Check your inbox for the OTP.');
      } else {
        toast.error(msg);
      }
    }
  };

  return (
    <div className="min-h-screen bg-gray-950 flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        <div className="flex flex-col items-center mb-8">
          <div className="bg-blue-600 rounded-2xl p-4 mb-4">
            <Gavel size={32} className="text-white" />
          </div>
          <h1 className="text-2xl font-bold text-white">AuctionPro</h1>
          <p className="text-gray-400 text-sm mt-1">Sign in to your account</p>
        </div>

        <div className="bg-gray-900 rounded-2xl p-6 space-y-5 border border-gray-800">
          {/* Google Sign-In */}
          <div>
            <p className="text-xs text-gray-500 text-center mb-3">Sign in with Google (recommended)</p>
            <div id="google-signin-btn" className="flex justify-center" />
          </div>

          {/* Divider */}
          <div className="flex items-center gap-3">
            <div className="flex-1 h-px bg-gray-800" />
            <span className="text-xs text-gray-600">or use email & password</span>
            <div className="flex-1 h-px bg-gray-800" />
          </div>

          {/* Password login */}
          <form onSubmit={handleSubmit} className="space-y-4">
            <Input
              label="Email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              required
              autoComplete="email"
            />
            <Input
              label="Password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              required
              autoComplete="current-password"
            />
            <Button type="submit" fullWidth loading={isLoading} size="lg">
              Sign In
            </Button>
          </form>
        </div>

        <p className="text-center text-gray-500 text-sm mt-4">
          Don't have an account?{' '}
          <Link to="/register" className="text-blue-400 hover:text-blue-300 font-medium">
            Register
          </Link>
        </p>
      </div>
    </div>
  );
};

export default LoginPage;