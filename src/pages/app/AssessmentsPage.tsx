import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Play } from 'lucide-react';
import { AppShell } from '../../components/AppShell';
import { SemanticStatusText } from '../../components/StatusText';
import { useAuth } from '../../context/AuthContext';
import type { Assessment } from '../../types/argus';

export const AssessmentsPage: React.FC = () => {
  const { apiFetch, organization } = useAuth();
  const [assessments, setAssessments] = useState<Assessment[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<string>('All');

  useEffect(() => {
    setLoading(true);
    apiFetch<Assessment[]>('/api/assessments')
      .then(setAssessments)
      .finally(() => setLoading(false));
  }, [apiFetch]);

  const filters = ['All', 'Running', 'Completed', 'Cancelled', 'Failed'];
  const filtered = filter === 'All' ? assessments : assessments.filter((a) => a.status === filter);
  const canLaunch = organization?.role !== 'Viewer';

  return (
    <AppShell
      breadcrumb="Assessments"
      action={
        canLaunch ? (
          <Link
            to="/app/assessments/new"
            className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-[#F4F7FC] bg-[#2388E8] hover:bg-[#1C74CA] rounded-md whitespace-nowrap"
          >
            <Play className="w-3.5 h-3.5" />
            <span>New Assessment</span>
          </Link>
        ) : undefined
      }
    >
      <div className="space-y-6">
        <div className="flex flex-wrap items-center gap-1 p-1 bg-[#0E182E] border border-[#1E3354] rounded-md w-fit">
          {filters.map((f) => (
            <button
              key={f}
              type="button"
              onClick={() => setFilter(f)}
              className={`px-3 py-1.5 text-xs font-medium rounded transition-colors whitespace-nowrap ${
                filter === f ? 'bg-[#142A49] text-[#F4F7FC]' : 'text-[#8796AB] hover:text-[#F4F7FC]'
              }`}
            >
              {f}
            </button>
          ))}
        </div>

        <div className="border border-[#1E3354] bg-[#0E182E] rounded-lg overflow-hidden">
          {loading ? (
            <div className="p-8 text-sm text-[#8796AB]">Loading assessments...</div>
          ) : filtered.length === 0 ? (
            <div className="p-10 text-center space-y-3">
              <p className="text-sm font-medium text-[#F4F7FC]">No assessments match this filter</p>
              <p className="text-xs text-[#8796AB]">
                Verify a target domain and run the 7-step Assessment Wizard to start an authorized security check.
              </p>
              {canLaunch && (
                <Link
                  to="/app/assessments/new"
                  className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-[#F4F7FC] bg-[#2388E8] rounded-md"
                >
                  Launch Assessment Wizard
                </Link>
              )}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-[#1E3354] text-xs font-medium text-[#8796AB]">
                    <th className="py-3 px-5">Target</th>
                    <th className="py-3 px-5">Profile</th>
                    <th className="py-3 px-5">Stage</th>
                    <th className="py-3 px-5">Status</th>
                    <th className="py-3 px-5">Checks Run</th>
                    <th className="py-3 px-5">Created</th>
                    <th className="py-3 px-5 text-right">View</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#1E3354] text-sm">
                  {filtered.map((a) => (
                    <tr key={a.id} className="hover:bg-[#142A49]/35 transition-colors">
                      <td className="py-3.5 px-5">
                        <p className="font-medium text-[#F4F7FC]">{a.target_name}</p>
                        <p className="font-mono text-xs text-[#65B9FF]">{a.target_domain}</p>
                      </td>
                      <td className="py-3.5 px-5 text-xs text-[#F4F7FC]">{a.profile}</td>
                      <td className="py-3.5 px-5 text-xs font-mono text-[#8796AB]">{a.current_stage}</td>
                      <td className="py-3.5 px-5">
                        <SemanticStatusText status={a.status} />
                      </td>
                      <td className="py-3.5 px-5 font-mono text-xs text-[#8796AB] tabular-nums">
                        {a.checks_performed.length}
                      </td>
                      <td className="py-3.5 px-5 font-mono text-xs text-[#8796AB] tabular-nums">
                        {new Date(a.created_at).toLocaleString()}
                      </td>
                      <td className="py-3.5 px-5 text-right">
                        <Link to={`/app/assessments/${a.id}`} className="text-xs font-medium text-[#65B9FF] hover:underline">
                          Inspect
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
    </AppShell>
  );
};
