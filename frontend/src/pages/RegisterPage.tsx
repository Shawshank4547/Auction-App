import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Gavel } from 'lucide-react';
import { toast } from 'react-hot-toast';
import useAuthStore from '../store/authStore';
import Button from '../components/shared/Button';
import Input from '../components/shared/Input';

declare const google: any;

const RegisterPage: React.FC = () => {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const { register, googleAuth, isLoading, setPendingOtp } = useAuthStore();
  const navigate = useNavigate();

  useEffect(() => {
    const initGoogle = () => {
      if (typeof google === 'undefined') return;
      google.accounts.id.initialize({
        client_id: process.env.REACT_APP_GOOGLE_CLIENT_ID!,
        callback: handleGoogleCredential,
      });
      google.accounts.id.renderButton(
        document.getElementById('google-register-btn'),
        {
          theme: 'filled_black',
          size: 'large',
          width: 340,
          text: 'signup_with',
          shape: 'rectangular',
        }
      );
    };

    if (typeof google !== 'undefined') {
      initGoogle();
    } else {
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
      toast.error(err.response?.data?.message || 'Google sign-up failed');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password.length < 6) {
      toast.error('Password must be at least 6 characters');
      return;
    }
    try {
      const { userId, email: returnedEmail } = await register(email, password, name);
      setPendingOtp({ userId, email: returnedEmail, name });
      toast.success('Account created! Check your email for the OTP.');
      navigate('/verify-otp?source=register');
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Registration failed');
    }
  };

  return (
    <div className="min-h-screen bg-gray-950 flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        <div className="flex flex-col items-center mb-8">
          <div className="bg-blue-600 rounded-2xl p-4 mb-4">
            <Gavel size={32} className="text-white" />
          </div>
          <h1 className="text-2xl font-bold text-white">Create Account</h1>
          <p className="text-gray-400 text-sm mt-1">Join AuctionPro today</p>
        </div>

        <div className="bg-gray-900 rounded-2xl p-6 space-y-5 border border-gray-800">
          {/* Google Sign-Up */}
          <div>
            <p className="text-xs text-gray-500 text-center mb-3">Quick sign-up with Google</p>
            <div id="google-register-btn" className="flex justify-center" />
          </div>

          {/* Divider */}
          <div className="flex items-center gap-3">
            <div className="flex-1 h-px bg-gray-800" />
            <span className="text-xs text-gray-600">or register with email</span>
            <div className="flex-1 h-px bg-gray-800" />
          </div>

          {/* Password register */}
          <form onSubmit={handleSubmit} className="space-y-4">
            <Input
              label="Full Name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Your name"
              required
            />
            <Input
              label="Email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              required
            />
            <Input
              label="Password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Min 6 characters"
              required
            />
            <Button type="submit" fullWidth loading={isLoading} size="lg">
              Create Account
            </Button>
          </form>
        </div>

        <p className="text-center text-gray-500 text-sm mt-4">
          Already have an account?{' '}
          <Link to="/login" className="text-blue-400 hover:text-blue-300 font-medium">
            Sign in
          </Link>
        </p>
      </div>
    </div>
  );
};

export default RegisterPage;