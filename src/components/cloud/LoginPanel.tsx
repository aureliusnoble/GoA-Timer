import React, { useState, useEffect, useCallback } from 'react';
import { Eye, EyeOff, Check, X, Loader2, Mail, KeyRound } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useSound } from '../../context/SoundContext';
import { AuthService } from '../../services/supabase/AuthService';

type Mode = 'login' | 'signup' | 'forgot-password';

const LoginPanel: React.FC = () => {
  const {
    login,
    signUp,
    error,
    clearError,
    isPasswordRecoveryMode,
    sendPasswordResetEmail,
    updatePasswordFromReset,
    clearPasswordRecoveryMode,
  } = useAuth();
  const { playSound } = useSound();

  const [mode, setMode] = useState<Mode>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [username, setUsername] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [usernameAvailable, setUsernameAvailable] = useState<boolean | null>(null);
  const [checkingUsername, setCheckingUsername] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);
  const [signupComplete, setSignupComplete] = useState(false);
  const [isResending, setIsResending] = useState(false);
  const [resendSuccess, setResendSuccess] = useState(false);
  const [resetEmailSent, setResetEmailSent] = useState(false);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  // Debounced username availability check
  useEffect(() => {
    if (mode !== 'signup' || username.length < 3) {
      setUsernameAvailable(null);
      return;
    }

    const usernameError = AuthService.validateUsername(username);
    if (usernameError) {
      setUsernameAvailable(null);
      return;
    }

    setCheckingUsername(true);
    const timeout = setTimeout(async () => {
      const available = await AuthService.isUsernameAvailable(username);
      setUsernameAvailable(available);
      setCheckingUsername(false);
    }, 500);

    return () => clearTimeout(timeout);
  }, [username, mode]);

  const handleModeSwitch = (newMode?: Mode) => {
    playSound('buttonClick');
    if (newMode) {
      setMode(newMode);
    } else {
      setMode(mode === 'login' ? 'signup' : 'login');
    }
    clearError();
    setLocalError(null);
    setUsernameAvailable(null);
    setSignupComplete(false);
    setResendSuccess(false);
    setResetEmailSent(false);
    setNewPassword('');
    setConfirmPassword('');
  };

  const handleForgotPassword = () => {
    playSound('buttonClick');
    setMode('forgot-password');
    clearError();
    setLocalError(null);
    setResetEmailSent(false);
  };

  const handleSendResetEmail = async (e: React.FormEvent) => {
    e.preventDefault();
    playSound('buttonClick');

    if (!email.trim()) {
      setLocalError('Email is required');
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setLocalError('Invalid email format');
      return;
    }

    setLocalError(null);
    setIsSubmitting(true);

    try {
      const result = await sendPasswordResetEmail(email);
      if (result.success) {
        setResetEmailSent(true);
      }
      // Note: We show success even if email doesn't exist (security best practice)
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleUpdatePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    playSound('buttonClick');

    // Validate new password
    const passwordError = AuthService.validatePassword(newPassword);
    if (passwordError) {
      setLocalError(passwordError);
      return;
    }

    if (newPassword !== confirmPassword) {
      setLocalError('Passwords do not match');
      return;
    }

    setLocalError(null);
    setIsSubmitting(true);

    try {
      const result = await updatePasswordFromReset(newPassword);
      if (result.success) {
        playSound('phaseChange');
        // User is now logged in - AuthContext will update automatically
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleResendEmail = async () => {
    playSound('buttonClick');
    setIsResending(true);
    setResendSuccess(false);
    setLocalError(null);

    try {
      const result = await AuthService.resendConfirmationEmail(email);
      if (result.success) {
        setResendSuccess(true);
      } else if (result.error) {
        setLocalError(result.error);
      }
    } finally {
      setIsResending(false);
    }
  };

  const validateForm = useCallback((): string | null => {
    if (!email.trim()) return 'Email is required';
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return 'Invalid email format';
    if (!password) return 'Password is required';

    if (mode === 'signup') {
      if (!username.trim()) return 'Username is required';
      const usernameError = AuthService.validateUsername(username);
      if (usernameError) return usernameError;
      const passwordError = AuthService.validatePassword(password);
      if (passwordError) return passwordError;
      if (usernameAvailable === false) return 'Username is already taken';
    }

    return null;
  }, [email, password, username, mode, usernameAvailable]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    playSound('buttonClick');

    const validationError = validateForm();
    if (validationError) {
      setLocalError(validationError);
      return;
    }

    setLocalError(null);
    setIsSubmitting(true);

    try {
      if (mode === 'login') {
        const result = await login({ email, password });
        if (result.success) {
          playSound('phaseChange');
        }
      } else {
        const result = await signUp({ email, password, username });
        if (result.success) {
          playSound('phaseChange');
          setSignupComplete(true);
        } else if (result.error) {
          // Check for email already in use error
          if (result.error.toLowerCase().includes('already registered') ||
              result.error.toLowerCase().includes('already been registered') ||
              result.error.toLowerCase().includes('user already registered')) {
            setLocalError('An account with this email already exists. Please sign in instead.');
          }
        }
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const passwordRequirements = [
    { label: '8+ characters', met: password.length >= 8 },
    { label: 'Uppercase letter', met: /[A-Z]/.test(password) },
    { label: 'Lowercase letter', met: /[a-z]/.test(password) },
    { label: 'Number', met: /[0-9]/.test(password) },
  ];

  const newPasswordRequirements = [
    { label: '8+ characters', met: newPassword.length >= 8 },
    { label: 'Uppercase letter', met: /[A-Z]/.test(newPassword) },
    { label: 'Lowercase letter', met: /[a-z]/.test(newPassword) },
    { label: 'Number', met: /[0-9]/.test(newPassword) },
  ];

  const displayError = localError || error;

  // Show "Set New Password" form when user clicks reset link from email
  if (isPasswordRecoveryMode) {
    return (
      <div className="space-y-4">
        <div className="text-center mb-6">
          <div className="w-16 h-16 bg-orange-600 rounded-full flex items-center justify-center mx-auto mb-4">
            <KeyRound size={32} className="text-white" />
          </div>
          <h3 className="text-xl font-semibold text-white">
            Set New Password
          </h3>
          <p className="text-gray-400 text-sm mt-1">
            Enter your new password below
          </p>
        </div>

        <form onSubmit={handleUpdatePassword} className="space-y-4">
          {/* New Password */}
          <div>
            <label className="block text-sm text-gray-300 mb-1">New Password</label>
            <div className="relative">
              <input
                type={showPassword ? 'text' : 'password'}
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                className="w-full bg-gray-800 border border-gray-700 rounded px-3 py-2 text-white focus:outline-none focus:border-orange-500 pr-10"
                placeholder="Create a strong password"
                disabled={isSubmitting}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-white"
              >
                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
          </div>

          {/* Confirm Password */}
          <div>
            <label className="block text-sm text-gray-300 mb-1">Confirm Password</label>
            <input
              type={showPassword ? 'text' : 'password'}
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className="w-full bg-gray-800 border border-gray-700 rounded px-3 py-2 text-white focus:outline-none focus:border-orange-500"
              placeholder="Confirm your password"
              disabled={isSubmitting}
            />
          </div>

          {/* Password requirements */}
          {newPassword.length > 0 && (
            <div className="grid grid-cols-2 gap-1 text-xs">
              {newPasswordRequirements.map((req) => (
                <div
                  key={req.label}
                  className={`flex items-center ${
                    req.met ? 'text-green-500' : 'text-gray-500'
                  }`}
                >
                  {req.met ? <Check size={12} className="mr-1" /> : <X size={12} className="mr-1" />}
                  {req.label}
                </div>
              ))}
            </div>
          )}

          {/* Password match indicator */}
          {confirmPassword.length > 0 && (
            <div className={`flex items-center text-xs ${
              newPassword === confirmPassword ? 'text-green-500' : 'text-gray-500'
            }`}>
              {newPassword === confirmPassword ? (
                <Check size={12} className="mr-1" />
              ) : (
                <X size={12} className="mr-1" />
              )}
              Passwords match
            </div>
          )}

          {/* Error message */}
          {displayError && (
            <div className="bg-red-900/50 border border-red-700 rounded p-2 text-red-300 text-sm">
              {displayError}
            </div>
          )}

          {/* Submit button */}
          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full bg-orange-600 hover:bg-orange-500 disabled:bg-gray-600 disabled:cursor-not-allowed text-white font-semibold py-2 px-4 rounded transition-colors flex items-center justify-center"
          >
            {isSubmitting ? (
              <>
                <Loader2 size={18} className="animate-spin mr-2" />
                Updating password...
              </>
            ) : (
              'Update Password'
            )}
          </button>
        </form>

        <button
          onClick={() => {
            clearPasswordRecoveryMode();
            handleModeSwitch('login');
          }}
          className="w-full text-gray-400 hover:text-white text-sm"
          disabled={isSubmitting}
        >
          Cancel
        </button>
      </div>
    );
  }

  // Show success message after sending reset email
  if (resetEmailSent) {
    return (
      <div className="space-y-4">
        <div className="text-center py-6">
          <div className="w-16 h-16 bg-orange-600 rounded-full flex items-center justify-center mx-auto mb-4">
            <Mail size={32} className="text-white" />
          </div>
          <h3 className="text-xl font-semibold text-white mb-2">
            Check Your Email
          </h3>
          <p className="text-gray-400 text-sm mb-4">
            If an account exists for this email, we've sent password reset instructions to:
          </p>
          <p className="text-orange-400 font-medium mb-4">
            {email}
          </p>
          <p className="text-gray-500 text-xs">
            Click the link in the email to reset your password. If you don't see it, check your spam folder.
          </p>
        </div>

        <button
          onClick={() => handleModeSwitch('login')}
          className="w-full bg-orange-600 hover:bg-orange-500 text-white font-medium py-2 px-4 rounded transition-colors"
        >
          Back to Sign In
        </button>
      </div>
    );
  }

  // Show forgot password form
  if (mode === 'forgot-password') {
    return (
      <div className="space-y-4">
        <div className="text-center mb-6">
          <h3 className="text-xl font-semibold text-white">
            Reset Password
          </h3>
          <p className="text-gray-400 text-sm mt-1">
            Enter your email to receive a reset link
          </p>
        </div>

        <form onSubmit={handleSendResetEmail} className="space-y-4">
          {/* Email */}
          <div>
            <label className="block text-sm text-gray-300 mb-1">Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full bg-gray-800 border border-gray-700 rounded px-3 py-2 text-white focus:outline-none focus:border-orange-500"
              placeholder="you@example.com"
              disabled={isSubmitting}
            />
          </div>

          {/* Error message */}
          {displayError && (
            <div className="bg-red-900/50 border border-red-700 rounded p-2 text-red-300 text-sm">
              {displayError}
            </div>
          )}

          {/* Submit button */}
          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full bg-orange-600 hover:bg-orange-500 disabled:bg-gray-600 disabled:cursor-not-allowed text-white font-semibold py-2 px-4 rounded transition-colors flex items-center justify-center"
          >
            {isSubmitting ? (
              <>
                <Loader2 size={18} className="animate-spin mr-2" />
                Sending...
              </>
            ) : (
              'Send Reset Link'
            )}
          </button>
        </form>

        <div className="text-center text-sm text-gray-400">
          <button
            onClick={() => handleModeSwitch('login')}
            className="text-orange-400 hover:text-orange-300"
            disabled={isSubmitting}
          >
            Back to Sign In
          </button>
        </div>
      </div>
    );
  }

  // Show email confirmation message after successful signup
  if (signupComplete) {
    return (
      <div className="space-y-4">
        <div className="text-center py-6">
          <div className="w-16 h-16 bg-orange-600 rounded-full flex items-center justify-center mx-auto mb-4">
            <Mail size={32} className="text-white" />
          </div>
          <h3 className="text-xl font-semibold text-white mb-2">
            Check Your Email
          </h3>
          <p className="text-gray-400 text-sm mb-4">
            We've sent a confirmation link to:
          </p>
          <p className="text-orange-400 font-medium mb-4">
            {email}
          </p>
          <p className="text-gray-500 text-xs">
            Click the link in the email to activate your account. If you don't see it, check your spam folder.
          </p>
        </div>

        {resendSuccess && (
          <div className="bg-green-900/50 border border-green-700 rounded p-2 text-green-300 text-sm text-center">
            Confirmation email resent!
          </div>
        )}

        {localError && (
          <div className="bg-red-900/50 border border-red-700 rounded p-2 text-red-300 text-sm text-center">
            {localError}
          </div>
        )}

        <button
          onClick={handleResendEmail}
          disabled={isResending}
          className="w-full bg-orange-600 hover:bg-orange-500 disabled:bg-gray-600 text-white font-medium py-2 px-4 rounded transition-colors flex items-center justify-center"
        >
          {isResending ? (
            <>
              <Loader2 size={18} className="animate-spin mr-2" />
              Sending...
            </>
          ) : (
            'Resend Confirmation Email'
          )}
        </button>

        <button
          onClick={() => handleModeSwitch('login')}
          className="w-full bg-gray-700 hover:bg-gray-600 text-white font-medium py-2 px-4 rounded transition-colors"
        >
          Back to Sign In
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="text-center mb-6">
        <h3 className="text-xl font-semibold text-white">
          {mode === 'login' ? 'Welcome Back' : 'Create Account'}
        </h3>
        <p className="text-gray-400 text-sm mt-1">
          {mode === 'login'
            ? 'Sign in to sync your data'
            : 'Join to sync with friends'}
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Username (signup only) */}
        {mode === 'signup' && (
          <div>
            <label className="block text-sm text-gray-300 mb-1">Username</label>
            <div className="relative">
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="w-full bg-gray-800 border border-gray-700 rounded px-3 py-2 text-white focus:outline-none focus:border-orange-500 pr-8"
                placeholder="Choose a username"
                disabled={isSubmitting}
              />
              {username.length >= 3 && (
                <div className="absolute right-2 top-1/2 -translate-y-1/2">
                  {checkingUsername ? (
                    <Loader2 size={16} className="animate-spin text-gray-400" />
                  ) : usernameAvailable === true ? (
                    <Check size={16} className="text-green-500" />
                  ) : usernameAvailable === false ? (
                    <X size={16} className="text-red-500" />
                  ) : null}
                </div>
              )}
            </div>
            <p className="text-xs text-gray-500 mt-1">
              3-30 characters, letters, numbers, _ and - only
            </p>
          </div>
        )}

        {/* Email */}
        <div>
          <label className="block text-sm text-gray-300 mb-1">Email</label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full bg-gray-800 border border-gray-700 rounded px-3 py-2 text-white focus:outline-none focus:border-orange-500"
            placeholder="you@example.com"
            disabled={isSubmitting}
          />
        </div>

        {/* Password */}
        <div>
          <label className="block text-sm text-gray-300 mb-1">Password</label>
          <div className="relative">
            <input
              type={showPassword ? 'text' : 'password'}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full bg-gray-800 border border-gray-700 rounded px-3 py-2 text-white focus:outline-none focus:border-orange-500 pr-10"
              placeholder={mode === 'signup' ? 'Create a strong password' : 'Enter your password'}
              disabled={isSubmitting}
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-white"
            >
              {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
            </button>
          </div>
        </div>

        {/* Password requirements (signup only) */}
        {mode === 'signup' && password.length > 0 && (
          <div className="grid grid-cols-2 gap-1 text-xs">
            {passwordRequirements.map((req) => (
              <div
                key={req.label}
                className={`flex items-center ${
                  req.met ? 'text-green-500' : 'text-gray-500'
                }`}
              >
                {req.met ? <Check size={12} className="mr-1" /> : <X size={12} className="mr-1" />}
                {req.label}
              </div>
            ))}
          </div>
        )}

        {/* Error message */}
        {displayError && (
          <div className="bg-red-900/50 border border-red-700 rounded p-2 text-red-300 text-sm">
            {displayError}
          </div>
        )}

        {/* Submit button */}
        <button
          type="submit"
          disabled={isSubmitting || (mode === 'signup' && usernameAvailable === false)}
          className="w-full bg-orange-600 hover:bg-orange-500 disabled:bg-gray-600 disabled:cursor-not-allowed text-white font-semibold py-2 px-4 rounded transition-colors flex items-center justify-center"
        >
          {isSubmitting ? (
            <>
              <Loader2 size={18} className="animate-spin mr-2" />
              {mode === 'login' ? 'Signing in...' : 'Creating account...'}
            </>
          ) : mode === 'login' ? (
            'Sign In'
          ) : (
            'Create Account'
          )}
        </button>
      </form>

      {/* Mode switch */}
      <div className="text-center text-sm text-gray-400">
        {mode === 'login' ? (
          <>
            Don&apos;t have an account?{' '}
            <button
              onClick={() => handleModeSwitch()}
              className="text-orange-400 hover:text-orange-300"
              disabled={isSubmitting}
            >
              Sign up
            </button>
          </>
        ) : (
          <>
            Already have an account?{' '}
            <button
              onClick={() => handleModeSwitch()}
              className="text-orange-400 hover:text-orange-300"
              disabled={isSubmitting}
            >
              Sign in
            </button>
          </>
        )}
      </div>

      {/* Forgot password link (login mode only) */}
      {mode === 'login' && (
        <div className="text-center">
          <button
            onClick={handleForgotPassword}
            className="text-gray-500 hover:text-gray-400 text-xs"
            disabled={isSubmitting}
          >
            Forgot your password?
          </button>
        </div>
      )}
    </div>
  );
};

export default LoginPanel;
