import React from 'react';
import { Link } from 'react-router-dom';
import { PublicLayout } from '../../components/PublicLayout';

export const FeaturesPage: React.FC = () => {
  const agents = [
    {
      role: 'RECON AGENT',
      summary: 'Passive reconnaissance and attack-surface mapping within verified domain boundaries.',
      capabilities: [
        'DNS A, AAAA, NS, MX, TXT, SPF, DMARC, and CAA resolution',
        'TLS handshake inspection, cipher suite check, and certificate expiry tracking',
        'Public security.txt and robots.txt inspection',
        'Technology fingerprinting from sanitized server headers and metadata',
      ],
    },
    {
      role: 'ANALYSIS AGENT',
      summary: 'Security configuration evaluation and structured risk classification.',
      capabilities: [
        'HTTP security header validation (HSTS, CSP, X-Frame-Options, nosniff)',
        'Session cookie flag auditing (Secure, HttpOnly, SameSite)',
        'Server banner and stack disclosure detection',
        'Prompt-injection-isolated interpretation of untrusted target responses',
      ],
    },
    {
      role: 'VALIDATION AGENT',
      summary: 'Evidence verification and false-positive elimination before triage.',
      capabilities: [
        'Cross-checks candidate weaknesses against raw worker telemetry',
        'Assigns independent Confidence levels (Confirmed, High, Medium, Low)',
        'Maps applicable CVSS v3.1 vectors without inventing arbitrary scores',
        'Maintains separate Validation Status lifecycle (Open, Confirmed, False Positive, Resolved)',
      ],
    },
    {
      role: 'REPORTING AGENT',
      summary: 'Executive and technical documentation grounded strictly in stored facts.',
      capabilities: [
        'Synthesizes executive summaries and prioritized remediation guidance',
        'Lists strictly the checks actually executed during the assessment',
        'Exports formatted PDF reports with ARGUS branding and scope boundaries',
        'Enforces organization-level access control on all report downloads',
      ],
    },
  ];

  return (
    <PublicLayout>
      <section className="border-b border-[#1E3354]">
        <div className="max-w-7xl mx-auto px-6 py-16 space-y-4">
          <p className="text-xs font-mono tracking-[0.18em] text-[#65B9FF]">PLATFORM CAPABILITIES</p>
          <h1 className="font-display text-3xl sm:text-4xl font-bold text-[#F4F7FC] tracking-tight max-w-3xl [text-wrap:balance]">
            Specialized security agents governed by deterministic policy.
          </h1>
          <p className="text-base text-[#8796AB] max-w-2xl leading-relaxed">
            ARGUS separates AI reasoning from execution authority. Model outputs are routed through server-side gateways, validated against registered tool schemas, and executed by SSRF-hardened workers.
          </p>
        </div>
      </section>

      <section className="max-w-7xl mx-auto px-6 py-16 space-y-12">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {agents.map((agent) => (
            <div key={agent.role} className="border border-[#1E3354] bg-[#0E182E] rounded-lg p-7 space-y-4">
              <p className="font-mono text-xs font-semibold text-[#65B9FF]">{agent.role}</p>
              <h2 className="font-display text-xl font-semibold text-[#F4F7FC]">{agent.summary}</h2>
              <ul className="space-y-2.5 text-sm text-[#8796AB]">
                {agent.capabilities.map((cap) => (
                  <li key={cap} className="flex items-start gap-2.5">
                    <span className="text-[#16B887] font-mono text-xs mt-0.5">+</span>
                    <span>{cap}</span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="border border-[#1E3354] bg-[#0E182E] rounded-lg p-8 flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
          <div className="space-y-2 max-w-2xl">
            <h3 className="font-display text-xl font-semibold text-[#F4F7FC]">
              Bifrost by Maxim AI &amp; Server-Side Model Governance
            </h3>
            <p className="text-sm text-[#8796AB] leading-relaxed">
              Administrators can route ARGUS agent roles through a configured Bifrost AI Gateway or the server-side Gemini engine, monitor real token and latency telemetry, and audit every gateway configuration change.
            </p>
          </div>
          <Link
            to="/signup"
            className="px-5 py-2.5 text-sm font-semibold text-[#F4F7FC] bg-[#2388E8] hover:bg-[#1C74CA] rounded-md whitespace-nowrap shrink-0"
          >
            Start Securing Your Assets
          </Link>
        </div>
      </section>
    </PublicLayout>
  );
};
