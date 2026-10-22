import React, { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { PasswordRecoveryView } from './PasswordRecoveryView';
import {
  Mail,
  Lock,
  User,
  Eye,
  EyeOff,
  Briefcase,
  ShieldCheck,
  Building2,
  Sparkles,
  AlertTriangle,
  CheckCircle2,
  ArrowRight,
  ChevronDown,
  Layers,
  Database,
  Shield,
  HelpCircle,
} from 'lucide-react';

export type AuthRoleTab = 'employee' | 'superAdmin' | 'client';

export const LoginView: React.FC = () => {
  const { loginWithEmail, loginWithGoogle, loginAsEmployee, loginAsDemoRole } = useAuth();

  // Active Role Tab
  const [activeRole, setActiveRole] = useState<AuthRoleTab>('employee');

  // Form Fields
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);

  // Status Handlers
  const [errorText, setErrorText] = useState<string | null>(null);
  const [successText, setSuccessText] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  // Password Recovery Toggle
  const [showPasswordRecovery, setShowPasswordRecovery] = useState(false);

  // Collapsible Developer Sandbox Drawer
  const [showDevSandbox, setShowDevSandbox] = useState(false);

  // Registered Specialist Team Accounts for quick selection in developer sandbox
  const employeeAccounts = [
    { name: 'Priyanshu', role: 'Developer', id: 'priyanshu', email: 'bgrltwrrt@gmail.com', dept: 'Development' },
    { name: 'Vansh', role: 'Graphic Designer', id: 'vansh', email: 'f3434@gmail.com', dept: 'Design' },
    { name: 'Ravinder', role: 'Graphic Designer', id: 'ravinder', email: '3r3rc5@gmail.com', dept: 'Design' },
    { name: 'Mohd Aakib', role: 'Graphic Designer', id: 'aakib', email: 'f4344@gmail.com', dept: 'Design' },
  ];

  // Clear fields and switch role tab
  const handleRoleTabChange = (role: AuthRoleTab) => {
    setActiveRole(role);
    setIdentifier('');
    setPassword('');
    setErrorText(null);
    setSuccessText(null);
  };

  // Submit Handler
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorText(null);
    setSuccessText(null);

    const cleanId = identifier.trim();
    const cleanPass = password.trim();

    if (!cleanId || !cleanPass) {
      setErrorText('Please enter both your identifier and password.');
      return;
    }

    const lowerId = cleanId.toLowerCase();
    const adminIdentifiers = ['admin', 'superadmin', 'admin@digiexplode.ai', 'superadmin@digiexplode.ai', 'dilseinvite@gmail.com'];
    const clientIdentifiers = ['client', 'client@nexuscoaching.com'];
    const employeeIdentifiers = ['priyanshu', 'vansh', 'ravinder', 'aakib', 'employee'];

    // Strict tab validation: prevent superadmin from logging in through employee tab
    if (activeRole === 'employee') {
      if (adminIdentifiers.includes(lowerId)) {
        setErrorText('This identifier belongs to Super Admin. Please switch to the "Super Admin" tab to log in.');
        return;
      }
      if (clientIdentifiers.includes(lowerId)) {
        setErrorText('This identifier belongs to Client. Please switch to the "Client" tab to log in.');
        return;
      }
    } else if (activeRole === 'superAdmin') {
      if (employeeIdentifiers.includes(lowerId)) {
        setErrorText('This identifier belongs to an Employee. Please switch to the "Employee" tab to log in.');
        return;
      }
      if (clientIdentifiers.includes(lowerId)) {
        setErrorText('This identifier belongs to Client. Please switch to the "Client" tab to log in.');
        return;
      }
      if (!adminIdentifiers.includes(lowerId)) {
        setErrorText('Invalid Super Admin credentials. Super Admin identifier is "admin" or registered master email.');
        return;
      }
    } else if (activeRole === 'client') {
      if (adminIdentifiers.includes(lowerId)) {
        setErrorText('This identifier belongs to Super Admin. Please switch to the "Super Admin" tab to log in.');
        return;
      }
      if (employeeIdentifiers.includes(lowerId)) {
        setErrorText('This identifier belongs to an Employee. Please switch to the "Employee" tab to log in.');
        return;
      }
    }

    setLoading(true);
    try {
      if (activeRole === 'superAdmin') {
        await loginWithEmail(lowerId, cleanPass, 'superAdmin');
      } else if (activeRole === 'client') {
        await loginWithEmail(cleanId, cleanPass, 'client');
      } else {
        await loginWithEmail(cleanId, cleanPass, 'employee');
      }

      if (rememberMe && typeof window !== 'undefined') {
        localStorage.setItem('digi_remember_identifier', cleanId);
      }
    } catch (err: any) {
      let translate = err.message || 'Authentication failed. Please verify credentials.';
      if (err.code === 'auth/wrong-password' || err.code === 'auth/invalid-credential') {
        translate = 'Incorrect password or invalid credentials. Please retry.';
      } else if (err.code === 'auth/user-not-found') {
        translate = 'No registered account found matching this identifier.';
      }
      setErrorText(translate);
    } finally {
      setLoading(false);
    }
  };

  // Google Sign-In Handler
  const handleGoogleSignIn = async () => {
    setErrorText(null);
    setLoading(true);
    try {
      await loginWithGoogle();
    } catch (err: any) {
      setErrorText(err.message || 'Failed to authenticate via Google.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="w-full max-w-6xl mx-auto py-6 sm:py-10 px-4">
      {/* Container Card with 2-Column Desktop Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-12 rounded-3xl overflow-hidden border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-2xl">
        
        {/* ── LEFT COLUMN: BRAND & ENTERPRISE VALUE PANEL (Desktop) ─────────── */}
        <div className="lg:col-span-5 bg-gradient-to-br from-[#080D1A] via-[#0E1528] to-[#121B33] p-8 sm:p-10 flex flex-col justify-between text-white relative overflow-hidden border-b lg:border-b-0 lg:border-r border-slate-800">
          {/* Subtle Ambient Decorative Glows */}
          <div className="absolute -top-24 -left-24 w-80 h-80 bg-blue-600/15 rounded-full blur-3xl pointer-events-none" />
          <div className="absolute -bottom-24 -right-24 w-80 h-80 bg-purple-600/15 rounded-full blur-3xl pointer-events-none" />

          {/* Top Branding */}
          <div className="relative z-10 space-y-6">
            <div className="flex items-center gap-3">
              <div
                className="w-12 h-12 rounded-2xl flex items-center justify-center text-white shadow-xl"
                style={{ background: '#3557FF', boxShadow: '0 8px 24px rgba(53,87,255,0.4)' }}
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" className="w-6 h-6">
                  <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" />
                </svg>
              </div>
              <div>
                <h1 className="text-xl font-black tracking-tight text-white flex items-center gap-1.5">
                  DigiExplode<span className="text-[#3557FF]">AI</span>
                </h1>
                <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">
                  Agency Command OS
                </p>
              </div>
            </div>

            <div className="space-y-2 pt-2">
              <h2 className="text-2xl sm:text-3xl font-black text-white tracking-tight leading-tight">
                Unified Agency Intelligence &amp; Execution
              </h2>
              <p className="text-xs text-slate-400 leading-relaxed">
                Empowering high-performance marketing teams, creative specialists, and enterprise clients with zero-trust role segregation and real-time campaign delivery.
              </p>
            </div>

            {/* Architecture Highlights */}
            <div className="space-y-3 pt-3">
              <div className="p-3.5 rounded-2xl bg-white/5 border border-white/10 flex items-start gap-3 backdrop-blur-md">
                <div className="w-8 h-8 rounded-xl bg-blue-500/20 text-[#3557FF] flex items-center justify-center shrink-0 mt-0.5">
                  <Shield className="w-4 h-4 text-blue-400" />
                </div>
                <div>
                  <h4 className="text-xs font-black text-white">Zero-Trust Role Segregation</h4>
                  <p className="text-[11px] text-slate-400 leading-normal">
                    Strict, isolated access controls for Super Admins, specialists, and clients.
                  </p>
                </div>
              </div>

              <div className="p-3.5 rounded-2xl bg-white/5 border border-white/10 flex items-start gap-3 backdrop-blur-md">
                <div className="w-8 h-8 rounded-xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center shrink-0 mt-0.5">
                  <Database className="w-4 h-4 text-emerald-400" />
                </div>
                <div>
                  <h4 className="text-xs font-black text-white">Cloudflare D1 Global Edge</h4>
                  <p className="text-[11px] text-slate-400 leading-normal">
                    Real-time persistence and high-availability database architecture.
                  </p>
                </div>
              </div>

              <div className="p-3.5 rounded-2xl bg-white/5 border border-white/10 flex items-start gap-3 backdrop-blur-md">
                <div className="w-8 h-8 rounded-xl bg-purple-500/20 text-purple-400 flex items-center justify-center shrink-0 mt-0.5">
                  <Layers className="w-4 h-4 text-purple-400" />
                </div>
                <div>
                  <h4 className="text-xs font-black text-white">Single-Use Security &amp; OTP</h4>
                  <p className="text-[11px] text-slate-400 leading-normal">
                    Multi-channel password recovery and automatic token revocation.
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Bottom Live System Indicator */}
          <div className="relative z-10 pt-8 mt-6 border-t border-white/10 flex items-center justify-between text-[11px] text-slate-400">
            <div className="flex items-center gap-2 font-medium">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              <span>All Systems Operational</span>
            </div>
            <span className="font-mono text-[10px] text-slate-500">v2.4 Enterprise</span>
          </div>
        </div>

        {/* ── RIGHT COLUMN: AUTHENTICATION FORM ───────────────────────────── */}
        <div className="lg:col-span-7 p-6 sm:p-10 flex flex-col justify-center bg-white dark:bg-slate-900">
          {showPasswordRecovery ? (
            /* Dedicated Password Recovery Wizard */
            <PasswordRecoveryView
              initialRoleHint={activeRole}
              onBackToLogin={roleHint => {
                setShowPasswordRecovery(false);
                if (roleHint) setActiveRole(roleHint);
              }}
            />
          ) : (
            /* Standard Role-Based Login Form */
            <div className="space-y-6">
              {/* Header */}
              <div className="space-y-1">
                <h3 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white tracking-tight">
                  Welcome to DigiExplodeAI
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Select your role below to access your tailored workspace.
                </p>
              </div>

              {/* Accessible Segmented Role Switcher */}
              <div
                role="tablist"
                aria-label="Workspace Role Selector"
                className="grid grid-cols-3 p-1 rounded-2xl bg-slate-100 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-xs font-bold"
              >
                <button
                  type="button"
                  role="tab"
                  id="tab-employee"
                  aria-selected={activeRole === 'employee'}
                  aria-controls="panel-employee"
                  onClick={() => handleRoleTabChange('employee')}
                  className={`py-2.5 px-3 rounded-xl flex items-center justify-center gap-2 transition-all cursor-pointer ${
                    activeRole === 'employee'
                      ? 'bg-white dark:bg-slate-800 text-[#3557FF] dark:text-white shadow-sm font-extrabold'
                      : 'text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white'
                  }`}
                >
                  <Briefcase className="w-3.5 h-3.5 shrink-0" />
                  <span className="truncate">Employee</span>
                </button>

                <button
                  type="button"
                  role="tab"
                  id="tab-superAdmin"
                  aria-selected={activeRole === 'superAdmin'}
                  aria-controls="panel-superAdmin"
                  onClick={() => handleRoleTabChange('superAdmin')}
                  className={`py-2.5 px-3 rounded-xl flex items-center justify-center gap-2 transition-all cursor-pointer ${
                    activeRole === 'superAdmin'
                      ? 'bg-white dark:bg-slate-800 text-[#3557FF] dark:text-white shadow-sm font-extrabold'
                      : 'text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white'
                  }`}
                >
                  <ShieldCheck className="w-3.5 h-3.5 shrink-0" />
                  <span className="truncate">Super Admin</span>
                </button>

                <button
                  type="button"
                  role="tab"
                  id="tab-client"
                  aria-selected={activeRole === 'client'}
                  aria-controls="panel-client"
                  onClick={() => handleRoleTabChange('client')}
                  className={`py-2.5 px-3 rounded-xl flex items-center justify-center gap-2 transition-all cursor-pointer ${
                    activeRole === 'client'
                      ? 'bg-white dark:bg-slate-800 text-[#3557FF] dark:text-white shadow-sm font-extrabold'
                      : 'text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white'
                  }`}
                >
                  <Building2 className="w-3.5 h-3.5 shrink-0" />
                  <span className="truncate">Client</span>
                </button>
              </div>

              {/* Feedback Alerts */}
              {errorText && (
                <div className="p-3 bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900/50 text-red-600 dark:text-red-400 text-xs font-semibold rounded-xl flex items-start gap-2 animate-in fade-in">
                  <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                  <span>{errorText}</span>
                </div>
              )}

              {successText && (
                <div className="p-3 bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-900/50 text-emerald-600 dark:text-emerald-400 text-xs font-semibold rounded-xl flex items-start gap-2 animate-in fade-in">
                  <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" />
                  <span>{successText}</span>
                </div>
              )}

              {/* Role-Specific Context Notice */}
              {activeRole === 'superAdmin' && (
                <div className="p-3 rounded-xl bg-blue-50/70 dark:bg-blue-950/30 border border-blue-200/70 dark:border-blue-900/40 text-[11px] text-blue-800 dark:text-blue-300 flex items-start gap-2.5">
                  <ShieldCheck className="w-4 h-4 shrink-0 text-[#3557FF] mt-0.5" />
                  <p>
                    <strong>Privileged Administrative Entry:</strong> Strict Zero-Trust token and verified role checks are enforced on all server operations.
                  </p>
                </div>
              )}

              {activeRole === 'client' && (
                <div className="p-3 rounded-xl bg-emerald-50/70 dark:bg-emerald-950/30 border border-emerald-200/70 dark:border-emerald-900/40 text-[11px] text-emerald-800 dark:text-emerald-300 flex items-start gap-2.5">
                  <Building2 className="w-4 h-4 shrink-0 text-emerald-600 dark:text-emerald-400 mt-0.5" />
                  <p>
                    <strong>Dedicated Client Workspace:</strong> Review and approve creative assets, monitor live content calendars, and inspect verified performance analytics.
                  </p>
                </div>
              )}

              {/* Login Form */}
              <form onSubmit={handleSubmit} className="space-y-4">
                {/* Identifier Input */}
                <div>
                  <label
                    htmlFor="login-identifier"
                    className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1"
                  >
                    {activeRole === 'employee' && 'Work Email or Employee ID *'}
                    {activeRole === 'superAdmin' && 'Super Admin ID or Email *'}
                    {activeRole === 'client' && 'Client Email or Client ID *'}
                  </label>
                  <div className="relative flex items-center">
                    {activeRole === 'client' ? (
                      <Building2 className="absolute left-3.5 w-4 h-4 text-slate-400" />
                    ) : activeRole === 'superAdmin' ? (
                      <ShieldCheck className="absolute left-3.5 w-4 h-4 text-slate-400" />
                    ) : (
                      <User className="absolute left-3.5 w-4 h-4 text-slate-400" />
                    )}
                    <input
                      id="login-identifier"
                      type="text"
                      autoComplete="username"
                      value={identifier}
                      onChange={e => setIdentifier(e.target.value)}
                      placeholder={
                        activeRole === 'employee'
                          ? 'e.g. priyanshu, vansh, or name@digiexplode.ai'
                          : activeRole === 'superAdmin'
                          ? 'admin or admin@digiexplode.ai'
                          : 'client@nexuscoaching.com or client_001'
                      }
                      className="w-full text-xs font-medium bg-slate-50 dark:bg-slate-950 hover:bg-slate-100/50 dark:hover:bg-slate-900 border border-slate-200 dark:border-slate-800 focus:border-[#3557FF] p-3.5 pl-10 rounded-xl outline-none text-slate-900 dark:text-white transition-colors"
                      required
                    />
                  </div>
                </div>

                {/* Password Input */}
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label
                      htmlFor="login-password"
                      className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400"
                    >
                      Password *
                    </label>
                    <button
                      type="button"
                      onClick={() => setShowPasswordRecovery(true)}
                      className="text-[11px] font-bold text-[#3557FF] hover:underline cursor-pointer"
                    >
                      Forgot password?
                    </button>
                  </div>
                  <div className="relative flex items-center">
                    <Lock className="absolute left-3.5 w-4 h-4 text-slate-400" />
                    <input
                      id="login-password"
                      type={showPassword ? 'text' : 'password'}
                      autoComplete="current-password"
                      value={password}
                      onChange={e => setPassword(e.target.value)}
                      placeholder="••••••••"
                      className="w-full text-xs font-medium bg-slate-50 dark:bg-slate-950 hover:bg-slate-100/50 dark:hover:bg-slate-900 border border-slate-200 dark:border-slate-800 focus:border-[#3557FF] p-3.5 pl-10 pr-10 rounded-xl outline-none text-slate-900 dark:text-white transition-colors"
                      required
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 cursor-pointer"
                      aria-label={showPassword ? 'Hide password' : 'Show password'}
                    >
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                {/* Remember Me Option */}
                <div className="flex items-center justify-between text-xs pt-1">
                  <label className="flex items-center gap-2 cursor-pointer select-none text-slate-600 dark:text-slate-300">
                    <input
                      type="checkbox"
                      checked={rememberMe}
                      onChange={e => setRememberMe(e.target.checked)}
                      className="w-4 h-4 rounded text-[#3557FF] focus:ring-[#3557FF] border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950"
                    />
                    <span>Remember this device</span>
                  </label>
                </div>

                {/* Primary Submit Button */}
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full py-3.5 px-4 bg-[#3557FF] hover:bg-[#2545E0] text-white text-xs font-extrabold uppercase tracking-wider rounded-xl shadow-lg transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                >
                  {loading ? (
                    'Verifying credentials…'
                  ) : activeRole === 'superAdmin' ? (
                    <>
                      <ShieldCheck className="w-4 h-4" />
                      <span>Authenticate Super Admin</span>
                    </>
                  ) : activeRole === 'client' ? (
                    <>
                      <Building2 className="w-4 h-4" />
                      <span>Access Client Workspace</span>
                    </>
                  ) : (
                    <>
                      <Briefcase className="w-4 h-4" />
                      <span>Sign In as Team Member</span>
                    </>
                  )}
                </button>
              </form>

              {/* Google Sign-In (For Employees & Clients) */}
              {activeRole !== 'superAdmin' && (
                <div className="space-y-4 pt-1">
                  <div className="flex items-center gap-3">
                    <div className="h-px bg-slate-200 dark:bg-slate-800 flex-1" />
                    <span className="text-[10px] font-black uppercase tracking-wider text-slate-400">
                      Or continue with
                    </span>
                    <div className="h-px bg-slate-200 dark:bg-slate-800 flex-1" />
                  </div>

                  <button
                    type="button"
                    onClick={handleGoogleSignIn}
                    disabled={loading}
                    className="w-full py-3 border border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/60 text-slate-700 dark:text-slate-200 font-bold text-xs rounded-xl transition-all flex items-center justify-center gap-2.5 cursor-pointer disabled:opacity-50"
                  >
                    <svg className="w-4 h-4" viewBox="0 0 24 24">
                      <path
                        fill="#4285F4"
                        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                      />
                      <path
                        fill="#34A853"
                        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                      />
                      <path
                        fill="#FBBC05"
                        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22-.03-.63z"
                      />
                      <path
                        fill="#EA4335"
                        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                      />
                    </svg>
                    <span>Google Workspace</span>
                  </button>
                </div>
              )}

              {/* Client Onboarding Assistance Link */}
              {activeRole === 'client' && (
                <div className="p-3 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl text-center">
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Client workspaces are provisioned by your DigiExplode account executive.
                  </p>
                  <a
                    href="mailto:support@digiexplode.ai"
                    className="text-xs font-bold text-[#3557FF] hover:underline inline-block mt-1"
                  >
                    Request invitation link or support &rarr;
                  </a>
                </div>
              )}

              {/* Discreet Development & Sandbox Accounts Drawer */}
              <div className="pt-2 border-t border-slate-100 dark:border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowDevSandbox(!showDevSandbox)}
                  className="w-full flex items-center justify-between text-[11px] font-bold text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 py-1 cursor-pointer"
                >
                  <span className="flex items-center gap-1.5">
                    <Sparkles className="w-3.5 h-3.5 text-[#3557FF]" />
                    <span>Development Environment Sandbox</span>
                  </span>
                  <ChevronDown
                    className={`w-3.5 h-3.5 transition-transform ${showDevSandbox ? 'rotate-180' : ''}`}
                  />
                </button>

                {showDevSandbox && (
                  <div className="mt-2.5 p-3 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 space-y-2.5 animate-in fade-in">
                    <div className="flex items-center justify-between text-[10px]">
                      <span className="font-bold text-slate-500">Quick Sandbox Sessions:</span>
                      <span className="text-slate-400">Development Mock Only</span>
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          setActiveRole('superAdmin');
                          setIdentifier('admin');
                          setPassword('admin123');
                        }}
                        className="p-2 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-left hover:border-blue-500 transition-all cursor-pointer"
                      >
                        <span className="block text-xs font-bold text-slate-800 dark:text-white">Super Admin</span>
                        <span className="text-[10px] text-slate-400 block font-mono">admin / admin123</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          setActiveRole('client');
                          setIdentifier('client@nexuscoaching.com');
                          setPassword('client123');
                        }}
                        className="p-2 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-left hover:border-emerald-500 transition-all cursor-pointer"
                      >
                        <span className="block text-xs font-bold text-slate-800 dark:text-white">Client Rep</span>
                        <span className="text-[10px] text-slate-400 block font-mono">Nexus Coaching</span>
                      </button>
                    </div>

                    <div className="pt-1">
                      <span className="block text-[10px] font-bold text-slate-400 mb-1.5">
                        Team Specialists:
                      </span>
                      <div className="grid grid-cols-2 gap-1.5">
                        {employeeAccounts.map(emp => (
                          <button
                            key={emp.id}
                            type="button"
                            onClick={() => {
                              setActiveRole('employee');
                              setIdentifier(emp.id);
                              setPassword(emp.id);
                            }}
                            className="p-1.5 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-left hover:border-blue-500 transition-all cursor-pointer"
                          >
                            <span className="block text-[11px] font-bold text-slate-800 dark:text-white">{emp.name}</span>
                            <span className="text-[9px] text-slate-400 block">{emp.role}</span>
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
