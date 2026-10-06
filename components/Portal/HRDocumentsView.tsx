import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useAuth } from '../../context/AuthContext';
import {
  FileText, Send, Download, Eye, Plus, ChevronDown, CheckCircle,
  AlertCircle, Loader2, Printer, Clock, User, Calendar, Building,
  Mail, Search, Filter, RefreshCw, Archive, X, ShieldCheck, QrCode,
  Copy, ExternalLink, Edit3, Trash2, History, Sparkles, ArrowLeft,
  Check, Award, Briefcase, TrendingUp, UserCheck, ShieldAlert,
  Calculator, DollarSign
} from 'lucide-react';
import {
  subscribeToCanonicalEmployees,
  CanonicalEmployee
} from '../../lib/employeeMaster';
import {
  DocType,
  DocStatus,
  HRDocumentRecord,
  HRAuditEvent,
  generateDocumentReference,
  generateVerificationToken,
  subscribeToHRDocuments,
  saveHRDocument,
  updateHRDocument,
  logHRAuditEvent,
  getDocumentByVerificationToken,
  DOC_TYPE_CODES
} from '../../lib/hrDocumentStorage';

// ── Document Type Definitions ─────────────────────────────────────────
interface DocTypeConfig {
  id: DocType;
  title: string;
  badge: string;
  icon: string;
  color: string;
  description: string;
}

export interface SalaryBreakdownItem {
  id: string;
  name: string;
  monthly: number;
  annual: number;
}

const DOC_TYPES: DocTypeConfig[] = [
  {
    id: 'appointment',
    title: 'Appointment Letter',
    badge: 'Onboarding',
    icon: '📋',
    color: '#5B4BFF',
    description: 'Formal confirmation of employment terms, CTC breakdown, and probation policies.'
  },
  {
    id: 'offer',
    title: 'Offer Letter',
    badge: 'Pre-Hire',
    icon: '✉️',
    color: '#00D2D3',
    description: 'Conditional pre-joining offer with salary proposition and validity deadline.'
  },
  {
    id: 'relieving',
    title: 'Relieving Letter',
    badge: 'Offboarding',
    icon: '🤝',
    color: '#FF9F43',
    description: 'Formal release from company duties confirming clearance of dues and final working day.'
  },
  {
    id: 'experience',
    title: 'Experience Certificate',
    badge: 'Career',
    icon: '🏆',
    color: '#10B981',
    description: 'Official employment history, tenure validation, and performance appraisal statement.'
  },
  {
    id: 'increment',
    title: 'Increment Letter',
    badge: 'Appraisal',
    icon: '📈',
    color: '#8B5CF6',
    description: 'Compensation enhancement letter with revised CTC and effective date confirmation.'
  },
];

// Helper to generate default standard salary breakdown
export const calculateDefaultBreakdown = (annualTotal: number): SalaryBreakdownItem[] => {
  const basicAnnual = Math.round(annualTotal * 0.45);
  const basicMonthly = Math.round(basicAnnual / 12);

  const hraAnnual = Math.round(annualTotal * 0.25);
  const hraMonthly = Math.round(hraAnnual / 12);

  const specialAnnual = Math.round(annualTotal * 0.20);
  const specialMonthly = Math.round(specialAnnual / 12);

  const perfAnnual = Math.round(annualTotal * 0.10);
  const perfMonthly = Math.round(perfAnnual / 12);

  return [
    { id: 'item_basic', name: 'Basic Salary (45%)', monthly: basicMonthly, annual: basicAnnual },
    { id: 'item_hra', name: 'House Rent Allowance (HRA - 25%)', monthly: hraMonthly, annual: hraAnnual },
    { id: 'item_special', name: 'Special / Flexi Allowance (20%)', monthly: specialMonthly, annual: specialAnnual },
    { id: 'item_perf', name: 'Performance Incentive / Retention Bonus (10%)', monthly: perfMonthly, annual: perfAnnual },
  ];
};

// ── HTML Template Generators for A4 Printing & Live Preview ───────────
const getDocTitle = (type: DocType): string => {
  switch (type) {
    case 'appointment': return 'LETTER OF APPOINTMENT';
    case 'offer':       return 'OFFER OF EMPLOYMENT';
    case 'relieving':   return 'RELIEVING & CLEARANCE LETTER';
    case 'experience':  return 'CERTIFICATE OF EXPERIENCE';
    case 'increment':   return 'ANNUAL COMPENSATION REVISION LETTER';
    default:            return 'OFFICIAL HR DOCUMENT';
  }
};

