import React, { useEffect, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { motion } from 'motion/react';
import {
  Activity,
  Bell,
  Bot,
  Cpu,
  FileText,
  Globe,
  LayoutDashboard,
  LogOut,
  Menu,
  Play,
  Search,
  Settings,
  ShieldAlert,
  Sliders,
  X,
} from 'lucide-react';
import { ArgusLogo } from './ArgusLogo';
import { CommandPalette } from './CommandPalette';
import { FAST_EASE, PageTransition } from './MotionPrimitives';
import { useAuth } from '../context/AuthContext';
import type { NotificationItem } from '../types/argus';

interface AppShellProps {
  breadcrumb: string;
  action?: React.ReactNode;
  children: React.ReactNode;
}

export const AppShell: React.FC<AppShellProps> = ({ breadcrumb, action, children }) => {
  const { user, organization, logout, apiFetch } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);

  const isAdmin = organization?.role === 'Owner' || organization?.role === 'Administrator';

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setPaletteOpen((prev) => !prev);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  useEffect(() => {
    let active = true;
    apiFetch<NotificationItem[]>('/api/notifications')
      .then((rows) => {
        if (active) setUnreadCount(rows.filter((r) => !r.is_read).length);
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, [apiFetch, location.pathname]);

  const primaryNav = [
    { label: 'Overview', to: '/app/overview', Icon: LayoutDashboard },
    { label: 'Targets', to: '/app/targets', Icon: Globe },
    { label: 'Assessments', to: '/app/assessments', Icon: Activity },
    { label: 'Vulnerabilities', to: '/app/vulnerabilities', Icon: ShieldAlert },
    { label: 'Reports', to: '/app/reports', Icon: FileText },
    { label: 'ARGUS Agent', to: '/app/agent', Icon: Bot },
    { label: 'Notifications', to: '/app/notifications', Icon: Bell, count: unreadCount },
    { label: 'Settings', to: '/app/settings/profile', Icon: Settings },
  ];

  const adminNav = [
    { label: 'AI Gateway & Usage', to: '/app/settings/ai-gateway', Icon: Cpu },
    { label: 'Security & Audit', to: '/app/settings/security', Icon: Sliders },
  ];

  const isPathActive = (to: string) => {
    if (to === '/app/settings/profile') {
      return (
        location.pathname === '/app/settings' ||
        location.pathname === '/app/settings/profile' ||
        location.pathname === '/app/settings/integrations'
      );
    }
    return location.pathname === to || location.pathname.startsWith(`${to}/`);
  };

  const renderNavLinks = (closeOnClick = false, layoutPrefix = 'desktop') => (
    <div className="flex-1 flex flex-col justify-between py-5 px-3 overflow-y-auto">
      <div className="space-y-6">
        <div className="space-y-1">
          {primaryNav.map(({ label, to, Icon, count }) => {
            const active = isPathActive(to);
            return (
              <Link
                key={to}
                to={to}
                onClick={() => closeOnClick && setMobileOpen(false)}
                className={`relative flex items-center justify-between px-3 py-2 rounded-md text-sm font-medium transition-colors whitespace-nowrap ${
                  active ? 'text-[#F4F7FC]' : 'text-[#8796AB] hover:text-[#F4F7FC] hover:bg-[#142A49]/40'
                }`}
              >
                {active && (
                  <motion.span
                    layoutId={`sidebar-active-${layoutPrefix}`}
                    transition={{ duration: 0.18, ease: FAST_EASE }}
                    className="absolute inset-0 bg-[#142A49] rounded-md -z-0"
                  />
                )}
                <span className="relative z-10 flex items-center gap-2.5 truncate">
                  <Icon className={`w-4 h-4 shrink-0 ${active ? 'text-[#65B9FF]' : 'text-[#8796AB]'}`} />
                  <span className="truncate">{label}</span>
                </span>
                {typeof count === 'number' && count > 0 && (
                  <span className="relative z-10 font-mono text-xs text-[#65B9FF] tabular-nums">{count}</span>
                )}
              </Link>
            );
          })}
        </div>

        {isAdmin && (
          <div className="space-y-1 pt-4 border-t border-[#1E3354]">
            <p className="px-3 pb-1 text-[11px] font-medium text-[#8796AB]">Administration</p>
            {adminNav.map(({ label, to, Icon }) => {
              const active = isPathActive(to);
              return (
                <Link
                  key={to}
                  to={to}
                  onClick={() => closeOnClick && setMobileOpen(false)}
                  className={`relative flex items-center gap-2.5 px-3 py-2 rounded-md text-sm font-medium transition-colors whitespace-nowrap ${
                    active ? 'text-[#F4F7FC]' : 'text-[#8796AB] hover:text-[#F4F7FC] hover:bg-[#142A49]/40'
                  }`}
                >
                  {active && (
                    <motion.span
                      layoutId={`sidebar-active-${layoutPrefix}`}
                      transition={{ duration: 0.18, ease: FAST_EASE }}
                      className="absolute inset-0 bg-[#142A49] rounded-md -z-0"
                    />
                  )}
                  <Icon className={`relative z-10 w-4 h-4 shrink-0 ${active ? 'text-[#65B9FF]' : 'text-[#8796AB]'}`} />
                  <span className="relative z-10 truncate">{label}</span>
                </Link>
              );
            })}
          </div>
        )}
      </div>

      <div className="pt-4 border-t border-[#1E3354] space-y-3 px-2">
        <div className="space-y-0.5">
          <p className="text-xs font-medium text-[#F4F7FC] truncate">{user?.full_name || user?.email}</p>
          <p className="text-[11px] text-[#8796AB] truncate">
            {organization?.name} · {organization?.role}
          </p>
        </div>
        <button
          type="button"
          onClick={() => {
            logout();
            navigate('/login');
          }}
          className="w-full flex items-center gap-2 px-2.5 py-2 text-xs font-medium text-[#8796AB] hover:text-[#F4F7FC] hover:bg-[#142A49]/40 rounded-md transition-colors"
        >
          <LogOut className="w-3.5 h-3.5" />
          <span>Sign Out</span>
        </button>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-[#0A1020] text-[#F4F7FC] flex">
      {/* Desktop Sidebar */}
      <aside className="hidden lg:flex lg:w-64 lg:flex-col lg:fixed lg:inset-y-0 border-r border-[#1E3354] bg-[#080D1A]">
        <div className="h-16 px-5 flex items-center border-b border-[#1E3354]">
          <Link to="/app/overview">
            <ArgusLogo size={24} />
          </Link>
        </div>
        {renderNavLinks(false, 'desktop')}
      </aside>

      {/* Mobile Drawer */}
      {mobileOpen && (
        <div className="fixed inset-0 z-50 lg:hidden flex">
          <div className="fixed inset-0 bg-black/60" onClick={() => setMobileOpen(false)} />
          <aside className="relative w-64 max-w-full bg-[#080D1A] border-r border-[#1E3354] flex flex-col z-10">
            <div className="h-16 px-5 flex items-center justify-between border-b border-[#1E3354]">
              <ArgusLogo size={24} />
              <button
                type="button"
                onClick={() => setMobileOpen(false)}
                aria-label="Close sidebar"
                className="p-1.5 text-[#8796AB] hover:text-[#F4F7FC]"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            {renderNavLinks(true, 'mobile')}
          </aside>
        </div>
      )}

      {/* Main Viewport */}
      <div className="flex-1 lg:pl-64 flex flex-col min-w-0">
        {organization?.is_demo && (
          <div className="bg-[#F0A43A]/15 border-b border-[#F0A43A]/40 px-6 py-2 flex flex-wrap items-center justify-between gap-2 text-xs">
            <span className="font-mono font-semibold text-[#F0A43A]">
              DEMO ENVIRONMENT — SAMPLE DATA
            </span>
            <span className="text-[#F4F7FC]/80">
              Isolated demonstration workspace. Sample findings are strictly separated from customer accounts.
            </span>
          </div>
        )}

        <header className="h-16 border-b border-[#1E3354] bg-[#0A1020] px-6 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <button
              type="button"
              onClick={() => setMobileOpen(true)}
              aria-label="Open navigation"
              className="lg:hidden p-1.5 text-[#8796AB] hover:text-[#F4F7FC] border border-[#1E3354] rounded-md"
            >
              <Menu className="w-5 h-5" />
            </button>
            <div className="text-sm font-medium text-[#F4F7FC] truncate">{breadcrumb}</div>
          </div>

          <div className="flex items-center gap-3 shrink-0">
            <button
              type="button"
              onClick={() => setPaletteOpen(true)}
              className="hidden sm:inline-flex items-center gap-2 px-3 py-1.5 text-xs text-[#8796AB] hover:text-[#F4F7FC] bg-[#0E182E] border border-[#1E3354] hover:border-[#65B9FF]/50 rounded-md transition-colors whitespace-nowrap shrink-0"
            >
              <Search className="w-3.5 h-3.5 text-[#65B9FF]" />
              <span>Quick Jump</span>
              <kbd className="font-mono text-[10px] text-[#8796AB] border border-[#1E3354] px-1 rounded">⌘K</kbd>
            </button>

            {action || (
              organization?.role !== 'Viewer' && (
                <Link
                  to="/app/assessments/new"
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-[#F4F7FC] bg-[#2388E8] hover:bg-[#1C74CA] rounded-md transition-colors whitespace-nowrap shrink-0 active:scale-[0.98]"
                >
                  <Play className="w-3.5 h-3.5" />
                  <span>New Assessment</span>
                </Link>
              )
            )}
          </div>
        </header>

        <main className="flex-1 p-6 max-w-[1440px] w-full mx-auto">
          <PageTransition key={location.pathname}>{children}</PageTransition>
        </main>
      </div>

      <CommandPalette open={paletteOpen} onClose={() => setPaletteOpen(false)} />
    </div>
  );
};
