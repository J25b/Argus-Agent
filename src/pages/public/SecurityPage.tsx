import React from 'react';
import { PublicLayout } from '../../components/PublicLayout';

export const SecurityPage: React.FC = () => {
  const controls = [
    {
      title: 'Verifiable Ownership Only',
      body: 'Targets require cryptographic token verification via DNS TXT records or HTTPS /.well-known/argus-verification.txt before any assessment can be created or started.',
    },
    {
      title: 'SSRF & DNS Rebinding Protection',
      body: 'Before any network connection, ARGUS resolves hostnames and blocks loopback (127.0.0.0/8, ::1), RFC 1918 private networks, link-local ranges, cloud metadata endpoints (169.254.169.254), and unsafe HTTP redirects.',
    },
    {
      title: 'Untrusted Content & Prompt-Injection Defense',
      body: 'HTML, headers, and metadata retrieved from scanned targets are sanitized and treated strictly as untrusted data. Target content cannot alter system prompts, scope, or user permissions.',
    },
    {
      title: 'No Destructive Exploitation',
      body: 'ARGUS never executes arbitrary shell commands, denial-of-service floods, credential brute-forcing, persistence mechanisms, or unauthorized network sweeping.',
    },
    {
      title: 'Organization Isolation & RBAC',
      body: 'Every database query is scoped to the authenticated organization. Roles (Owner, Administrator, Security Analyst, Viewer) restrict destructive, administrative, and scanning actions.',
    },
    {
      title: 'Immutable Audit Trail & Secret Hygiene',
      body: 'Target verifications, scope changes, tool approvals, vulnerability status transitions, and AI gateway updates are audit-logged. Gateway secrets and API keys are never returned to the browser.',
    },
  ];

  return (
    <PublicLayout>
      <section className="border-b border-[#1E3354]">
        <div className="max-w-7xl mx-auto px-6 py-16 space-y-4">
          <p className="text-xs font-mono tracking-[0.18em] text-[#16B887]">SECURITY &amp; AUTHORIZATION</p>
          <h1 className="font-display text-3xl sm:text-4xl font-bold text-[#F4F7FC] tracking-tight max-w-3xl [text-wrap:balance]">
            Engineered with strict guardrails for authorized testing.
          </h1>
          <p className="text-base text-[#8796AB] max-w-2xl leading-relaxed">
            Security operations platforms must enforce safety boundaries in code, not just terms of service. Every layer of ARGUS enforces authorization, scope containment, and least privilege.
          </p>
        </div>
      </section>

      <section className="max-w-7xl mx-auto px-6 py-16">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {controls.map((c, idx) => (
            <div key={c.title} className="border border-[#1E3354] bg-[#0E182E] rounded-lg p-7 space-y-3">
              <span className="font-mono text-xs text-[#65B9FF]">0{idx + 1}.</span>
              <h2 className="font-display text-lg font-semibold text-[#F4F7FC]">{c.title}</h2>
              <p className="text-sm text-[#8796AB] leading-relaxed">{c.body}</p>
            </div>
          ))}
        </div>
      </section>
    </PublicLayout>
  );
};
