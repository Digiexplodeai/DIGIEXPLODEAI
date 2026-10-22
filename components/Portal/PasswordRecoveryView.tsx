import React, { useState, useEffect } from 'react';
import {
  Mail,
  Smartphone,
  Lock,
  Eye,
  EyeOff,
  ArrowLeft,
  ArrowRight,
  ShieldCheck,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  KeyRound,
  Check,
  X,
} from 'lucide-react';
import {
  cfRequestPasswordRecovery,
  cfVerifyRecoveryOtp,
  cfResetPasswordWithToken,
} from '../../lib/cloudflareApi';

interface PasswordRecoveryViewProps {
  onBackToLogin: (roleHint?: 'employee' | 'superAdmin' | 'client') => void;
  initialRoleHint?: 'employee' | 'superAdmin' | 'client';
}

type RecoveryStep = 1 | 2 | 3 | 4;

export const PasswordRecoveryView: React.FC<PasswordRecoveryViewProps> = ({
  onBackToLogin,
  initialRoleHint = 'employee',
}) => {
  const [step, setStep] = useState<RecoveryStep>(1);
  const [channel, setChannel] = useState<'email' | 'sms'>('email');
  const [identifier, setIdentifier] = useState('');
  const [maskedTarget, setMaskedTarget] = useState('');
  const [otp, setOtp] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [resetAuthToken, setResetAuthToken] = useState('');

  // States & Feedback
  const [loading, setLoading] = useState(false);
  const [errorText, setErrorText] = useState<string | null>(null);
  const [infoText, setInfoText] = useState<string | null>(null);
  const [cooldown, setCooldown] = useState(0);

  // Timer cooldown effect
  useEffect(() => {
    if (cooldown <= 0) return;
    const interval = setInterval(() => {
      setCooldown(prev => (prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => clearInterval(interval);
  }, [cooldown]);

  // Password strength checks
  const hasMinLength = newPassword.length >= 8;
  const hasMixedCase = /[a-z]/.test(newPassword) && /[A-Z]/.test(newPassword);
  const hasNumberOrSymbol = /[0-9!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(newPassword);
  const passwordsMatch = newPassword.length > 0 && newPassword === confirmPassword;
  const isPasswordValid = hasMinLength && hasMixedCase && hasNumberOrSymbol && passwordsMatch;

  // Step 1: Request Recovery Code
  const handleRequestRecovery = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorText(null);
    setInfoText(null);

    const clean = identifier.trim();
    if (!clean) {
      setErrorText('Please enter your registered email address or mobile number.');
      return;
    }

    if (channel === 'email' && !clean.includes('@')) {
      setErrorText('Please enter a valid email address with an "@" symbol.');
      return;
    }

    setLoading(true);
    try {
      // 1. Dispatch through Cloudflare Worker API
      const res = await cfRequestPasswordRecovery(clean, channel);
      setMaskedTarget(res.maskedTarget || clean);
      setCooldown(res.cooldownSeconds || 60);

      // 2. Also trigger Firebase client password reset if email channel
      if (channel === 'email') {
        try {
          const { sendPasswordResetEmail } = await import('firebase/auth');
          const { auth } = await import('../../lib/firebase');
          await sendPasswordResetEmail(auth, clean);
        } catch (firebaseErr: any) {
          // Non-blocking: Cloudflare Worker verification code handles custom recovery
          console.info('[Recovery] Firebase reset note:', firebaseErr.message);
        }
      }

      setInfoText(
        `Verification instructions sent! Please check your ${channel === 'email' ? 'inbox' : 'messages'}.`
      );
      setStep(2);
    } catch (err: any) {
      setErrorText(err.message || 'Unable to dispatch recovery instructions. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  // Step 2: Verify OTP
  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorText(null);
    setInfoText(null);

    const cleanOtp = otp.trim();
    if (cleanOtp.length < 6) {
      setErrorText('Please enter the complete 6-digit verification code.');
      return;
    }

    setLoading(true);
    try {
      const res = await cfVerifyRecoveryOtp(identifier.trim(), cleanOtp);
      if (res.success && res.resetAuthToken) {
        setResetAuthToken(res.resetAuthToken);
        setStep(3);
      } else {
        setErrorText(res.error || 'Verification failed. Please check the code.');
      }
    } catch (err: any) {
      setErrorText(err.message || 'Incorrect verification code. Please check and try again.');
    } finally {
      setLoading(false);
    }
  };

  // Resend code handler
  const handleResendCode = async () => {
    if (cooldown > 0 || loading) return;
    setErrorText(null);
    setLoading(true);
    try {
      const res = await cfRequestPasswordRecovery(identifier.trim(), channel);
      setCooldown(res.cooldownSeconds || 60);
      setInfoText('A fresh verification code has been dispatched.');
    } catch (err: any) {
      setErrorText(err.message || 'Failed to resend verification code.');
    } finally {
      setLoading(false);
    }
  };

  // Step 3: Set New Password
  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorText(null);
    setInfoText(null);

    if (!isPasswordValid) {
      setErrorText('Please ensure all password criteria are satisfied.');
      return;
    }

    setLoading(true);
    try {
      const res = await cfResetPasswordWithToken(resetAuthToken, newPassword);
      if (res.success) {
        setStep(4);
      } else {
        setErrorText(res.error || 'Failed to reset password. Please try again.');
      }
    } catch (err: any) {
      setErrorText(err.message || 'Unable to update password. Please restart the recovery flow.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="w-full space-y-6 animate-in fade-in zoom-in-95 duration-200">
      {/* Step Indicator */}
      <div className="flex items-center justify-between pb-3 border-b border-slate-200 dark:border-slate-800">
        <button
          type="button"
          onClick={() => onBackToLogin(initialRoleHint)}
          className="flex items-center gap-1.5 text-xs font-bold text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-white transition-colors"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>Back to Sign In</span>
        </button>
        <div className="flex items-center gap-2">
          {[1, 2, 3, 4].map(s => (
            <div
              key={s}
              className={`w-2 h-2 rounded-full transition-all duration-300 ${
                s === step
                  ? 'w-6 bg-[#3557FF]'
                  : s < step
                  ? 'bg-emerald-500'
                  : 'bg-slate-300 dark:bg-slate-700'
              }`}
            />
          ))}
        </div>
      </div>

      {/* Screen Title */}
      <div className="space-y-1">
        <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-md text-[10px] font-black uppercase tracking-wider bg-blue-50 dark:bg-blue-950/60 text-[#3557FF] border border-blue-200/60 dark:border-blue-900/40">
          <KeyRound className="w-3 h-3" />
          <span>Security &amp; Password Recovery</span>
        </div>
        <h2 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white tracking-tight">
          {step === 1 && 'Recover Your Workspace Account'}
          {step === 2 && 'Verify Account Contact'}
          {step === 3 && 'Choose a New Secure Password'}
          {step === 4 && 'Password Reset Complete'}
        </h2>
        <p className="text-xs text-slate-500 dark:text-slate-400">
          {step === 1 && 'Enter your verified email or mobile number to receive single-use credentials.'}
          {step === 2 && `Enter the 6-digit code sent to ${maskedTarget || 'your contact'}.`}
          {step === 3 && 'Create a strong, unique password to restore access to DigiExplodeAI.'}
          {step === 4 && 'Your credentials have been securely updated. You can now access your workspace.'}
        </p>
      </div>

      {/* Alert Notices */}
      {errorText && (
        <div className="p-3 bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900/50 text-red-600 dark:text-red-400 text-xs font-semibold rounded-xl flex items-start gap-2">
          <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
          <span>{errorText}</span>
        </div>
      )}

      {infoText && (
        <div className="p-3 bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-900/50 text-emerald-600 dark:text-emerald-400 text-xs font-semibold rounded-xl flex items-start gap-2">
          <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" />
          <span>{infoText}</span>
        </div>
      )}

      {/* STEP 1: REQUEST */}
      {step === 1 && (
        <form onSubmit={handleRequestRecovery} className="space-y-4">
          {/* Recovery Channel Selector */}
          <div>
            <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-2">
              Select Verification Channel
            </label>
            <div className="grid grid-cols-2 gap-2.5">
              <button
                type="button"
                onClick={() => setChannel('email')}
                className={`p-3 rounded-xl border text-left flex items-center gap-3 transition-all ${
                  channel === 'email'
                    ? 'border-[#3557FF] bg-blue-50/50 dark:bg-blue-950/40 text-slate-900 dark:text-white shadow-xs'
                    : 'border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 text-slate-600 dark:text-slate-400'
                }`}
              >
                <div
                  className={`w-8 h-8 rounded-lg flex items-center justify-center ${
                    channel === 'email'
                      ? 'bg-[#3557FF] text-white'
                      : 'bg-slate-100 dark:bg-slate-800 text-slate-400'
                  }`}
                >
                  <Mail className="w-4 h-4" />
                </div>
                <div>
                  <span className="block text-xs font-black">Verified Email</span>
                  <span className="text-[10px] text-slate-400 block">Link &amp; 6-Digit Code</span>
                </div>
              </button>

              <button
                type="button"
                onClick={() => setChannel('sms')}
                className={`p-3 rounded-xl border text-left flex items-center gap-3 transition-all ${
                  channel === 'sms'
                    ? 'border-[#3557FF] bg-blue-50/50 dark:bg-blue-950/40 text-slate-900 dark:text-white shadow-xs'
                    : 'border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 text-slate-600 dark:text-slate-400'
                }`}
              >
                <div
                  className={`w-8 h-8 rounded-lg flex items-center justify-center ${
                    channel === 'sms'
                      ? 'bg-[#3557FF] text-white'
                      : 'bg-slate-100 dark:bg-slate-800 text-slate-400'
                  }`}
                >
                  <Smartphone className="w-4 h-4" />
                </div>
                <div>
                  <span className="block text-xs font-black">Mobile SMS OTP</span>
                  <span className="text-[10px] text-slate-400 block">Fast 6-Digit Code</span>
                </div>
              </button>
            </div>
          </div>

          {/* Identifier Input */}
          <div>
            <label
              htmlFor="recovery-identifier"
              className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1"
            >
              {channel === 'email' ? 'Registered Account Email' : 'Registered Mobile Number'} *
            </label>
            <div className="relative flex items-center">
              {channel === 'email' ? (
                <Mail className="absolute left-3.5 w-4 h-4 text-slate-400" />
              ) : (
                <Smartphone className="absolute left-3.5 w-4 h-4 text-slate-400" />
              )}
              <input
                id="recovery-identifier"
                type={channel === 'email' ? 'email' : 'tel'}
                autoComplete={channel === 'email' ? 'email' : 'tel'}
                value={identifier}
                onChange={e => setIdentifier(e.target.value)}
                placeholder={
                  channel === 'email'
                    ? 'name@digiexplode.ai or client@company.com'
                    : '+91 98765 43210'
                }
                className="w-full text-xs font-medium bg-slate-50 dark:bg-slate-950 hover:bg-slate-100/50 dark:hover:bg-slate-900 border border-slate-200 dark:border-slate-800 focus:border-[#3557FF] p-3.5 pl-10 rounded-xl outline-none text-slate-900 dark:text-white transition-colors"
                required
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3.5 px-4 bg-[#3557FF] hover:bg-[#2545E0] text-white text-xs font-extrabold uppercase tracking-wider rounded-xl shadow-lg transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
          >
            {loading ? (
              <RefreshCw className="w-4 h-4 animate-spin" />
            ) : (
              <>
                <span>Send Verification Code</span>
                <ArrowRight className="w-4 h-4" />
              </>
            )}
          </button>
        </form>
      )}

      {/* STEP 2: VERIFY CODE */}
      {step === 2 && (
        <form onSubmit={handleVerifyOtp} className="space-y-4">
          <div className="p-3 rounded-xl bg-slate-100 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-800 flex items-center justify-between text-xs">
            <span className="text-slate-500 dark:text-slate-400">Target:</span>
            <span className="font-mono font-bold text-slate-800 dark:text-white">
              {maskedTarget || identifier}
            </span>
          </div>

          <div>
            <label
              htmlFor="recovery-otp"
              className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1"
            >
              Enter 6-Digit Verification Code *
            </label>
            <div className="relative flex items-center">
              <KeyRound className="absolute left-3.5 w-4 h-4 text-slate-400" />
              <input
                id="recovery-otp"
                type="text"
                inputMode="numeric"
                autoComplete="one-time-code"
                maxLength={6}
                value={otp}
                onChange={e => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
                placeholder="123456"
                autoFocus
                className="w-full text-base tracking-widest text-center font-mono font-bold bg-slate-50 dark:bg-slate-950 hover:bg-slate-100/50 dark:hover:bg-slate-900 border border-slate-200 dark:border-slate-800 focus:border-[#3557FF] p-3 pl-10 rounded-xl outline-none text-slate-900 dark:text-white transition-colors"
                required
              />
            </div>
            <p className="text-[10px] text-slate-400 mt-1">
              Code expires in 5 minutes. Never share this code with anyone.
            </p>
          </div>

          <div className="flex items-center justify-between pt-1">
            <button
              type="button"
              onClick={handleResendCode}
              disabled={cooldown > 0 || loading}
              className={`text-xs font-bold transition-colors ${
                cooldown > 0
                  ? 'text-slate-400 cursor-not-allowed'
                  : 'text-[#3557FF] hover:underline cursor-pointer'
              }`}
            >
              {cooldown > 0 ? `Resend code in ${cooldown}s` : 'Resend verification code'}
            </button>
            <button
              type="button"
              onClick={() => setStep(1)}
              className="text-xs text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-white"
            >
              Change Contact
            </button>
          </div>

          <button
            type="submit"
            disabled={loading || otp.length < 6}
            className="w-full py-3.5 px-4 bg-[#3557FF] hover:bg-[#2545E0] text-white text-xs font-extrabold uppercase tracking-wider rounded-xl shadow-lg transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
          >
            {loading ? (
              <RefreshCw className="w-4 h-4 animate-spin" />
            ) : (
              <>
                <span>Verify Code</span>
                <ArrowRight className="w-4 h-4" />
              </>
            )}
          </button>
        </form>
      )}

      {/* STEP 3: SET NEW PASSWORD */}
      {step === 3 && (
        <form onSubmit={handleResetPassword} className="space-y-4">
          <div>
            <label
              htmlFor="recovery-new-password"
              className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1"
            >
              New Password *
            </label>
            <div className="relative flex items-center">
              <Lock className="absolute left-3.5 w-4 h-4 text-slate-400" />
              <input
                id="recovery-new-password"
                type={showPassword ? 'text' : 'password'}
                autoComplete="new-password"
                value={newPassword}
                onChange={e => setNewPassword(e.target.value)}
                placeholder="At least 8 characters..."
                autoFocus
                className="w-full text-xs font-medium bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 focus:border-[#3557FF] p-3.5 pl-10 pr-10 rounded-xl outline-none text-slate-900 dark:text-white"
                required
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                aria-label={showPassword ? 'Hide password' : 'Show password'}
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          <div>
            <label
              htmlFor="recovery-confirm-password"
              className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1"
            >
              Confirm New Password *
            </label>
            <div className="relative flex items-center">
              <Lock className="absolute left-3.5 w-4 h-4 text-slate-400" />
              <input
                id="recovery-confirm-password"
                type={showPassword ? 'text' : 'password'}
                autoComplete="new-password"
                value={confirmPassword}
                onChange={e => setConfirmPassword(e.target.value)}
                placeholder="Re-type your new password..."
                className="w-full text-xs font-medium bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 focus:border-[#3557FF] p-3.5 pl-10 pr-10 rounded-xl outline-none text-slate-900 dark:text-white"
                required
              />
            </div>
          </div>

          {/* Password Quality Criteria Checklist */}
          <div className="p-3 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl space-y-1.5 text-[11px]">
            <p className="font-bold text-slate-600 dark:text-slate-300 mb-1">Password Requirements:</p>
            <div className="flex items-center gap-2">
              {hasMinLength ? (
                <Check className="w-3.5 h-3.5 text-emerald-500" />
              ) : (
                <X className="w-3.5 h-3.5 text-slate-400" />
              )}
              <span className={hasMinLength ? 'text-emerald-600 dark:text-emerald-400 font-semibold' : 'text-slate-500'}>
                Minimum 8 characters
              </span>
            </div>
            <div className="flex items-center gap-2">
              {hasMixedCase ? (
                <Check className="w-3.5 h-3.5 text-emerald-500" />
              ) : (
                <X className="w-3.5 h-3.5 text-slate-400" />
              )}
              <span className={hasMixedCase ? 'text-emerald-600 dark:text-emerald-400 font-semibold' : 'text-slate-500'}>
                Uppercase and lowercase letters
              </span>
            </div>
            <div className="flex items-center gap-2">
              {hasNumberOrSymbol ? (
                <Check className="w-3.5 h-3.5 text-emerald-500" />
              ) : (
                <X className="w-3.5 h-3.5 text-slate-400" />
              )}
              <span className={hasNumberOrSymbol ? 'text-emerald-600 dark:text-emerald-400 font-semibold' : 'text-slate-500'}>
                At least one number or special symbol
              </span>
            </div>
            <div className="flex items-center gap-2">
              {passwordsMatch ? (
                <Check className="w-3.5 h-3.5 text-emerald-500" />
              ) : (
                <X className="w-3.5 h-3.5 text-slate-400" />
              )}
              <span className={passwordsMatch ? 'text-emerald-600 dark:text-emerald-400 font-semibold' : 'text-slate-500'}>
                Passwords match
              </span>
            </div>
          </div>

          <button
            type="submit"
            disabled={loading || !isPasswordValid}
            className="w-full py-3.5 px-4 bg-[#3557FF] hover:bg-[#2545E0] text-white text-xs font-extrabold uppercase tracking-wider rounded-xl shadow-lg transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
          >
            {loading ? (
              <RefreshCw className="w-4 h-4 animate-spin" />
            ) : (
              <>
                <ShieldCheck className="w-4 h-4" />
                <span>Save New Password &amp; Restore Access</span>
              </>
            )}
          </button>
        </form>
      )}

      {/* STEP 4: COMPLETE */}
      {step === 4 && (
        <div className="text-center py-4 space-y-4">
          <div className="w-16 h-16 rounded-full bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-500 mx-auto">
            <CheckCircle2 className="w-8 h-8" />
          </div>
          <div className="space-y-1">
            <h3 className="text-lg font-black text-slate-900 dark:text-white">
              Password Successfully Updated
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 max-w-sm mx-auto">
              Your new password is now active. All previous authentication tokens have been revoked
              to protect your workspace.
            </p>
          </div>
          <div className="pt-2">
            <button
              type="button"
              onClick={() => onBackToLogin(initialRoleHint)}
              className="w-full py-3.5 px-4 bg-[#3557FF] hover:bg-[#2545E0] text-white text-xs font-extrabold uppercase tracking-wider rounded-xl shadow-lg transition-all flex items-center justify-center gap-2 cursor-pointer"
            >
              <span>Sign In with New Password</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