export const buildDocumentHTML = (
  type: DocType,
  data: Record<string, string>,
  emp: { name: string; email: string; designation?: string; department?: string; id?: string },
  referenceNumber: string,
  verificationToken: string,
  effectiveDate: string,
  signatory: { name: string; designation: string },
  customSalaryBreakdown?: SalaryBreakdownItem[]
): string => {
  const formattedDate = effectiveDate
    ? new Date(effectiveDate).toLocaleDateString('en-IN', { day: '2-digit', month: 'long', year: 'numeric' })
    : new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'long', year: 'numeric' });

  let bodyContent = '';

  if (type === 'appointment') {
    // Determine salary breakdown items
    let breakdownItems: SalaryBreakdownItem[] = [];
    if (customSalaryBreakdown && customSalaryBreakdown.length > 0) {
      breakdownItems = customSalaryBreakdown;
    } else if (data.salaryBreakdown) {
      try {
        breakdownItems = JSON.parse(data.salaryBreakdown);
      } catch {}
    }

    if (!breakdownItems || breakdownItems.length === 0) {
      const rawCtc = data.ctc || '1000000';
      const numMatch = rawCtc.replace(/[^0-9]/g, '');
      const annualNumber = parseInt(numMatch, 10) || 1000000;
      breakdownItems = calculateDefaultBreakdown(annualNumber);
    }

    // Totals from breakdown
    const totalMonthly = breakdownItems.reduce((acc, item) => acc + (Number(item.monthly) || 0), 0);
    const totalAnnual = breakdownItems.reduce((acc, item) => acc + (Number(item.annual) || 0), 0);

    // Format display string
    const formattedAnnualDisplay = '₹ ' + totalAnnual.toLocaleString('en-IN') + '/- LPA';
    const formattedMonthlyDisplay = '₹ ' + totalMonthly.toLocaleString('en-IN');

    // Generate table rows
    const tableRowsHTML = breakdownItems.map((item, idx) => {
      const isEven = idx % 2 === 1;
      return `
        <tr style="${isEven ? 'background: #fafafa;' : ''}">
          <td style="padding: 7px 10px; border: 1px solid #e2e8f0;">${item.name || 'Allowance'}</td>
          <td style="padding: 7px 10px; border: 1px solid #e2e8f0; text-align: right; font-family: monospace;">₹ ${(Number(item.monthly) || 0).toLocaleString('en-IN')}</td>
          <td style="padding: 7px 10px; border: 1px solid #e2e8f0; text-align: right; font-family: monospace;">₹ ${(Number(item.annual) || 0).toLocaleString('en-IN')}</td>
        </tr>
      `;
    }).join('');

    bodyContent = `
      <div style="font-size: 11px; font-weight: 700; color: #dc2626; letter-spacing: 1px; text-transform: uppercase; margin-bottom: 12px;">
        Strictly Private & Confidential
      </div>

      <div class="salutation">
        To,<br/>
        <strong>${emp.name || '[Employee Full Name]'}</strong><br/>
        <span style="color: #475569; font-size: 12px;">Employee Code: <strong>${emp.id || 'DEA-EMP-024'}</strong> | Email: ${emp.email || 'employee@digiexplode.com'}</span>
      </div>

      <div class="subject-line">
        <strong>SUBJECT: LETTER OF APPOINTMENT & EMPLOYMENT AGREEMENT</strong>
      </div>

      <p>
        Dear <strong>${emp.name || 'Candidate'}</strong>,
      </p>
      <p>
        On behalf of <strong>Digiexplode Digital Media Private Limited (DigiexplodeAI)</strong>, we are pleased to offer you the position of
        <strong>${data.designation || emp.designation || 'Specialist'}</strong> in our
        <strong>${data.department || emp.department || 'Growth & Operations'}</strong> department.
        Your employment with the Company shall commence effective <strong>${formattedDate}</strong> under the comprehensive terms and conditions set forth below.
      </p>

      <div class="section-title">1. APPOINTMENT, ROLE & REPORTING STRUCTURE</div>
      <p>
        You will be designated as <strong>${data.designation || emp.designation || 'Specialist'}</strong>.
        In this role, you will report directly to the <strong>${data.reportingManager || 'Department Head / Managing Director'}</strong> or any other authorized executive designated by the Company.
        You are expected to perform all duties, responsibilities, and key result areas (KRAs) associated with this position with highest professional standards, integrity, and diligence.
      </p>

      <div class="section-title">2. PLACE OF POSTING & OPERATING MODEL</div>
      <p>
        Your primary operating base will be <strong>${data.location || 'Innovate Hub, Sector 62, Noida (Hybrid Mode)'}</strong>.
        Normal business operating hours are Monday through Friday, 10:00 AM to 7:00 PM IST.
        The Company operates in an agile, client-centric delivery environment; depending upon business contingencies, project milestones, and client deliverables, you may be required to work flexible hours or travel for business engagements.
      </p>

      <div class="section-title">3. PROBATION & CONFIRMATION OF SERVICE</div>
      <p>
        You shall be on probation for an initial period of <strong>${data.probation || '3 (Three) Months'}</strong> from your date of joining.
        During the probation period, your performance, attendance, cultural alignment, and quality of work will be periodically assessed.
        Upon satisfactory completion of the probation period, the Company shall confirm your employment in writing. The Company reserves the right to extend the probation period if performance is deemed to require further evaluation.
      </p>

      <div class="section-title">4. COMPENSATION & EMOLUMENTS (ANNEXURE A)</div>
      <p>
        Your Total Cost to Company (CTC) is agreed at <strong>${formattedAnnualDisplay}</strong> (gross monthly remuneration of <strong>${formattedMonthlyDisplay}</strong>).
        Salary will be disbursed monthly in arrears into your nominated bank account on or before the final working day of each calendar month, subject to standard statutory tax deductions (TDS) and statutory compliances.
      </p>

      <div style="margin: 14px 0 18px;">
        <table class="doc-table" style="font-size: 12px;">
          <thead>
            <tr style="background: #f1f5f9; color: #1e293b; font-weight: 700; text-align: left;">
              <th style="padding: 8px 10px; border: 1px solid #cbd5e1;">Salary Component</th>
              <th style="padding: 8px 10px; border: 1px solid #cbd5e1; text-align: right; width: 28%;">Monthly (₹)</th>
              <th style="padding: 8px 10px; border: 1px solid #cbd5e1; text-align: right; width: 28%;">Annualized (₹)</th>
            </tr>
          </thead>
          <tbody>
            ${tableRowsHTML}
            <tr style="background: #f8fafc; font-weight: 700; color: #0f172a; border-top: 2px solid #334155;">
              <td style="padding: 8px 10px; border: 1px solid #cbd5e1;">Total Cost to Company (Gross CTC)</td>
              <td style="padding: 8px 10px; border: 1px solid #cbd5e1; text-align: right; font-family: monospace; color: #5B4BFF; font-size: 13px;">${formattedMonthlyDisplay}</td>
              <td style="padding: 8px 10px; border: 1px solid #cbd5e1; text-align: right; font-family: monospace; color: #5B4BFF; font-size: 13px;">${formattedAnnualDisplay}</td>
            </tr>
          </tbody>
        </table>
        <div style="font-size: 10.5px; color: #64748b; margin-top: 4px; font-style: italic;">
          * Note: Compensation is confidential between you and DigiexplodeAI. Statutory deductions such as Professional Tax, TDS, and PF (if applicable) shall be deducted as per statutory norms.
        </div>
      </div>

      <div class="section-title">5. INTELLECTUAL PROPERTY RIGHTS & WORK-FOR-HIRE</div>
      <p>
        All intellectual property, proprietary software, source codes, AI workflows, algorithms, machine learning models, media assets, creative designs, client strategies, copywriting, and documentation created, conceptualized, or delivered by you during your employment (collectively <strong>"Work Product"</strong>) shall be deemed <em>"Work Made for Hire"</em> and shall remain the absolute, worldwide, and perpetual property of <strong>Digiexplode Digital Media Pvt. Ltd.</strong> You hereby irrevocably assign all rights, title, and interest in such Work Product to the Company.
      </p>

      <div class="section-title">6. CONFIDENTIALITY & NON-DISCLOSURE (NDA)</div>
      <p>
        You agree that you will not, during your employment or at any time thereafter, disclose, copy, transfer, or utilize any Confidential Information of the Company or its clients (including but not limited to source code, client records, pricing models, agency systems, and business trade secrets) for personal benefit or the benefit of any third party. A breach of this covenant will entitle the Company to immediate injunctive relief and legal damages.
      </p>

      <div class="section-title">7. EXCLUSIVITY & CODE OF CONDUCT (NO MOONLIGHTING)</div>
      <p>
        Your employment with DigiexplodeAI is on a full-time, exclusive basis. During the term of your engagement, you shall not engage directly or indirectly in any other business, commercial venture, freelance consulting, or employment (commonly referred to as moonlighting) without prior express written approval from the Board of Directors. You shall strictly adhere to the Company's Code of Conduct, Anti-Harassment (POSH) Policies, and Information Security standards.
      </p>

      <div class="section-title">8. NON-SOLICITATION & NON-COMPETE</div>
      <p>
        For a period of <strong>12 (Twelve) Months</strong> following the termination of your employment for any reason, you agree not to:
        (a) Solicit, canvas, or entice away any clients, leads, or business partners of the Company with whom you had contact during your tenure;
        (b) Directly or indirectly induce, recruit, or hire any current employee or contractor of DigiexplodeAI.
      </p>

      <div class="section-title">9. LEAVE POLICY & STATUTORY BENEFITS</div>
      <p>
        You are eligible for <strong>18 (Eighteen) days</strong> of Annual Paid Leaves per calendar year (pro-rated from your joining date), alongside officially declared agency holidays. Leaves must be requested and approved in advance through the Agency OS Portal.
      </p>

      <div class="section-title">10. SEPARATION, NOTICE PERIOD & TERMINATION</div>
      <p>
        (a) <strong>During Probation:</strong> Either party may terminate this employment contract by giving <strong>15 (Fifteen) days</strong> written notice or gross salary in lieu thereof.<br/>
        (b) <strong>Post-Confirmation:</strong> Either party may terminate the employment by providing <strong>${data.noticePeriod || '30 (Thirty) days'}</strong> written notice or equivalent basic salary in lieu thereof, subject to mutual executive approval.<br/>
        (c) <strong>Termination for Cause:</strong> The Company reserves the right to terminate your employment immediately without notice, compensation, or severance in cases of gross misconduct, breach of confidentiality/IP, fraud, criminal conduct, data theft, or unapproved absence exceeding 3 consecutive business days.
      </p>

      <div class="section-title">11. GOVERNING LAW & JURISDICTION</div>
      <p>
        This Agreement shall be governed by and construed in accordance with the substantive laws of the Republic of India. Any legal disputes arising under or in connection with this Appointment Letter shall be subject to the exclusive jurisdiction of the competent courts in <strong>Gautam Buddha Nagar / New Delhi, India</strong>.
      </p>

      <p style="margin-top: 24px;">
        We welcome you to <strong>DigiexplodeAI</strong> and are confident that your technical acumen, leadership, and drive will play a pivotal role in accelerating our organizational growth.
      </p>
    `;
  } else if (type === 'offer') {
    bodyContent = `
      <div class="salutation">Dear <strong>${emp.name || '[Candidate Name]'}</strong>,</div>
      <p>
        We are delighted to extend this offer of employment with <strong>DigiexplodeAI</strong> for the position of
        <strong>${data.designation || emp.designation || 'Associate'}</strong>.
      </p>

      <div class="section-title">Key Offer Terms:</div>
      <table class="doc-table">
        <tr><td style="width: 35%; font-weight: bold;">Offered Role:</td><td>${data.designation || emp.designation || 'Specialist'}</td></tr>
        <tr><td style="font-weight: bold;">Department:</td><td>${data.department || emp.department || 'Technology'}</td></tr>
        <tr><td style="font-weight: bold;">Annual CTC:</td><td>${data.ctc || '₹ 7,20,000/- LPA'}</td></tr>
        <tr><td style="font-weight: bold;">Expected Date of Joining:</td><td>${formattedDate}</td></tr>
        <tr><td style="font-weight: bold;">Offer Validity Deadline:</td><td>${data.validUntil || 'Within 5 business days'}</td></tr>
      </table>

      <p style="margin-top: 18px;">
        Please sign and return a duplicate copy of this letter as a token of your formal acceptance.
        We are thrilled about the prospect of having you join our fast-paced agency.
      </p>
    `;
  } else if (type === 'relieving') {
    bodyContent = `
      <div class="salutation">To Whom It May Concern,</div>
      <p>
        This is to certify that <strong>${emp.name || '[Employee Name]'}</strong> (Employee ID:
        <strong>${emp.id || 'N/A'}</strong>) has been formally relieved from services at
        <strong>DigiexplodeAI</strong> at the close of business hours on
        <strong>${formattedDate}</strong>.
      </p>
      <p>
        ${emp.name} served as <strong>${data.designation || emp.designation || 'Team Member'}</strong>
        in the <strong>${data.department || emp.department || 'Operations'}</strong> department from
        <strong>${data.joiningDate || 'their date of inception'}</strong> until <strong>${formattedDate}</strong>.
      </p>
      <div class="section-title">Clearance Status:</div>
      <p>
        All company assets, confidential records, credentials, and financial dues have been fully settled and reconciled
        with no outstanding obligations remaining.
      </p>
      <p>
        We thank ${emp.name} for the valuable contributions made during their tenure and wish them continued success
        in all future professional endeavors.
      </p>
    `;
  } else if (type === 'experience') {
    bodyContent = `
      <div class="salutation">TO WHOMSOEVER IT MAY CONCERN</div>
      <p>
        This is to certify that <strong>${emp.name || '[Employee Name]'}</strong> was an integral employee of
        <strong>DigiexplodeAI</strong> from <strong>${data.joiningDate || 'Date of Joining'}</strong> to
        <strong>${formattedDate}</strong>.
      </p>
      <p>
        During this tenure, ${emp.name} served as <strong>${data.designation || emp.designation || 'Lead Specialist'}</strong>
        within our <strong>${data.department || emp.department || 'Core'}</strong> team.
      </p>
      <div class="section-title">Performance & Conduct:</div>
      <p>
        ${data.performanceNotes || emp.name + ' consistently exhibited commendable work ethics, technical proficiency, collaborative teamwork, and strong ownership. Their conduct during the entire engagement with the company was found to be exemplary.'}
      </p>
      <p style="margin-top: 20px;">
        We appreciate their commitment and wish them the very best in all their future undertakings.
      </p>
    `;
  } else if (type === 'increment') {
    bodyContent = `
      <div class="salutation">Dear <strong>${emp.name || '[Employee Name]'}</strong>,</div>
      <p>
        In recognition of your exceptional performance, dedication, and impactful contributions toward
        <strong>DigiexplodeAI</strong>, the Management is delighted to inform you that your compensation has been revised.
      </p>

      <div class="section-title">Revision Details:</div>
      <table class="doc-table">
        <tr><td style="width: 38%; font-weight: bold;">Current CTC:</td><td>${data.currentCtc || '₹ 5,00,000/- LPA'}</td></tr>
        <tr><td style="font-weight: bold;">Revised CTC:</td><td style="font-weight: bold; color: #10B981;">${data.revisedCtc || '₹ 6,50,000/- LPA'}</td></tr>
        <tr><td style="font-weight: bold;">Increment Percentage:</td><td>${data.incrementPercentage || '30%'}</td></tr>
        <tr><td style="font-weight: bold;">Effective Revision Date:</td><td>${formattedDate}</td></tr>
        <tr><td style="font-weight: bold;">Revised Designation:</td><td>${data.designation || emp.designation || 'Senior Specialist'}</td></tr>
      </table>

      <div class="section-title">Appraisal Note:</div>
      <p>
        ${data.appraisalNote || 'Your strong ownership, technical excellence, and cross-team leadership have set high standards across the agency. We are confident you will continue to achieve greater milestones with us.'}
      </p>
      <p style="margin-top: 18px;">
        All other terms and conditions of your employment contract remain unchanged.
      </p>
    `;
  }

  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <title>${getDocTitle(type)} — ${emp.name || 'Digiexplode'}</title>
      <style>
        @page { size: A4 portrait; margin: 16mm 14mm 16mm 14mm; }
        * { box-sizing: border-box; }
        body {
          font-family: 'Georgia', serif;
          color: #0f172a;
          background: #ffffff;
          line-height: 1.65;
          font-size: 12.8px;
          margin: 0;
          padding: 0;
        }
        .letterhead {
          border-bottom: 2.5px solid #0f172a;
          padding-bottom: 12px;
          margin-bottom: 16px;
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
        }
        .brand-name {
          font-size: 21px;
          font-weight: 800;
          letter-spacing: -0.5px;
          color: #0f172a;
          font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
        }
        .brand-accent { color: #5B4BFF; }
        .brand-tagline {
          font-size: 9.5px;
          text-transform: uppercase;
          letter-spacing: 1.5px;
          color: #64748b;
          margin-top: 2px;
          font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
        }
        .company-meta {
          text-align: right;
          font-size: 10px;
          color: #475569;
          font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
          line-height: 1.45;
        }
        .doc-header-meta {
          display: flex;
          justify-content: space-between;
          align-items: flex-end;
          margin-bottom: 18px;
          border-bottom: 1px dashed #cbd5e1;
          padding-bottom: 8px;
          font-size: 11.5px;
        }
        .ref-box { font-family: 'Courier New', monospace; font-weight: bold; color: #1e293b; }
        .doc-title {
          text-align: center;
          font-size: 16px;
          font-weight: 800;
          letter-spacing: 1px;
          text-transform: uppercase;
          color: #0f172a;
          margin: 14px 0 16px;
          font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
          border-top: 1px solid #e2e8f0;
          border-bottom: 1px solid #e2e8f0;
          padding: 8px 0;
        }
        .subject-line {
          font-size: 12.5px;
          color: #0f172a;
          margin: 10px 0 14px;
          font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
        }
        .salutation { font-size: 13px; margin-bottom: 12px; line-height: 1.5; }
        .section-title {
          font-size: 11.8px;
          font-weight: 800;
          text-transform: uppercase;
          letter-spacing: 0.5px;
          color: #0f172a;
          margin-top: 18px;
          margin-bottom: 6px;
          font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
        }
        p {
          margin: 0 0 10px 0;
          text-align: justify;
        }
        .doc-table {
          width: 100%;
          border-collapse: collapse;
          margin: 12px 0;
          font-size: 12px;
          page-break-inside: avoid;
        }
        .doc-table td, .doc-table th {
          padding: 6px 10px;
          border: 1px solid #e2e8f0;
        }
        .signature-section {
          margin-top: 36px;
          display: flex;
          justify-content: space-between;
          align-items: flex-end;
          page-break-inside: avoid;
        }
        .sig-block { width: 230px; text-align: left; }
        .sig-line {
          border-top: 1.5px solid #0f172a;
          margin-bottom: 6px;
          width: 100%;
        }
        .sig-name { font-weight: bold; font-size: 12.5px; color: #0f172a; }
        .sig-title { font-size: 11px; color: #475569; line-height: 1.3; }
        .footer-watermark {
          margin-top: 32px;
          padding-top: 10px;
          border-top: 1px solid #e2e8f0;
          display: flex;
          justify-content: space-between;
          align-items: center;
          font-size: 9px;
          color: #64748b;
          font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
          page-break-inside: avoid;
        }
        .qr-placeholder {
          border: 1px solid #cbd5e1;
          padding: 4px 8px;
          background: #f8fafc;
          border-radius: 4px;
          font-size: 8.5px;
          font-family: monospace;
        }
      </style>
    </head>
    <body>
      <div class="letterhead">
        <div>
          <div class="brand-name">DIGIEXPLODE<span class="brand-accent">AI</span></div>
          <div class="brand-tagline">Digital Dreams, Explosive Results</div>
        </div>
        <div class="company-meta">
          <strong>Digiexplode Digital Media Private Limited</strong><br/>
          Corporate Identity: U72900UP2024PTC189201<br/>
          Innovate Hub, Sector 62, Noida, NCR 201301<br/>
          hr@digiexplode.com | +91 98765 43210
        </div>
      </div>

      <div class="doc-header-meta">
        <div>
          <span style="color: #64748b;">Ref No:</span>
          <span class="ref-box">${referenceNumber}</span>
        </div>
        <div>
          <span style="color: #64748b;">Date of Issuance:</span>
          <strong>${formattedDate}</strong>
        </div>
      </div>

      <div class="doc-title">${getDocTitle(type)}</div>

      <div class="doc-body">
        ${bodyContent}
      </div>

      <div class="signature-section">
        <div class="sig-block">
          <div style="font-size: 11px; color: #64748b; margin-bottom: 26px;">For Digiexplode Digital Media Pvt. Ltd.</div>
          <div class="sig-line"></div>
          <div class="sig-name">${signatory.name || 'Vansh Sharma'}</div>
          <div class="sig-title">${signatory.designation || 'Managing Director & Authorized Signatory'}</div>
        </div>

        <div class="sig-block" style="text-align: right;">
          <div style="font-size: 11px; color: #64748b; margin-bottom: 26px;">Accepted & Agreed (Employee Signature)</div>
          <div class="sig-line"></div>
          <div class="sig-name">${emp.name || 'Employee Full Name'}</div>
          <div class="sig-title">Date: ____________________ | Place: _____________</div>
        </div>
      </div>

      <div class="footer-watermark">
        <div>
          🔐 <strong>Digitally Signed Official Record</strong> | Security Ref: ${referenceNumber}
        </div>
        <div class="qr-placeholder">
          Verification Hash: ${verificationToken.slice(0, 18)}...
        </div>
      </div>
    </body>
    </html>
  `;
};

// Print dialog helper
const triggerCleanPrint = (html: string, title: string) => {
  const iframe = document.createElement('iframe');
  iframe.style.position = 'fixed';
  iframe.style.right = '0';
  iframe.style.bottom = '0';
  iframe.style.width = '0';
  iframe.style.height = '0';
  iframe.style.border = '0';
  document.body.appendChild(iframe);

  const doc = iframe.contentWindow?.document;
  if (!doc) return;
  doc.open();
  doc.write(html);
  doc.close();

  setTimeout(() => {
    try {
      iframe.contentWindow?.focus();
      iframe.contentWindow?.print();
    } catch (e) {
      console.error('Print iframe error:', e);
    } finally {
      setTimeout(() => {
        document.body.removeChild(iframe);
      }, 2000);
    }
  }, 400);
};

export const HRDocumentsView: React.FC = () => {
  const { user, profile } = useAuth();
  const isSuperAdmin = profile?.role === 'super_admin' || profile?.role === 'admin';

  // Master State
  const [employees, setEmployees] = useState<CanonicalEmployee[]>([]);
  const [documents, setDocuments] = useState<HRDocumentRecord[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [activeTab, setActiveTab] = useState<'create' | 'history' | 'verify'>('create');

  // Wizard / Editor State
  const [selectedType, setSelectedType] = useState<DocType>('appointment');
  const [selectedEmpId, setSelectedEmpId] = useState<string>('');
  const [effectiveDate, setEffectiveDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [signatoryName, setSignatoryName] = useState<string>('Vansh Sharma');
  const [signatoryRole, setSignatoryRole] = useState<string>('Managing Director & CEO');
  const [fields, setFields] = useState<Record<string, string>>({
    designation: '',
    department: '',
    reportingManager: 'Director of Growth / Managing Director',
    ctc: '1000000',
    probation: '3 (Three) months',
    location: 'Innovate Hub, Sector 62, Noida (Hybrid)',
    noticePeriod: '30 days',
    joiningDate: '',
    validUntil: '',
    currentCtc: '₹ 5,00,000/- LPA',
    revisedCtc: '₹ 6,50,000/- LPA',
    incrementPercentage: '30%',
    performanceNotes: 'Demonstrated outstanding problem-solving skills, accountability, and team collaboration.',
    appraisalNote: 'Exceeded targets across core client deliverables and led team initiatives with excellence.'
  });

  // Salary Breakdown Items state
  const [salaryBreakdown, setSalaryBreakdown] = useState<SalaryBreakdownItem[]>(() => calculateDefaultBreakdown(1000000));

  // Reference & Token for Current Session
  const [currentRef, setCurrentRef] = useState<string>('DEA/HR/APPT/2026/0042');
  const [currentToken, setCurrentToken] = useState<string>(generateVerificationToken());
  const [savingDoc, setSavingDoc] = useState<boolean>(false);
  const [saveSuccessMsg, setSaveSuccessMsg] = useState<string | null>(null);

  // Modal / Preview State
  const [previewOpen, setPreviewOpen] = useState<boolean>(false);
  const [activePreviewDoc, setActivePreviewDoc] = useState<HRDocumentRecord | null>(null);

  // Verification Search State
  const [verifyQuery, setVerifyQuery] = useState<string>('');
  const [verifyResult, setVerifyResult] = useState<HRDocumentRecord | null>(null);
  const [verifySearching, setVerifySearching] = useState<boolean>(false);
  const [verifySearched, setVerifySearched] = useState<boolean>(false);

  // History Filter State
  const [historySearch, setHistorySearch] = useState<string>('');
  const [historyTypeFilter, setHistoryTypeFilter] = useState<string>('all');
  const [historyStatusFilter, setHistoryStatusFilter] = useState<string>('all');

  // Load Canonical Employees
  useEffect(() => {
    const unsub = subscribeToCanonicalEmployees(
      (list) => {
        setEmployees(list);
        if (list.length > 0 && !selectedEmpId) {
          const first = list[0];
          setSelectedEmpId(first.id);
          autoFillForEmployee(first);
        }
      },
      (err) => console.warn('[HRDocs] Error loading employees:', err)
    );
    return () => unsub();
  }, []);

  // Load Saved HR Documents
  useEffect(() => {
    const unsub = subscribeToHRDocuments(
      (docs) => {
        setDocuments(docs);
        setLoading(false);
      },
      (err) => {
        console.warn('[HRDocs] Error loading documents:', err);
        setLoading(false);
      }
    );
    return () => unsub();
  }, []);

  // Generate new Reference Number when doc type changes
  useEffect(() => {
    let active = true;
    generateDocumentReference(selectedType).then((ref) => {
      if (active) {
        setCurrentRef(ref);
        setCurrentToken(generateVerificationToken());
      }
    });
    return () => { active = false; };
  }, [selectedType]);

  // Handle URL verify parameter on mount
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const verifyTokenParam = params.get('verify');
    if (verifyTokenParam) {
      setActiveTab('verify');
      setVerifyQuery(verifyTokenParam);
      handlePerformVerification(verifyTokenParam);
    }
  }, []);

  // Auto-fill logic when employee selected
  const autoFillForEmployee = (emp: CanonicalEmployee) => {
    const salaryNum = typeof emp.monthlySalary === 'number' ? (emp.monthlySalary * 12) : 1000000;
    setFields(prev => ({
      ...prev,
      designation: emp.role || prev.designation || 'Specialist',
      department: emp.department || prev.department || 'Growth & Ads',
      joiningDate: emp.joiningDate || prev.joiningDate || '2025-01-15',
      ctc: String(salaryNum),
      currentCtc: `₹ ${salaryNum.toLocaleString('en-IN')}/- LPA`,
    }));
    setSalaryBreakdown(calculateDefaultBreakdown(salaryNum));
  };

  const handleSelectEmployee = (empId: string) => {
    setSelectedEmpId(empId);
    const match = employees.find(e => e.id === empId);
    if (match) {
      autoFillForEmployee(match);
    }
  };

  const selectedEmployee = useMemo(() => {
    const match = employees.find(e => e.id === selectedEmpId);
    return {
      id: selectedEmpId || 'emp_default',
      name: match ? match.name : 'Select Employee',
      email: match?.email || '',
      designation: fields.designation || match?.role || 'Specialist',
      department: fields.department || match?.department || 'Operations'
    };
  }, [employees, selectedEmpId, fields.designation, fields.department]);

  // Handle CTC input change
  const handleCtcChange = (newVal: string) => {
    setFields(prev => ({ ...prev, ctc: newVal }));
    const num = parseInt(newVal.replace(/[^0-9]/g, ''), 10);
    if (!isNaN(num) && num > 0) {
      setSalaryBreakdown(calculateDefaultBreakdown(num));
    }
  };

  // Rebalance salary breakdown from current CTC
  const handleRebalanceSalary = () => {
    const num = parseInt(fields.ctc.replace(/[^0-9]/g, ''), 10) || 1000000;
    setSalaryBreakdown(calculateDefaultBreakdown(num));
  };

  // Update specific salary component field
  const handleUpdateSalaryComponent = (id: string, updates: Partial<SalaryBreakdownItem>) => {
    setSalaryBreakdown(prev => prev.map(item => {
      if (item.id !== id) return item;
      const updated = { ...item, ...updates };
      // If monthly updated and annual not explicitly set, auto compute annual
      if (updates.monthly !== undefined && updates.annual === undefined) {
        updated.annual = Math.round(Number(updates.monthly) * 12);
      } else if (updates.annual !== undefined && updates.monthly === undefined) {
        updated.monthly = Math.round(Number(updates.annual) / 12);
      }
      return updated;
    }));
  };

  // Add new custom salary breakdown row
  const handleAddSalaryComponent = () => {
    const newId = 'item_' + Date.now();
    setSalaryBreakdown(prev => [
      ...prev,
      { id: newId, name: 'Special Allowance', monthly: 5000, annual: 60000 }
    ]);
  };

  // Remove salary component row
  const handleRemoveSalaryComponent = (id: string) => {
    if (salaryBreakdown.length <= 1) {
      alert('You must have at least one salary component.');
      return;
    }
    setSalaryBreakdown(prev => prev.filter(item => item.id !== id));
  };

  // Totals for current salary breakdown
  const salaryTotals = useMemo(() => {
    const monthly = salaryBreakdown.reduce((acc, item) => acc + (Number(item.monthly) || 0), 0);
    const annual = salaryBreakdown.reduce((acc, item) => acc + (Number(item.annual) || 0), 0);
    return { monthly, annual };
  }, [salaryBreakdown]);

  // Live generated HTML for current Wizard form
  const currentLiveHTML = useMemo(() => {
    return buildDocumentHTML(
      selectedType,
      {
        ...fields,
        salaryBreakdown: JSON.stringify(salaryBreakdown)
      },
      {
        id: selectedEmployee.id,
        name: selectedEmployee.name,
        email: selectedEmployee.email,
        designation: fields.designation || selectedEmployee.designation,
        department: fields.department || selectedEmployee.department
      },
      currentRef,
      currentToken,
      effectiveDate,
      { name: signatoryName, designation: signatoryRole },
      salaryBreakdown
    );
  }, [selectedType, fields, selectedEmployee, currentRef, currentToken, effectiveDate, signatoryName, signatoryRole, salaryBreakdown]);

  // Start wizard for a specific card type clicked
  const handleStartWizard = (type: DocType) => {
    setSelectedType(type);
    setActiveTab('create');
    window.scrollTo({ top: 380, behavior: 'smooth' });
  };

  // Save Document handler (Draft or Finalized)
  const handleSaveDocument = async (status: DocStatus) => {
    if (!selectedEmployee.name || selectedEmployee.name === 'Select Employee') {
      alert('Please select an employee before saving the document.');
      return;
    }

    setSavingDoc(true);
    setSaveSuccessMsg(null);

    const docRecord: Omit<HRDocumentRecord, 'id'> = {
      referenceNumber: currentRef,
      verificationToken: currentToken,
      type: selectedType,
      status: status,
      employeeId: selectedEmployee.id,
      employeeName: selectedEmployee.name,
      employeeEmail: selectedEmployee.email || '',
      designation: fields.designation || selectedEmployee.designation || 'Specialist',
      department: fields.department || selectedEmployee.department || 'Operations',
      effectiveDate: effectiveDate,
      generatedAt: new Date().toISOString(),
      templateData: {
        ...fields,
        salaryBreakdown: JSON.stringify(salaryBreakdown)
      },
      signatoryName: signatoryName,
      signatoryDesignation: signatoryRole,
      generatedBy: profile?.name || user?.displayName || 'HR Administrator',
      generatedById: user?.uid || 'admin_usr',
      emailSent: false,
      version: 1
    };

    try {
      const newId = await saveHRDocument(docRecord);
      await logHRAuditEvent({
        documentId: newId,
        referenceNumber: currentRef,
        action: status === 'Finalized' ? 'DOCUMENT_FINALIZED' : 'DRAFT_CREATED',
        actorId: user?.uid || 'admin_usr',
        actorName: profile?.name || user?.displayName || 'HR Administrator',
        timestamp: new Date().toISOString(),
        notes: `Created ${selectedType} letter for ${selectedEmployee.name} with Ref ${currentRef}`
      });

      setSaveSuccessMsg(`Document successfully saved as ${status}! Reference: ${currentRef}`);

      // Generate next reference for fresh document
      generateDocumentReference(selectedType).then(ref => {
        setCurrentRef(ref);
        setCurrentToken(generateVerificationToken());
      });

      setTimeout(() => setSaveSuccessMsg(null), 6000);
    } catch (e) {
      console.error('Save doc error:', e);
      alert('Failed to save document. Please check console for details.');
    } finally {
      setSavingDoc(false);
    }
  };

  // Revoke Document
  const handleRevokeDocument = async (docItem: HRDocumentRecord) => {
    const reason = prompt('Please specify the reason for revoking this document:');
    if (!reason) return;

    try {
      await updateHRDocument(docItem.id, { status: 'Revoked' });
      await logHRAuditEvent({
        documentId: docItem.id,
        referenceNumber: docItem.referenceNumber,
        action: 'DOCUMENT_REVOKED',
        actorId: user?.uid || 'admin_usr',
        actorName: profile?.name || user?.displayName || 'HR Administrator',
        timestamp: new Date().toISOString(),
        notes: `Revoked reason: ${reason}`
      });
      alert(`Document ${docItem.referenceNumber} has been revoked.`);
    } catch (e) {
      console.error('Revoke error:', e);
    }
  };

  // Email via Mailto
  const handleEmailDocument = (docItem: HRDocumentRecord) => {
    const subject = encodeURIComponent(`DigiexplodeAI: ${getDocTitle(docItem.type)} — ${docItem.referenceNumber}`);
    const body = encodeURIComponent(
      `Dear ${docItem.employeeName},

Please find your official ${getDocTitle(docItem.type)} (Ref: ${docItem.referenceNumber}) generated on ${new Date(docItem.generatedAt).toLocaleDateString()}.

You can verify the authentic digital certificate using your verification token:
${docItem.verificationToken}

Warm Regards,
DigiexplodeAI HR Team`
    );
    window.open(`mailto:${docItem.employeeEmail || ''}?subject=${subject}&body=${body}`, '_blank');
    updateHRDocument(docItem.id, {
      status: docItem.status === 'Draft' ? 'Draft' : 'Emailed',
      emailSent: true,
      emailSentAt: new Date().toISOString(),
      emailSentTo: docItem.employeeEmail
    });
  };

  // Verification Search
  const handlePerformVerification = async (tokenOrRef: string) => {
    if (!tokenOrRef.trim()) return;
    setVerifySearching(true);
    setVerifySearched(true);
    setVerifyResult(null);

    const queryClean = tokenOrRef.trim();
    const directMatch = documents.find(
      d => d.verificationToken === queryClean || d.referenceNumber.toLowerCase() === queryClean.toLowerCase()
    );

    if (directMatch) {
      setVerifyResult(directMatch);
      setVerifySearching(false);
      return;
    }

    const fetched = await getDocumentByVerificationToken(queryClean);
    setVerifyResult(fetched);
    setVerifySearching(false);
  };

  // Filtered history list
  const filteredHistory = useMemo(() => {
    return documents.filter(doc => {
      const matchSearch =
        doc.employeeName.toLowerCase().includes(historySearch.toLowerCase()) ||
        doc.referenceNumber.toLowerCase().includes(historySearch.toLowerCase()) ||
        doc.designation.toLowerCase().includes(historySearch.toLowerCase());
      const matchType = historyTypeFilter === 'all' || doc.type === historyTypeFilter;
      const matchStatus = historyStatusFilter === 'all' || doc.status === historyStatusFilter;
      return matchSearch && matchType && matchStatus;
    });
  }, [documents, historySearch, historyTypeFilter, historyStatusFilter]);

  // Statistics
  const stats = useMemo(() => {
    return {
      total: documents.length,
      finalized: documents.filter(d => d.status === 'Finalized').length,
      emailed: documents.filter(d => d.status === 'Emailed').length,
      drafts: documents.filter(d => d.status === 'Draft').length,
      revoked: documents.filter(d => d.status === 'Revoked').length,
    };
  }, [documents]);

  return (
    <div style={{ padding: '24px 32px', maxWidth: '1440px', margin: '0 auto', color: '#F8FAFC' }}>
      {/* ── Top Header ────────────────────────────────────────────── */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '24px' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{
              width: '40px', height: '40px', borderRadius: '10px',
              background: 'linear-gradient(135deg, #5B4BFF 0%, #3B82F6 100%)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              boxShadow: '0 4px 12px rgba(91, 75, 255, 0.3)'
            }}>
              <FileText size={22} color="#FFF" />
            </div>
            <div>
              <h1 style={{ fontSize: '24px', fontWeight: 700, margin: 0, letterSpacing: '-0.5px' }}>
                HR Document Generator & Registry
              </h1>
              <p style={{ margin: 0, fontSize: '13px', color: '#94A3B8' }}>
                Generate, customize salary annexures, verify, print, and audit official agency letters.
              </p>
            </div>
          </div>
        </div>

        {/* Top Tab Navigator */}
        <div style={{
          display: 'flex', background: '#171E31', padding: '4px',
          borderRadius: '12px', border: '1px solid #293248', gap: '4px'
        }}>
          <button
            onClick={() => setActiveTab('create')}
            style={{
              padding: '8px 16px', borderRadius: '8px', border: 'none',
              cursor: 'pointer', fontSize: '13px', fontWeight: 600,
              background: activeTab === 'create' ? '#5B4BFF' : 'transparent',
              color: activeTab === 'create' ? '#FFF' : '#94A3B8',
              display: 'flex', alignItems: 'center', gap: '6px',
              transition: 'all 0.2s ease'
            }}
          >
            <Plus size={16} /> Create Document
          </button>
          <button
            onClick={() => setActiveTab('history')}
            style={{
              padding: '8px 16px', borderRadius: '8px', border: 'none',
              cursor: 'pointer', fontSize: '13px', fontWeight: 600,
              background: activeTab === 'history' ? '#5B4BFF' : 'transparent',
              color: activeTab === 'history' ? '#FFF' : '#94A3B8',
              display: 'flex', alignItems: 'center', gap: '6px',
              transition: 'all 0.2s ease'
            }}
          >
            <History size={16} /> Document History ({documents.length})
          </button>
          <button
            onClick={() => setActiveTab('verify')}
            style={{
              padding: '8px 16px', borderRadius: '8px', border: 'none',
              cursor: 'pointer', fontSize: '13px', fontWeight: 600,
              background: activeTab === 'verify' ? '#5B4BFF' : 'transparent',
              color: activeTab === 'verify' ? '#FFF' : '#94A3B8',
              display: 'flex', alignItems: 'center', gap: '6px',
              transition: 'all 0.2s ease'
            }}
          >
            <ShieldCheck size={16} /> QR / Token Verify
          </button>
        </div>
      </div>

      {/* ── Document Type Quick-Cards ─────────────────────────────── */}
      <div style={{
        display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))',
        gap: '14px', marginBottom: '28px'
      }}>
        {DOC_TYPES.map((d) => {
          const isSelected = activeTab === 'create' && selectedType === d.id;
          return (
            <div
              key={d.id}
              onClick={() => handleStartWizard(d.id)}
              style={{
                background: isSelected ? 'rgba(91, 75, 255, 0.12)' : '#171E31',
                border: isSelected ? '1.5px solid #5B4BFF' : '1px solid #293248',
                borderRadius: '12px',
                padding: '16px',
                cursor: 'pointer',
                transition: 'all 0.2s ease',
                position: 'relative',
                overflow: 'hidden'
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '10px' }}>
                <span style={{ fontSize: '24px' }}>{d.icon}</span>
                <span style={{
                  fontSize: '10.5px', fontWeight: 600, padding: '2px 8px', borderRadius: '20px',
                  background: 'rgba(255, 255, 255, 0.06)', color: '#94A3B8'
                }}>
                  {d.badge}
                </span>
              </div>
              <div style={{ fontWeight: 700, fontSize: '14.5px', color: isSelected ? '#5B4BFF' : '#F8FAFC', marginBottom: '4px' }}>
                {d.title}
              </div>
              <div style={{ fontSize: '11.5px', color: '#94A3B8', lineHeight: 1.4 }}>
                {d.description}
              </div>
              {isSelected && (
                <div style={{
                  marginTop: '10px', fontSize: '11px', fontWeight: 600, color: '#5B4BFF',
                  display: 'flex', alignItems: 'center', gap: '4px'
                }}>
                  <Check size={13} /> Active Form Selected
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* ── TAB 1: CREATE / WIZARD VIEW ────────────────────────────── */}
      {activeTab === 'create' && (
        <div>
          {saveSuccessMsg && (
            <div style={{
              background: 'rgba(16, 185, 129, 0.15)', border: '1px solid #10B981',
              borderRadius: '10px', padding: '12px 18px', color: '#10B981',
              marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '10px',
              fontSize: '13.5px', fontWeight: 600
            }}>
              <CheckCircle size={18} /> {saveSuccessMsg}
            </div>
          )}

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.15fr', gap: '24px', alignItems: 'start' }}>
            {/* Left Column: Interactive Form */}
            <div style={{
              background: '#171E31', border: '1px solid #293248',
              borderRadius: '16px', padding: '24px'
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '18px', paddingBottom: '14px', borderBottom: '1px solid #293248' }}>
                <div>
                  <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 700, color: '#F8FAFC' }}>
                    Document Configuration
                  </h3>
                  <p style={{ margin: '2px 0 0', fontSize: '12px', color: '#94A3B8' }}>
                    Auto-filling fields from Employee Master.
                  </p>
                </div>
                <div style={{
                  padding: '4px 10px', borderRadius: '6px', background: 'rgba(91, 75, 255, 0.15)',
                  border: '1px solid rgba(91, 75, 255, 0.4)', fontSize: '11.5px', color: '#A5B4FC',
                  fontFamily: 'monospace', fontWeight: 600
                }}>
                  {currentRef}
                </div>
              </div>

              {/* Step 1: Select Employee */}
              <div style={{ marginBottom: '18px' }}>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#94A3B8', marginBottom: '6px' }}>
                  Target Employee <span style={{ color: '#EF4444' }}>*</span>
                </label>
                <select
                  value={selectedEmpId}
                  onChange={(e) => handleSelectEmployee(e.target.value)}
                  style={{
                    width: '100%', padding: '10px 14px', borderRadius: '8px',
                    background: '#111728', border: '1px solid #293248', color: '#F8FAFC',
                    fontSize: '13px', outline: 'none', cursor: 'pointer'
                  }}
                >
                  <option value="">-- Select Employee from Master --</option>
                  {employees.map((emp) => (
                    <option key={emp.id} value={emp.id}>
                      {emp.name} ({emp.role || 'Staff'} • {emp.department || 'Agency'})
                    </option>
                  ))}
                </select>
              </div>

              {/* Step 2: Historical / Custom Effective Date & Designation */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px', marginBottom: '18px' }}>
                <div>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', fontWeight: 600, color: '#94A3B8', marginBottom: '6px' }}>
                    <Calendar size={13} /> Effective Date {isSuperAdmin && <span style={{ color: '#10B981', fontSize: '10px' }}>(Historical Allowed)</span>}
                  </label>
                  <input
                    type="date"
                    value={effectiveDate}
                    onChange={(e) => setEffectiveDate(e.target.value)}
                    style={{
                      width: '100%', padding: '9px 12px', borderRadius: '8px',
                      background: '#111728', border: '1px solid #293248', color: '#F8FAFC',
                      fontSize: '13px', outline: 'none'
                    }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#94A3B8', marginBottom: '6px' }}>
                    Designation
                  </label>
                  <input
                    type="text"
                    value={fields.designation}
                    onChange={(e) => setFields({ ...fields, designation: e.target.value })}
                    placeholder="e.g. Lead Video Editor"
                    style={{
                      width: '100%', padding: '9px 12px', borderRadius: '8px',
                      background: '#111728', border: '1px solid #293248', color: '#F8FAFC',
                      fontSize: '13px', outline: 'none'
                    }}
                  />
                </div>
              </div>

              {/* Step 3: Type Specific Fields */}
              <div style={{ background: '#111728', padding: '16px', borderRadius: '10px', border: '1px solid #293248', marginBottom: '18px' }}>
                <div style={{ fontSize: '12.5px', fontWeight: 700, color: '#A5B4FC', marginBottom: '12px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                  {selectedType.toUpperCase()} Specific Parameters
                </div>

                {(selectedType === 'appointment' || selectedType === 'offer') && (
                  <div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '14px' }}>
                      <div>
                        <label style={{ display: 'block', fontSize: '11.5px', color: '#94A3B8', marginBottom: '4px' }}>
                          Total Annual CTC (₹)
                        </label>
                        <input
                          type="text"
                          value={fields.ctc}
                          onChange={(e) => handleCtcChange(e.target.value)}
                          placeholder="e.g. 1000000"
                          style={{
                            width: '100%', padding: '8px 10px', borderRadius: '6px',
                            background: '#171E31', border: '1px solid #293248', color: '#F8FAFC',
                            fontSize: '12.5px', outline: 'none'
                          }}
                        />
                      </div>
                      <div>
                        <label style={{ display: 'block', fontSize: '11.5px', color: '#94A3B8', marginBottom: '4px' }}>
                          Probation Period
                        </label>
                        <input
                          type="text"
                          value={fields.probation}
                          onChange={(e) => setFields({ ...fields, probation: e.target.value })}
                          style={{
                            width: '100%', padding: '8px 10px', borderRadius: '6px',
                            background: '#171E31', border: '1px solid #293248', color: '#F8FAFC',
                            fontSize: '12.5px', outline: 'none'
                          }}
                        />
                      </div>
                      <div>
                        <label style={{ display: 'block', fontSize: '11.5px', color: '#94A3B8', marginBottom: '4px' }}>
                          Work Location
                        </label>
                        <input
                          type="text"
                          value={fields.location}
                          onChange={(e) => setFields({ ...fields, location: e.target.value })}
                          style={{
                            width: '100%', padding: '8px 10px', borderRadius: '6px',
                            background: '#171E31', border: '1px solid #293248', color: '#F8FAFC',
                            fontSize: '12.5px', outline: 'none'
                          }}
                        />
                      </div>
                      <div>
                        <label style={{ display: 'block', fontSize: '11.5px', color: '#94A3B8', marginBottom: '4px' }}>
                          Notice Period
                        </label>
                        <input
                          type="text"
                          value={fields.noticePeriod}
                          onChange={(e) => setFields({ ...fields, noticePeriod: e.target.value })}
                          style={{
                            width: '100%', padding: '8px 10px', borderRadius: '6px',
                            background: '#171E31', border: '1px solid #293248', color: '#F8FAFC',
                            fontSize: '12.5px', outline: 'none'
                          }}
                        />
                      </div>
                    </div>

                    {/* ── Dynamic Salary Breakage Builder (Annexure A) ── */}
                    {selectedType === 'appointment' && (
                      <div style={{
                        marginTop: '16px', background: '#171E31', padding: '14px',
                        borderRadius: '10px', border: '1px solid #293248'
                      }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <Calculator size={15} color="#5B4BFF" />
                            <span style={{ fontSize: '12.5px', fontWeight: 700, color: '#F8FAFC' }}>
                              Salary Breakage & Structure (Annexure A)
                            </span>
                          </div>
                          <div style={{ display: 'flex', gap: '6px' }}>
                            <button
                              type="button"
                              onClick={handleRebalanceSalary}
                              title="Auto calculate standard breakdown (45% Basic, 25% HRA, 20% Flexi, 10% Bonus)"
                              style={{
                                padding: '4px 8px', borderRadius: '6px', border: '1px solid #293248',
                                background: '#111728', color: '#94A3B8', fontSize: '11px',
                                cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px'
                              }}
                            >
                              <RefreshCw size={11} /> Auto Rebalance
                            </button>
                            <button
                              type="button"
                              onClick={handleAddSalaryComponent}
                              style={{
                                padding: '4px 10px', borderRadius: '6px', border: 'none',
                                background: '#5B4BFF', color: '#FFF', fontSize: '11px',
                                fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px'
                              }}
                            >
                              <Plus size={12} /> Add Field
                            </button>
                          </div>
                        </div>

                        {/* Salary Component Rows */}
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '12px' }}>
                          {salaryBreakdown.map((item, index) => (
                            <div
                              key={item.id}
                              style={{
                                display: 'grid', gridTemplateColumns: '1.6fr 1fr 1fr 32px',
                                gap: '8px', alignItems: 'center', background: '#111728',
                                padding: '8px 10px', borderRadius: '8px', border: '1px solid #293248'
                              }}
                            >
                              <input
                                type="text"
                                value={item.name}
                                onChange={(e) => handleUpdateSalaryComponent(item.id, { name: e.target.value })}
                                placeholder="Component Name"
                                style={{
                                  padding: '6px 8px', borderRadius: '6px', background: '#171E31',
                                  border: '1px solid #293248', color: '#F8FAFC', fontSize: '12px', outline: 'none'
                                }}
                              />
                              <div>
                                <input
                                  type="number"
                                  value={item.monthly}
                                  onChange={(e) => handleUpdateSalaryComponent(item.id, { monthly: Number(e.target.value) || 0 })}
                                  placeholder="Monthly (₹)"
                                  style={{
                                    width: '100%', padding: '6px 8px', borderRadius: '6px', background: '#171E31',
                                    border: '1px solid #293248', color: '#F8FAFC', fontSize: '12px',
                                    fontFamily: 'monospace', outline: 'none'
                                  }}
                                />
                              </div>
                              <div>
                                <input
                                  type="number"
                                  value={item.annual}
                                  onChange={(e) => handleUpdateSalaryComponent(item.id, { annual: Number(e.target.value) || 0 })}
                                  placeholder="Annual (₹)"
                                  style={{
                                    width: '100%', padding: '6px 8px', borderRadius: '6px', background: '#171E31',
                                    border: '1px solid #293248', color: '#F8FAFC', fontSize: '12px',
                                    fontFamily: 'monospace', outline: 'none'
                                  }}
                                />
                              </div>
                              <button
                                type="button"
                                onClick={() => handleRemoveSalaryComponent(item.id)}
                                title="Remove component"
                                style={{
                                  background: 'transparent', border: 'none', color: '#EF4444',
                                  cursor: 'pointer', padding: '4px', display: 'flex', alignItems: 'center', justifyContent: 'center'
                                }}
                              >
                                <Trash2 size={14} />
                              </button>
                            </div>
                          ))}
                        </div>

                        {/* Salary Total Summary Strip */}
                        <div style={{
                          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                          padding: '8px 12px', background: '#111728', borderRadius: '8px',
                          border: '1px dashed #3B82F6', fontSize: '12px'
                        }}>
                          <span style={{ fontWeight: 700, color: '#94A3B8' }}>Calculated Total CTC:</span>
                          <div style={{ display: 'flex', gap: '12px', fontFamily: 'monospace', fontWeight: 700 }}>
                            <span style={{ color: '#60A5FA' }}>Monthly: ₹ {salaryTotals.monthly.toLocaleString('en-IN')}</span>
                            <span style={{ color: '#10B981' }}>Annual: ₹ {salaryTotals.annual.toLocaleString('en-IN')}</span>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {selectedType === 'increment' && (
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                    <div>
                      <label style={{ display: 'block', fontSize: '11.5px', color: '#94A3B8', marginBottom: '4px' }}>
                        Current CTC
                      </label>
                      <input
                        type="text"
                        value={fields.currentCtc}
                        onChange={(e) => setFields({ ...fields, currentCtc: e.target.value })}
                        style={{
                          width: '100%', padding: '8px 10px', borderRadius: '6px',
                          background: '#171E31', border: '1px solid #293248', color: '#F8FAFC',
                          fontSize: '12.5px', outline: 'none'
                        }}
                      />
                    </div>
                    <div>
                      <label style={{ display: 'block', fontSize: '11.5px', color: '#94A3B8', marginBottom: '4px' }}>
                        Revised CTC
                      </label>
                      <input
                        type="text"
                        value={fields.revisedCtc}
                        onChange={(e) => setFields({ ...fields, revisedCtc: e.target.value })}
                        style={{
                          width: '100%', padding: '8px 10px', borderRadius: '6px',
                          background: '#171E31', border: '1px solid #293248', color: '#F8FAFC',
                          fontSize: '12.5px', outline: 'none'
                        }}
                      />
                    </div>
                    <div style={{ gridColumn: 'span 2' }}>
                      <label style={{ display: 'block', fontSize: '11.5px', color: '#94A3B8', marginBottom: '4px' }}>
                        Increment Percentage & Appraisal Note
                      </label>
                      <input
                        type="text"
                        value={fields.appraisalNote}
                        onChange={(e) => setFields({ ...fields, appraisalNote: e.target.value })}
                        style={{
                          width: '100%', padding: '8px 10px', borderRadius: '6px',
                          background: '#171E31', border: '1px solid #293248', color: '#F8FAFC',
                          fontSize: '12.5px', outline: 'none'
                        }}
                      />
                    </div>
                  </div>
                )}

                {(selectedType === 'relieving' || selectedType === 'experience') && (
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                    <div>
                      <label style={{ display: 'block', fontSize: '11.5px', color: '#94A3B8', marginBottom: '4px' }}>
                        Joining Date
                      </label>
                      <input
                        type="date"
                        value={fields.joiningDate}
                        onChange={(e) => setFields({ ...fields, joiningDate: e.target.value })}
                        style={{
                          width: '100%', padding: '8px 10px', borderRadius: '6px',
                          background: '#171E31', border: '1px solid #293248', color: '#F8FAFC',
                          fontSize: '12.5px', outline: 'none'
                        }}
                      />
                    </div>
                    <div>
                      <label style={{ display: 'block', fontSize: '11.5px', color: '#94A3B8', marginBottom: '4px' }}>
                        Last Working Date
                      </label>
                      <input
                        type="date"
                        value={effectiveDate}
                        onChange={(e) => setEffectiveDate(e.target.value)}
                        style={{
                          width: '100%', padding: '8px 10px', borderRadius: '6px',
                          background: '#171E31', border: '1px solid #293248', color: '#F8FAFC',
                          fontSize: '12.5px', outline: 'none'
                        }}
                      />
                    </div>
                    <div style={{ gridColumn: 'span 2' }}>
                      <label style={{ display: 'block', fontSize: '11.5px', color: '#94A3B8', marginBottom: '4px' }}>
                        Performance / Conduct Notes
                      </label>
                      <textarea
                        rows={3}
                        value={fields.performanceNotes}
                        onChange={(e) => setFields({ ...fields, performanceNotes: e.target.value })}
                        style={{
                          width: '100%', padding: '8px 10px', borderRadius: '6px',
                          background: '#171E31', border: '1px solid #293248', color: '#F8FAFC',
                          fontSize: '12.5px', outline: 'none', resize: 'vertical'
                        }}
                      />
                    </div>
                  </div>
                )}
              </div>

              {/* Step 4: Authorized Signatory */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px', marginBottom: '24px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '11.5px', color: '#94A3B8', marginBottom: '4px' }}>
                    Signatory Name
                  </label>
                  <input
                    type="text"
                    value={signatoryName}
                    onChange={(e) => setSignatoryName(e.target.value)}
                    style={{
                      width: '100%', padding: '8px 12px', borderRadius: '6px',
                      background: '#111728', border: '1px solid #293248', color: '#F8FAFC',
                      fontSize: '12.5px', outline: 'none'
                    }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '11.5px', color: '#94A3B8', marginBottom: '4px' }}>
                    Signatory Designation
                  </label>
                  <input
                    type="text"
                    value={signatoryRole}
                    onChange={(e) => setSignatoryRole(e.target.value)}
                    style={{
                      width: '100%', padding: '8px 12px', borderRadius: '6px',
                      background: '#111728', border: '1px solid #293248', color: '#F8FAFC',
                      fontSize: '12.5px', outline: 'none'
                    }}
                  />
                </div>
              </div>

              {/* Action Buttons */}
              <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                <button
                  type="button"
                  onClick={() => handleSaveDocument('Draft')}
                  disabled={savingDoc}
                  style={{
                    flex: 1, padding: '10px 14px', borderRadius: '8px', border: '1px solid #293248',
                    background: '#111728', color: '#F8FAFC', fontSize: '13px', fontWeight: 600,
                    cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px'
                  }}
                >
                  <Archive size={15} /> Save Draft
                </button>
                <button
                  type="button"
                  onClick={() => triggerCleanPrint(currentLiveHTML, `${selectedType}_${selectedEmployee.name}`)}
                  style={{
                    flex: 1, padding: '10px 14px', borderRadius: '8px', border: '1px solid #3B82F6',
                    background: 'rgba(59, 130, 246, 0.15)', color: '#60A5FA', fontSize: '13px',
                    fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center',
                    justifyContent: 'center', gap: '6px'
                  }}
                >
                  <Printer size={15} /> Print / PDF
                </button>
                <button
                  type="button"
                  onClick={() => handleSaveDocument('Finalized')}
                  disabled={savingDoc}
                  style={{
                    flex: 1.4, padding: '10px 16px', borderRadius: '8px', border: 'none',
                    background: 'linear-gradient(135deg, #5B4BFF 0%, #3B82F6 100%)', color: '#FFF',
                    fontSize: '13px', fontWeight: 700, cursor: 'pointer', display: 'flex',
                    alignItems: 'center', justifyContent: 'center', gap: '6px',
                    boxShadow: '0 4px 14px rgba(91, 75, 255, 0.35)'
                  }}
                >
                  {savingDoc ? <Loader2 size={16} className="animate-spin" /> : <ShieldCheck size={16} />}
                  Finalize & Register
                </button>
              </div>
            </div>

            {/* Right Column: Live A4 Interactive Preview */}
            <div style={{ position: 'sticky', top: '20px' }}>
              <div style={{
                background: '#171E31', border: '1px solid #293248',
                borderRadius: '16px', padding: '18px 20px', marginBottom: '14px',
                display: 'flex', justifyContent: 'space-between', alignItems: 'center'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Eye size={17} color="#5B4BFF" />
                  <span style={{ fontSize: '14px', fontWeight: 700 }}>Real-Time A4 Document Preview</span>
                </div>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <button
                    onClick={() => {
                      navigator.clipboard.writeText(currentToken);
                      alert('Verification token copied to clipboard: ' + currentToken);
                    }}
                    style={{
                      padding: '6px 12px', borderRadius: '6px', border: '1px solid #293248',
                      background: '#111728', color: '#94A3B8', fontSize: '11.5px',
                      cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px'
                    }}
                  >
                    <Copy size={12} /> Copy Token
                  </button>
                  <button
                    onClick={() => triggerCleanPrint(currentLiveHTML, 'preview_doc')}
                    style={{
                      padding: '6px 12px', borderRadius: '6px', border: 'none',
                      background: '#5B4BFF', color: '#FFF', fontSize: '11.5px',
                      fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px'
                    }}
                  >
                    <Download size={12} /> Export PDF
                  </button>
                </div>
              </div>

              {/* Scaled A4 Sheet Container */}
              <div style={{
                background: '#525659',
                padding: '24px',
                borderRadius: '12px',
                boxShadow: 'inset 0 2px 8px rgba(0, 0, 0, 0.4)',
                overflowX: 'auto',
                display: 'flex',
                justifyContent: 'center'
              }}>
                <div
                  style={{
                    width: '100%',
                    maxWidth: '680px',
                    minHeight: '880px',
                    background: '#FFFFFF',
                    boxShadow: '0 8px 30px rgba(0,0,0,0.3)',
                    borderRadius: '2px',
                    overflow: 'hidden'
                  }}
                >
                  <iframe
                    title="Live Preview"
                    srcDoc={currentLiveHTML}
                    style={{
                      width: '100%',
                      height: '880px',
                      border: 'none',
                      background: '#FFFFFF'
                    }}
                  />
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── TAB 2: DOCUMENT HISTORY & AUDIT LOG ────────────────────── */}
      {activeTab === 'history' && (
        <div style={{ background: '#171E31', border: '1px solid #293248', borderRadius: '16px', padding: '24px' }}>
          {/* Stats Bar */}
          <div style={{
            display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '12px',
            marginBottom: '20px', paddingBottom: '20px', borderBottom: '1px solid #293248'
          }}>
            <div style={{ background: '#111728', padding: '12px 16px', borderRadius: '10px', border: '1px solid #293248' }}>
              <div style={{ fontSize: '11.5px', color: '#94A3B8' }}>Total Documents</div>
              <div style={{ fontSize: '20px', fontWeight: 800, color: '#F8FAFC' }}>{stats.total}</div>
            </div>
            <div style={{ background: '#111728', padding: '12px 16px', borderRadius: '10px', border: '1px solid #293248' }}>
              <div style={{ fontSize: '11.5px', color: '#10B981' }}>Finalized</div>
              <div style={{ fontSize: '20px', fontWeight: 800, color: '#10B981' }}>{stats.finalized}</div>
            </div>
            <div style={{ background: '#111728', padding: '12px 16px', borderRadius: '10px', border: '1px solid #293248' }}>
              <div style={{ fontSize: '11.5px', color: '#3B82F6' }}>Emailed</div>
              <div style={{ fontSize: '20px', fontWeight: 800, color: '#60A5FA' }}>{stats.emailed}</div>
            </div>
            <div style={{ background: '#111728', padding: '12px 16px', borderRadius: '10px', border: '1px solid #293248' }}>
              <div style={{ fontSize: '11.5px', color: '#F59E0B' }}>Drafts</div>
              <div style={{ fontSize: '20px', fontWeight: 800, color: '#FBBF24' }}>{stats.drafts}</div>
            </div>
            <div style={{ background: '#111728', padding: '12px 16px', borderRadius: '10px', border: '1px solid #293248' }}>
              <div style={{ fontSize: '11.5px', color: '#EF4444' }}>Revoked</div>
              <div style={{ fontSize: '20px', fontWeight: 800, color: '#F87171' }}>{stats.revoked}</div>
            </div>
          </div>

          {/* Search & Filter Filters */}
          <div style={{ display: 'flex', gap: '12px', marginBottom: '20px', flexWrap: 'wrap' }}>
            <div style={{ position: 'relative', flex: 1, minWidth: '240px' }}>
              <Search size={16} color="#64748b" style={{ position: 'absolute', left: '12px', top: '12px' }} />
              <input
                type="text"
                placeholder="Search by Employee, Ref #, or Designation..."
                value={historySearch}
                onChange={(e) => setHistorySearch(e.target.value)}
                style={{
                  width: '100%', padding: '10px 14px 10px 38px', borderRadius: '8px',
                  background: '#111728', border: '1px solid #293248', color: '#F8FAFC',
                  fontSize: '13px', outline: 'none'
                }}
              />
            </div>

            <select
              value={historyTypeFilter}
              onChange={(e) => setHistoryTypeFilter(e.target.value)}
              style={{
                padding: '10px 14px', borderRadius: '8px', background: '#111728',
                border: '1px solid #293248', color: '#F8FAFC', fontSize: '13px', outline: 'none'
              }}
            >
              <option value="all">All Document Types</option>
              <option value="appointment">Appointment Letter</option>
              <option value="offer">Offer Letter</option>
              <option value="relieving">Relieving Letter</option>
              <option value="experience">Experience Certificate</option>
              <option value="increment">Increment Letter</option>
            </select>

            <select
              value={historyStatusFilter}
              onChange={(e) => setHistoryStatusFilter(e.target.value)}
              style={{
                padding: '10px 14px', borderRadius: '8px', background: '#111728',
                border: '1px solid #293248', color: '#F8FAFC', fontSize: '13px', outline: 'none'
              }}
            >
              <option value="all">All Statuses</option>
              <option value="Finalized">Finalized</option>
              <option value="Emailed">Emailed</option>
              <option value="Draft">Draft</option>
              <option value="Revoked">Revoked</option>
            </select>
          </div>

          {/* Table of Records */}
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '13px' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid #293248', color: '#94A3B8', fontSize: '12px' }}>
                  <th style={{ padding: '12px 14px' }}>Reference & Type</th>
                  <th style={{ padding: '12px 14px' }}>Employee</th>
                  <th style={{ padding: '12px 14px' }}>Effective Date</th>
                  <th style={{ padding: '12px 14px' }}>Status</th>
                  <th style={{ padding: '12px 14px' }}>Generated By</th>
                  <th style={{ padding: '12px 14px', textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredHistory.length === 0 ? (
                  <tr>
                    <td colSpan={6} style={{ textAlign: 'center', padding: '40px', color: '#64748b' }}>
                      <FileText size={32} style={{ margin: '0 auto 8px', display: 'block', opacity: 0.4 }} />
                      No document records found matching your filters.
                    </td>
                  </tr>
                ) : (
                  filteredHistory.map((doc) => {
                    const statusColors: Record<DocStatus, { bg: string; text: string; border: string }> = {
                      Finalized: { bg: 'rgba(16, 185, 129, 0.12)', text: '#10B981', border: '#10B981' },
                      Emailed:   { bg: 'rgba(59, 130, 246, 0.12)', text: '#60A5FA', border: '#3B82F6' },
                      Draft:     { bg: 'rgba(245, 158, 11, 0.12)', text: '#FBBF24', border: '#F59E0B' },
                      Revoked:   { bg: 'rgba(239, 68, 68, 0.12)',  text: '#F87171', border: '#EF4444' },
                    };
                    const sc = statusColors[doc.status] || statusColors.Draft;

                    const docHtml = buildDocumentHTML(
                      doc.type,
                      doc.templateData || {},
                      { id: doc.employeeId, name: doc.employeeName, email: doc.employeeEmail, designation: doc.designation, department: doc.department },
                      doc.referenceNumber,
                      doc.verificationToken,
                      doc.effectiveDate,
                      { name: doc.signatoryName || 'Vansh Sharma', designation: doc.signatoryDesignation || 'Managing Director' }
                    );

                    return (
                      <tr key={doc.id} style={{ borderBottom: '1px solid rgba(41, 50, 72, 0.6)' }}>
                        <td style={{ padding: '14px' }}>
                          <div style={{ fontWeight: 700, fontFamily: 'monospace', color: '#F8FAFC' }}>
                            {doc.referenceNumber}
                          </div>
                          <div style={{ fontSize: '11.5px', color: '#94A3B8', textTransform: 'capitalize' }}>
                            {doc.type} Letter
                          </div>
                        </td>
                        <td style={{ padding: '14px' }}>
                          <div style={{ fontWeight: 600, color: '#F8FAFC' }}>{doc.employeeName}</div>
                          <div style={{ fontSize: '11.5px', color: '#64748b' }}>{doc.designation} • {doc.department}</div>
                        </td>
                        <td style={{ padding: '14px', color: '#CBD5E1' }}>
                          {new Date(doc.effectiveDate || doc.generatedAt).toLocaleDateString()}
                        </td>
                        <td style={{ padding: '14px' }}>
                          <span style={{
                            padding: '3px 8px', borderRadius: '6px', fontSize: '11px', fontWeight: 700,
                            background: sc.bg, color: sc.text, border: `1px solid ${sc.border}`
                          }}>
                            {doc.status}
                          </span>
                        </td>
                        <td style={{ padding: '14px', fontSize: '12px', color: '#94A3B8' }}>
                          {doc.generatedBy}
                        </td>
                        <td style={{ padding: '14px', textAlign: 'right' }}>
                          <div style={{ display: 'flex', gap: '6px', justifyContent: 'flex-end' }}>
                            <button
                              onClick={() => {
                                setActivePreviewDoc(doc);
                                setPreviewOpen(true);
                              }}
                              title="Quick View"
                              style={{
                                padding: '6px', borderRadius: '6px', background: '#111728',
                                border: '1px solid #293248', color: '#94A3B8', cursor: 'pointer'
                              }}
                            >
                              <Eye size={14} />
                            </button>
                            <button
                              onClick={() => triggerCleanPrint(docHtml, `${doc.type}_${doc.employeeName}`)}
                              title="Print / PDF"
                              style={{
                                padding: '6px', borderRadius: '6px', background: '#111728',
                                border: '1px solid #293248', color: '#60A5FA', cursor: 'pointer'
                              }}
                            >
                              <Printer size={14} />
                            </button>
                            <button
                              onClick={() => handleEmailDocument(doc)}
                              title="Send Email"
                              style={{
                                padding: '6px', borderRadius: '6px', background: '#111728',
                                border: '1px solid #293248', color: '#10B981', cursor: 'pointer'
                              }}
                            >
                              <Mail size={14} />
                            </button>
                            {doc.status !== 'Revoked' && (
                              <button
                                onClick={() => handleRevokeDocument(doc)}
                                title="Revoke Certificate"
                                style={{
                                  padding: '6px', borderRadius: '6px', background: '#111728',
                                  border: '1px solid #293248', color: '#EF4444', cursor: 'pointer'
                                }}
                              >
                                <Trash2 size={14} />
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── TAB 3: VERIFY BY TOKEN OR REFERENCE ────────────────────── */}
      {activeTab === 'verify' && (
        <div style={{ maxWidth: '780px', margin: '0 auto', background: '#171E31', border: '1px solid #293248', borderRadius: '16px', padding: '32px' }}>
          <div style={{ textAlign: 'center', marginBottom: '28px' }}>
            <div style={{
              width: '56px', height: '56px', borderRadius: '16px',
              background: 'linear-gradient(135deg, #10B981 0%, #059669 100%)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              margin: '0 auto 14px', boxShadow: '0 6px 18px rgba(16, 185, 129, 0.3)'
            }}>
              <ShieldCheck size={30} color="#FFF" />
            </div>
            <h2 style={{ fontSize: '20px', fontWeight: 700, margin: '0 0 6px', color: '#F8FAFC' }}>
              Official HR Document Authentication Portal
            </h2>
            <p style={{ fontSize: '13px', color: '#94A3B8', margin: 0 }}>
              Verify the authenticity of any DigiexplodeAI issued letter, offer, or certificate.
            </p>
          </div>

          <div style={{ display: 'flex', gap: '10px', marginBottom: '24px' }}>
            <input
              type="text"
              placeholder="Enter Document Reference (e.g. DEA/HR/APPT/2026/0042) or 48-char Token..."
              value={verifyQuery}
              onChange={(e) => setVerifyQuery(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handlePerformVerification(verifyQuery)}
              style={{
                flex: 1, padding: '12px 16px', borderRadius: '10px',
                background: '#111728', border: '1px solid #293248', color: '#F8FAFC',
                fontSize: '13.5px', outline: 'none'
              }}
            />
            <button
              onClick={() => handlePerformVerification(verifyQuery)}
              disabled={verifySearching}
              style={{
                padding: '12px 22px', borderRadius: '10px', border: 'none',
                background: '#10B981', color: '#FFF', fontWeight: 700, fontSize: '13.5px',
                cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px'
              }}
            >
              {verifySearching ? <Loader2 size={16} className="animate-spin" /> : <ShieldCheck size={16} />}
              Verify Now
            </button>
          </div>

          {verifySearched && (
            <div>
              {verifyResult ? (
                <div style={{
                  background: 'rgba(16, 185, 129, 0.08)', border: '1.5px solid #10B981',
                  borderRadius: '12px', padding: '24px'
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '16px' }}>
                    <CheckCircle size={24} color="#10B981" />
                    <div>
                      <div style={{ fontSize: '16px', fontWeight: 800, color: '#10B981' }}>
                        Authentic Document Verified
                      </div>
                      <div style={{ fontSize: '12px', color: '#94A3B8' }}>
                        Issued by DigiexplodeAI HR Authority
                      </div>
                    </div>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', fontSize: '13px', background: '#111728', padding: '16px', borderRadius: '8px' }}>
                    <div><span style={{ color: '#64748b' }}>Reference No:</span> <strong style={{ color: '#F8FAFC', fontFamily: 'monospace' }}>{verifyResult.referenceNumber}</strong></div>
                    <div><span style={{ color: '#64748b' }}>Document Type:</span> <strong style={{ color: '#F8FAFC', textTransform: 'capitalize' }}>{verifyResult.type} Letter</strong></div>
                    <div><span style={{ color: '#64748b' }}>Employee Name:</span> <strong style={{ color: '#F8FAFC' }}>{verifyResult.employeeName}</strong></div>
                    <div><span style={{ color: '#64748b' }}>Designation:</span> <strong style={{ color: '#F8FAFC' }}>{verifyResult.designation}</strong></div>
                    <div><span style={{ color: '#64748b' }}>Status:</span> <strong style={{ color: verifyResult.status === 'Revoked' ? '#EF4444' : '#10B981' }}>{verifyResult.status}</strong></div>
                    <div><span style={{ color: '#64748b' }}>Effective Date:</span> <strong style={{ color: '#F8FAFC' }}>{new Date(verifyResult.effectiveDate).toLocaleDateString()}</strong></div>
                  </div>
                </div>
              ) : (
                <div style={{
                  background: 'rgba(239, 68, 68, 0.08)', border: '1.5px solid #EF4444',
                  borderRadius: '12px', padding: '24px', textAlign: 'center'
                }}>
                  <ShieldAlert size={32} color="#EF4444" style={{ margin: '0 auto 8px' }} />
                  <div style={{ fontSize: '16px', fontWeight: 700, color: '#EF4444', marginBottom: '4px' }}>
                    Document Not Found or Invalid Token
                  </div>
                  <div style={{ fontSize: '12.5px', color: '#94A3B8' }}>
                    No valid registered HR document exists with this verification string.
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* ── Modal Preview ─────────────────────────────────────────── */}
      {previewOpen && activePreviewDoc && (
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)',
          zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center',
          padding: '24px'
        }}>
          <div style={{
            background: '#171E31', border: '1px solid #293248', borderRadius: '16px',
            width: '100%', maxWidth: '840px', maxHeight: '92vh', display: 'flex',
            flexDirection: 'column', overflow: 'hidden'
          }}>
            <div style={{
              padding: '16px 20px', borderBottom: '1px solid #293248',
              display: 'flex', justifyContent: 'space-between', alignItems: 'center'
            }}>
              <div style={{ fontWeight: 700, fontSize: '15px' }}>
                {activePreviewDoc.referenceNumber} — {activePreviewDoc.employeeName}
              </div>
              <button
                onClick={() => setPreviewOpen(false)}
                style={{
                  background: 'transparent', border: 'none', color: '#94A3B8',
                  cursor: 'pointer', padding: '4px'
                }}
              >
                <X size={20} />
              </button>
            </div>
            <div style={{ flex: 1, overflowY: 'auto', padding: '20px', background: '#525659' }}>
              <iframe
                title="Full Preview"
                srcDoc={buildDocumentHTML(
                  activePreviewDoc.type,
                  activePreviewDoc.templateData || {},
                  { id: activePreviewDoc.employeeId, name: activePreviewDoc.employeeName, email: activePreviewDoc.employeeEmail, designation: activePreviewDoc.designation, department: activePreviewDoc.department },
                  activePreviewDoc.referenceNumber,
                  activePreviewDoc.verificationToken,
                  activePreviewDoc.effectiveDate,
                  { name: activePreviewDoc.signatoryName || 'Vansh Sharma', designation: activePreviewDoc.signatoryDesignation || 'Managing Director' }
                )}
                style={{ width: '100%', height: '700px', border: 'none', background: '#FFFFFF' }}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
