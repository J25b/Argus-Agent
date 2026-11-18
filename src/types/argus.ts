export type OrgRole = 'Owner' | 'Administrator' | 'Security Analyst' | 'Viewer';

export type VerificationStatus = 'Unverified' | 'Pending' | 'Verified' | 'Failed';
export type VerificationMethod = 'dns_txt' | 'http_file';

export type AssessmentProfile =
  | 'Passive Reconnaissance'
  | 'Standard Web Security Assessment'
  | 'Comprehensive Authorized Assessment';

export type AssessmentStatus =
  | 'Draft'
  | 'Pending Authorization'
  | 'Queued'
  | 'Running'
  | 'Completed'
  | 'Failed'
  | 'Cancelled';

export type VulnerabilitySeverity =
  | 'Critical'
  | 'High'
  | 'Medium'
  | 'Low'
  | 'Informational';

export type VulnerabilityConfidence = 'Confirmed' | 'High' | 'Medium' | 'Low';

export type VulnerabilityStatus =
  | 'Open'
  | 'Confirmed'
  | 'False Positive'
  | 'Accepted Risk'
  | 'Resolved'
  | 'Reopened';

export type AgentRole =
  | 'ARGUS CORE'
  | 'RECON AGENT'
  | 'ANALYSIS AGENT'
  | 'VALIDATION AGENT'
  | 'REPORTING AGENT';

export interface UserProfile {
  id: string;
  email: string;
  full_name: string;
  job_title: string;
  intended_use_case: string;
  auth_acknowledged: boolean;
  onboarding_completed: boolean;
  created_at: string;
}

export interface Organization {
  id: string;
  name: string;
  domain: string;
  industry: string;
  is_demo: boolean;
  role: OrgRole;
  created_at: string;
}

export interface TargetScope {
  id: string;
  target_id: string;
  allowed_domains: string[];
  allowed_paths: string[];
  excluded_paths: string[];
  permitted_methods: string[];
  restrictions: string;
  updated_at: string;
}

export interface Target {
  id: string;
  organization_id: string;
  name: string;
  domain: string;
  target_type: string;
  description: string;
  verification_status: VerificationStatus;
  verification_method: VerificationMethod | null;
  verification_token: string;
  verified_at: string | null;
  created_by: string;
  created_at: string;
  scope?: TargetScope;
}

export interface AuthorizationRecord {
  id: string;
  target_id: string;
  organization_id: string;
  user_id: string;
  user_email?: string;
  method: string;
  evidence: string;
  status: string;
  created_at: string;
}

export interface Assessment {
  id: string;
  organization_id: string;
  target_id: string;
  target_name?: string;
  target_domain?: string;
  profile: AssessmentProfile;
  status: AssessmentStatus;
  current_stage: string;
  require_tool_approval: boolean;
  checks_performed: string[];
  started_at: string | null;
  completed_at: string | null;
  created_by: string;
  created_at: string;
}

export interface AssessmentEvent {
  id: string;
  assessment_id: string;
  stage: string;
  agent_role: AgentRole | string;
  event_type: string;
  message: string;
  details: Record<string, unknown> | null;
  created_at: string;
}

export interface AgentTask {
  id: string;
  assessment_id: string;
  organization_id: string;
  agent_role: AgentRole;
  task_name: string;
  status:
    | 'Queued'
    | 'Processing'
    | 'Awaiting Approval'
    | 'Executing'
    | 'Completed'
    | 'Failed'
    | 'Rejected';
  input_summary: string;
  output_summary: string | null;
  created_at: string;
  completed_at: string | null;
}

export interface ToolDefinition {
  id: string;
  name: string;
  category: string;
  description: string;
  allowed_profiles: AssessmentProfile[];
  risk_level: 'Low' | 'Moderate';
  requires_approval: boolean;
  enabled: boolean;
}

export interface ToolExecutionLog {
  id: string;
  assessment_id: string;
  organization_id: string;
  agent_role: AgentRole;
  tool_name: string;
  arguments: Record<string, unknown>;
  policy_decision: 'Approved' | 'Rejected' | 'Awaiting Approval';
  policy_reason: string;
  result_summary: string | null;
  evidence: Record<string, unknown> | null;
  executed_by: string;
  created_at: string;
}

