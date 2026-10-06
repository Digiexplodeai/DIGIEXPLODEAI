import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useAuth } from '../../context/AuthContext';
import {
  CreditCard, Plus, Download, Eye, Printer, CheckCircle, AlertCircle,
  Loader2, Send, ChevronDown, Users, Calendar, DollarSign, X,
  TrendingUp, FileCheck, MoreVertical, Edit3, Lock, Check,
  AlertTriangle, RefreshCw, Calculator, FileText, ChevronRight,
  ShieldCheck, ArrowRight, CornerDownRight, Trash2, SlidersHorizontal
} from 'lucide-react';
import { collection, onSnapshot, getDocs } from 'firebase/firestore';
import { db } from '../../lib/firebase';
import {
  subscribeToCanonicalEmployees,
  CanonicalEmployee,
  matchEmployeeToRecord,
  isTimestampInMonthRange
} from '../../lib/employeeMaster';
import {
  PayrollRecord,
  PayrollStatus,
  SalaryEarnings,
  SalaryDeductions,
  AttendanceSummary,
  subscribeToPayrollRecords,
  savePayrollRecord,
  updatePayrollRecord,
  deletePayrollDraft,
  generatePayslipReference,
  parseEmployeeAnnualSalary,
  calculateDraftSalaryStructure,
  compileEmployeeAttendanceSummary,
  calculateWorkingDaysInMonth
} from '../../lib/payrollStorage';

// ── Number to Words Helper (Indian Currency) ───────────────────────────
function numberToWords(num: number): string {
  if (num === 0) return 'Zero Rupees Only';
  const a = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen'];
  const b = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];

  function inWords(n: number): string {
    if (n < 20) return a[n];
    if (n < 100) return b[Math.floor(n / 10)] + (n % 10 !== 0 ? ' ' + a[n % 10] : '');
    if (n < 1000) return a[Math.floor(n / 100)] + ' Hundred' + (n % 100 !== 0 ? ' and ' + inWords(n % 100) : '');
    if (n < 100000) return inWords(Math.floor(n / 1000)) + ' Thousand' + (n % 1000 !== 0 ? ' ' + inWords(n % 1000) : '');
    if (n < 10000000) return inWords(Math.floor(n / 100000)) + ' Lakh' + (n % 100000 !== 0 ? ' ' + inWords(n % 100000) : '');
    return inWords(Math.floor(n / 10000000)) + ' Crore' + (n % 10000000 !== 0 ? ' ' + inWords(n % 10000000) : '');
  }

  return inWords(Math.round(num)) + ' Rupees Only';
}

