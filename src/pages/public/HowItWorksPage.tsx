import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { CheckCircle2, Clock, XCircle } from 'lucide-react';
import { PublicLayout } from '../../components/PublicLayout';
import { FAST_EASE } from '../../components/MotionPrimitives';

interface PolicyScenario {
  id: string;
  label: string;
  proposal: string;
  profile: string;
  scope: string;
  checks: { rule: string; passed: boolean; detail: string }[];
  decision: 'Approved' | 'Awaiting Approval' | 'Rejected';
}

const SCENARIOS: PolicyScenario[] = [
  {
    id: 'dns-pass',
    label: 'Passive DNS Lookup (Verified Scope)',
    proposal: 'dns_lookup({ domain: "portal.company.com" })',
    profile: 'Passive Reconnaissance',
    scope: 'Verified · Allowed: portal.company.com',
    checks: [
      { rule: 'Registered Tool Check', passed: true, detail: 'dns_lookup is enabled in tool_registry' },
      { rule: 'Profile Allowance', passed: true, detail: 'Permitted in Passive Reconnaissance' },
      { rule: 'Scope Containment', passed: true, detail: 'portal.company.com matches verified scope' },
      { rule: 'SSRF & Public IP Check', passed: true, detail: 'Resolves to public IPv4 address' },
    ],
    decision: 'Approved',
  },
  {
    id: 'http-gate',
    label: 'Active HTTP Header Check (Approval Gate)',
    proposal: 'http_header_check({ domain: "portal.company.com" })',
    profile: 'Standard Web Security Assessment',
    scope: 'Verified · Human Approval Enabled',
    checks: [
      { rule: 'Registered Tool Check', passed: true, detail: 'http_header_check is enabled in tool_registry' },
      { rule: 'Profile Allowance', passed: true, detail: 'Permitted in Standard Web Security Assessment' },
      { rule: 'Scope Containment', passed: true, detail: 'portal.company.com matches verified scope' },
      { rule: 'Analyst Gate Requirement', passed: false, detail: 'Moderate-risk tool requires explicit analyst approval' },
    ],
    decision: 'Awaiting Approval',
  },
  {
    id: 'scope-block',
    label: 'Out-of-Scope Domain Proposal',
    proposal: 'http_header_check({ domain: "partner-external.org" })',
    profile: 'Standard Web Security Assessment',
    scope: 'Verified · Allowed: portal.company.com',
    checks: [
      { rule: 'Registered Tool Check', passed: true, detail: 'http_header_check is enabled in tool_registry' },
      { rule: 'Profile Allowance', passed: true, detail: 'Permitted in Standard Web Security Assessment' },
      { rule: 'Scope Containment', passed: false, detail: 'partner-external.org is outside verified scope' },
    ],
    decision: 'Rejected',
  },
  {
    id: 'ssrf-block',
    label: 'Metadata IP / SSRF Attempt',
    proposal: 'tls_inspect({ domain: "169.254.169.254" })',
    profile: 'Comprehensive Authorized Assessment',
    scope: 'Verified · Allowed: portal.company.com',
    checks: [
      { rule: 'Registered Tool Check', passed: true, detail: 'tls_inspect is enabled in tool_registry' },
      { rule: 'Hostname & IP Filter', passed: false, detail: 'Raw IP and link-local metadata 169.254.169.254 blocked' },
    ],
    decision: 'Rejected',
  },
];

