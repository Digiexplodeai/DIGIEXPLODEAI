/**
 * Canonical Payroll Storage & Calculations Library
 * Digiexplode Agency OS
 */

import {
  collection, doc, getDocs, addDoc, setDoc, updateDoc, deleteDoc,
  onSnapshot, query, where, orderBy
} from 'firebase/firestore';
import { db } from './firebase';
import { CanonicalEmployee, matchEmployeeToRecord, isTimestampInMonthRange, normalizeDate } from './employeeMaster';

export type PayrollStatus = 'draft' | 'reviewed' | 'finalized' | 'paid' | 'revoked';

export interface SalaryEarnings {
  basic: number;
  hra: number;
  specialAllowance: number;
  bonus: number;
  overtime: number;
  otherAllowances: number;
  customItems?: { name: string; amount: number }[];
}

export interface SalaryDeductions {
  pf: number;
  tds: number;
  leaveDeductions: number;
  otherDeductions: number;
  customItems?: { name: string; amount: number }[];
}

export interface AttendanceSummary {
  totalWorkingDays: number;
  presentDays: number;
  paidLeaveDays: number;
  unpaidLeaveDays: number;
  halfDays: number;
  lateDays: number;
  absentDays: number;
  attendanceIncomplete: boolean;
}

export interface PayrollRecord {
  id: string;
  payrollReference: string;
  employeeId: string;
  employeeName: string;
  employeeEmail: string;
  designation: string;
  department: string;
  payrollMonth: string; // Format: "YYYY-MM"
  payrollYear: number;
  annualCtcSnapshot: number;
  monthlyReferenceSalary: number;
  earnings: SalaryEarnings;
  deductions: SalaryDeductions;
  grossPay: number;
  totalDeductions: number;
  netPay: number;
  attendanceSummary: AttendanceSummary;
  status: PayrollStatus;
  generatedAt: string;
  generatedBy: string;
  generatedById: string;
  finalizedAt?: string;
  finalizedBy?: string;
  finalizedById?: string;
  paidAt?: string;
  paidBy?: string;
  paymentReference?: string;
  adjustmentReason?: string;
  notes?: string;
  version: number;
  updatedAt: string;
}

const LS_PAYROLL_KEY = 'digi_payroll_records_v1';
const LS_PAYROLL_SEQ = 'digi_payroll_seq_v1';

// ── Helpers ─────────────────────────────────────────────────────────────

export function getDaysInMonth(year: number, monthZeroIndexed: number): number {
  return new Date(year, monthZeroIndexed + 1, 0).getDate();
}

export function calculateWorkingDaysInMonth(year: number, monthZeroIndexed: number): number {
  const totalDays = getDaysInMonth(year, monthZeroIndexed);
  let workingDays = 0;
  for (let day = 1; day <= totalDays; day++) {
    const d = new Date(year, monthZeroIndexed, day);
    const dayOfWeek = d.getDay();
    // Monday(1) to Friday(5) are working days
    if (dayOfWeek !== 0 && dayOfWeek !== 6) {
      workingDays++;
    }
  }
  return workingDays || 22;
}

export function generatePayslipReference(month: string): string {
  const cleanMonth = month.replace(/[^0-9]/g, '') || new Date().toISOString().slice(0, 7).replace('-', '');
  let seq = 101;
  try {
    const raw = localStorage.getItem(LS_PAYROLL_SEQ);
    if (raw) {
      const parsed = JSON.parse(raw);
      seq = (parsed[cleanMonth] || 101);
    }
  } catch {}
  seq++;
  try {
    const raw = localStorage.getItem(LS_PAYROLL_SEQ);
    const current = raw ? JSON.parse(raw) : {};
    current[cleanMonth] = seq;
    localStorage.setItem(LS_PAYROLL_SEQ, JSON.stringify(current));
  } catch {}
  const padded = String(seq).padStart(4, '0');
  return `DEA/PAY/${cleanMonth}/${padded}`;
}

