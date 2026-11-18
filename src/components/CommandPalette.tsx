import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import {
  Activity,
  Bot,
  Cpu,
  FileText,
  Globe,
  LayoutDashboard,
  Play,
  Search,
  Settings,
  ShieldAlert,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { FAST_EASE } from './MotionPrimitives';
import type { Assessment, Target, Vulnerability } from '../types/argus';

interface CommandItem {
  id: string;
  label: string;
  sublabel: string;
  category: string;
  to: string;
  Icon: React.FC<{ className?: string }>;
}

interface CommandPaletteProps {
  open: boolean;
  onClose: () => void;
}

export const CommandPalette: React.FC<CommandPaletteProps> = ({ open, onClose }) => {
  const { apiFetch, organization } = useAuth();
  const navigate = useNavigate();
  const reduced = useReducedMotion();
  const [query, setQuery] = useState('');
  const [selectedIdx, setSelectedIdx] = useState(0);
  const [targets, setTargets] = useState<Target[]>([]);
  const [assessments, setAssessments] = useState<Assessment[]>([]);
  const [vulns, setVulns] = useState<Vulnerability[]>([]);

  const isAdmin = organization?.role === 'Owner' || organization?.role === 'Administrator';
  const canLaunch = organization?.role !== 'Viewer';

  useEffect(() => {
    if (!open) {
      setQuery('');
      setSelectedIdx(0);
      return;
    }
    Promise.all([
      apiFetch<Target[]>('/api/targets').catch(() => []),
      apiFetch<Assessment[]>('/api/assessments').catch(() => []),
      apiFetch<Vulnerability[]>('/api/vulnerabilities').catch(() => []),
    ]).then(([t, a, v]) => {
      setTargets(t);
      setAssessments(a);
      setVulns(v);
    });
  }, [open, apiFetch]);

  const items = useMemo<CommandItem[]>(() => {
    const base: CommandItem[] = [
      { id: 'nav-overview', label: 'Overview Dashboard', sublabel: '/app/overview', category: 'Navigation', to: '/app/overview', Icon: LayoutDashboard },
      { id: 'nav-targets', label: 'Targets & Scope Management', sublabel: '/app/targets', category: 'Navigation', to: '/app/targets', Icon: Globe },
      { id: 'nav-assessments', label: 'Assessments', sublabel: '/app/assessments', category: 'Navigation', to: '/app/assessments', Icon: Activity },
      { id: 'nav-vulns', label: 'Vulnerabilities', sublabel: '/app/vulnerabilities', category: 'Navigation', to: '/app/vulnerabilities', Icon: ShieldAlert },
      { id: 'nav-reports', label: 'Reports & PDF Exports', sublabel: '/app/reports', category: 'Navigation', to: '/app/reports', Icon: FileText },
      { id: 'nav-agent', label: 'ARGUS Agent & Tool Registry', sublabel: '/app/agent', category: 'Navigation', to: '/app/agent', Icon: Bot },
      { id: 'nav-settings', label: 'Organization Settings', sublabel: '/app/settings/profile', category: 'Navigation', to: '/app/settings/profile', Icon: Settings },
    ];

    if (canLaunch) {
      base.unshift({
        id: 'act-new-asmt',
        label: 'Launch New Assessment Wizard',
        sublabel: '7-step authorized workflow',
        category: 'Quick Actions',
        to: '/app/assessments/new',
        Icon: Play,
      });
    }
    if (isAdmin) {
      base.push({
        id: 'nav-ai-gw',
        label: 'AI Gateway & Usage Administration',
        sublabel: 'Bifrost & server-side Gemini config',
        category: 'Administration',
        to: '/app/settings/ai-gateway',
        Icon: Cpu,
      });
    }

    for (const t of targets) {
      base.push({
        id: `t-${t.id}`,
        label: t.name,
        sublabel: `${t.domain} · ${t.verification_status}`,
        category: 'Targets',
        to: `/app/targets/${t.id}`,
        Icon: Globe,
      });
    }

    for (const a of assessments.slice(0, 8)) {
      base.push({
        id: `a-${a.id}`,
        label: `${a.target_domain || a.target_name} (${a.profile})`,
        sublabel: `Assessment · ${a.status}`,
        category: 'Assessments',
        to: `/app/assessments/${a.id}`,
        Icon: Activity,
      });
    }

    for (const v of vulns.slice(0, 10)) {
      base.push({
        id: `v-${v.id}`,
        label: v.title,
        sublabel: `${v.severity} · ${v.endpoint}`,
        category: 'Vulnerabilities',
        to: `/app/vulnerabilities/${v.id}`,
        Icon: ShieldAlert,
      });
    }

    const q = query.trim().toLowerCase();
    if (!q) return base.slice(0, 12);
    return base
      .filter(
        (item) =>
          item.label.toLowerCase().includes(q) ||
          item.sublabel.toLowerCase().includes(q) ||
          item.category.toLowerCase().includes(q)
      )
      .slice(0, 14);
  }, [targets, assessments, vulns, query, canLaunch, isAdmin]);

  useEffect(() => {
    setSelectedIdx(0);
  }, [query]);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      } else if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSelectedIdx((i) => (items.length ? (i + 1) % items.length : 0));
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSelectedIdx((i) => (items.length ? (i - 1 + items.length) % items.length : 0));
      } else if (e.key === 'Enter' && items[selectedIdx]) {
        e.preventDefault();
        navigate(items[selectedIdx].to);
        onClose();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [open, items, selectedIdx, navigate, onClose]);

  return (
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-50 flex items-start justify-center pt-[12vh] px-4">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.14 }}
            onClick={onClose}
            className="fixed inset-0 bg-black/70 backdrop-blur-[2px]"
          />
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-label="Quick command palette"
            initial={reduced ? { opacity: 0 } : { opacity: 0, scale: 0.97, y: -6 }}
            animate={reduced ? { opacity: 1 } : { opacity: 1, scale: 1, y: 0 }}
            exit={reduced ? { opacity: 0 } : { opacity: 0, scale: 0.98, y: -4 }}
            transition={{ duration: 0.16, ease: FAST_EASE }}
            className="relative z-10 w-full max-w-xl border border-[#1E3354] bg-[#0B1325] rounded-lg shadow-2xl overflow-hidden"
          >
            <div className="flex items-center gap-3 px-4 py-3 border-b border-[#1E3354]">
              <Search className="w-4 h-4 text-[#65B9FF] shrink-0" />
              <input
                type="text"
                autoFocus
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Jump to targets, assessments, findings, or settings..."
                className="w-full bg-transparent text-sm text-[#F4F7FC] placeholder-[#8796AB] focus:outline-none"
              />
              <kbd className="text-[11px] font-mono text-[#8796AB] border border-[#1E3354] px-1.5 py-0.5 rounded shrink-0">
                ESC
              </kbd>
            </div>

            <div className="max-h-80 overflow-y-auto divide-y divide-[#1E3354]/50">
              {items.length === 0 ? (
                <div className="p-6 text-center text-xs text-[#8796AB]">No matching workspace resources.</div>
              ) : (
                items.map((item, idx) => {
                  const Icon = item.Icon;
                  const active = idx === selectedIdx;
                  return (
                    <button
                      key={item.id}
                      type="button"
                      onMouseEnter={() => setSelectedIdx(idx)}
                      onClick={() => {
                        navigate(item.to);
                        onClose();
                      }}
                      className={`w-full text-left px-4 py-3 flex items-center justify-between gap-4 transition-colors ${
                        active ? 'bg-[#142A49]' : 'hover:bg-[#142A49]/40'
                      }`}
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <Icon className={`w-4 h-4 shrink-0 ${active ? 'text-[#65B9FF]' : 'text-[#8796AB]'}`} />
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-[#F4F7FC] truncate">{item.label}</p>
                          <p className="text-xs font-mono text-[#8796AB] truncate">{item.sublabel}</p>
                        </div>
                      </div>
                      <span className="text-[11px] text-[#8796AB] shrink-0">{item.category}</span>
                    </button>
                  );
                })
              )}
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};
