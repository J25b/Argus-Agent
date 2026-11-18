import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArgusLogo } from '../../components/ArgusLogo';
import { useAuth } from '../../context/AuthContext';
import type { Organization, UserProfile } from '../../types/argus';

export const LoginPage: React.FC = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [demoBusy, setDemoBusy] = useState(false);
  const { setSession } = useAuth();
  const navigate = useNavigate();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      const resp = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });
      const data = await resp.json();
      if (!resp.ok) throw new Error(data.error || 'Sign in failed.');
      setSession(data as { token: string; user: UserProfile; organization: Organization });
      if (!data.user.onboarding_completed) {
        navigate('/onboarding');
      } else {
        navigate('/app/overview');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to sign in.');
    } finally {
      setBusy(false);
    }
  };

  const handleDemo = async () => {
    setError(null);
    setDemoBusy(true);
    try {
      const resp = await fetch('/api/auth/demo', { method: 'POST' });
      const data = await resp.json();
      if (!resp.ok) throw new Error(data.error || 'Unable to launch demo environment.');
      setSession(data as { token: string; user: UserProfile; organization: Organization });
      navigate('/app/overview');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Demo initialization failed.');
    } finally {
      setDemoBusy(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#0A1020] flex flex-col justify-center px-6 py-12">
      <div className="max-w-md w-full mx-auto space-y-8">
        <div className="flex flex-col items-start space-y-3">
          <Link to="/">
            <ArgusLogo size={28} />
          </Link>
          <h1 className="font-display text-2xl font-bold text-[#F4F7FC]">Sign in to ARGUS</h1>
          <p className="text-sm text-[#8796AB]">Access your organization’s security intelligence workspace.</p>
        </div>

        <form onSubmit={handleLogin} className="border border-[#1E3354] bg-[#0E182E] rounded-lg p-7 space-y-5">
          {error && (
            <div role="alert" className="border border-[#E45B68]/50 bg-[#E45B68]/10 text-[#E45B68] text-xs rounded-md px-3.5 py-2.5">
              {error}
            </div>
          )}

          <div className="space-y-1.5">
            <label htmlFor="login-email" className="block text-xs font-medium text-[#F4F7FC]">
              Work Email
            </label>
            <input
              id="login-email"
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="analyst@company.com"
              className="w-full px-3.5 py-2.5 text-sm bg-[#0A1020] border border-[#1E3354] rounded-md text-[#F4F7FC] placeholder-[#8796AB]/50 focus:outline-none focus:border-[#2388E8]"
            />
          </div>

          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label htmlFor="login-password" className="block text-xs font-medium text-[#F4F7FC]">
                Password
              </label>
              <Link to="/forgot-password" className="text-xs text-[#65B9FF] hover:underline">
                Forgot password?
              </Link>
            </div>
            <input
              id="login-password"
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              className="w-full px-3.5 py-2.5 text-sm bg-[#0A1020] border border-[#1E3354] rounded-md text-[#F4F7FC] placeholder-[#8796AB]/50 focus:outline-none focus:border-[#2388E8]"
            />
          </div>

          <button
            type="submit"
            disabled={busy}
            className="w-full py-2.5 text-sm font-semibold text-[#F4F7FC] bg-[#2388E8] hover:bg-[#1C74CA] disabled:opacity-50 rounded-md transition-colors"
          >
            {busy ? 'Signing in...' : 'Sign In'}
          </button>

          <div className="pt-2 border-t border-[#1E3354] space-y-3">
            <button
              type="button"
              onClick={handleDemo}
              disabled={demoBusy}
              className="w-full py-2.5 text-xs font-semibold text-[#F0A43A] border border-[#F0A43A]/40 hover:bg-[#F0A43A]/10 rounded-md transition-colors"
            >
              {demoBusy ? 'Opening Demo Environment...' : 'Explore Isolated Demo Environment (Sample Data)'}
            </button>
            <p className="text-[11px] text-[#8796AB] text-center">
              Demo Environment uses clearly labeled sample records and is strictly isolated from customer accounts.
            </p>
          </div>
        </form>

        <p className="text-center text-sm text-[#8796AB]">
          Need a workspace?{' '}
          <Link to="/signup" className="text-[#65B9FF] hover:underline font-medium">
            Create an account
          </Link>
        </p>
      </div>
    </div>
  );
};

export const SignupPage: React.FC = () => {
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const { setSession } = useAuth();
  const navigate = useNavigate();

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (password.length < 8) {
      setError('Password must be at least 8 characters.');
      return;
    }
    setBusy(true);
    try {
      const resp = await fetch('/api/auth/signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ full_name: fullName, email, password }),
      });
      const data = await resp.json();
      if (!resp.ok) throw new Error(data.error || 'Registration failed.');
      setSession(data as { token: string; user: UserProfile; organization: Organization });
      navigate('/onboarding');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to register.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#0A1020] flex flex-col justify-center px-6 py-12">
      <div className="max-w-md w-full mx-auto space-y-8">
        <div className="space-y-3">
          <Link to="/">
            <ArgusLogo size={28} />
          </Link>
          <h1 className="font-display text-2xl font-bold text-[#F4F7FC]">Create your ARGUS account</h1>
          <p className="text-sm text-[#8796AB]">Provision a clean organization workspace for authorized security testing.</p>
        </div>

        <form onSubmit={handleSignup} className="border border-[#1E3354] bg-[#0E182E] rounded-lg p-7 space-y-5">
          {error && (
            <div role="alert" className="border border-[#E45B68]/50 bg-[#E45B68]/10 text-[#E45B68] text-xs rounded-md px-3.5 py-2.5">
              {error}
            </div>
          )}

          <div className="space-y-1.5">
            <label htmlFor="signup-name" className="block text-xs font-medium text-[#F4F7FC]">
              Full Name
            </label>
            <input
              id="signup-name"
              type="text"
              required
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              placeholder="Jordan Mercer"
              className="w-full px-3.5 py-2.5 text-sm bg-[#0A1020] border border-[#1E3354] rounded-md text-[#F4F7FC] placeholder-[#8796AB]/50 focus:outline-none focus:border-[#2388E8]"
            />
          </div>

          <div className="space-y-1.5">
            <label htmlFor="signup-email" className="block text-xs font-medium text-[#F4F7FC]">
              Work Email
            </label>
            <input
              id="signup-email"
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="jordan@company.com"
              className="w-full px-3.5 py-2.5 text-sm bg-[#0A1020] border border-[#1E3354] rounded-md text-[#F4F7FC] placeholder-[#8796AB]/50 focus:outline-none focus:border-[#2388E8]"
            />
          </div>

          <div className="space-y-1.5">
            <label htmlFor="signup-password" className="block text-xs font-medium text-[#F4F7FC]">
              Password (min. 8 characters)
            </label>
            <input
              id="signup-password"
              type="password"
              required
              minLength={8}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••••••"
              className="w-full px-3.5 py-2.5 text-sm bg-[#0A1020] border border-[#1E3354] rounded-md text-[#F4F7FC] placeholder-[#8796AB]/50 focus:outline-none focus:border-[#2388E8]"
            />
          </div>

          <button
            type="submit"
            disabled={busy}
            className="w-full py-2.5 text-sm font-semibold text-[#F4F7FC] bg-[#2388E8] hover:bg-[#1C74CA] disabled:opacity-50 rounded-md transition-colors"
          >
            {busy ? 'Creating workspace...' : 'Create Account'}
          </button>
        </form>

        <p className="text-center text-sm text-[#8796AB]">
          Already registered?{' '}
          <Link to="/login" className="text-[#65B9FF] hover:underline font-medium">
            Sign in
          </Link>
        </p>
      </div>
    </div>
  );
};

