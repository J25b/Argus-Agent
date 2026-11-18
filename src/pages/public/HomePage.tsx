import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { ArrowRight, CheckCircle2, LockKeyhole, ShieldCheck, TerminalSquare } from 'lucide-react';
import { PublicLayout } from '../../components/PublicLayout';
import { FAST_EASE } from '../../components/MotionPrimitives';

const ARCHITECTURE_LAYERS = [
  {
    step: '01',
    title: 'Target Verification & Scope Lock',
    desc: 'DNS TXT or .well-known HTTP proof required prior to any scan.',
    tone: 'text-[#16B887]',
    input: 'Registered hostname + cryptographic token',
    guardrail: 'Rejects raw IPs, private CIDRs, and unverified assets',
    output: 'Immutable TargetScope & AuthorizationRecord',
  },
  {
    step: '02',
    title: 'ARGUS CORE Orchestration',
    desc: 'Plans passive recon, header analysis, and TLS checks via AI gateway.',
    tone: 'text-[#65B9FF]',
    input: 'Approved AssessmentProfile + TargetScope',
    guardrail: 'Never passes raw untrusted target HTML into system rules',
    output: 'Structured task queue across specialized agents',
  },
  {
    step: '03',
    title: 'Tool-Call Policy Engine',
    desc: 'Validates registered tools, strict schemas, SSRF rules, and analyst approval.',
    tone: 'text-[#F0A43A]',
    input: 'Proposed tool call + destination arguments',
    guardrail: 'Enforces tool_registry allowlist and optional analyst approval gate',
    output: 'Audited Decision: Approved · Awaiting Approval · Rejected',
  },
  {
    step: '04',
    title: 'Controlled Workers & Validation',
    desc: 'Executes approved checks, verifies findings, and compiles audit-ready reports.',
    tone: 'text-[#F4F7FC]',
    input: 'Approved tool execution handle + AbortController',
    guardrail: 'Rate-limited HTTPS/DNS/TLS checks with instant cancellation',
    output: 'Raw evidence, CVSS v3.1 findings, and PDF report',
  },
];

const SPECIALIZED_AGENTS = [
  {
    role: 'RECON AGENT',
    summary: 'Passive DNS, TLS & public surface mapping',
    tools: ['dns_lookup', 'tls_inspect', 'public_metadata_check'],
    boundary: 'Read-only network lookups against verified scope hostnames.',
    output: 'A/AAAA/NS/MX/TXT/DMARC/CAA records, TLS cipher & expiry, security.txt.',
  },
  {
    role: 'ANALYSIS AGENT',
    summary: 'Security header, cookie & stack evaluation',
    tools: ['http_header_check', 'tech_fingerprint'],
    boundary: 'Rate-limited GET/HEAD with redirect blocking and HTML sanitization.',
    output: 'Missing HSTS/CSP/X-Frame-Options, cookie flag gaps, banner disclosure.',
  },
  {
    role: 'VALIDATION AGENT',
    summary: 'Evidence cross-checking & confidence scoring',
    tools: ['evidence_correlator'],
    boundary: 'Separates Severity, Confidence, and Validation Status cleanly.',
    output: 'Confirmed findings with CVSS v3.1 vectors and false-positive filtering.',
  },
  {
    role: 'REPORTING AGENT',
    summary: 'Executive summary & PDF synthesis',
    tools: ['report_compiler'],
    boundary: 'Documents strictly the checks actually performed and stored findings.',
    output: 'Organization-isolated structured report and downloadable PDF export.',
  },
];

