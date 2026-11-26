import React, { useState } from 'react';
import { Eye, EyeOff, FolderKanban, Lock, Mail, ShieldCheck, Tv } from 'lucide-react';
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
      setError('Cannot connect to CampusCast backend server (port 5000).');
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#290044] flex flex-col justify-center items-center p-4 sm:p-6">
      <div className="w-full max-w-md bg-white rounded-2xl shadow-2xl border border-[#E6E0EC] overflow-hidden">
        {/* Top Banner */}
        <div className="bg-gradient-to-r from-[#290044] to-[#500071] px-6 py-6 text-white">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-xl bg-[#500071] border border-[#EEE3B0]/40 flex items-center justify-center shrink-0">
              <FolderKanban className="w-6 h-6 text-[#EEE3B0]" />
            </div>
            <div>
              <h1 className="text-lg font-bold tracking-tight font-display">
                CampusCast Sign-In
              </h1>
              <p className="text-xs text-[#EEE3B0]/85">
                D.Y. Patil International University · Digital Signage Console
              </p>
            </div>
          </div>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className="block text-xs font-semibold text-[#290044] mb-1.5">
              University Email
            </label>
            <div className="relative">
              <Mail className="w-4 h-4 text-[#645573] absolute left-3 top-1/2 -translate-y-1/2" />
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
                className="w-full pl-9 pr-3 py-2.5 text-xs bg-[#FAF8FC] border border-[#E8E2EE] rounded-lg text-[#290044] focus:outline-none focus:border-[#8A2A78] focus:bg-white"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-[#290044] mb-1.5">
              Password
            </label>
            <div className="relative">
              <Lock className="w-4 h-4 text-[#645573] absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type={showPassword ? 'text' : 'password'}
                required
                value={password}
                onChange={(e) => {
                  setPassword(e.target.value);
                  setError('');
                }}
                placeholder="Enter your password"
                className="w-full pl-9 pr-10 py-2.5 text-xs bg-[#FAF8FC] border border-[#E8E2EE] rounded-lg text-[#290044] focus:outline-none focus:border-[#8A2A78] focus:bg-white"
              />
              <button
                type="button"
                onClick={() => setShowPassword((s) => !s)}
                aria-label={showPassword ? 'Hide password' : 'Show password'}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 text-[#645573] hover:text-[#290044]"
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          {error && (
            <div className="p-3 rounded-lg bg-rose-50 border border-rose-200 text-xs text-rose-700 font-medium">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full py-2.5 px-4 rounded-lg bg-[#500071] hover:bg-[#8A2A78] text-white text-xs font-semibold transition-colors disabled:opacity-60 cursor-pointer flex items-center justify-center gap-2"
          >
            <ShieldCheck className="w-4 h-4 text-[#EEE3B0]" />
            {loading ? 'Signing in...' : 'Sign In to Console'}
          </button>

          {/* Quick Role Credentials Helper */}
          <div className="pt-3 border-t border-[#F1ECF6] space-y-2">
            <div className="flex items-center justify-between text-[11px] text-[#645573]">
              <span className="font-semibold text-[#290044]">Quick staff account fill</span>
              <span className="font-mono">
                Default pass: <strong className="text-[#500071]">Admin@123</strong>
              </span>
            </div>
            <div className="grid grid-cols-2 gap-1.5">
              {DEMO_ACCOUNTS.map((acc) => (
                <button
                  key={acc.email}
                  type="button"
                  onClick={() => {
                    setEmail(acc.email);
                    setPassword('Admin@123');
                    setError('');
                  }}
                  className="px-2.5 py-1.5 rounded-lg border border-[#E8E2EE] bg-[#FAF8FC] hover:border-[#8A2A78] text-left transition-colors cursor-pointer"
                >
                  <span className="block text-[11px] font-semibold text-[#290044]">
                    {acc.label}
                  </span>
                  <span className="block text-[10px] text-[#645573] truncate">{acc.role}</span>
                </button>
              ))}
            </div>
          </div>
        </form>

        {/* Bottom TV Mode Bypass Link */}
        <div className="px-6 py-3 bg-[#FAF8FC] border-t border-[#E8E2EE] flex items-center justify-between text-[11px] text-[#645573]">
          <span>Smart TVs & Standys auto-play without login</span>
          <button
            type="button"
            onClick={onOpenTvMode}
            className="inline-flex items-center gap-1 font-semibold text-[#500071] hover:text-[#8A2A78] cursor-pointer"
          >
            <Tv className="w-3.5 h-3.5" />
            Open TV Player
          </button>
        </div>
      </div>
    </div>
  );
};