export const HowItWorksPage: React.FC = () => {
  const reduced = useReducedMotion();
  const [selectedId, setSelectedId] = useState(SCENARIOS[0].id);
  const scenario = SCENARIOS.find((s) => s.id === selectedId) || SCENARIOS[0];

  const flowSteps = [
    {
      num: '01',
      title: 'Authenticated Request & Organization Isolation',
      detail: 'Users authenticate with organization-scoped sessions. Role-based permissions (Owner, Administrator, Security Analyst, Viewer) are checked on every API request.',
    },
    {
      num: '02',
      title: 'Ownership Verification Gate',
      detail: 'Before any assessment is permitted, the target domain must pass live DNS TXT record lookup or HTTPS .well-known file verification.',
    },
    {
      num: '03',
      title: 'Scope & Profile Selection',
      detail: 'The 7-step Assessment Wizard binds the run to explicit allowed domains, allowed paths, excluded paths, and non-destructive testing restrictions.',
    },
    {
      num: '04',
      title: 'ARGUS CORE Planning',
      detail: 'ARGUS CORE initializes the five-stage lifecycle and dispatches permitted tasks to specialized agents.',
    },
    {
      num: '05',
      title: 'Tool-Call Policy Engine & Human Approval',
      detail: 'Every proposed tool call is checked against tool_registry, strict argument schemas, and scope. Moderate-risk checks can pause in Awaiting Approval until explicitly approved by an analyst.',
    },
    {
      num: '06',
      title: 'Controlled Scanning & AI Analysis',
      detail: 'Workers resolve DNS upfront to block private/loopback/metadata IPs, collect real telemetry, validate findings, and compile audit-ready PDF reports.',
    },
  ];

  return (
    <PublicLayout>
      <section className="border-b border-[#1E3354]">
        <div className="max-w-7xl mx-auto px-6 py-16 space-y-4">
          <p className="text-xs font-mono tracking-[0.18em] text-[#65B9FF]">ARCHITECTURE &amp; WORKFLOW</p>
          <h1 className="font-display text-3xl sm:text-4xl font-bold text-[#F4F7FC] tracking-tight max-w-3xl [text-wrap:balance]">
            How ARGUS plans, governs, and validates every security check.
          </h1>
          <p className="text-base text-[#8796AB] max-w-2xl leading-relaxed">
            AI models never execute commands directly. Every proposal passes through deterministic policy enforcement before touching a verified asset.
          </p>
        </div>
      </section>

      <section className="max-w-7xl mx-auto px-6 py-16 space-y-12">
        {/* Interactive Policy Engine Evaluator */}
        <div className="border border-[#1E3354] bg-[#0E182E] rounded-lg p-7 space-y-6">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-[#1E3354] pb-4">
            <div className="space-y-1">
              <h2 className="font-display text-lg font-semibold text-[#F4F7FC]">
                Interactive Policy Engine Evaluator
              </h2>
              <p className="text-xs text-[#8796AB]">
                Test how ARGUS evaluates AI-proposed tool calls before any worker executes.
              </p>
            </div>
            <span className="text-xs font-mono text-[#65B9FF]">Deterministic Rule Engine</span>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            <div className="lg:col-span-5 space-y-2.5">
              {SCENARIOS.map((sc) => {
                const active = sc.id === selectedId;
                return (
                  <button
                    key={sc.id}
                    type="button"
                    onClick={() => setSelectedId(sc.id)}
                    className={`w-full text-left border rounded-md p-3.5 transition-colors ${
                      active
                        ? 'border-[#2388E8] bg-[#142A49]/70'
                        : 'border-[#1E3354] bg-[#0A1020] hover:border-[#65B9FF]/40'
                    }`}
                  >
                    <p className="text-xs font-semibold text-[#F4F7FC]">{sc.label}</p>
                    <p className="font-mono text-[11px] text-[#65B9FF] mt-1 truncate">{sc.proposal}</p>
                  </button>
                );
              })}
            </div>

            <div className="lg:col-span-7">
              <AnimatePresence mode="wait">
                <motion.div
                  key={scenario.id}
                  initial={reduced ? false : { opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={reduced ? undefined : { opacity: 0, y: -4 }}
                  transition={{ duration: 0.16, ease: FAST_EASE }}
                  className="border border-[#1E3354] bg-[#0A1020] rounded-md p-5 space-y-4"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#1E3354] pb-3">
                    <code className="text-xs font-mono text-[#F4F7FC]">{scenario.proposal}</code>
                    <span
                      className={`text-xs font-mono font-semibold ${
                        scenario.decision === 'Approved'
                          ? 'text-[#16B887]'
                          : scenario.decision === 'Awaiting Approval'
                          ? 'text-[#F0A43A]'
                          : 'text-[#E45B68]'
                      }`}
                    >
                      Decision: {scenario.decision}
                    </span>
                  </div>

                  <p className="text-xs text-[#8796AB]">
                    Profile: <span className="text-[#F4F7FC]">{scenario.profile}</span> · {scenario.scope}
                  </p>

                  <div className="space-y-2.5">
                    {scenario.checks.map((chk, idx) => (
                      <motion.div
                        key={chk.rule}
                        initial={reduced ? false : { opacity: 0, x: -6 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ duration: 0.15, delay: idx * 0.05, ease: FAST_EASE }}
                        className="flex items-start gap-2.5 text-xs border border-[#1E3354]/80 rounded p-3 bg-[#0E182E]/50"
                      >
                        {chk.passed ? (
                          <CheckCircle2 className="w-4 h-4 text-[#16B887] shrink-0 mt-0.5" />
                        ) : scenario.decision === 'Awaiting Approval' ? (
                          <Clock className="w-4 h-4 text-[#F0A43A] shrink-0 mt-0.5" />
                        ) : (
                          <XCircle className="w-4 h-4 text-[#E45B68] shrink-0 mt-0.5" />
                        )}
                        <div>
                          <p className="font-medium text-[#F4F7FC]">{chk.rule}</p>
                          <p className="text-[#8796AB]">{chk.detail}</p>
                        </div>
                      </motion.div>
                    ))}
                  </div>
                </motion.div>
              </AnimatePresence>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {flowSteps.map((s) => (
            <div key={s.num} className="border border-[#1E3354] bg-[#0E182E] rounded-lg p-6 space-y-3">
              <span className="font-mono text-xs font-semibold text-[#65B9FF]">Step {s.num}</span>
              <h2 className="font-display text-lg font-semibold text-[#F4F7FC]">{s.title}</h2>
              <p className="text-sm text-[#8796AB] leading-relaxed">{s.detail}</p>
            </div>
          ))}
        </div>

        <div className="pt-4 flex justify-start">
          <Link
            to="/signup"
            className="px-6 py-3 text-sm font-semibold text-[#F4F7FC] bg-[#2388E8] hover:bg-[#1C74CA] rounded-md transition-all active:scale-[0.98]"
          >
            Launch Your First Verified Assessment
          </Link>
        </div>
      </section>
    </PublicLayout>
  );
};
