import React, { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Menu, X } from 'lucide-react';
import { ArgusLogo } from './ArgusLogo';
import { useAuth } from '../context/AuthContext';

export const PublicLayout: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [mobileOpen, setMobileOpen] = useState(false);
  const location = useLocation();
  const { user } = useAuth();

  const navLinks = [
    { label: 'Features', to: '/features' },
    { label: 'How It Works', to: '/how-it-works' },
    { label: 'Security', to: '/security' },
    { label: user ? 'Console' : 'Sign In', to: user ? '/app/overview' : '/login' },
  ];

  return (
    <div className="min-h-screen flex flex-col bg-[#0A1020] text-[#F4F7FC]">
      <header className="sticky top-0 z-40 border-b border-[#1E3354] bg-[#0A1020]/95 backdrop-blur-sm">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between gap-8">
          <Link to="/" className="whitespace-nowrap shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2388E8] rounded">
            <ArgusLogo size={26} />
          </Link>

          <nav className="hidden md:flex items-center gap-7 text-sm font-medium text-[#8796AB]" aria-label="Primary">
            {navLinks.map((item) => {
              const active = location.pathname === item.to;
              return (
                <Link
                  key={item.to}
                  to={item.to}
                  className={`whitespace-nowrap shrink-0 py-1 transition-colors hover:text-[#F4F7FC] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#2388E8] rounded ${
                    active ? 'text-[#F4F7FC] underline underline-offset-8 decoration-[#2388E8]' : ''
                  }`}
                >
                  {item.label}
                </Link>
              );
            })}
          </nav>

          <div className="flex items-center gap-3 shrink-0">
            <Link
              to={user ? '/app/overview' : '/signup'}
              className="hidden sm:inline-flex items-center justify-center px-4 py-2 text-sm font-semibold text-[#F4F7FC] bg-[#2388E8] hover:bg-[#1C74CA] rounded-md transition-colors whitespace-nowrap shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#65B9FF]"
            >
              {user ? 'Open Workspace' : 'Get Started'}
            </Link>
            <button
              type="button"
              onClick={() => setMobileOpen((v) => !v)}
              aria-label={mobileOpen ? 'Close navigation menu' : 'Open navigation menu'}
              className="md:hidden p-2 text-[#8796AB] hover:text-[#F4F7FC] rounded-md border border-[#1E3354]"
            >
              {mobileOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
          </div>
        </div>

        {mobileOpen && (
          <div className="md:hidden border-t border-[#1E3354] bg-[#0D162B] px-6 py-4 space-y-3">
            {navLinks.map((item) => (
              <Link
                key={item.to}
                to={item.to}
                onClick={() => setMobileOpen(false)}
                className="block py-2 text-sm font-medium text-[#F4F7FC] hover:text-[#65B9FF]"
              >
                {item.label}
              </Link>
            ))}
            <Link
              to={user ? '/app/overview' : '/signup'}
              onClick={() => setMobileOpen(false)}
              className="block w-full text-center px-4 py-2.5 text-sm font-semibold text-[#F4F7FC] bg-[#2388E8] rounded-md"
            >
              {user ? 'Open Workspace' : 'Get Started'}
            </Link>
          </div>
        )}
      </header>

      <main className="flex-1">{children}</main>

      <footer className="border-t border-[#1E3354] bg-[#080D1A]">
        <div className="max-w-7xl mx-auto px-6 py-12 grid grid-cols-1 md:grid-cols-4 gap-8">
          <div className="md:col-span-2 space-y-3">
            <ArgusLogo size={24} />
            <p className="text-xs font-mono tracking-wider text-[#65B9FF]">
              AUTONOMOUS SECURITY INTELLIGENCE
            </p>
            <p className="text-sm text-[#8796AB] max-w-md leading-relaxed">
              See Every Weakness. Secure Every Layer. Built strictly for authorized security assessments with cryptographic ownership verification and explicit policy governance.
            </p>
          </div>

          <div className="space-y-2.5 text-sm">
            <p className="font-display font-semibold text-[#F4F7FC]">Platform</p>
            <ul className="space-y-2 text-[#8796AB]">
              <li><Link to="/features" className="hover:text-[#F4F7FC] transition-colors">Features</Link></li>
              <li><Link to="/how-it-works" className="hover:text-[#F4F7FC] transition-colors">How It Works</Link></li>
              <li><Link to="/security" className="hover:text-[#F4F7FC] transition-colors">Security & Governance</Link></li>
            </ul>
          </div>

          <div className="space-y-2.5 text-sm">
            <p className="font-display font-semibold text-[#F4F7FC]">Access</p>
            <ul className="space-y-2 text-[#8796AB]">
              <li><Link to="/login" className="hover:text-[#F4F7FC] transition-colors">Sign In</Link></li>
              <li><Link to="/signup" className="hover:text-[#F4F7FC] transition-colors">Create Account</Link></li>
              <li><Link to="/forgot-password" className="hover:text-[#F4F7FC] transition-colors">Reset Password</Link></li>
            </ul>
          </div>
        </div>
        <div className="border-t border-[#1E3354]/70">
          <div className="max-w-7xl mx-auto px-6 py-5 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-[#8796AB]">
            <span>© {new Date().getFullYear()} ARGUS Security Intelligence. All assessments require verified target ownership.</span>
            <span className="font-mono">SSRF-Protected · Policy-Governed · Audit-Logged</span>
          </div>
        </div>
      </footer>
    </div>
  );
};