export const HomePage: React.FC = () => {
  const reduced = useReducedMotion();
  const [activeLayerIdx, setActiveLayerIdx] = useState(0);
  const [activeAgentIdx, setActiveAgentIdx] = useState(0);

  const selectedLayer = ARCHITECTURE_LAYERS[activeLayerIdx];
  const selectedAgent = SPECIALIZED_AGENTS[activeAgentIdx];

  return (
    <PublicLayout>
      {/* Hero Section */}
      <section className="border-b border-[#1E3354]">
        <div className="max-w-7xl mx-auto px-6 py-16 lg:py-24 grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">
          <motion.div
            initial={reduced ? false : { opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.28, ease: FAST_EASE }}
            className="lg:col-span-7 space-y-6"
          >
            <p className="text-xs font-mono tracking-[0.18em] text-[#65B9FF]">
              AUTONOMOUS SECURITY INTELLIGENCE
            </p>
            <h1 className="font-display text-4xl sm:text-5xl lg:text-[3.5rem] font-bold tracking-tight text-[#F4F7FC] leading-[1.08] [text-wrap:balance]">
              See Every Weakness. Secure Every Layer.
            </h1>
            <p className="text-base sm:text-lg text-[#8796AB] leading-relaxed max-w-2xl">
              Meet ARGUS, your autonomous AI penetration-testing agent. Discover vulnerabilities, understand your attack surface and strengthen your security posture with intelligent security assessments.
            </p>
            <div className="pt-2 flex flex-wrap items-center gap-4">
              <Link
                to="/signup"
                className="inline-flex items-center gap-2 px-6 py-3 text-sm font-semibold text-[#F4F7FC] bg-[#2388E8] hover:bg-[#1C74CA] rounded-md transition-all active:scale-[0.98] whitespace-nowrap shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#65B9FF]"
              >
                <span>Start Securing Your Assets</span>
                <ArrowRight className="w-4 h-4" />
              </Link>
              <Link
                to="/features"
                className="inline-flex items-center gap-2 px-6 py-3 text-sm font-semibold text-[#F4F7FC] border border-[#1E3354] hover:border-[#65B9FF]/60 hover:bg-[#142A49]/40 rounded-md transition-colors whitespace-nowrap shrink-0"
              >
                <span>Explore the Platform</span>
              </Link>
            </div>
            <div className="pt-4 flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-[#8796AB]">
              <span>DNS TXT &amp; HTTP Ownership Verification</span>
              <span aria-hidden="true">·</span>
              <span>Policy-Gated Tool Execution</span>
              <span aria-hidden="true">·</span>
              <span>Evidence-Backed PDF Reporting</span>
            </div>
          </motion.div>

          {/* Interactive Execution Architecture Explorer */}
          <motion.div
            initial={reduced ? false : { opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.32, delay: 0.06, ease: FAST_EASE }}
            className="lg:col-span-5"
          >
            <div className="border border-[#1E3354] bg-[#0E182E] rounded-lg p-6 space-y-4">
              <div className="flex items-center justify-between border-b border-[#1E3354] pb-3.5">
                <span className="font-display text-sm font-semibold text-[#F4F7FC]">
                  ARGUS Execution Architecture
                </span>
                <span className="text-xs font-mono text-[#65B9FF]">Select layer to inspect</span>
              </div>

              <div className="space-y-2.5">
                {ARCHITECTURE_LAYERS.map((layer, idx) => {
                  const selected = idx === activeLayerIdx;
                  return (
                    <button
                      key={layer.step}
                      type="button"
                      onClick={() => setActiveLayerIdx(idx)}
                      className={`relative w-full text-left border rounded-md px-4 py-3 flex items-start gap-3.5 transition-colors ${
                        selected
                          ? 'border-[#2388E8] bg-[#142A49]/60'
                          : 'border-[#1E3354] bg-[#0A1020] hover:border-[#65B9FF]/40'
                      }`}
                    >
                      <span className={`font-mono text-xs font-semibold pt-0.5 ${layer.tone}`}>
                        {layer.step}
                      </span>
                      <div className="space-y-0.5 min-w-0">
                        <p className="text-sm font-medium text-[#F4F7FC]">{layer.title}</p>
                        <p className="text-xs text-[#8796AB] leading-relaxed">{layer.desc}</p>
                      </div>
                    </button>
                  );
                })}
              </div>

              <AnimatePresence mode="wait">
                <motion.div
                  key={selectedLayer.step}
                  initial={reduced ? false : { opacity: 0, y: 4 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={reduced ? undefined : { opacity: 0, y: -4 }}
                  transition={{ duration: 0.16, ease: FAST_EASE }}
                  className="border border-[#1E3354] bg-[#0A1020] rounded-md p-4 space-y-2 text-xs"
                >
                  <p className="font-mono text-[11px] text-[#65B9FF]">
                    Layer {selectedLayer.step} Contract
                  </p>
                  <p className="text-[#8796AB]">
                    <span className="text-[#F4F7FC]">Input:</span> {selectedLayer.input}
                  </p>
                  <p className="text-[#8796AB]">
                    <span className="text-[#F4F7FC]">Guardrail:</span> {selectedLayer.guardrail}
                  </p>
                  <p className="text-[#16B887]">
                    <span className="text-[#F4F7FC]">Output:</span> {selectedLayer.output}
                  </p>
                </motion.div>
              </AnimatePresence>
            </div>
          </motion.div>
        </div>
      </section>

      {/* Core Capabilities — Asymmetric Bento with Interactive Agent Inspector */}
      <section className="border-b border-[#1E3354]">
        <div className="max-w-7xl mx-auto px-6 py-20 space-y-10">
          <div className="max-w-2xl space-y-3">
            <h2 className="font-display text-2xl sm:text-3xl font-bold text-[#F4F7FC] tracking-tight">
              Built for verifiable security engineering, not guesswork.
            </h2>
            <p className="text-sm sm:text-base text-[#8796AB] leading-relaxed">
              Every assessment runs inside explicit domain boundaries with immutable audit logs, separated severity and validation states, and direct raw evidence.
            </p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 border border-[#1E3354] bg-[#0E182E] rounded-lg p-7 space-y-5">
              <div className="flex items-center justify-between">
                <h3 className="font-display text-lg font-semibold text-[#F4F7FC]">
                  01. Multi-Agent Assessment Orchestration
                </h3>
                <TerminalSquare className="w-5 h-5 text-[#65B9FF]" />
              </div>
              <p className="text-sm text-[#8796AB] leading-relaxed">
                ARGUS CORE coordinates four specialized roles across a transparent five-stage lifecycle. Select any agent role below to inspect its permitted tool boundaries.
              </p>

              {/* Interactive Agent Selector */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                {SPECIALIZED_AGENTS.map((agent, idx) => {
                  const active = idx === activeAgentIdx;
                  return (
                    <button
                      key={agent.role}
                      type="button"
                      onClick={() => setActiveAgentIdx(idx)}
                      className={`text-left border rounded p-3 transition-colors ${
                        active
                          ? 'border-[#2388E8] bg-[#142A49]/70'
                          : 'border-[#1E3354] bg-[#0A1020] hover:border-[#65B9FF]/50'
                      }`}
                    >
                      <p className="font-mono text-xs text-[#65B9FF]">{agent.role}</p>
                      <p className="text-[#8796AB] text-xs mt-1">{agent.summary}</p>
                    </button>
                  );
                })}
              </div>

              <AnimatePresence mode="wait">
                <motion.div
                  key={selectedAgent.role}
                  initial={reduced ? false : { opacity: 0, y: 4 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={reduced ? undefined : { opacity: 0, y: -4 }}
                  transition={{ duration: 0.16, ease: FAST_EASE }}
                  className="border border-[#1E3354] bg-[#0A1020] rounded-md p-4 grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs"
                >
                  <div>
                    <p className="text-[#8796AB]">Permitted Tools</p>
                    <p className="font-mono text-[#65B9FF] mt-1">{selectedAgent.tools.join(', ')}</p>
                  </div>
                  <div>
                    <p className="text-[#8796AB]">Execution Boundary</p>
                    <p className="text-[#F4F7FC] mt-1">{selectedAgent.boundary}</p>
                  </div>
                  <div>
                    <p className="text-[#8796AB]">Verified Output</p>
                    <p className="text-[#16B887] mt-1">{selectedAgent.output}</p>
                  </div>
                </motion.div>
              </AnimatePresence>
            </div>

            <div className="border border-[#1E3354] bg-[#0E182E] rounded-lg p-7 space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="font-display text-lg font-semibold text-[#F4F7FC]">
                  02. Mandatory Ownership Proof
                </h3>
                <LockKeyhole className="w-5 h-5 text-[#16B887]" />
              </div>
              <p className="text-sm text-[#8796AB] leading-relaxed">
                A checkbox never authorizes a scan. Targets must pass live DNS TXT record verification or HTTPS well-known file verification before any assessment can be queued.
              </p>
              <div className="border border-[#1E3354] bg-[#0A1020] rounded p-3 font-mono text-xs text-[#8796AB] space-y-1">
                <p className="text-[#16B887]">TXT _argus-verify.domain</p>
                <p>argus-verify=token</p>
              </div>
            </div>

            <div className="border border-[#1E3354] bg-[#0E182E] rounded-lg p-7 space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="font-display text-lg font-semibold text-[#F4F7FC]">
                  03. SSRF &amp; Egress Hardening
                </h3>
                <ShieldCheck className="w-5 h-5 text-[#2388E8]" />
              </div>
              <p className="text-sm text-[#8796AB] leading-relaxed">
                Every outbound worker lookup resolves DNS upfront and rejects loopback, RFC 1918 private networks, link-local ranges, cloud metadata IPs, and unsafe HTTP redirects.
              </p>
            </div>

            <div className="lg:col-span-2 border border-[#1E3354] bg-[#0E182E] rounded-lg p-7 space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="font-display text-lg font-semibold text-[#F4F7FC]">
                  04. Auditable Findings &amp; Report Generation
                </h3>
                <CheckCircle2 className="w-5 h-5 text-[#65B9FF]" />
              </div>
              <p className="text-sm text-[#8796AB] leading-relaxed">
                Track Severity, Confidence, and Validation Status independently with CVSS v3.1 scoring where applicable. Every status transition is recorded in vulnerability history, and PDF reports strictly document only the checks actually executed.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Assessment Workflow Section */}
      <section className="border-b border-[#1E3354]">
        <div className="max-w-7xl mx-auto px-6 py-20 space-y-10">
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
            <div className="max-w-2xl space-y-3">
              <h2 className="font-display text-2xl sm:text-3xl font-bold text-[#F4F7FC] tracking-tight">
                Controlled seven-step assessment workflow
              </h2>
              <p className="text-sm sm:text-base text-[#8796AB]">
                From verified asset selection to emergency cancellation and structured PDF delivery.
              </p>
            </div>
            <Link
              to="/how-it-works"
              className="text-sm font-medium text-[#65B9FF] hover:text-[#F4F7FC] transition-colors whitespace-nowrap"
            >
              Try interactive policy evaluator →
            </Link>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
            {[
              {
                num: '01',
                title: 'Verify Asset & Scope',
                body: 'Register your domain, verify ownership via DNS TXT or HTTPS file, and define allowed or excluded paths.',
              },
              {
                num: '02',
                title: 'Configure Profile',
                body: 'Select Passive Reconnaissance, Standard Web Security, or Comprehensive Authorized Assessment.',
              },
              {
                num: '03',
                title: 'Monitor & Govern',
                body: 'Watch real task events in real time, approve or reject gated tool calls, or cancel active workers immediately.',
              },
              {
                num: '04',
                title: 'Triage & Export PDF',
                body: 'Inspect raw evidence, update audited finding statuses, and export structured PDF reports.',
              },
            ].map((step) => (
              <motion.div
                key={step.num}
                whileHover={reduced ? undefined : { y: -3 }}
                transition={{ duration: 0.16, ease: FAST_EASE }}
                className="border border-[#1E3354] bg-[#0E182E] hover:border-[#65B9FF]/40 rounded-lg p-6 space-y-3 transition-colors"
              >
                <span className="font-mono text-xs font-semibold text-[#2388E8]">{step.num}</span>
                <h3 className="font-display text-base font-semibold text-[#F4F7FC]">{step.title}</h3>
                <p className="text-sm text-[#8796AB] leading-relaxed">{step.body}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Conversion Section */}
      <section>
        <div className="max-w-7xl mx-auto px-6 py-20">
          <div className="border border-[#1E3354] bg-[#0E182E] rounded-lg px-8 py-12 flex flex-col lg:flex-row items-start lg:items-center justify-between gap-8">
            <div className="space-y-3 max-w-2xl">
              <h2 className="font-display text-2xl sm:text-3xl font-bold text-[#F4F7FC] tracking-tight">
                Ready to assess your authorized web assets?
              </h2>
              <p className="text-sm sm:text-base text-[#8796AB]">
                Create an organization workspace to verify your domains and run controlled security assessments, or explore the isolated Demo Environment first.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-4 shrink-0">
              <Link
                to="/signup"
                className="px-6 py-3 text-sm font-semibold text-[#F4F7FC] bg-[#2388E8] hover:bg-[#1C74CA] rounded-md transition-all active:scale-[0.98] whitespace-nowrap"
              >
                Start Securing Your Assets
              </Link>
              <Link
                to="/login"
                className="px-6 py-3 text-sm font-semibold text-[#F4F7FC] border border-[#1E3354] hover:border-[#65B9FF]/60 rounded-md transition-colors whitespace-nowrap"
              >
                Sign In / Demo Mode
              </Link>
            </div>
          </div>
        </div>
      </section>
    </PublicLayout>
  );
};