export function parseEmployeeAnnualSalary(emp: CanonicalEmployee): number {
  if (typeof emp.monthlySalary === 'number' && emp.monthlySalary > 0) {
    return emp.monthlySalary * 12;
  }
  if ((emp as any).salary) {
    const n = parseFloat(String((emp as any).salary).replace(/[^0-9.]/g, ''));
    if (!isNaN(n) && n > 0) {
      // If entered as LPA or under 100
      if (n < 100) return n * 100000;
      return n;
    }
  }
  return 720000; // Default reference 7.2 LPA
}

// ── Calculations ────────────────────────────────────────────────────────

export function calculateDraftSalaryStructure(
  annualCtc: number,
  unpaidLeaveDays = 0,
  totalWorkingDays = 22
): { earnings: SalaryEarnings; deductions: SalaryDeductions; grossPay: number; totalDeductions: number; netPay: number; monthlyRef: number } {
  const monthlyRef = Math.round(annualCtc / 12);
  const basic = Math.round(monthlyRef * 0.45);
  const hra = Math.round(monthlyRef * 0.25);
  const specialAllowance = Math.round(monthlyRef * 0.20);
  const bonus = Math.round(monthlyRef * 0.10);
  const overtime = 0;
  const otherAllowances = 0;

  const grossPay = basic + hra + specialAllowance + bonus + overtime + otherAllowances;

  // LOP Deduction (unpaid leaves)
  const leaveDeductions = unpaidLeaveDays > 0 && totalWorkingDays > 0
    ? Math.round((monthlyRef / totalWorkingDays) * unpaidLeaveDays)
    : 0;

  const pf = 0; // Configured statutory rule (default 0 unless configured)
  const tds = 0; // Configured statutory rule
  const otherDeductions = 0;

  const totalDeductions = pf + tds + leaveDeductions + otherDeductions;
  const netPay = Math.max(0, grossPay - totalDeductions);

  return {
    monthlyRef,
    earnings: {
      basic,
      hra,
      specialAllowance,
      bonus,
      overtime,
      otherAllowances
    },
    deductions: {
      pf,
      tds,
      leaveDeductions,
      otherDeductions
    },
    grossPay,
    totalDeductions,
    netPay
  };
}

export function compileEmployeeAttendanceSummary(
  emp: CanonicalEmployee,
  month: string,
  attendanceRecords: any[],
  allEmployees: { id: string; name: string }[]
): AttendanceSummary {
  const [yearStr, monthStr] = month.split('-');
  const year = parseInt(yearStr, 10) || new Date().getFullYear();
  const monthIdx = (parseInt(monthStr, 10) || 1) - 1;
  const totalWorkingDays = calculateWorkingDaysInMonth(year, monthIdx);

  const empMonthRecords = attendanceRecords.filter(rec => {
    return isTimestampInMonthRange(rec.date || rec.timestamp || rec.createdAt, month) &&
      matchEmployeeToRecord(emp, rec, allEmployees);
  });

  let presentDays = 0;
  let halfDays = 0;
  let lateDays = 0;
  let paidLeaveDays = 0;
  let unpaidLeaveDays = 0;
  let absentDays = 0;

  empMonthRecords.forEach(rec => {
    const status = String(rec.status || '').toLowerCase();
    if (status === 'present' || status === 'on-time' || status === 'completed') {
      presentDays += 1;
    } else if (status === 'half-day' || status === 'halfday') {
      halfDays += 1;
      presentDays += 0.5;
    } else if (status === 'late') {
      lateDays += 1;
      presentDays += 1;
    } else if (status === 'leave' || status === 'paid_leave' || status === 'approved') {
      paidLeaveDays += 1;
    } else if (status === 'unpaid_leave' || status === 'lop') {
      unpaidLeaveDays += 1;
    } else if (status === 'absent') {
      absentDays += 1;
      unpaidLeaveDays += 1; // Unapproved absence counts as LOP
    }
  });

  // If there are 0 records logged for the month, flag as incomplete
  const attendanceIncomplete = empMonthRecords.length === 0;

  return {
    totalWorkingDays,
    presentDays: Math.min(totalWorkingDays, presentDays || (attendanceIncomplete ? totalWorkingDays : presentDays)),
    paidLeaveDays,
    unpaidLeaveDays,
    halfDays,
    lateDays,
    absentDays,
    attendanceIncomplete
  };
}

// ── Cache & Local Storage ───────────────────────────────────────────────

