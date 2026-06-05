import React, { useState, useRef, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Gavel, Mail, RefreshCw } from 'lucide-react';
import { toast } from 'react-hot-toast';
import useAuthStore from '../store/authStore';
import Button from '../components/shared/Button';

const OTPVerifyPage: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const source = searchParams.get('source'); // 'google' | 'register'

  const { pendingOtp, verifyOTP, googleVerifyOTP, resendOTP, isLoading } = useAuthStore();

  const [otp, setOtp] = useState(['', '', '', '', '', '']);
  const [resendCooldown, setResendCooldown] = useState(0);
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

  // Redirect away if no pending OTP state
  useEffect(() => {
    if (!pendingOtp) {
      navigate('/login', { replace: true });
    }
  }, [pendingOtp, navigate]);

  // Cooldown timer for resend
  useEffect(() => {
    if (resendCooldown <= 0) return;
    const t = setTimeout(() => setResendCooldown((c) => c - 1), 1000);
    return () => clearTimeout(t);
  }, [resendCooldown]);

  // Focus first input on mount
  useEffect(() => {
    inputRefs.current[0]?.focus();
  }, []);

  if (!pendingOtp) return null;

  const handleChange = (index: number, value: string) => {
    // Only allow digits
    if (!/^\d*$/.test(value)) return;

    const newOtp = [...otp];
    newOtp[index] = value.slice(-1); // take last char (in case of paste into single box)
    setOtp(newOtp);

    // Auto-advance
    if (value && index < 5) {
      inputRefs.current[index + 1]?.focus();
    }
  };

  const handleKeyDown = (index: number, e: React.KeyboardEvent) => {
    if (e.key === 'Backspace' && !otp[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
  };

  const handlePaste = (e: React.ClipboardEvent) => {
    e.preventDefault();
    const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6);
    const newOtp = [...otp];
    pasted.split('').forEach((char, i) => {
      if (i < 6) newOtp[i] = char;
    });
    setOtp(newOtp);
    // Focus last filled or next empty
    const lastIndex = Math.min(pasted.length, 5);
    inputRefs.current[lastIndex]?.focus();
  };

  const handleVerify = async () => {
    const code = otp.join('');
    if (code.length < 6) {
      toast.error('Please enter all 6 digits');
      return;
    }
    try {
      if (source === 'google') {
        await googleVerifyOTP(pendingOtp.userId, code);
      } else {
        await verifyOTP(pendingOtp.userId, code);
      }
      toast.success('Verified! Welcome to AuctionPro.');
      navigate('/dashboard', { replace: true });
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Invalid OTP');
      // Clear inputs on wrong code
      setOtp(['', '', '', '', '', '']);
      inputRefs.current[0]?.focus();
    }
  };

  const handleResend = async () => {
    if (resendCooldown > 0) return;
    try {
      await resendOTP(pendingOtp.userId);
      toast.success('New OTP sent!');
      setResendCooldown(60);
      setOtp(['', '', '', '', '', '']);
      inputRefs.current[0]?.focus();
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Failed to resend OTP');
    }
  };

  return (
    <div className="min-h-screen bg-gray-950 flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        <div className="flex flex-col items-center mb-8">
          <div className="bg-blue-600 rounded-2xl p-4 mb-4">
            <Gavel size={32} className="text-white" />
          </div>
          <h1 className="text-2xl font-bold text-white">Verify your email</h1>
          <p className="text-gray-400 text-sm mt-2 text-center">
            We sent a 6-digit code to
          </p>
          <div className="flex items-center gap-2 mt-1">
            <Mail size={14} className="text-blue-400" />
            <span className="text-blue-400 font-medium text-sm">{pendingOtp.email}</span>
          </div>
        </div>

        <div className="bg-gray-900 rounded-2xl p-6 space-y-6 border border-gray-800">
          {/* OTP inputs */}
          <div className="flex gap-2 justify-center" onPaste={handlePaste}>
            {otp.map((digit, i) => (
              <input
                key={i}
                ref={(el) => { inputRefs.current[i] = el; }}
                type="text"
                inputMode="numeric"
                maxLength={1}
                value={digit}
                onChange={(e) => handleChange(i, e.target.value)}
                onKeyDown={(e) => handleKeyDown(i, e)}
                className={`
                  w-11 h-14 text-center text-xl font-bold rounded-xl border bg-gray-800 text-white
                  focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent
                  transition-all duration-150
                  ${digit ? 'border-blue-500 bg-blue-900/20' : 'border-gray-600'}
                `}
              />
            ))}
          </div>

          <Button
            fullWidth
            size="lg"
            loading={isLoading}
            onClick={handleVerify}
            disabled={otp.join('').length < 6}
          >
            Verify & Continue
          </Button>

          {/* Resend */}
          <div className="text-center">
            <p className="text-gray-500 text-sm mb-2">Didn't receive the code?</p>
            <button
              onClick={handleResend}
              disabled={resendCooldown > 0}
              className="inline-flex items-center gap-1.5 text-sm font-medium text-blue-400 hover:text-blue-300 disabled:text-gray-600 disabled:cursor-not-allowed transition-colors"
            >
              <RefreshCw size={14} />
              {resendCooldown > 0 ? `Resend in ${resendCooldown}s` : 'Resend OTP'}
            </button>
          </div>
        </div>

        <p className="text-center text-gray-600 text-xs mt-4">
          Wrong account?{' '}
          <button
            onClick={() => navigate('/login')}
            className="text-gray-400 hover:text-white underline"
          >
            Back to login
          </button>
        </p>
      </div>
    </div>
  );
};

export default OTPVerifyPage;