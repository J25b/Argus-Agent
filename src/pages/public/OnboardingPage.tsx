import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArgusLogo } from '../../components/ArgusLogo';
import { useAuth } from '../../context/AuthContext';
import type { Organization, UserProfile } from '../../types/argus';

export const OnboardingPage: React.FC = () => {
  const { user, organization, apiFetch, setSession } = useAuth();
  const navigate = useNavigate();

  const [step, setStep] = useState(1);
  const [fullName, setFullName] = useState(user?.full_name || '');
  const [jobTitle, setJobTitle] = useState(user?.job_title || '');
  const [orgName, setOrgName] = useState(organization?.name || '');
  const [orgDomain, setOrgDomain] = useState(organization?.domain || '');
  const [industry, setIndustry] = useState(organization?.industry || 'Technology & SaaS');
  const [useCase, setUseCase] = useState('Continuous Web Application Security Assessment');
  const [acknowledged, setAcknowledged] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const handleFinish = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!acknowledged) {
      setError('You must acknowledge the authorization requirements before continuing.');
      return;
    }
    setError(null);
    setBusy(true);
    try {
      const data = await apiFetch<{ token: string; user: UserProfile; organization: Organization }>('/api/onboarding', {
        method: 'POST',
        body: JSON.stringify({
          full_name: fullName,
          job_title: jobTitle,
          organization_name: orgName,
          organization_domain: orgDomain,
          industry,
          intended_use_case: useCase,
          auth_acknowledged: acknowledged,
        }),
      });
      setSession(data);
      navigate('/app/overview');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Onboarding failed.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#0A1020] flex flex-col justify-center px-6 py-12">
      <div className="max-w-2xl w-full mx-auto space-y-8">
        <div className="flex items-center justify-between">
          <ArgusLogo size={26} />
          <span className="text-xs font-mono text-[#8796AB]">Step {step} of 3</span>
        </div>

        <form onSubmit={handleFinish} className="border border-[#1E3354] bg-[#0E182E] rounded-lg p-8 space-y-6">
          {error && (
            <div role="alert" className="border border-[#E45B68]/50 bg-[#E45B68]/10 text-[#E45B68] text-xs rounded-md px-3.5 py-2.5">
              {error}
            </div>
          )}

          {step === 1 && (
            <div className="space-y-5">
              <div className="space-y-1">
                <h1 className="font-display text-xl font-bold text-[#F4F7FC]">Profile &amp; Organization Setup</h1>
                <p className="text-sm text-[#8796AB]">Configure your security operator profile and organization isolation boundary.</p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label htmlFor="ob-name" className="block text-xs font-medium text-[#F4F7FC]">Full Name</label>
                  <input
                    id="ob-name"
                    type="text"
                    required
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    className="w-full px-3.5 py-2.5 text-sm bg-[#0A1020] border border-[#1E3354] rounded-md text-[#F4F7FC] focus:outline-none focus:border-[#2388E8]"
                  />
                </div>
                <div className="space-y-1.5">
                  <label htmlFor="ob-title" className="block text-xs font-medium text-[#F4F7FC]">Role / Title</label>
                  <input
                    id="ob-title"
                    type="text"
                    required
                    placeholder="Security Engineer"
                    value={jobTitle}
                    onChange={(e) => setJobTitle(e.target.value)}
                    className="w-full px-3.5 py-2.5 text-sm bg-[#0A1020] border border-[#1E3354] rounded-md text-[#F4F7FC] focus:outline-none focus:border-[#2388E8]"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label htmlFor="ob-org" className="block text-xs font-medium text-[#F4F7FC]">Organization Name</label>
                  <input
                    id="ob-org"
                    type="text"
                    required
                    value={orgName}
                    onChange={(e) => setOrgName(e.target.value)}
                    className="w-full px-3.5 py-2.5 text-sm bg-[#0A1020] border border-[#1E3354] rounded-md text-[#F4F7FC] focus:outline-none focus:border-[#2388E8]"
                  />
                </div>
                <div className="space-y-1.5">
                  <label htmlFor="ob-domain" className="block text-xs font-medium text-[#F4F7FC]">Primary Domain (Optional)</label>
                  <input
                    id="ob-domain"
                    type="text"
                    placeholder="company.com"
                    value={orgDomain}
                    onChange={(e) => setOrgDomain(e.target.value)}
                    className="w-full px-3.5 py-2.5 text-sm bg-[#0A1020] border border-[#1E3354] rounded-md text-[#F4F7FC] focus:outline-none focus:border-[#2388E8]"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label htmlFor="ob-industry" className="block text-xs font-medium text-[#F4F7FC]">Industry</label>
                  <select
                    id="ob-industry"
                    value={industry}
                    onChange={(e) => setIndustry(e.target.value)}
                    className="w-full px-3.5 py-2.5 text-sm bg-[#0A1020] border border-[#1E3354] rounded-md text-[#F4F7FC] focus:outline-none focus:border-[#2388E8]"
                  >
                    <option>Technology &amp; SaaS</option>
                    <option>Financial Services</option>
                    <option>Healthcare</option>
                    <option>E-Commerce &amp; Retail</option>
                    <option>Government &amp; Infrastructure</option>
                    <option>Security Consultancy</option>
                  </select>
                </div>
                <div className="space-y-1.5">
                  <label htmlFor="ob-usecase" className="block text-xs font-medium text-[#F4F7FC]">Intended Use Case</label>
                  <select
                    id="ob-usecase"
                    value={useCase}
                    onChange={(e) => setUseCase(e.target.value)}
                    className="w-full px-3.5 py-2.5 text-sm bg-[#0A1020] border border-[#1E3354] rounded-md text-[#F4F7FC] focus:outline-none focus:border-[#2388E8]"
                  >
                    <option>Continuous Web Application Security Assessment</option>
                    <option>Pre-Release Security Verification</option>
                    <option>External Attack Surface &amp; TLS Auditing</option>
                    <option>Authorized Client Security Reviews</option>
                  </select>
                </div>
              </div>

              <div className="pt-2 flex justify-end">
                <button
                  type="button"
                  onClick={() => {
                    if (!fullName.trim() || !orgName.trim()) {
                      setError('Full name and organization name are required.');
                      return;
                    }
                    setError(null);
                    setStep(2);
                  }}
                  className="px-5 py-2.5 text-sm font-semibold text-[#F4F7FC] bg-[#2388E8] hover:bg-[#1C74CA] rounded-md"
                >
                  Continue
                </button>
              </div>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-5">
              <div className="space-y-1">
                <h1 className="font-display text-xl font-bold text-[#F4F7FC]">Authorization &amp; Acceptable Use</h1>
                <p className="text-sm text-[#8796AB]">ARGUS enforces technical ownership proof before assessing any asset.</p>
              </div>

              <div className="border border-[#1E3354] bg-[#0A1020] rounded-md p-5 space-y-3 text-sm text-[#8796AB] leading-relaxed">
                <p className="text-[#F4F7FC] font-medium">Mandatory Operational Rules</p>
                <p>1. You will only register and assess digital assets owned by your organization or for which you hold explicit written authorization.</p>
                <p>2. Ownership must be cryptographically verified via DNS TXT record or HTTPS <code className="text-[#65B9FF]">/.well-known/argus-verification.txt</code> before assessments can be queued.</p>
                <p>3. All operations are logged in an immutable audit trail tied to your user identity and organization.</p>
              </div>

              <label className="flex items-start gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={acknowledged}
                  onChange={(e) => setAcknowledged(e.target.checked)}
                  className="mt-1 h-4 w-4 rounded border-[#1E3354] bg-[#0A1020] text-[#2388E8]"
                />
                <span className="text-sm text-[#F4F7FC]">
                  I acknowledge that ARGUS may only be used against authorized targets with verified ownership and approved scope.
                </span>
              </label>

              <div className="pt-2 flex items-center justify-between">
                <button
                  type="button"
                  onClick={() => setStep(1)}
                  className="px-4 py-2 text-sm text-[#8796AB] hover:text-[#F4F7FC]"
                >
                  Back
                </button>
                <button
                  type="button"
                  onClick={() => {
                    if (!acknowledged) {
                      setError('Please acknowledge the authorization requirements to proceed.');
                      return;
                    }
                    setError(null);
                    setStep(3);
                  }}
                  className="px-5 py-2.5 text-sm font-semibold text-[#F4F7FC] bg-[#2388E8] hover:bg-[#1C74CA] rounded-md"
                >
                  Continue
                </button>
              </div>
            </div>
          )}

          {step === 3 && (
            <div className="space-y-5">
              <div className="space-y-1">
                <h1 className="font-display text-xl font-bold text-[#F4F7FC]">Workspace Orientation</h1>
                <p className="text-sm text-[#8796AB]">Your clean organization workspace starts with zero fabricated metrics.</p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
                <div className="border border-[#1E3354] bg-[#0A1020] rounded-md p-4 space-y-1">
                  <p className="font-mono text-xs text-[#65B9FF]">01. Targets &amp; Scope</p>
                  <p className="text-[#8796AB]">Add a domain, publish the verification token, and lock allowed paths.</p>
                </div>
                <div className="border border-[#1E3354] bg-[#0A1020] rounded-md p-4 space-y-1">
                  <p className="font-mono text-xs text-[#65B9FF]">02. Assessment Wizard</p>
                  <p className="text-[#8796AB]">Select a verified target, pick a profile, and monitor real task events live.</p>
                </div>
                <div className="border border-[#1E3354] bg-[#0A1020] rounded-md p-4 space-y-1">
                  <p className="font-mono text-xs text-[#65B9FF]">03. Agent Governance</p>
                  <p className="text-[#8796AB]">Approve or reject proposed active tool calls and review raw evidence.</p>
                </div>
                <div className="border border-[#1E3354] bg-[#0A1020] rounded-md p-4 space-y-1">
                  <p className="font-mono text-xs text-[#65B9FF]">04. Findings &amp; PDF Reports</p>
                  <p className="text-[#8796AB]">Triage CVSS-scored vulnerabilities and download structured PDF reports.</p>
                </div>
              </div>

              <div className="pt-2 flex items-center justify-between">
                <button
                  type="button"
                  onClick={() => setStep(2)}
                  className="px-4 py-2 text-sm text-[#8796AB] hover:text-[#F4F7FC]"
                >
                  Back
                </button>
                <button
                  type="submit"
                  disabled={busy}
                  className="px-6 py-2.5 text-sm font-semibold text-[#F4F7FC] bg-[#2388E8] hover:bg-[#1C74CA] disabled:opacity-50 rounded-md"
                >
                  {busy ? 'Finalizing workspace...' : 'Enter ARGUS Console'}
                </button>
              </div>
            </div>
          )}
        </form>
      </div>
    </div>
  );
};