export function getCachedPayrollRecords(): PayrollRecord[] {
  try {
    const raw = localStorage.getItem(LS_PAYROLL_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) return parsed;
    }
  } catch {}
  return [];
}

export function setCachedPayrollRecords(records: PayrollRecord[]): void {
  try {
    localStorage.setItem(LS_PAYROLL_KEY, JSON.stringify(records));
  } catch {}
}

// ── Firestore Subscriptions & CRUD ──────────────────────────────────────

export function subscribeToPayrollRecords(
  month: string,
  onUpdate: (records: PayrollRecord[]) => void,
  onError?: (err: any) => void
): () => void {
  // 1. Emit matching cached records immediately
  try {
    const cached = getCachedPayrollRecords();
    const matching = cached.filter(r => !month || r.payrollMonth === month);
    onUpdate(matching);
  } catch {}

  // 2. Subscribe to Firestore
  try {
    const q = collection(db, 'payslips');
    const unsub = onSnapshot(q, (snap) => {
      const list: PayrollRecord[] = [];
      snap.forEach(docSnap => {
        const d = docSnap.data();
        list.push({
          id: docSnap.id,
          payrollReference: d.payrollReference || `DEA/PAY/${d.payrollMonth || month}/0001`,
          employeeId: d.employeeId || '',
          employeeName: d.employeeName || 'Employee',
          employeeEmail: d.employeeEmail || '',
          designation: d.designation || '',
          department: d.department || '',
          payrollMonth: d.payrollMonth || d.month || month,
          payrollYear: d.payrollYear || parseInt(d.payrollMonth?.split('-')[0] || '2026', 10),
          annualCtcSnapshot: d.annualCtcSnapshot || 0,
          monthlyReferenceSalary: d.monthlyReferenceSalary || d.grossPay || 0,
          earnings: d.earnings || {
            basic: d.structure?.basic || 0,
            hra: d.structure?.hra || 0,
            specialAllowance: d.structure?.allowances || 0,
            bonus: d.structure?.bonus || 0,
            overtime: d.structure?.overtime || 0,
            otherAllowances: 0
          },
          deductions: d.deductionsData || d.deductions || {
            pf: d.structure?.pf || 0,
            tds: d.structure?.tds || 0,
            leaveDeductions: d.structure?.leaveDeductions || 0,
            otherDeductions: d.structure?.otherDeductions || 0
          },
          grossPay: typeof d.grossPay === 'number' ? d.grossPay : 0,
          totalDeductions: typeof d.totalDeductions === 'number' ? d.totalDeductions : (typeof d.deductions === 'number' ? d.deductions : 0),
          netPay: typeof d.netPay === 'number' ? d.netPay : 0,
          attendanceSummary: d.attendanceSummary || {
            totalWorkingDays: 22,
            presentDays: 22,
            paidLeaveDays: 0,
            unpaidLeaveDays: 0,
            halfDays: 0,
            lateDays: 0,
            absentDays: 0,
            attendanceIncomplete: false
          },
          status: (d.status === 'finalized' || d.status === 'approved' ? 'finalized' : (d.status === 'paid' ? 'paid' : 'draft')) as PayrollStatus,
          generatedAt: d.generatedAt || new Date().toISOString(),
          generatedBy: d.generatedBy || 'Admin',
          generatedById: d.generatedById || 'admin',
          finalizedAt: d.finalizedAt,
          finalizedBy: d.finalizedBy,
          finalizedById: d.finalizedById,
          paidAt: d.paidAt,
          paidBy: d.paidBy,
          paymentReference: d.paymentReference,
          adjustmentReason: d.adjustmentReason,
          notes: d.notes,
          version: d.version || 1,
          updatedAt: d.updatedAt || new Date().toISOString()
        });
      });

      // Merge with cached list
      const cached = getCachedPayrollRecords();
      const mergedMap = new Map<string, PayrollRecord>();
      cached.forEach(r => mergedMap.set(r.id, r));
      list.forEach(r => mergedMap.set(r.id, r));
      const fullList = Array.from(mergedMap.values());
      setCachedPayrollRecords(fullList);

      const matching = fullList.filter(r => !month || r.payrollMonth === month);
      onUpdate(matching);
    }, (err) => {
      console.warn('[PayrollStorage] Snapshot error (using local cache fallback):', err);
      const cached = getCachedPayrollRecords();
      const matching = cached.filter(r => !month || r.payrollMonth === month);
      onUpdate(matching);
      if (onError) onError(err);
    });

    return unsub;
  } catch (e) {
    if (onError) onError(e);
    return () => {};
  }
}