export const ForgotPasswordPage: React.FC = () => {
  const [email, setEmail] = useState('');
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setMessage(null);
    setBusy(true);
    try {
      const resp = await fetch('/api/auth/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });
      const data = await resp.json();
      if (!resp.ok) throw new Error(data.error || 'Request failed.');
      setMessage(data.message);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to send reset request.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#0A1020] flex flex-col justify-center px-6 py-12">
      <div className="max-w-md w-full mx-auto space-y-8">
        <div className="space-y-3">
          <Link to="/">
            <ArgusLogo size={28} />
          </Link>
          <h1 className="font-display text-2xl font-bold text-[#F4F7FC]">Recover access</h1>
          <p className="text-sm text-[#8796AB]">Enter your registered work email to request password recovery.</p>
        </div>

        <form onSubmit={handleSubmit} className="border border-[#1E3354] bg-[#0E182E] rounded-lg p-7 space-y-5">
          {error && (
            <div role="alert" className="border border-[#E45B68]/50 bg-[#E45B68]/10 text-[#E45B68] text-xs rounded-md px-3.5 py-2.5">
              {error}
            </div>
          )}
          {message && (
            <div className="border border-[#16B887]/50 bg-[#16B887]/10 text-[#16B887] text-xs rounded-md px-3.5 py-2.5">
              {message}
            </div>
          )}

          <div className="space-y-1.5">
            <label htmlFor="reset-email" className="block text-xs font-medium text-[#F4F7FC]">
              Work Email
            </label>
            <input
              id="reset-email"
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="analyst@company.com"
              className="w-full px-3.5 py-2.5 text-sm bg-[#0A1020] border border-[#1E3354] rounded-md text-[#F4F7FC] placeholder-[#8796AB]/50 focus:outline-none focus:border-[#2388E8]"
            />
          </div>

          <button
            type="submit"
            disabled={busy}
            className="w-full py-2.5 text-sm font-semibold text-[#F4F7FC] bg-[#2388E8] hover:bg-[#1C74CA] disabled:opacity-50 rounded-md transition-colors"
          >
            {busy ? 'Sending...' : 'Request Password Reset'}
          </button>
        </form>

        <p className="text-center text-sm text-[#8796AB]">
          <Link to="/login" className="text-[#65B9FF] hover:underline font-medium">
            Back to Sign In
          </Link>
        </p>
      </div>
    </div>
  );
};
