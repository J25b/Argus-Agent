import React, { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { Plus, Search, X } from 'lucide-react';
import { AppShell } from '../../components/AppShell';
import { FAST_EASE } from '../../components/MotionPrimitives';
import { SemanticStatusText } from '../../components/StatusText';
import { useAuth } from '../../context/AuthContext';
import type { Target } from '../../types/argus';

export const TargetsPage: React.FC = () => {
  const { apiFetch, organization } = useAuth();
  const navigate = useNavigate();
  const reduced = useReducedMotion();
  const [targets, setTargets] = useState<Target[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [showModal, setShowModal] = useState(false);

  const [name, setName] = useState('');
  const [domain, setDomain] = useState('');
  const [targetType, setTargetType] = useState('Web Application');
  const [description, setDescription] = useState('');
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const canMutate = organization?.role !== 'Viewer';

  const loadTargets = useCallback(() => {
    setLoading(true);
    apiFetch<Target[]>('/api/targets')
      .then(setTargets)
      .finally(() => setLoading(false));
  }, [apiFetch]);

  useEffect(() => {
    loadTargets();
  }, [loadTargets]);

  useEffect(() => {
    if (!showModal) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setShowModal(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [showModal]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    setSaving(true);
    try {
      const created = await apiFetch<Target>('/api/targets', {
        method: 'POST',
        body: JSON.stringify({ name, domain, target_type: targetType, description }),
      });
      setShowModal(false);
      setName('');
      setDomain('');
      setDescription('');
      navigate(`/app/targets/${created.id}`);
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Unable to create target.');
    } finally {
      setSaving(false);
    }
  };

  const filtered = targets.filter(
    (t) =>
      t.name.toLowerCase().includes(search.toLowerCase()) ||
      t.domain.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <AppShell
      breadcrumb="Targets & Scope Management"
      action={
        canMutate ? (
          <button
            type="button"
            onClick={() => setShowModal(true)}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-[#F4F7FC] bg-[#2388E8] hover:bg-[#1C74CA] rounded-md whitespace-nowrap shrink-0 transition-colors"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Register Target</span>
          </button>
        ) : undefined
      }
    >
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="relative max-w-sm w-full">
            <Search className="w-4 h-4 text-[#8796AB] absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Filter targets by name or domain..."
              className="w-full pl-9 pr-3.5 py-2 text-sm bg-[#0E182E] border border-[#1E3354] rounded-md text-[#F4F7FC] placeholder-[#8796AB] focus:outline-none focus:border-[#2388E8] transition-colors"
            />
          </div>
          <p className="text-xs text-[#8796AB]">
            Only targets with Verified ownership can be assessed.
          </p>
        </div>

        <div className="border border-[#1E3354] bg-[#0E182E] rounded-lg overflow-hidden">
          {loading ? (
            <div className="p-8 text-sm text-[#8796AB]">Loading targets...</div>
          ) : filtered.length === 0 ? (
            <div className="p-10 text-center space-y-3">
              <p className="text-sm font-medium text-[#F4F7FC]">No registered targets found</p>
              <p className="text-xs text-[#8796AB]">
                Register a domain owned by your organization to generate an ownership verification token.
              </p>
              {canMutate && (
                <button
                  type="button"
                  onClick={() => setShowModal(true)}
                  className="px-4 py-2 text-xs font-semibold text-[#F4F7FC] bg-[#2388E8] hover:bg-[#1C74CA] rounded-md transition-colors"
                >
                  Register First Target
                </button>
              )}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-[#1E3354] text-xs font-medium text-[#8796AB]">
                    <th className="py-3 px-5">Target</th>
                    <th className="py-3 px-5">Domain</th>
                    <th className="py-3 px-5">Type</th>
                    <th className="py-3 px-5">Verification</th>
                    <th className="py-3 px-5">Allowed Domains</th>
                    <th className="py-3 px-5 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#1E3354] text-sm">
                  {filtered.map((t) => (
                    <tr key={t.id} className="hover:bg-[#142A49]/35 transition-colors">
                      <td className="py-3.5 px-5 font-medium text-[#F4F7FC]">{t.name}</td>
                      <td className="py-3.5 px-5 font-mono text-xs text-[#65B9FF]">{t.domain}</td>
                      <td className="py-3.5 px-5 text-xs text-[#8796AB]">{t.target_type}</td>
                      <td className="py-3.5 px-5">
                        <SemanticStatusText status={t.verification_status} />
                      </td>
                      <td className="py-3.5 px-5 font-mono text-xs text-[#8796AB] tabular-nums">
                        {t.scope?.allowed_domains.length || 1} host(s)
                      </td>
                      <td className="py-3.5 px-5 text-right">
                        <Link
                          to={`/app/targets/${t.id}`}
                          className="text-xs font-medium text-[#65B9FF] hover:underline whitespace-nowrap"
                        >
                          Manage &amp; Verify
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* Add Target Modal */}
      <AnimatePresence>
        {showModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center px-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.16 }}
              onClick={() => setShowModal(false)}
              className="fixed inset-0 bg-black/70 backdrop-blur-[2px]"
            />
            <motion.div
              role="dialog"
              aria-modal="true"
              aria-label="Register Authorized Target"
              initial={reduced ? { opacity: 0 } : { opacity: 0, scale: 0.96, y: 8 }}
              animate={reduced ? { opacity: 1 } : { opacity: 1, scale: 1, y: 0 }}
              exit={reduced ? { opacity: 0 } : { opacity: 0, scale: 0.96, y: 8 }}
              transition={{ duration: 0.18, ease: FAST_EASE }}
              className="relative z-10 max-w-lg w-full border border-[#1E3354] bg-[#0E182E] rounded-lg p-6 space-y-5 shadow-2xl"
            >
              <div className="flex items-center justify-between border-b border-[#1E3354] pb-3">
                <h2 className="font-display text-lg font-semibold text-[#F4F7FC]">Register Authorized Target</h2>
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  aria-label="Close modal"
                  className="text-[#8796AB] hover:text-[#F4F7FC] transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <form onSubmit={handleCreate} className="space-y-4">
                {formError && (
                  <div role="alert" className="border border-[#E45B68]/50 bg-[#E45B68]/10 text-[#E45B68] text-xs rounded-md p-3">
                    {formError}
                  </div>
                )}

                <div className="space-y-1.5">
                  <label htmlFor="tgt-name" className="block text-xs font-medium text-[#F4F7FC]">Target Name</label>
                  <input
                    id="tgt-name"
                    type="text"
                    required
                    placeholder="Production Customer Portal"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="w-full px-3.5 py-2 text-sm bg-[#0A1020] border border-[#1E3354] rounded-md text-[#F4F7FC] focus:outline-none focus:border-[#2388E8]"
                  />
                </div>

                <div className="space-y-1.5">
                  <label htmlFor="tgt-domain" className="block text-xs font-medium text-[#F4F7FC]">Public Domain Hostname</label>
                  <input
                    id="tgt-domain"
                    type="text"
                    required
                    placeholder="app.example.com"
                    value={domain}
                    onChange={(e) => setDomain(e.target.value)}
                    className="w-full px-3.5 py-2 text-sm font-mono bg-[#0A1020] border border-[#1E3354] rounded-md text-[#F4F7FC] focus:outline-none focus:border-[#2388E8]"
                  />
                  <p className="text-[11px] text-[#8796AB]">Raw IPs, localhost, and internal hostnames are blocked by SSRF policy.</p>
                </div>

                <div className="space-y-1.5">
                  <label htmlFor="tgt-type" className="block text-xs font-medium text-[#F4F7FC]">Asset Type</label>
                  <select
                    id="tgt-type"
                    value={targetType}
                    onChange={(e) => setTargetType(e.target.value)}
                    className="w-full px-3.5 py-2 text-sm bg-[#0A1020] border border-[#1E3354] rounded-md text-[#F4F7FC] focus:outline-none focus:border-[#2388E8]"
                  >
                    <option>Web Application</option>
                    <option>REST / GraphQL API</option>
                    <option>Marketing / Public Website</option>
                    <option>Staging Environment</option>
                  </select>
                </div>

                <div className="space-y-1.5">
                  <label htmlFor="tgt-desc" className="block text-xs font-medium text-[#F4F7FC]">Description</label>
                  <textarea
                    id="tgt-desc"
                    rows={2}
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="Scope boundaries and asset context..."
                    className="w-full px-3.5 py-2 text-sm bg-[#0A1020] border border-[#1E3354] rounded-md text-[#F4F7FC] focus:outline-none focus:border-[#2388E8]"
                  />
                </div>

                <div className="pt-2 flex justify-end gap-3">
                  <button
                    type="button"
                    onClick={() => setShowModal(false)}
                    className="px-4 py-2 text-xs font-medium text-[#8796AB] hover:text-[#F4F7FC] transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={saving}
                    className="px-4 py-2 text-xs font-semibold text-[#F4F7FC] bg-[#2388E8] hover:bg-[#1C74CA] disabled:opacity-50 rounded-md transition-colors"
                  >
                    {saving ? 'Registering...' : 'Register Target'}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </AppShell>
  );
};
