import React, { useState } from 'react';
import { AtSign, Eye, EyeOff, Lock, Tv } from 'lucide-react';
import { UserAccount } from '../types/signage';
import { loginApi } from '../api/signageApi';

interface LoginPageProps {
  onLoginSuccess: (token: string, user: UserAccount) => void;
  onOpenTvMode: () => void;
}

const DEMO_ACCOUNTS = [
  { label: 'Super Admin', email: 'vinod.jain@dypiu.ac.in', role: 'Full access' },
  { label: 'Content Manager', email: 'sunita.rao@dypiu.ac.in', role: 'Media & Playlists' },
  { label: 'IT Admin', email: 'rajesh.sharma@dypiu.ac.in', role: 'Screens & Monitoring' },
  { label: 'Monitoring User', email: 'amit.verma@dypiu.ac.in', role: 'Read & Reports' },
];

export const LoginPage: React.FC<LoginPageProps> = ({
  onLoginSuccess,
  onOpenTvMode,
}) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !password) {
      setError('Please enter both university email and password.');
      return;
    }

    setLoading(true);
    setError('');
    try {
      const res = await loginApi(email.trim(), password);
      if (!res.success || !res.token || !res.user) {
        setError(res.error || 'Unable to sign in. Check your credentials.');
        setLoading(false);
        return;
      }
      onLoginSuccess(res.token, res.user);
    } catch {
      setError('Cannot connect to NEXORA backend server (port 5000).');
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen grid grid-cols-1 lg:grid-cols-2 bg-white">
      {/* Left Brand Panel — Deep Navy + DYPIU Logo + NEXORA Title */}
      <div className="bg-[#131E3A] text-white flex flex-col items-center justify-center px-8 py-12 lg:py-16 text-center">
        <div className="bg-white rounded-3xl px-7 py-6 shadow-2xl w-48 sm:w-52 mb-8">
          <img
            src="/dypiu-logo.png"
            alt="D. Y. Patil International University, Akurdi, Pune"
            className="w-full h-auto object-contain select-none"
          />
        </div>

        <h1 className="text-3xl sm:text-4xl font-bold tracking-tight text-white">
          DYPIU Digital Signage
        </h1>
        <p className="mt-1.5 text-2xl sm:text-3xl font-bold text-[#F59E0B] tracking-wide">
          NEXORA
        </p>
        <p className="mt-3 text-sm text-[#A5B4CF]">
          D. Y. Patil International University, Akurdi, Pune
        </p>
      </div>

      {/* Right Sign-In Panel — Clean White + Soft Slate Inputs + Role-Based Access */}
      <div className="bg-white flex flex-col items-center justify-center px-6 sm:px-12 py-10">
        <div className="w-full max-w-md space-y-6">
          {/* Emblem + Sign In Heading */}
          <div className="flex flex-col items-center text-center">
            <img
              src="/dypiu-emblem.png"
              alt="DYPIU Emblem"
              className="w-12 h-12 mb-2 object-contain select-none"
            />
            <h2 className="text-3xl font-bold text-[#0F172A] tracking-tight">
              Sign In
            </h2>
            <p className="mt-1 text-xs text-[#64748B]">
              NEXORA Campus Signage Console
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-[#1E293B] mb-1.5">
                Email
              </label>
              <div className="relative">
                <AtSign className="w-4 h-4 text-[#64748B] absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="email"
                  required
                  autoFocus
                  value={email}
                  onChange={(e) => {
                    setEmail(e.target.value);
                    setError('');
                  }}
                  placeholder="name@dypiu.ac.in"
                  className="w-full pl-10 pr-4 py-3 text-sm bg-[#EBF1FC] border border-transparent rounded-xl text-[#0F172A] placeholder-[#64748B] focus:outline-none focus:border-[#131E3A] focus:bg-white transition-colors"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-[#1E293B] mb-1.5">
                Password
              </label>
              <div className="relative">
                <Lock className="w-4 h-4 text-[#64748B] absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  value={password}
                  onChange={(e) => {
                    setPassword(e.target.value);
                    setError('');
                  }}
                  placeholder="Enter your password"
                  className="w-full pl-10 pr-10 py-3 text-sm bg-[#EBF1FC] border border-transparent rounded-xl text-[#0F172A] placeholder-[#64748B] focus:outline-none focus:border-[#131E3A] focus:bg-white transition-colors"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((s) => !s)}
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                  className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-[#64748B] hover:text-[#0F172A] cursor-pointer"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {error && (
              <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-xs text-rose-700 font-medium">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 px-4 rounded-xl bg-[#0F172A] hover:bg-[#1E293B] text-white text-sm font-semibold shadow-sm transition-colors disabled:opacity-60 cursor-pointer flex items-center justify-center"
            >
              {loading ? 'Signing in...' : 'Sign In'}
            </button>
          </form>

          {/* Role-Based Access Quick Choose */}
          <div className="pt-4 border-t border-[#E2E8F0] space-y-2.5">
            <div className="flex items-center justify-between text-[11px] text-[#64748B]">
              <span className="font-semibold text-[#0F172A]">
                Role-based access (choose role)
              </span>
              <span className="font-mono">
                Default pass: <strong className="text-[#131E3A]">Admin@123</strong>
              </span>
            </div>
            <div className="grid grid-cols-2 gap-2">
              {DEMO_ACCOUNTS.map((acc) => {
                const selected = email.trim().toLowerCase() === acc.email.toLowerCase();
                return (
                  <button
                    key={acc.email}
                    type="button"
                    onClick={() => {
                      setEmail(acc.email);
                      setPassword('Admin@123');
                      setError('');
                    }}
                    className={`px-3 py-2 rounded-xl border text-left transition-colors cursor-pointer ${
                      selected
                        ? 'border-[#131E3A] bg-[#EBF1FC]'
                        : 'border-[#E2E8F0] bg-[#F8FAFC] hover:border-[#F59E0B] hover:bg-[#FFFBEB]/60'
                    }`}
                  >
                    <span className="block text-xs font-semibold text-[#0F172A]">
                      {acc.label}
                    </span>
                    <span className="block text-[11px] text-[#64748B] truncate">
                      {acc.role}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Bottom TV Mode Bypass Link */}
          <div className="pt-3 border-t border-[#E2E8F0] flex items-center justify-between text-xs text-[#64748B]">
            <span>Smart TVs &amp; Standys auto-play without login</span>
            <button
              type="button"
              onClick={onOpenTvMode}
              className="inline-flex items-center gap-1.5 font-semibold text-[#131E3A] hover:text-[#F59E0B] transition-colors cursor-pointer"
            >
              <Tv className="w-3.5 h-3.5" />
              Open TV Player
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