// ── A4 Printable Payslip Generator ─────────────────────────────────────
export const buildPayslipHTML = (p: PayrollRecord, monthLabel: string): string => {
  const fmt = (n: number) => `₹${(n || 0).toLocaleString('en-IN')}`;

  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <title>Payslip — ${p.employeeName} — ${monthLabel}</title>
      <style>
        @page { size: A4 portrait; margin: 15mm 14mm 15mm 14mm; }
        * { box-sizing: border-box; }
        body {
          font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
          color: #0f172a;
          background: #ffffff;
          line-height: 1.5;
          font-size: 12.5px;
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
          font-size: 20px;
          font-weight: 900;
          letter-spacing: -0.5px;
          color: #0f172a;
        }
        .brand-accent { color: #5B4BFF; }
        .brand-tagline {
          font-size: 9.5px;
          text-transform: uppercase;
          letter-spacing: 1.5px;
          color: #64748b;
          margin-top: 2px;
          font-weight: 600;
        }
        .company-meta {
          text-align: right;
          font-size: 10px;
          color: #475569;
          line-height: 1.4;
        }
        .payslip-badge-bar {
          display: flex;
          justify-content: space-between;
          align-items: center;
          background: #f8fafc;
          border: 1px solid #e2e8f0;
          border-radius: 8px;
          padding: 8px 14px;
          margin-bottom: 16px;
        }
        .payslip-title {
          font-size: 14px;
          font-weight: 800;
          text-transform: uppercase;
          letter-spacing: 0.5px;
          color: #0f172a;
        }
        .payslip-ref {
          font-family: 'Courier New', monospace;
          font-size: 11px;
          font-weight: 700;
          color: #334155;
        }
        .employee-card {
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          gap: 10px;
          background: #ffffff;
          border: 1px solid #e2e8f0;
          border-radius: 8px;
          padding: 12px 14px;
          margin-bottom: 16px;
          font-size: 11.5px;
        }
        .field-label {
          font-size: 9.5px;
          color: #64748b;
          text-transform: uppercase;
          letter-spacing: 0.5px;
          margin-bottom: 2px;
          font-weight: 600;
        }
        .field-val {
          font-weight: 700;
          color: #0f172a;
        }
        .attendance-strip {
          display: flex;
          justify-content: space-between;
          background: #f1f5f9;
          border-radius: 6px;
          padding: 8px 14px;
          margin-bottom: 16px;
          font-size: 11px;
        }
        .att-item { text-align: center; }
        .att-num { font-weight: 800; color: #0f172a; font-size: 12.5px; }
        .salary-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 14px;
          margin-bottom: 16px;
        }
        .table-box {
          border: 1px solid #e2e8f0;
          border-radius: 8px;
          overflow: hidden;
        }
        .table-head {
          background: #f8fafc;
          padding: 8px 12px;
          font-weight: 800;
          font-size: 11px;
          text-transform: uppercase;
          letter-spacing: 0.5px;
          border-bottom: 1px solid #e2e8f0;
          display: flex;
          justify-content: space-between;
        }
        .table-row {
          display: flex;
          justify-content: space-between;
          padding: 6px 12px;
          border-bottom: 1px solid #f1f5f9;
          font-size: 11.5px;
        }
        .table-row.alt { background: #fafafa; }
        .table-total-row {
          display: flex;
          justify-content: space-between;
          padding: 8px 12px;
          background: #f8fafc;
          font-weight: 800;
          border-top: 1.5px solid #cbd5e1;
          font-size: 12px;
        }
        .net-pay-banner {
          background: #0f172a;
          color: #ffffff;
          border-radius: 8px;
          padding: 14px 18px;
          margin-bottom: 20px;
          display: flex;
          justify-content: space-between;
          align-items: center;
        }
        .net-amount {
          font-size: 22px;
          font-weight: 900;
          color: #10B981;
          font-family: 'Courier New', monospace;
        }
        .net-words {
          font-size: 11px;
          color: #94a3b8;
          font-style: italic;
          margin-top: 2px;
        }
        .signature-section {
          margin-top: 36px;
          display: flex;
          justify-content: space-between;
          align-items: flex-end;
          page-break-inside: avoid;
        }
        .sig-block { width: 220px; text-align: left; }
        .sig-line {
          border-top: 1.5px solid #0f172a;
          margin-bottom: 6px;
          width: 100%;
        }
        .sig-name { font-weight: bold; font-size: 12px; color: #0f172a; }
        .sig-title { font-size: 10.5px; color: #475569; }
        .footer-watermark {
          margin-top: 32px;
          padding-top: 10px;
          border-top: 1px solid #e2e8f0;
          display: flex;
          justify-content: space-between;
          align-items: center;
          font-size: 9px;
          color: #64748b;
          page-break-inside: avoid;
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
          CIN: U72900UP2024PTC189201 | Sector 62, Noida, NCR<br/>
          payroll@digiexplode.com | +91 98765 43210
        </div>
      </div>

      <div class="payslip-badge-bar">
        <div class="payslip-title">PAYSLIP FOR ${monthLabel.toUpperCase()}</div>
        <div class="payslip-ref">Ref: ${p.payrollReference}</div>
      </div>

      <div class="employee-card">
        <div>
          <div class="field-label">Employee Name</div>
          <div class="field-val">${p.employeeName}</div>
        </div>
        <div>
          <div class="field-label">Employee ID</div>
          <div class="field-val">${p.employeeId}</div>
        </div>
        <div>
          <div class="field-label">Designation</div>
          <div class="field-val">${p.designation || 'Specialist'}</div>
        </div>
        <div>
          <div class="field-label">Department</div>
          <div class="field-val">${p.department || 'Operations'}</div>
        </div>
        <div>
          <div class="field-label">Email</div>
          <div class="field-val">${p.employeeEmail || 'N/A'}</div>
        </div>
        <div>
          <div class="field-label">Annual CTC Snapshot</div>
          <div class="field-val">₹${(p.annualCtcSnapshot || 0).toLocaleString('en-IN')}</div>
        </div>
        <div>
          <div class="field-label">Pay Period</div>
          <div class="field-val">${monthLabel}</div>
        </div>
        <div>
          <div class="field-label">Status</div>
          <div class="field-val" style="color: #10B981; text-transform: uppercase;">${p.status}</div>
        </div>
      </div>

      <div class="attendance-strip">
        <div class="att-item">
          <div class="field-label">Working Days</div>
          <div class="att-num">${p.attendanceSummary.totalWorkingDays}</div>
        </div>
        <div class="att-item">
          <div class="field-label">Present Days</div>
          <div class="att-num">${p.attendanceSummary.presentDays}</div>
        </div>
        <div class="att-item">
          <div class="field-label">Paid Leaves</div>
          <div class="att-num" style="color: #3B82F6;">${p.attendanceSummary.paidLeaveDays}</div>
        </div>
        <div class="att-item">
          <div class="field-label">Unpaid Leaves (LOP)</div>
          <div class="att-num" style="color: #EF4444;">${p.attendanceSummary.unpaidLeaveDays}</div>
        </div>
        <div class="att-item">
          <div class="field-label">Half Days / Late</div>
          <div class="att-num">${p.attendanceSummary.halfDays} / ${p.attendanceSummary.lateDays}</div>
        </div>
      </div>

      <div class="salary-grid">
        <!-- Earnings Table -->
        <div class="table-box">
          <div class="table-head">
            <span>Earnings</span>
            <span>Amount (₹)</span>
          </div>
          <div class="table-row">
            <span>Basic Salary</span>
            <span style="font-family: monospace;">${fmt(p.earnings.basic)}</span>
          </div>
          <div class="table-row alt">
            <span>House Rent Allowance (HRA)</span>
            <span style="font-family: monospace;">${fmt(p.earnings.hra)}</span>
          </div>
          <div class="table-row">
            <span>Special / Flexi Allowance</span>
            <span style="font-family: monospace;">${fmt(p.earnings.specialAllowance)}</span>
          </div>
          <div class="table-row alt">
            <span>Bonus / Performance Incentive</span>
            <span style="font-family: monospace;">${fmt(p.earnings.bonus)}</span>
          </div>
          <div class="table-row">
            <span>Overtime / Extra Duty</span>
            <span style="font-family: monospace;">${fmt(p.earnings.overtime)}</span>
          </div>
          ${(p.earnings.customItems || []).map((ci, idx) => `
            <div class="table-row ${idx % 2 === 1 ? 'alt' : ''}">
              <span>${ci.name}</span>
              <span style="font-family: monospace;">${fmt(ci.amount)}</span>
            </div>
          `).join('')}
          <div class="table-total-row">
            <span>Total Gross Pay</span>
            <span style="color: #5B4BFF; font-family: monospace;">${fmt(p.grossPay)}</span>
          </div>
        </div>

        <!-- Deductions Table -->
        <div class="table-box">
          <div class="table-head">
            <span>Deductions</span>
            <span>Amount (₹)</span>
          </div>
          <div class="table-row">
            <span>Provident Fund (PF)</span>
            <span style="font-family: monospace;">${fmt(p.deductions.pf)}</span>
          </div>
          <div class="table-row alt">
            <span>Tax Deducted at Source (TDS)</span>
            <span style="font-family: monospace;">${fmt(p.deductions.tds)}</span>
          </div>
          <div class="table-row">
            <span>Leave Deductions / LOP</span>
            <span style="font-family: monospace; color: #EF4444;">${fmt(p.deductions.leaveDeductions)}</span>
          </div>
          <div class="table-row alt">
            <span>Other Deductions</span>
            <span style="font-family: monospace;">${fmt(p.deductions.otherDeductions)}</span>
          </div>
          ${(p.deductions.customItems || []).map((ci, idx) => `
            <div class="table-row ${idx % 2 === 1 ? 'alt' : ''}">
              <span>${ci.name}</span>
              <span style="font-family: monospace; color: #EF4444;">${fmt(ci.amount)}</span>
            </div>
          `).join('')}
          <div class="table-total-row">
            <span>Total Deductions</span>
            <span style="color: #EF4444; font-family: monospace;">${fmt(p.totalDeductions)}</span>
          </div>
        </div>
      </div>

      <div class="net-pay-banner">
        <div>
          <div style="font-size: 11px; text-transform: uppercase; letter-spacing: 1px; color: #94a3b8; font-weight: 700;">Net Payable Salary</div>
          <div class="net-words">${numberToWords(p.netPay)}</div>
        </div>
        <div class="net-amount">${fmt(p.netPay)}</div>
      </div>

      <div class="signature-section">
        <div class="sig-block">
          <div style="font-size: 10.5px; color: #64748b; margin-bottom: 24px;">Authorized Signatory</div>
          <div class="sig-line"></div>
          <div class="sig-name">Vansh Sharma</div>
          <div class="sig-title">Managing Director · DigiexplodeAI</div>
        </div>
        <div class="sig-block" style="text-align: right;">
          <div style="font-size: 10.5px; color: #64748b; margin-bottom: 24px;">Employee Signature</div>
          <div class="sig-line"></div>
          <div class="sig-name">${p.employeeName}</div>
          <div class="sig-title">Date: ____________________</div>
        </div>
      </div>

      <div class="footer-watermark">
        <div>
          🔐 This is a system-generated payslip issued through Digiexplode Agency OS.
        </div>
        <div>
          Generated on ${new Date(p.generatedAt).toLocaleDateString('en-IN')} by ${p.generatedBy}
        </div>
      </div>
    </body>
    </html>
  `;
};

// Print dialog helper
const triggerPrintPayslip = (p: PayrollRecord, monthLabel: string) => {
  const html = buildPayslipHTML(p, monthLabel);
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

export const PayrollView: React.FC = () => {
  const { user, profile } = useAuth();
  const isSuperAdmin = profile?.role === 'super_admin' || profile?.role === 'superAdmin' || profile?.role === 'admin';
  const canManage = isSuperAdmin;

  // Master State
  const [employees, setEmployees] = useState<CanonicalEmployee[]>([]);
  const [payslips, setPayslips] = useState<PayrollRecord[]>([]);
  const [attendanceRecords, setAttendanceRecords] = useState<any[]>([]);
  const [selectedMonth, setSelectedMonth] = useState<string>(() => new Date().toISOString().slice(0, 7));
  const [loading, setLoading] = useState<boolean>(true);
  const [generating, setGenerating] = useState<boolean>(false);

  // Review Drawer / Modal State
  const [drawerOpen, setDrawerOpen] = useState<boolean>(false);
  const [selectedEmp, setSelectedEmp] = useState<CanonicalEmployee | null>(null);
  const [activePayrollRecord, setActivePayrollRecord] = useState<PayrollRecord | null>(null);
  const [customEarnings, setCustomEarnings] = useState<SalaryEarnings>({
    basic: 0, hra: 0, specialAllowance: 0, bonus: 0, overtime: 0, otherAllowances: 0
  });
  const [customDeductions, setCustomDeductions] = useState<SalaryDeductions>({
    pf: 0, tds: 0, leaveDeductions: 0, otherDeductions: 0
  });
  const [adjustmentReason, setAdjustmentReason] = useState<string>('');
  const [customAttendance, setCustomAttendance] = useState<AttendanceSummary>({
    totalWorkingDays: 22, presentDays: 22, paidLeaveDays: 0, unpaidLeaveDays: 0, halfDays: 0, lateDays: 0, absentDays: 0, attendanceIncomplete: false
  });

  // Bulk Modal State
  const [bulkModalOpen, setBulkModalOpen] = useState<boolean>(false);
  const [bulkProgress, setBulkProgress] = useState<{ total: number; done: number; results: string[] } | null>(null);

  // Preview Modal State
  const [previewOpen, setPreviewOpen] = useState<boolean>(false);
  const [previewSlip, setPreviewSlip] = useState<PayrollRecord | null>(null);

  // Toast State
  const [toast, setToast] = useState<{ type: 'success' | 'error'; msg: string } | null>(null);

  const showToast = (type: 'success' | 'error', msg: string) => {
    setToast({ type, msg });
    setTimeout(() => setToast(null), 4000);
  };

  // Month Label
  const monthLabel = useMemo(() => {
    const [year, month] = selectedMonth.split('-');
    const d = new Date(Number(year), Number(month) - 1, 1);
    return d.toLocaleDateString('en-IN', { month: 'long', year: 'numeric' });
  }, [selectedMonth]);

  // 1. Subscribe to Employees
  useEffect(() => {
    const unsub = subscribeToCanonicalEmployees(
      (list) => {
        setEmployees(list);
        setLoading(false);
      },
      (err) => console.warn('[PayrollView] Employees load notice:', err)
    );
    return () => unsub();
  }, []);

  // 2. Subscribe to Attendance
  useEffect(() => {
    const unsub = onSnapshot(collection(db, 'attendance'), (snap) => {
      if (!snap.empty) {
        setAttendanceRecords(snap.docs.map(d => ({ id: d.id, ...d.data() })));
      }
    }, (err) => console.warn('[PayrollView] Attendance load notice:', err));
    return () => unsub();
  }, []);

  // 3. Subscribe to Payroll Records for selected month
  useEffect(() => {
    const unsub = subscribeToPayrollRecords(
      selectedMonth,
      (records) => {
        setPayslips(records);
      },
      (err) => console.warn('[PayrollView] Payroll records error:', err)
    );
    return () => unsub();
  }, [selectedMonth]);

  // Derive Dashboard KPIs
  const kpis = useMemo(() => {
    const totalEmployees = employees.length;
    const generatedSlips = payslips.filter(p => p.payrollMonth === selectedMonth);
    const payslipsCount = generatedSlips.length;
    const totalGross = generatedSlips.reduce((sum, p) => sum + (p.grossPay || 0), 0);
    const totalNet = generatedSlips.reduce((sum, p) => sum + (p.netPay || 0), 0);
    return { totalEmployees, payslipsCount, totalGross, totalNet };
  }, [employees, payslips, selectedMonth]);

  // Open Review Drawer for Single Employee Generate / Edit
  const handleOpenReview = (emp: CanonicalEmployee) => {
    setSelectedEmp(emp);
    const existing = payslips.find(p => p.employeeId === emp.id && p.payrollMonth === selectedMonth);

    if (existing) {
      setActivePayrollRecord(existing);
      setCustomEarnings({ ...existing.earnings });
      setCustomDeductions({ ...existing.deductions });
      setCustomAttendance({ ...existing.attendanceSummary });
      setAdjustmentReason(existing.adjustmentReason || '');
    } else {
      // Calculate fresh draft from attendance & salary
      const annualCtc = parseEmployeeAnnualSalary(emp);
      const attSummary = compileEmployeeAttendanceSummary(emp, selectedMonth, attendanceRecords, employees);
      const calc = calculateDraftSalaryStructure(annualCtc, attSummary.unpaidLeaveDays, attSummary.totalWorkingDays);

      setActivePayrollRecord(null);
      setCustomEarnings(calc.earnings);
      setCustomDeductions(calc.deductions);
      setCustomAttendance(attSummary);
      setAdjustmentReason('');
    }
    setDrawerOpen(true);
  };

  // Recalculate values in Drawer
  const handleRecalculateInDrawer = () => {
    if (!selectedEmp) return;
    const annualCtc = parseEmployeeAnnualSalary(selectedEmp);
    const attSummary = compileEmployeeAttendanceSummary(selectedEmp, selectedMonth, attendanceRecords, employees);
    const calc = calculateDraftSalaryStructure(annualCtc, attSummary.unpaidLeaveDays, attSummary.totalWorkingDays);
    setCustomEarnings(calc.earnings);
    setCustomDeductions(calc.deductions);
    setCustomAttendance(attSummary);
    showToast('success', 'Recalculated salary breakdown based on Attendance & CTC rules.');
  };

  // Current Live Calculations in Drawer
  const drawerTotals = useMemo(() => {
    const gross = (customEarnings.basic || 0) + (customEarnings.hra || 0) + (customEarnings.specialAllowance || 0) +
      (customEarnings.bonus || 0) + (customEarnings.overtime || 0) + (customEarnings.otherAllowances || 0) +
      (customEarnings.customItems || []).reduce((s, i) => s + (i.amount || 0), 0);

    const deductions = (customDeductions.pf || 0) + (customDeductions.tds || 0) + (customDeductions.leaveDeductions || 0) +
      (customDeductions.otherDeductions || 0) +
      (customDeductions.customItems || []).reduce((s, i) => s + (i.amount || 0), 0);

    const net = Math.max(0, gross - deductions);
    return { gross, deductions, net };
  }, [customEarnings, customDeductions]);

  // Save or Finalize from Drawer
  const handleSaveFromDrawer = async (status: PayrollStatus) => {
    if (!selectedEmp) return;
    setGenerating(true);

    const annualCtc = parseEmployeeAnnualSalary(selectedEmp);
    const refNumber = activePayrollRecord?.payrollReference || generatePayslipReference(selectedMonth);

    const payload: Omit<PayrollRecord, 'id'> = {
      payrollReference: refNumber,
      employeeId: selectedEmp.id,
      employeeName: selectedEmp.name,
      employeeEmail: selectedEmp.email || '',
      designation: selectedEmp.role || (selectedEmp as any).designation || 'Specialist',
      department: selectedEmp.department || 'Operations',
      payrollMonth: selectedMonth,
      payrollYear: parseInt(selectedMonth.split('-')[0], 10) || 2026,
      annualCtcSnapshot: annualCtc,
      monthlyReferenceSalary: Math.round(annualCtc / 12),
      earnings: { ...customEarnings },
      deductions: { ...customDeductions },
      grossPay: drawerTotals.gross,
      totalDeductions: drawerTotals.deductions,
      netPay: drawerTotals.net,
      attendanceSummary: { ...customAttendance },
      status: status,
      generatedAt: activePayrollRecord?.generatedAt || new Date().toISOString(),
      generatedBy: profile?.name || user?.displayName || 'Administrator',
      generatedById: user?.uid || 'admin',
      finalizedAt: status === 'finalized' ? new Date().toISOString() : activePayrollRecord?.finalizedAt,
      finalizedBy: status === 'finalized' ? (profile?.name || user?.displayName || 'Administrator') : activePayrollRecord?.finalizedBy,
      finalizedById: status === 'finalized' ? user?.uid : activePayrollRecord?.finalizedById,
      adjustmentReason: adjustmentReason || undefined,
      version: (activePayrollRecord?.version || 0) + 1,
      updatedAt: new Date().toISOString()
    };

    try {
      const docId = await savePayrollRecord(payload);
      showToast('success', `Payroll successfully saved as ${status.toUpperCase()} for ${selectedEmp.name}`);
      setDrawerOpen(false);

      // Auto update local state
      const savedRecord: PayrollRecord = { ...payload, id: docId };
      setPayslips(prev => {
        const filtered = prev.filter(p => p.employeeId !== selectedEmp.id || p.payrollMonth !== selectedMonth);
        return [savedRecord, ...filtered];
      });
    } catch (e) {
      console.error('Save payroll error:', e);
      showToast('error', 'Failed to save payroll record. Please check console.');
    } finally {
      setGenerating(false);
    }
  };

  // Bulk Generate Action
  const handleBulkGenerateSubmit = async () => {
    setGenerating(true);
    const eligibleEmployees = employees.filter(emp => {
      const existing = payslips.find(p => p.employeeId === emp.id && p.payrollMonth === selectedMonth);
      return !existing || existing.status === 'draft';
    });

    setBulkProgress({ total: eligibleEmployees.length, done: 0, results: [] });

    let count = 0;
    for (const emp of eligibleEmployees) {
      try {
        const annualCtc = parseEmployeeAnnualSalary(emp);
        const attSummary = compileEmployeeAttendanceSummary(emp, selectedMonth, attendanceRecords, employees);
        const calc = calculateDraftSalaryStructure(annualCtc, attSummary.unpaidLeaveDays, attSummary.totalWorkingDays);
        const refNumber = generatePayslipReference(selectedMonth);

        const payload: Omit<PayrollRecord, 'id'> = {
          payrollReference: refNumber,
          employeeId: emp.id,
          employeeName: emp.name,
          employeeEmail: emp.email || '',
          designation: emp.role || (emp as any).designation || 'Specialist',
          department: emp.department || 'Operations',
          payrollMonth: selectedMonth,
          payrollYear: parseInt(selectedMonth.split('-')[0], 10) || 2026,
          annualCtcSnapshot: annualCtc,
          monthlyReferenceSalary: Math.round(annualCtc / 12),
          earnings: calc.earnings,
          deductions: calc.deductions,
          grossPay: calc.grossPay,
          totalDeductions: calc.totalDeductions,
          netPay: calc.netPay,
          attendanceSummary: attSummary,
          status: 'draft',
          generatedAt: new Date().toISOString(),
          generatedBy: profile?.name || user?.displayName || 'Administrator',
          generatedById: user?.uid || 'admin',
          version: 1,
          updatedAt: new Date().toISOString()
        };

        await savePayrollRecord(payload);
        count++;
        setBulkProgress(prev => prev ? {
          ...prev,
          done: prev.done + 1,
          results: [...prev.results, `✓ Generated draft for ${emp.name}`]
        } : null);
      } catch (e) {
        console.error('Bulk generate item error:', e);
      }
    }

    setGenerating(false);
    showToast('success', `Successfully generated ${count} payroll drafts for ${monthLabel}.`);
    setTimeout(() => {
      setBulkModalOpen(false);
      setBulkProgress(null);
    }, 1500);
  };

  // Mark Paid
  const handleMarkPaid = async (slip: PayrollRecord) => {
    const paymentRef = prompt('Enter payment transaction reference / UTR:', `UTR-${Date.now()}`);
    if (!paymentRef) return;

    try {
      await updatePayrollRecord(slip.id, {
        status: 'paid',
        paidAt: new Date().toISOString(),
        paidBy: profile?.name || user?.displayName || 'Administrator',
        paymentReference: paymentRef
      });
      showToast('success', `Marked payslip ${slip.payrollReference} as PAID.`);
    } catch (e) {
      showToast('error', 'Failed to update payment status.');
    }
  };

  const fmt = (n: number) => `₹${(n || 0).toLocaleString('en-IN')}`;

  return (
    <div style={{ fontFamily: 'Inter, Manrope, sans-serif', padding: '24px 32px', maxWidth: '1440px', margin: '0 auto', color: '#F8FAFC' }}>

      {/* Toast Notification */}
      {toast && (
        <div style={{
          position: 'fixed', top: '24px', right: '24px', zIndex: 99999,
          display: 'flex', alignItems: 'center', gap: '10px', padding: '12px 18px',
          borderRadius: '12px', fontSize: '13.5px', fontWeight: 600,
          background: toast.type === 'success' ? 'rgba(16,185,129,0.95)' : 'rgba(239,68,68,0.95)',
          color: '#FFF', boxShadow: '0 8px 30px rgba(0,0,0,0.3)', backdropFilter: 'blur(10px)'
        }}>
          {toast.type === 'success' ? <CheckCircle size={18} /> : <AlertCircle size={18} />}
          {toast.msg}
        </div>
      )}

      {/* ── Top Header ────────────────────────────────────────────── */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '24px', flexWrap: 'wrap', gap: '16px' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '4px' }}>
            <div style={{
              width: '40px', height: '40px', borderRadius: '10px',
              background: 'linear-gradient(135deg, #3B82F6 0%, #1D4ED8 100%)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              boxShadow: '0 4px 14px rgba(59, 130, 246, 0.35)'
            }}>
              <CreditCard size={22} color="#FFF" />
            </div>
            <div>
              <h1 style={{ fontSize: '24px', fontWeight: 800, margin: 0, letterSpacing: '-0.5px' }}>
                Payroll Management
              </h1>
              <p style={{ margin: 0, fontSize: '13px', color: '#94A3B8' }}>
                Calculate monthly earnings, sync attendance LOP, finalize payslips, and generate printable statements.
              </p>
            </div>
          </div>
        </div>

        {/* Month Selector & Bulk Actions */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{
            display: 'flex', alignItems: 'center', gap: '8px', background: '#171E31',
            padding: '6px 12px', borderRadius: '10px', border: '1px solid #293248'
          }}>
            <Calendar size={15} color="#60A5FA" />
            <input
              type="month"
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(e.target.value)}
              style={{
                background: 'transparent', border: 'none', color: '#F8FAFC',
                fontSize: '13.5px', fontWeight: 700, outline: 'none', cursor: 'pointer'
              }}
            />
          </div>

          {canManage && (
            <button
              onClick={() => setBulkModalOpen(true)}
              style={{
                display: 'flex', alignItems: 'center', gap: '8px', padding: '9px 18px',
                borderRadius: '10px', border: 'none',
                background: 'linear-gradient(135deg, #3B82F6 0%, #2563EB 100%)',
                color: '#FFF', fontSize: '13px', fontWeight: 700, cursor: 'pointer',
                boxShadow: '0 4px 14px rgba(37, 99, 235, 0.35)'
              }}
            >
              <Users size={16} /> Bulk Generate
            </button>
          )}
        </div>
      </div>

      {/* ── Summary KPI Cards ──────────────────────────────────────── */}
      <div style={{
        display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
        gap: '14px', marginBottom: '24px'
      }}>
        <div style={{ background: '#171E31', padding: '16px 20px', borderRadius: '14px', border: '1px solid #293248' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
            <Users size={16} color="#3B82F6" />
            <span style={{ fontSize: '11.5px', fontWeight: 700, color: '#94A3B8', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
              Eligible Employees
            </span>
          </div>
          <div style={{ fontSize: '24px', fontWeight: 900, color: '#F8FAFC' }}>{kpis.totalEmployees}</div>
          <div style={{ fontSize: '11px', color: '#64748B', marginTop: '4px' }}>Active team members in master</div>
        </div>

        <div style={{ background: '#171E31', padding: '16px 20px', borderRadius: '14px', border: '1px solid #293248' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
            <FileCheck size={16} color="#10B981" />
            <span style={{ fontSize: '11.5px', fontWeight: 700, color: '#94A3B8', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
              Payslips Generated
            </span>
          </div>
          <div style={{ fontSize: '24px', fontWeight: 900, color: '#10B981' }}>{kpis.payslipsCount} / {kpis.totalEmployees}</div>
          <div style={{ fontSize: '11px', color: '#64748B', marginTop: '4px' }}>For {monthLabel}</div>
        </div>

        <div style={{ background: '#171E31', padding: '16px 20px', borderRadius: '14px', border: '1px solid #293248' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
            <TrendingUp size={16} color="#F59E0B" />
            <span style={{ fontSize: '11.5px', fontWeight: 700, color: '#94A3B8', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
              Total Gross Pay
            </span>
          </div>
          <div style={{ fontSize: '24px', fontWeight: 900, color: '#FBBF24', fontFamily: 'monospace' }}>{fmt(kpis.totalGross)}</div>
          <div style={{ fontSize: '11px', color: '#64748B', marginTop: '4px' }}>Sum of generated earnings</div>
        </div>

        <div style={{ background: '#171E31', padding: '16px 20px', borderRadius: '14px', border: '1px solid #293248' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
            <DollarSign size={16} color="#10B981" />
            <span style={{ fontSize: '11.5px', fontWeight: 700, color: '#94A3B8', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
              Total Net Payable
            </span>
          </div>
          <div style={{ fontSize: '24px', fontWeight: 900, color: '#10B981', fontFamily: 'monospace' }}>{fmt(kpis.totalNet)}</div>
          <div style={{ fontSize: '11px', color: '#64748B', marginTop: '4px' }}>Net disbursable amount</div>
        </div>
      </div>

      {/* ── Employee Payroll Table ─────────────────────────────────── */}
      <div style={{ background: '#171E31', borderRadius: '16px', border: '1px solid #293248', overflow: 'hidden' }}>
        <div style={{
          padding: '16px 20px', borderBottom: '1px solid #293248',
          display: 'flex', justifyContent: 'space-between', alignItems: 'center'
        }}>
          <div style={{ fontWeight: 800, fontSize: '15px', color: '#F8FAFC' }}>
            Payroll Registry — {monthLabel}
          </div>
          <div style={{ fontSize: '12.5px', color: '#94A3B8' }}>
            Showing {employees.length} employees
          </div>
        </div>

        {loading ? (
          <div style={{ padding: '40px', textAlign: 'center', color: '#94A3B8' }}>
            <Loader2 size={24} className="animate-spin" style={{ margin: '0 auto 8px' }} />
            Loading employee payroll records...
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '13px' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid #293248', color: '#94A3B8', fontSize: '11.5px', textTransform: 'uppercase' }}>
                  <th style={{ padding: '12px 18px' }}>Employee</th>
                  <th style={{ padding: '12px 18px' }}>Role / Dept</th>
                  <th style={{ padding: '12px 18px' }}>Annual CTC</th>
                  <th style={{ padding: '12px 18px' }}>Attendance / LOP</th>
                  <th style={{ padding: '12px 18px' }}>Status</th>
                  <th style={{ padding: '12px 18px', textAlign: 'right' }}>Net Pay (₹)</th>
                  <th style={{ padding: '12px 18px', textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {employees.map((emp) => {
                  const slip = payslips.find(p => p.employeeId === emp.id && p.payrollMonth === selectedMonth);
                  const annual = parseEmployeeAnnualSalary(emp);
                  const att = compileEmployeeAttendanceSummary(emp, selectedMonth, attendanceRecords, employees);

                  const statusConfig: Record<PayrollStatus | 'pending', { bg: string; text: string; label: string }> = {
                    pending:   { bg: 'rgba(245, 158, 11, 0.12)', text: '#FBBF24', label: 'Pending' },
                    draft:     { bg: 'rgba(59, 130, 246, 0.12)', text: '#60A5FA', label: 'Draft' },
                    reviewed:  { bg: 'rgba(168, 85, 247, 0.12)', text: '#C084FC', label: 'Reviewed' },
                    finalized: { bg: 'rgba(16, 185, 129, 0.12)', text: '#10B981', label: 'Finalized' },
                    paid:      { bg: 'rgba(16, 185, 129, 0.25)', text: '#34D399', label: 'Paid' },
                    revoked:   { bg: 'rgba(239, 68, 68, 0.12)',  text: '#F87171', label: 'Revoked' },
                  };

                  const currentStatus = slip ? slip.status : 'pending';
                  const sc = statusConfig[currentStatus];

                  return (
                    <tr key={emp.id} style={{ borderBottom: '1px solid rgba(41, 50, 72, 0.6)' }}>
                      <td style={{ padding: '14px 18px' }}>
                        <div style={{ fontWeight: 700, color: '#F8FAFC' }}>{emp.name}</div>
                        <div style={{ fontSize: '11px', color: '#64748B' }}>{emp.email || emp.id}</div>
                      </td>
                      <td style={{ padding: '14px 18px' }}>
                        <div style={{ color: '#CBD5E1' }}>{emp.role || (emp as any).designation || 'Specialist'}</div>
                        <div style={{ fontSize: '11px', color: '#64748B' }}>{emp.department || 'Operations'}</div>
                      </td>
                      <td style={{ padding: '14px 18px', fontWeight: 600, color: '#CBD5E1', fontFamily: 'monospace' }}>
                        ₹{annual.toLocaleString('en-IN')}
                      </td>
                      <td style={{ padding: '14px 18px', fontSize: '12px' }}>
                        <div style={{ color: '#CBD5E1' }}>
                          <strong>{att.presentDays}</strong> / {att.totalWorkingDays} days
                        </div>
                        {att.unpaidLeaveDays > 0 ? (
                          <div style={{ color: '#EF4444', fontSize: '11px', fontWeight: 600 }}>
                            {att.unpaidLeaveDays} LOP day(s)
                          </div>
                        ) : (
                          <div style={{ color: '#10B981', fontSize: '11px' }}>Full Attendance</div>
                        )}
                      </td>
                      <td style={{ padding: '14px 18px' }}>
                        <span style={{
                          padding: '3px 9px', borderRadius: '6px', fontSize: '11px', fontWeight: 700,
                          background: sc.bg, color: sc.text, border: `1px solid ${sc.text}33`
                        }}>
                          {sc.label}
                        </span>
                      </td>
                      <td style={{ padding: '14px 18px', textAlign: 'right', fontWeight: 800, fontFamily: 'monospace', fontSize: '14px', color: slip ? '#10B981' : '#64748B' }}>
                        {slip ? fmt(slip.netPay) : '—'}
                      </td>
                      <td style={{ padding: '14px 18px', textAlign: 'right' }}>
                        <div style={{ display: 'flex', gap: '6px', justifyContent: 'flex-end', alignItems: 'center' }}>
                          {!slip ? (
                            <button
                              onClick={() => handleOpenReview(emp)}
                              style={{
                                padding: '6px 12px', borderRadius: '8px', border: 'none',
                                background: 'rgba(59, 130, 246, 0.15)', color: '#60A5FA',
                                fontSize: '12px', fontWeight: 700, cursor: 'pointer',
                                display: 'flex', alignItems: 'center', gap: '4px'
                              }}
                            >
                              <Plus size={13} /> Generate
                            </button>
                          ) : (
                            <>
                              <button
                                onClick={() => {
                                  setPreviewSlip(slip);
                                  setPreviewOpen(true);
                                }}
                                title="Preview Payslip"
                                style={{
                                  padding: '6px', borderRadius: '6px', background: '#111728',
                                  border: '1px solid #293248', color: '#94A3B8', cursor: 'pointer'
                                }}
                              >
                                <Eye size={14} />
                              </button>
                              <button
                                onClick={() => triggerPrintPayslip(slip, monthLabel)}
                                title="Print / PDF"
                                style={{
                                  padding: '6px', borderRadius: '6px', background: '#111728',
                                  border: '1px solid #293248', color: '#60A5FA', cursor: 'pointer'
                                }}
                              >
                                <Printer size={14} />
                              </button>

                              {slip.status === 'draft' && (
                                <button
                                  onClick={() => handleOpenReview(emp)}
                                  title="Review & Edit"
                                  style={{
                                    padding: '6px 10px', borderRadius: '6px', background: 'rgba(59, 130, 246, 0.15)',
                                    border: '1px solid #3B82F6', color: '#60A5FA', fontSize: '11.5px',
                                    fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px'
                                  }}
                                >
                                  <Edit3 size={12} /> Review
                                </button>
                              )}

                              {slip.status === 'finalized' && (
                                <button
                                  onClick={() => handleMarkPaid(slip)}
                                  title="Mark as Paid"
                                  style={{
                                    padding: '6px 10px', borderRadius: '6px', background: 'rgba(16, 185, 129, 0.15)',
                                    border: '1px solid #10B981', color: '#10B981', fontSize: '11.5px',
                                    fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px'
                                  }}
                                >
                                  <Check size={12} /> Mark Paid
                                </button>
                              )}
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ── DRAWER / MODAL: PAYROLL REVIEW & CALCULATION ───────────── */}
      {drawerOpen && selectedEmp && (
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.8)',
          zIndex: 9999, display: 'flex', justifyContent: 'flex-end', backdropFilter: 'blur(4px)'
        }}>
          <div style={{
            background: '#171E31', width: '100%', maxWidth: '640px', height: '100vh',
            overflowY: 'auto', borderLeft: '1px solid #293248', padding: '24px',
            display: 'flex', flexDirection: 'column'
          }}>
            {/* Drawer Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '20px', paddingBottom: '16px', borderBottom: '1px solid #293248' }}>
              <div>
                <h3 style={{ fontSize: '18px', fontWeight: 800, margin: '0 0 4px', color: '#F8FAFC' }}>
                  Payroll Calculation Review
                </h3>
                <div style={{ fontSize: '13px', color: '#94A3B8' }}>
                  {selectedEmp.name} · {monthLabel}
                </div>
              </div>
              <button
                onClick={() => setDrawerOpen(false)}
                style={{ background: 'transparent', border: 'none', color: '#94A3B8', cursor: 'pointer' }}
              >
                <X size={20} />
              </button>
            </div>

            {/* Content */}
            <div style={{ flex: 1 }}>
              {/* Attendance Breakdown Strip */}
              <div style={{
                background: '#111728', padding: '14px 16px', borderRadius: '12px',
                border: '1px solid #293248', marginBottom: '18px'
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                  <span style={{ fontSize: '12px', fontWeight: 700, color: '#A5B4FC', textTransform: 'uppercase' }}>
                    Attendance Sync Summary
                  </span>
                  <button
                    type="button"
                    onClick={handleRecalculateInDrawer}
                    style={{
                      background: 'transparent', border: 'none', color: '#60A5FA',
                      fontSize: '11.5px', fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px'
                    }}
                  >
                    <RefreshCw size={12} /> Auto Recalculate
                  </button>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '8px', fontSize: '12px', textAlign: 'center' }}>
                  <div style={{ background: '#171E31', padding: '8px', borderRadius: '8px' }}>
                    <div style={{ color: '#94A3B8', fontSize: '10.5px' }}>Working Days</div>
                    <div style={{ fontWeight: 800, color: '#F8FAFC' }}>{customAttendance.totalWorkingDays}</div>
                  </div>
                  <div style={{ background: '#171E31', padding: '8px', borderRadius: '8px' }}>
                    <div style={{ color: '#94A3B8', fontSize: '10.5px' }}>Present Days</div>
                    <div style={{ fontWeight: 800, color: '#10B981' }}>{customAttendance.presentDays}</div>
                  </div>
                  <div style={{ background: '#171E31', padding: '8px', borderRadius: '8px' }}>
                    <div style={{ color: '#94A3B8', fontSize: '10.5px' }}>Paid Leaves</div>
                    <div style={{ fontWeight: 800, color: '#3B82F6' }}>{customAttendance.paidLeaveDays}</div>
                  </div>
                  <div style={{ background: '#171E31', padding: '8px', borderRadius: '8px' }}>
                    <div style={{ color: '#94A3B8', fontSize: '10.5px' }}>LOP Days</div>
                    <div style={{ fontWeight: 800, color: customAttendance.unpaidLeaveDays > 0 ? '#EF4444' : '#94A3B8' }}>{customAttendance.unpaidLeaveDays}</div>
                  </div>
                </div>
              </div>

              {/* Earnings Inputs */}
              <div style={{ marginBottom: '18px' }}>
                <div style={{ fontSize: '12px', fontWeight: 700, color: '#A5B4FC', textTransform: 'uppercase', marginBottom: '8px' }}>
                  Earnings (Gross: {fmt(drawerTotals.gross)})
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '11px', color: '#94A3B8', marginBottom: '3px' }}>Basic Salary</label>
                    <input
                      type="number"
                      value={customEarnings.basic}
                      onChange={e => setCustomEarnings({ ...customEarnings, basic: Number(e.target.value) || 0 })}
                      style={{ width: '100%', padding: '8px', borderRadius: '8px', background: '#111728', border: '1px solid #293248', color: '#F8FAFC', fontSize: '12.5px', fontFamily: 'monospace' }}
                    />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: '11px', color: '#94A3B8', marginBottom: '3px' }}>HRA</label>
                    <input
                      type="number"
                      value={customEarnings.hra}
                      onChange={e => setCustomEarnings({ ...customEarnings, hra: Number(e.target.value) || 0 })}
                      style={{ width: '100%', padding: '8px', borderRadius: '8px', background: '#111728', border: '1px solid #293248', color: '#F8FAFC', fontSize: '12.5px', fontFamily: 'monospace' }}
                    />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: '11px', color: '#94A3B8', marginBottom: '3px' }}>Special Allowance</label>
                    <input
                      type="number"
                      value={customEarnings.specialAllowance}
                      onChange={e => setCustomEarnings({ ...customEarnings, specialAllowance: Number(e.target.value) || 0 })}
                      style={{ width: '100%', padding: '8px', borderRadius: '8px', background: '#111728', border: '1px solid #293248', color: '#F8FAFC', fontSize: '12.5px', fontFamily: 'monospace' }}
                    />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: '11px', color: '#94A3B8', marginBottom: '3px' }}>Bonus / Incentive</label>
                    <input
                      type="number"
                      value={customEarnings.bonus}
                      onChange={e => setCustomEarnings({ ...customEarnings, bonus: Number(e.target.value) || 0 })}
                      style={{ width: '100%', padding: '8px', borderRadius: '8px', background: '#111728', border: '1px solid #293248', color: '#F8FAFC', fontSize: '12.5px', fontFamily: 'monospace' }}
                    />
                  </div>
                </div>
              </div>

              {/* Deductions Inputs */}
              <div style={{ marginBottom: '18px' }}>
                <div style={{ fontSize: '12px', fontWeight: 700, color: '#A5B4FC', textTransform: 'uppercase', marginBottom: '8px' }}>
                  Deductions (Total: {fmt(drawerTotals.deductions)})
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '11px', color: '#94A3B8', marginBottom: '3px' }}>LOP / Leave Deduction</label>
                    <input
                      type="number"
                      value={customDeductions.leaveDeductions}
                      onChange={e => setCustomDeductions({ ...customDeductions, leaveDeductions: Number(e.target.value) || 0 })}
                      style={{ width: '100%', padding: '8px', borderRadius: '8px', background: '#111728', border: '1px solid #293248', color: '#EF4444', fontSize: '12.5px', fontFamily: 'monospace' }}
                    />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: '11px', color: '#94A3B8', marginBottom: '3px' }}>Provident Fund (PF)</label>
                    <input
                      type="number"
                      value={customDeductions.pf}
                      onChange={e => setCustomDeductions({ ...customDeductions, pf: Number(e.target.value) || 0 })}
                      style={{ width: '100%', padding: '8px', borderRadius: '8px', background: '#111728', border: '1px solid #293248', color: '#F8FAFC', fontSize: '12.5px', fontFamily: 'monospace' }}
                    />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: '11px', color: '#94A3B8', marginBottom: '3px' }}>TDS / Income Tax</label>
                    <input
                      type="number"
                      value={customDeductions.tds}
                      onChange={e => setCustomDeductions({ ...customDeductions, tds: Number(e.target.value) || 0 })}
                      style={{ width: '100%', padding: '8px', borderRadius: '8px', background: '#111728', border: '1px solid #293248', color: '#F8FAFC', fontSize: '12.5px', fontFamily: 'monospace' }}
                    />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: '11px', color: '#94A3B8', marginBottom: '3px' }}>Other Deductions</label>
                    <input
                      type="number"
                      value={customDeductions.otherDeductions}
                      onChange={e => setCustomDeductions({ ...customDeductions, otherDeductions: Number(e.target.value) || 0 })}
                      style={{ width: '100%', padding: '8px', borderRadius: '8px', background: '#111728', border: '1px solid #293248', color: '#F8FAFC', fontSize: '12.5px', fontFamily: 'monospace' }}
                    />
                  </div>
                </div>
              </div>

              {/* Adjustment Reason */}
              <div style={{ marginBottom: '20px' }}>
                <label style={{ display: 'block', fontSize: '11.5px', color: '#94A3B8', marginBottom: '4px' }}>
                  Adjustment Notes / Reason (Optional)
                </label>
                <input
                  type="text"
                  placeholder="e.g. Quarterly performance bonus added"
                  value={adjustmentReason}
                  onChange={e => setAdjustmentReason(e.target.value)}
                  style={{ width: '100%', padding: '9px 12px', borderRadius: '8px', background: '#111728', border: '1px solid #293248', color: '#F8FAFC', fontSize: '12.5px', outline: 'none' }}
                />
              </div>

              {/* Net Pay Banner */}
              <div style={{
                background: '#111728', padding: '16px', borderRadius: '12px',
                border: '1.5px solid #10B981', display: 'flex', justifyContent: 'space-between',
                alignItems: 'center', marginBottom: '20px'
              }}>
                <div>
                  <div style={{ fontSize: '11px', color: '#94A3B8', textTransform: 'uppercase', fontWeight: 700 }}>Calculated Net Pay</div>
                  <div style={{ fontSize: '12px', color: '#10B981' }}>{numberToWords(drawerTotals.net)}</div>
                </div>
                <div style={{ fontSize: '24px', fontWeight: 900, color: '#10B981', fontFamily: 'monospace' }}>
                  {fmt(drawerTotals.net)}
                </div>
              </div>
            </div>

            {/* Action Buttons */}
            <div style={{ display: 'flex', gap: '10px', paddingTop: '16px', borderTop: '1px solid #293248' }}>
              <button
                type="button"
                onClick={() => handleSaveFromDrawer('draft')}
                disabled={generating}
                style={{
                  flex: 1, padding: '12px', borderRadius: '10px', border: '1px solid #293248',
                  background: '#111728', color: '#F8FAFC', fontSize: '13px', fontWeight: 700,
                  cursor: 'pointer'
                }}
              >
                Save Draft
              </button>
              <button
                type="button"
                onClick={() => handleSaveFromDrawer('finalized')}
                disabled={generating}
                style={{
                  flex: 1.3, padding: '12px', borderRadius: '10px', border: 'none',
                  background: 'linear-gradient(135deg, #10B981 0%, #059669 100%)', color: '#FFF',
                  fontSize: '13px', fontWeight: 700, cursor: 'pointer', display: 'flex',
                  alignItems: 'center', justifyContent: 'center', gap: '6px'
                }}
              >
                {generating ? <Loader2 size={16} className="animate-spin" /> : <Lock size={16} />}
                Finalize & Issue
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── MODAL: BULK GENERATE SUMMARY ──────────────────────────── */}
      {bulkModalOpen && (
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)',
          zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px'
        }}>
          <div style={{
            background: '#171E31', border: '1px solid #293248', borderRadius: '16px',
            width: '100%', maxWidth: '520px', padding: '24px'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Users size={20} color="#3B82F6" />
                <h3 style={{ margin: 0, fontSize: '17px', fontWeight: 800 }}>
                  Bulk Payroll Generation — {monthLabel}
                </h3>
              </div>
              <button onClick={() => setBulkModalOpen(false)} style={{ background: 'transparent', border: 'none', color: '#94A3B8', cursor: 'pointer' }}>
                <X size={18} />
              </button>
            </div>

            <p style={{ fontSize: '13px', color: '#94A3B8', lineHeight: 1.5, margin: '0 0 16px' }}>
              This will automatically process attendance logs and generate <strong>Draft</strong> payslips for all eligible active employees for <strong>{monthLabel}</strong>.
            </p>

            <div style={{ background: '#111728', padding: '14px', borderRadius: '10px', border: '1px solid #293248', marginBottom: '20px', fontSize: '12.5px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                <span style={{ color: '#94A3B8' }}>Total Active Employees:</span>
                <strong style={{ color: '#F8FAFC' }}>{employees.length}</strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                <span style={{ color: '#94A3B8' }}>Already Finalized (Protected):</span>
                <strong style={{ color: '#10B981' }}>{payslips.filter(p => p.payrollMonth === selectedMonth && p.status === 'finalized').length}</strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: '#94A3B8' }}>Eligible to Generate/Update:</span>
                <strong style={{ color: '#60A5FA' }}>{employees.length - payslips.filter(p => p.payrollMonth === selectedMonth && p.status === 'finalized').length}</strong>
              </div>
            </div>

            {bulkProgress && (
              <div style={{ marginBottom: '16px', background: '#111728', padding: '10px 14px', borderRadius: '8px' }}>
                <div style={{ fontSize: '12px', fontWeight: 700, color: '#60A5FA', marginBottom: '6px' }}>
                  Processing {bulkProgress.done} of {bulkProgress.total}...
                </div>
                <div style={{ maxHeight: '80px', overflowY: 'auto', fontSize: '11px', color: '#94A3B8' }}>
                  {bulkProgress.results.map((r, i) => <div key={i}>{r}</div>)}
                </div>
              </div>
            )}

            <div style={{ display: 'flex', gap: '10px' }}>
              <button
                onClick={() => setBulkModalOpen(false)}
                style={{ flex: 1, padding: '10px', borderRadius: '8px', border: '1px solid #293248', background: '#111728', color: '#94A3B8', fontWeight: 600, cursor: 'pointer' }}
              >
                Cancel
              </button>
              <button
                onClick={handleBulkGenerateSubmit}
                disabled={generating}
                style={{
                  flex: 1.5, padding: '10px', borderRadius: '8px', border: 'none',
                  background: '#3B82F6', color: '#FFF', fontWeight: 700, cursor: 'pointer',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px'
                }}
              >
                {generating ? <Loader2 size={16} className="animate-spin" /> : <CheckCircle size={16} />}
                Confirm & Generate All
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── MODAL: PAYSLIP PREVIEW ─────────────────────────────────── */}
      {previewOpen && previewSlip && (
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)',
          zIndex: 99999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px'
        }}>
          <div style={{
            background: '#171E31', border: '1px solid #293248', borderRadius: '16px',
            width: '100%', maxWidth: '840px', maxHeight: '92vh', display: 'flex', flexDirection: 'column', overflow: 'hidden'
          }}>
            <div style={{ padding: '14px 20px', borderBottom: '1px solid #293248', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ fontWeight: 800, fontSize: '15px' }}>
                Payslip Preview · {previewSlip.employeeName} ({previewSlip.payrollReference})
              </div>
              <div style={{ display: 'flex', gap: '8px' }}>
                <button
                  onClick={() => triggerPrintPayslip(previewSlip, monthLabel)}
                  style={{
                    padding: '6px 12px', borderRadius: '6px', border: 'none',
                    background: '#3B82F6', color: '#FFF', fontSize: '12px', fontWeight: 700,
                    cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px'
                  }}
                >
                  <Printer size={13} /> Print / Download
                </button>
                <button onClick={() => setPreviewOpen(false)} style={{ background: 'transparent', border: 'none', color: '#94A3B8', cursor: 'pointer' }}>
                  <X size={20} />
                </button>
              </div>
            </div>
            <div style={{ flex: 1, overflowY: 'auto', padding: '20px', background: '#525659' }}>
              <iframe
                title="Payslip View"
                srcDoc={buildPayslipHTML(previewSlip, monthLabel)}
                style={{ width: '100%', height: '700px', border: 'none', background: '#FFFFFF' }}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default PayrollView;
