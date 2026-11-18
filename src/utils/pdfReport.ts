import { jsPDF } from 'jspdf';
import type { ReportRecord, Vulnerability } from '../types/argus';

interface PdfReportInput {
  report: ReportRecord & {
    scope?: {
      allowed_domains: string[];
      allowed_paths: string[];
      excluded_paths: string[];
      restrictions: string;
    };
  };
  findings: Vulnerability[];
  organizationName: string;
  isDemo: boolean;
}

export function downloadAssessmentPdf({
  report,
  findings,
  organizationName,
  isDemo,
}: PdfReportInput): void {
  const doc = new jsPDF({ unit: 'pt', format: 'a4' });
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 48;
  const maxWidth = pageWidth - margin * 2;
  let y = 56;

  const ensureSpace = (needed: number) => {
    if (y + needed > pageHeight - 54) {
      doc.addPage();
      y = 54;
    }
  };

  const addSectionTitle = (title: string) => {
    ensureSpace(36);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(12);
    doc.setTextColor(20, 42, 73);
    doc.text(title, margin, y);
    y += 6;
    doc.setDrawColor(35, 136, 232);
    doc.setLineWidth(0.75);
    doc.line(margin, y, margin + maxWidth, y);
    y += 16;
  };

  const addParagraph = (text: string, fontSize = 10, color: [number, number, number] = [30, 41, 59]) => {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(fontSize);
    doc.setTextColor(...color);
    const lines = doc.splitTextToSize(text || '—', maxWidth) as string[];
    for (const line of lines) {
      ensureSpace(15);
      doc.text(line, margin, y);
      y += 14;
    }
    y += 6;
  };

  // Header Banner
  doc.setFillColor(10, 16, 32);
  doc.rect(0, 0, pageWidth, 108, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(20);
  doc.setTextColor(244, 247, 252);
  doc.text('ARGUS', margin, 42);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(101, 185, 255);
  doc.text('AUTONOMOUS SECURITY INTELLIGENCE', margin, 58);

  if (isDemo) {
    doc.setTextColor(240, 164, 58);
    doc.text('DEMO ENVIRONMENT — SAMPLE DATA', pageWidth - margin, 42, { align: 'right' });
  }

  doc.setFontSize(10);
  doc.setTextColor(135, 150, 171);
  doc.text(`Organization: ${organizationName}`, margin, 82);
  doc.text(`Generated: ${new Date(report.created_at).toUTCString()}`, pageWidth - margin, 82, { align: 'right' });

  y = 136;

  // Report Title & Metadata
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(16);
  doc.setTextColor(10, 16, 32);
  const titleLines = doc.splitTextToSize(report.title, maxWidth) as string[];
  for (const line of titleLines) {
    doc.text(line, margin, y);
    y += 20;
  }
  y += 4;

  addParagraph(`Report ID: ${report.id}  |  Assessment ID: ${report.assessment_id}`, 9, [100, 116, 139]);
  addParagraph(`Target: ${report.target_name || ''} (${report.target_domain || ''})  |  Profile: ${report.assessment_profile || ''}`, 9, [100, 116, 139]);

  addSectionTitle('1. Executive Summary');
  addParagraph(report.executive_summary);

  addSectionTitle('2. Approved Target Scope & Methodology');
  addParagraph(report.methodology);
  if (report.scope) {
    addParagraph(`Allowed Domains: ${report.scope.allowed_domains.join(', ') || '—'}`, 9.5);
    addParagraph(`Allowed Paths: ${report.scope.allowed_paths.join(', ') || '—'}`, 9.5);
    addParagraph(`Excluded Paths: ${report.scope.excluded_paths.join(', ') || 'None'}`, 9.5);
    addParagraph(`Restrictions: ${report.scope.restrictions || 'Standard non-destructive limits'}`, 9.5);
  }

  addSectionTitle('3. Checks Actually Performed');
  if (report.checks_performed.length === 0) {
    addParagraph('No checks were recorded for this assessment.');
  } else {
    for (const check of report.checks_performed) {
      addParagraph(`• ${check}`, 10);
    }
  }

  addSectionTitle(`4. Findings & Evidence (${findings.length})`);
  if (findings.length === 0) {
    addParagraph('No vulnerabilities were identified across the executed checks.');
  } else {
    for (let i = 0; i < findings.length; i++) {
      const f = findings[i];
      ensureSpace(90);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(11);
      doc.setTextColor(10, 16, 32);
      const fTitle = `${i + 1}. [${f.severity}] ${f.title}`;
      const fLines = doc.splitTextToSize(fTitle, maxWidth) as string[];
      for (const l of fLines) {
        ensureSpace(16);
        doc.text(l, margin, y);
        y += 15;
      }

      const cvssStr = f.cvss_score !== null ? `${f.cvss_version || 'CVSS'} ${f.cvss_score} (${f.cvss_vector || ''})` : 'Not scored';
      addParagraph(
        `Endpoint: ${f.endpoint}  ·  Category: ${f.category}  ·  Confidence: ${f.confidence}  ·  Status: ${f.validation_status}  ·  ${cvssStr}`,
        9,
        [71, 85, 105]
      );
      addParagraph(`Description: ${f.description}`, 9.5);
      addParagraph(`Evidence: ${f.evidence}`, 9, [51, 65, 85]);
      addParagraph(`Remediation: ${f.remediation}`, 9.5);
      y += 4;
    }
  }

  addSectionTitle('5. Conclusion');
  addParagraph(report.conclusion);

  const totalPages = doc.getNumberOfPages();
  for (let p = 1; p <= totalPages; p++) {
    doc.setPage(p);
    doc.setFontSize(8);
    doc.setTextColor(135, 150, 171);
    doc.text(
      `ARGUS — Authorized Security Assessment Report · Page ${p} of ${totalPages}`,
      pageWidth / 2,
      pageHeight - 24,
      { align: 'center' }
    );
  }

  const safeDomain = (report.target_domain || 'argus-report').replace(/[^a-z0-9.-]/gi, '_');
  doc.save(`ARGUS_Report_${safeDomain}.pdf`);
}
