import React from 'react';
import {
  AlertCircle,
  AlertTriangle,
  CheckCircle2,
  Clock,
  Info,
  ShieldAlert,
  XCircle,
} from 'lucide-react';
import type { VulnerabilitySeverity } from '../types/argus';

export const SeverityLabel: React.FC<{ severity: VulnerabilitySeverity }> = ({ severity }) => {
  const map: Record<
    VulnerabilitySeverity,
    { color: string; Icon: React.FC<{ className?: string }> }
  > = {
    Critical: { color: 'text-[#E45B68]', Icon: ShieldAlert },
    High: { color: 'text-[#F0A43A]', Icon: AlertTriangle },
    Medium: { color: 'text-[#65B9FF]', Icon: AlertCircle },
    Low: { color: 'text-[#16B887]', Icon: Info },
    Informational: { color: 'text-[#8796AB]', Icon: Info },
  };
  const cfg = map[severity] || map.Informational;
  const Icon = cfg.Icon;

  return (
    <span className={`inline-flex items-center gap-1.5 text-xs font-semibold whitespace-nowrap ${cfg.color}`}>
      <Icon className="w-3.5 h-3.5 shrink-0" />
      <span>{severity}</span>
    </span>
  );
};

export const SemanticStatusText: React.FC<{ status: string }> = ({ status }) => {
  const normalized = status.toLowerCase();
  if (
    normalized === 'verified' ||
    normalized === 'completed' ||
    normalized === 'connected' ||
    normalized === 'approved' ||
    normalized === 'resolved' ||
    normalized === 'confirmed'
  ) {
    return (
      <span className="inline-flex items-center gap-1.5 text-xs font-medium text-[#16B887] whitespace-nowrap">
        <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
        <span>{status}</span>
      </span>
    );
  }
  if (
    normalized === 'running' ||
    normalized === 'processing' ||
    normalized === 'executing' ||
    normalized === 'queued'
  ) {
    return (
      <span className="inline-flex items-center gap-1.5 text-xs font-medium text-[#65B9FF] whitespace-nowrap">
        <Clock className="w-3.5 h-3.5 shrink-0" />
        <span>{status}</span>
      </span>
    );
  }
  if (
    normalized === 'pending' ||
    normalized === 'pending authorization' ||
    normalized === 'awaiting approval' ||
    normalized === 'open' ||
    normalized === 'reopened' ||
    normalized === 'degraded'
  ) {
    return (
      <span className="inline-flex items-center gap-1.5 text-xs font-medium text-[#F0A43A] whitespace-nowrap">
        <AlertCircle className="w-3.5 h-3.5 shrink-0" />
        <span>{status}</span>
      </span>
    );
  }
  if (
    normalized === 'failed' ||
    normalized === 'rejected' ||
    normalized === 'unavailable'
  ) {
    return (
      <span className="inline-flex items-center gap-1.5 text-xs font-medium text-[#E45B68] whitespace-nowrap">
        <XCircle className="w-3.5 h-3.5 shrink-0" />
        <span>{status}</span>
      </span>
    );
  }

  return (
    <span className="inline-flex items-center gap-1.5 text-xs font-medium text-[#8796AB] whitespace-nowrap">
      <span>{status}</span>
    </span>
  );
};