export async function savePayrollRecord(
  record: Omit<PayrollRecord, 'id'>
): Promise<string> {
  const compositeKey = `${record.employeeId}_${record.payrollMonth}`;
  let docId = compositeKey;

  try {
    // Check if doc already exists with composite key
    const ref = doc(db, 'payslips', compositeKey);
    await setDoc(ref, record, { merge: true });
    docId = compositeKey;
  } catch (e) {
    console.warn('[PayrollStorage] Firestore write fallback:', e);
    docId = compositeKey;
  }

  // Update local cache
  try {
    const cached = getCachedPayrollRecords();
    const idx = cached.findIndex(r => r.id === docId || (r.employeeId === record.employeeId && r.payrollMonth === record.payrollMonth));
    const fullRecord: PayrollRecord = { ...record, id: docId };
    if (idx >= 0) {
      cached[idx] = fullRecord;
    } else {
      cached.unshift(fullRecord);
    }
    setCachedPayrollRecords(cached);
  } catch {}

  try {
    const { WorkspaceEventService } = await import('./controlPlane/WorkspaceEventService');
    await WorkspaceEventService.emit({
      eventType: record.status === 'finalized' ? 'payroll.finalized' : 'payroll.generated',
      entityType: 'payroll',
      entityId: record.payrollReference || docId,
      actorId: record.generatedById || 'accounts',
      actorName: record.generatedBy || 'Accounts Lead',
      actorRole: 'accounts',
      targetMemberIds: [record.employeeId],
      metadata: {
        employeeName: record.employeeName,
        payrollMonth: record.payrollMonth,
        netPay: record.netPay,
        status: record.status
      },
      customDescription: `Generated ${record.payrollMonth} payroll slip (${record.payrollReference}) for ${record.employeeName} (Net: ₹${record.netPay?.toLocaleString('en-IN')})`
    });
  } catch (e) {}

  return docId;
}

export async function updatePayrollRecord(
  recordId: string,
  updates: Partial<PayrollRecord>
): Promise<void> {
  const updatedAt = new Date().toISOString();
  const payload = { ...updates, updatedAt };

  try {
    await updateDoc(doc(db, 'payslips', recordId), payload);
  } catch (e) {
    console.warn('[PayrollStorage] Update Firestore fallback:', e);
  }

  // Update local cache
  try {
    const cached = getCachedPayrollRecords();
    const idx = cached.findIndex(r => r.id === recordId);
    if (idx >= 0) {
      cached[idx] = { ...cached[idx], ...payload };
      setCachedPayrollRecords(cached);
    }
  } catch {}

  try {
    const { WorkspaceEventService } = await import('./controlPlane/WorkspaceEventService');
    const isPaid = updates.status === 'paid';
    const isFinal = updates.status === 'finalized';
    if (isPaid || isFinal) {
      await WorkspaceEventService.emit({
        eventType: isPaid ? 'payroll.marked_paid' : 'payroll.finalized',
        entityType: 'payroll',
        entityId: recordId,
        actorId: updates.paidBy || updates.finalizedBy || 'accounts',
        actorName: updates.paidBy || updates.finalizedBy || 'Accounts Lead',
        actorRole: 'accounts',
        customDescription: isPaid 
          ? `Payroll record ${recordId} marked PAID (${updates.paymentReference || 'Bank Transfer'})`
          : `Payroll record ${recordId} finalized and locked for disbursement`
      });
    }
  } catch (e) {}
}

export async function deletePayrollDraft(recordId: string): Promise<void> {
  try {
    await deleteDoc(doc(db, 'payslips', recordId));
  } catch (e) {
    console.warn('[PayrollStorage] Delete Firestore fallback:', e);
  }

  // Remove from local cache
  try {
    const cached = getCachedPayrollRecords();
    const filtered = cached.filter(r => r.id !== recordId);
    setCachedPayrollRecords(filtered);
  } catch {}
}