export interface Vulnerability {
  id: string;
  organization_id: string;
  target_id: string;
  target_name?: string;
  target_domain?: string;
  assessment_id: string;
  title: string;
  severity: VulnerabilitySeverity;
  endpoint: string;
  category: string;
  confidence: VulnerabilityConfidence;
  validation_status: VulnerabilityStatus;
  cvss_score: number | null;
  cvss_vector: string | null;
  cvss_version: string | null;
  description: string;
  technical_explanation: string;
  evidence: string;
  impact: string;
  remediation: string;
  discovered_at: string;
}

export interface VulnerabilityHistoryItem {
  id: string;
  vulnerability_id: string;
  user_id: string;
  user_email: string;
  from_status: string;
  to_status: string;
  note: string;
  created_at: string;
}

export interface ReportRecord {
  id: string;
  organization_id: string;
  assessment_id: string;
  target_id: string;
  target_name?: string;
  target_domain?: string;
  assessment_profile?: string;
  title: string;
  executive_summary: string;
  methodology: string;
  checks_performed: string[];
  conclusion: string;
  generated_by: string;
  created_at: string;
}

export interface NotificationItem {
  id: string;
  organization_id: string;
  user_id: string | null;
  type: string;
  title: string;
  message: string;
  link: string | null;
  is_read: boolean;
  created_at: string;
}

export interface AuditLogItem {
  id: string;
  organization_id: string;
  user_id: string;
  user_email: string;
  action: string;
  resource_type: string;
  resource_id: string;
  details: Record<string, unknown> | null;
  created_at: string;
}

export interface AiGatewayStatus {
  provider_mode: 'gemini_server' | 'bifrost';
  bifrost_base_url: string;
  has_bifrost_api_key: boolean;
  has_bifrost_virtual_key: boolean;
  gemini_server_configured: boolean;
  default_model: string;
  fallback_models: string[];
  request_timeout_ms: number;
  connection_status: 'Connected' | 'Unavailable' | 'Not Configured' | 'Degraded';
  last_checked_at: string | null;
  last_check_message: string | null;
  available_models: { id: string; provider: string; label: string }[];
}

export interface AiModelAssignment {
  id: string;
  organization_id: string;
  agent_role: AgentRole;
  model_id: string;
  updated_at: string;
}

export interface AiUsageSummary {
  total_requests: number;
  successful_requests: number;
  failed_requests: number;
  total_prompt_tokens: number;
  total_completion_tokens: number;
  avg_latency_ms: number | null;
  fallback_events: number;
  estimated_cost_usd: number | null;
  by_model: { model: string; provider: string; count: number; tokens: number }[];
}

export interface AiRequestLogItem {
  id: string;
  organization_id: string;
  assessment_id: string | null;
  agent_role: string;
  provider: string;
  model: string;
  status: 'Success' | 'Failed';
  prompt_tokens: number | null;
  completion_tokens: number | null;
  latency_ms: number | null;
  fallback_used: boolean;
  error_message: string | null;
  created_at: string;
}

export interface ApiKeyItem {
  id: string;
  name: string;
  key_prefix: string;
  created_by: string;
  last_used_at: string | null;
  created_at: string;
}

export interface IntegrationItem {
  id: string;
  provider: 'github' | 'slack' | 'email' | 'webhook';
  status: 'Disconnected' | 'Connected';
  config: Record<string, string>;
  updated_at: string;
}

export interface OverviewStats {
  total_assessments: number;
  registered_targets: number;
  verified_targets: number;
  total_vulnerabilities: number;
  critical_findings: number;
  severity_distribution: Record<VulnerabilitySeverity, number>;
  recent_assessments: Assessment[];
  recent_vulnerabilities: Vulnerability[];
  recent_activity: AuditLogItem[];
  assessment_timeline: { date: string; completed: number; findings: number }[];
}
