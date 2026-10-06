import React, { useState, useEffect, useMemo, useRef } from "react";
import {
  collection,
  onSnapshot,
  doc,
  setDoc,
  deleteDoc,
  updateDoc,
  query,
  where,
  getDocs,
  orderBy,
  writeBatch,
} from "firebase/firestore";
import { db, handleFirestoreError, OperationType } from "../../lib/firebase";
import { useAuth } from "../../context/AuthContext";
import {
  Calendar as CalendarIcon,
  Clock,
  UserCheck,
  Users,
  Plus,
  Trash2,
  Edit3,
  X,
  Check,
  FileText,
  Download,
  CheckCircle2,
  AlertTriangle,
  Briefcase,
  DollarSign,
  TrendingUp,
  Sun,
  Snowflake,
  FileSpreadsheet,
  Printer,
  ChevronLeft,
  ChevronRight,
  Info,
  LogOut,
  Search,
  Filter,
  CheckSquare,
  Square,
  Sliders,
  Settings,
  RotateCcw,
  Sparkles,
  ArrowRight,
  Shield,
  HelpCircle,
  Award,
  Building2,
  PieChart,
  CalendarDays,
} from "lucide-react";

// ── Types ─────────────────────────────────────────────────────────────
export interface Employee {
  employeeId: string;
  name: string;
  email: string;
  phone: string;
  role: string;
  department?: string;
  joiningDate: string;
  status: "Active" | "Inactive";
  monthlySalary: number;
  userId?: string;
  createdAt: string;
}

export interface Attendance {
  attendanceId: string; // employeeId_YYYY-MM-DD
  employeeId: string;
  employeeName: string;
  employeeEmail?: string;
  date: string; // YYYY-MM-DD
  status: "Present" | "Absent" | "Half Day" | "Late" | "Leave";
  checkIn?: string; // HH:MM
  checkOut?: string; // HH:MM
  breaks?: { start: string; end?: string }[];
  isLate?: boolean;
  notes?: string;
  markedAt: string;
  markedBy: string;
}

export interface LeaveRequest {
  requestId: string;
  employeeId: string;
  employeeName: string;
  employeeEmail: string;
  startDate: string;
  endDate: string;
  days: number;
  reason: string;
  leaveType: "Paid" | "Unpaid";
  status: "Pending" | "Approved" | "Rejected";
  approvedBy?: string;
  reviewedAt?: string;
  createdAt: string;
}

export interface Holiday {
  holidayId: string;
  title: string;
  date: string; // YYYY-MM-DD
  type: "National" | "Gazetted" | "Agency" | "Festival" | "Optional";
  description?: string;
  year: number;
  createdAt: string;
}

interface ShiftSettings {
  season: "Summer" | "Winter" | "Custom";
  startTime: string; // "09:00"
  endTime: string;   // "18:00"
  graceMinutes: number; // 15
  workingDays: number; // 6
}

// Full 2026 Agency Holiday Seed Calendar
const DEFAULT_AGENCY_HOLIDAYS: Holiday[] = [
  { holidayId: "hol-1", title: "Republic Day", date: "2026-01-26", type: "National", description: "National Holiday - Republic Day of India", year: 2026, createdAt: "2026-01-01T00:00:00Z" },
  { holidayId: "hol-2", title: "Maha Shivratri", date: "2026-02-16", type: "Festival", description: "Maha Shivratri Celebration", year: 2026, createdAt: "2026-01-01T00:00:00Z" },
  { holidayId: "hol-3", title: "Holi (Festival of Colors)", date: "2026-03-04", type: "Festival", description: "Agency-wide Holi Celebration", year: 2026, createdAt: "2026-01-01T00:00:00Z" },
  { holidayId: "hol-4", title: "Eid-ul-Fitr", date: "2026-03-20", type: "Festival", description: "Eid Celebration", year: 2026, createdAt: "2026-01-01T00:00:00Z" },
  { holidayId: "hol-5", title: "Good Friday", date: "2026-04-03", type: "Gazetted", description: "Good Friday Gazetted Holiday", year: 2026, createdAt: "2026-01-01T00:00:00Z" },
  { holidayId: "hol-6", title: "Dr. B.R. Ambedkar Jayanti", date: "2026-04-14", type: "Gazetted", description: "Ambedkar Jayanti", year: 2026, createdAt: "2026-01-01T00:00:00Z" },
  { holidayId: "hol-7", title: "Labour Day / May Day", date: "2026-05-01", type: "Agency", description: "International Workers Day", year: 2026, createdAt: "2026-01-01T00:00:00Z" },
  { holidayId: "hol-8", title: "Independence Day", date: "2026-08-15", type: "National", description: "Indian Independence Day Celebration", year: 2026, createdAt: "2026-01-01T00:00:00Z" },
  { holidayId: "hol-9", title: "Raksha Bandhan", date: "2026-08-27", type: "Festival", description: "Raksha Bandhan Festival", year: 2026, createdAt: "2026-01-01T00:00:00Z" },
  { holidayId: "hol-10", title: "Janmashtami", date: "2026-09-04", type: "Festival", description: "Shri Krishna Janmashtami", year: 2026, createdAt: "2026-01-01T00:00:00Z" },
  { holidayId: "hol-11", title: "Mahatma Gandhi Jayanti", date: "2026-10-02", type: "National", description: "National Holiday - Gandhi Jayanti", year: 2026, createdAt: "2026-01-01T00:00:00Z" },
  { holidayId: "hol-12", title: "Dussehra / Vijayadashami", date: "2026-10-20", type: "Festival", description: "Dussehra Festival", year: 2026, createdAt: "2026-01-01T00:00:00Z" },
  { holidayId: "hol-13", title: "Diwali (Deepavali)", date: "2026-11-08", type: "Festival", description: "Diwali Festival of Lights", year: 2026, createdAt: "2026-01-01T00:00:00Z" },
  { holidayId: "hol-14", title: "Govardhan Puja & Bhai Dooj", date: "2026-11-09", type: "Festival", description: "Bhai Dooj / Govardhan Puja", year: 2026, createdAt: "2026-01-01T00:00:00Z" },
  { holidayId: "hol-15", title: "Guru Nanak Jayanti", date: "2026-11-24", type: "Gazetted", description: "Guru Nanak Prakash Parv", year: 2026, createdAt: "2026-01-01T00:00:00Z" },
  { holidayId: "hol-16", title: "Christmas Day", date: "2026-12-25", type: "Gazetted", description: "Christmas Day Celebration", year: 2026, createdAt: "2026-01-01T00:00:00Z" },
  { holidayId: "hol-17", title: "Agency Year-End Wrap", date: "2026-12-31", type: "Agency", description: "DigiExplode Annual Wrap & New Year Eve", year: 2026, createdAt: "2026-01-01T00:00:00Z" },
];

// Default Seed Data
const DEFAULT_AGENCY_EMPLOYEES: Employee[] = [
  { employeeId: "emp-1", name: "Vansh", email: "admin@digiexplode.com", phone: "+91 98000 11111", role: "Super Admin", department: "Executive", joiningDate: "2024-01-01", status: "Active", monthlySalary: 150000, createdAt: "2024-01-01T00:00:00Z" },
  { employeeId: "emp-2", name: "Aman Sharma", email: "aman@digiexplode.com", phone: "+91 98000 22222", role: "Performance Marketer", department: "Growth & Ads", joiningDate: "2024-01-15", status: "Active", monthlySalary: 65000, createdAt: "2024-01-15T00:00:00Z" },
  { employeeId: "emp-3", name: "Neha Gupta", email: "neha@digiexplode.com", phone: "+91 98000 33333", role: "Senior Video Editor", department: "Creative Production", joiningDate: "2024-02-01", status: "Active", monthlySalary: 60000, createdAt: "2024-02-01T00:00:00Z" },
  { employeeId: "emp-4", name: "Rahul Verma", email: "rahul@digiexplode.com", phone: "+91 98000 44444", role: "Full Stack & SEO Lead", department: "Engineering", joiningDate: "2024-02-15", status: "Active", monthlySalary: 75000, createdAt: "2024-02-15T00:00:00Z" },
  { employeeId: "emp-5", name: "Priya Singh", email: "priya@digiexplode.com", phone: "+91 98000 55555", role: "Creative Visual Designer", department: "Design & Branding", joiningDate: "2024-03-01", status: "Active", monthlySalary: 55000, createdAt: "2024-03-01T00:00:00Z" },
  { employeeId: "emp-6", name: "Rohit Kumar", email: "rohit@digiexplode.com", phone: "+91 98000 66666", role: "Content Strategist", department: "Copy & Social", joiningDate: "2024-03-10", status: "Active", monthlySalary: 50000, createdAt: "2024-03-10T00:00:00Z" },
];

const todayDateStr = new Date().toISOString().split("T")[0];

const DEFAULT_INITIAL_ATTENDANCE: Attendance[] = DEFAULT_AGENCY_EMPLOYEES.map((emp, i) => ({
  attendanceId: `${emp.employeeId}_${todayDateStr}`,
  employeeId: emp.employeeId,
  employeeName: emp.name,
  employeeEmail: emp.email,
  date: todayDateStr,
  status: (i === 4 ? "Half Day" : i === 5 ? "Late" : "Present") as any,
  checkIn: i === 5 ? "10:15" : "09:30",
  checkOut: "18:30",
  markedAt: new Date().toISOString(),
  markedBy: "System Marker",
}));

const DEFAULT_LEAVES_SAMPLE: LeaveRequest[] = [
  {
    requestId: "leave-1",
    employeeId: "emp-3",
    employeeName: "Neha Gupta",
    employeeEmail: "neha@digiexplode.com",
    startDate: new Date(Date.now() + 86400000 * 5).toISOString().split("T")[0],
    endDate: new Date(Date.now() + 86400000 * 6).toISOString().split("T")[0],
    days: 2,
    reason: "Creative Video Summit, Mumbai",
    leaveType: "Paid",
    status: "Pending",
    createdAt: new Date().toISOString(),
  },
];

// Helper: Calculate work hours
function computeWorkDuration(inTime?: string, outTime?: string): { text: string; hours: number; tag: "Full Day" | "Short Hours" | "Overtime" | "In Progress" | "-" } {
  if (!inTime) return { text: "-", hours: 0, tag: "-" };
  if (!outTime) return { text: "In Office", hours: 0, tag: "In Progress" };

  const [inH, inM] = inTime.split(":").map(Number);
  const [outH, outM] = outTime.split(":").map(Number);
  const diffMins = outH * 60 + outM - (inH * 60 + inM);

  if (diffMins <= 0) return { text: "Invalid", hours: 0, tag: "-" };

  const hours = Math.floor(diffMins / 60);
  const mins = diffMins % 60;
  const text = `${hours}h ${mins > 0 ? `${mins}m` : ""}`.trim();

  let tag: "Full Day" | "Short Hours" | "Overtime" = "Full Day";
  if (hours >= 9) tag = "Overtime";
  else if (hours < 8) tag = "Short Hours";

  return { text, hours: diffMins / 60, tag };
}

export const AttendanceView: React.FC = () => {
  const { profile, user } = useAuth();
  const isAdminOrSuper = profile?.role === "admin" || profile?.role === "superAdmin";

  // Data states
  const [employees, setEmployees] = useState<Employee[]>(() => {
    try {
      const cached = localStorage.getItem('digi_local_employees');
      if (cached) {
        const parsed = JSON.parse(cached);
        if (Array.isArray(parsed) && parsed.length > 0) {
          return parsed.map((item: any) => ({
            employeeId: item.employeeId || item.id,
            name: item.name,
            email: item.email,
            phone: item.phone || '',
            role: item.role || item.designation || 'Specialist',
            department: item.department || 'Operations',
            joiningDate: item.joiningDate || todayDateStr,
            status: item.status || 'Active',
            monthlySalary: Number(item.monthlySalary) || 45000,
            createdAt: item.createdAt || new Date().toISOString(),
          }));
        }
      }
    } catch (e) {}
    return DEFAULT_AGENCY_EMPLOYEES;
  });

  const [attendance, setAttendance] = useState<Attendance[]>(() => {
    try {
      const cached = localStorage.getItem('digi_local_attendance');
      if (cached) {
        const parsed = JSON.parse(cached);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch (e) {}
    return DEFAULT_INITIAL_ATTENDANCE;
  });

  const [leaves, setLeaves] = useState<LeaveRequest[]>(DEFAULT_LEAVES_SAMPLE);
  const [loading, setLoading] = useState(false);

  // Listen to cross-module sync events (employees, attendance & holidays)
  useEffect(() => {
    const syncHandler = (e: any) => {
      if (e?.detail && Array.isArray(e.detail)) {
        setEmployees(e.detail.map((item: any) => ({
          employeeId: item.employeeId || item.id,
          name: item.name,
          email: item.email,
          phone: item.phone || '',
          role: item.role || item.designation || 'Specialist',
          department: item.department || 'Operations',
          joiningDate: item.joiningDate || todayDateStr,
          status: item.status || 'Active',
          monthlySalary: Number(item.monthlySalary) || 45000,
          createdAt: item.createdAt || new Date().toISOString(),
        })));
      }
    };

    const attSyncHandler = (e: any) => {
      if (e?.detail && Array.isArray(e.detail)) {
        setAttendance(e.detail);
      }
    };

    const holSyncHandler = (e: any) => {
      if (e?.detail && Array.isArray(e.detail)) {
        setHolidays(e.detail);
      }
    };

    window.addEventListener('digi_employees_sync', syncHandler);
    window.addEventListener('digi_attendance_sync', attSyncHandler);
    window.addEventListener('digi_holidays_sync', holSyncHandler);
    window.addEventListener('storage', () => {
      try {
        const cachedEmp = localStorage.getItem('digi_local_employees');
        if (cachedEmp) {
          const parsed = JSON.parse(cachedEmp);
          if (Array.isArray(parsed)) syncHandler({ detail: parsed });
        }
        const cachedAtt = localStorage.getItem('digi_local_attendance');
        if (cachedAtt) {
          const parsed = JSON.parse(cachedAtt);
          if (Array.isArray(parsed)) attSyncHandler({ detail: parsed });
        }
        const cachedHol = localStorage.getItem('digi_local_holidays');
        if (cachedHol) {
          const parsed = JSON.parse(cachedHol);
          if (Array.isArray(parsed)) holSyncHandler({ detail: parsed });
        }
      } catch (e) {}
    });

    return () => {
      window.removeEventListener('digi_employees_sync', syncHandler);
      window.removeEventListener('digi_attendance_sync', attSyncHandler);
      window.removeEventListener('digi_holidays_sync', holSyncHandler);
    };
  }, []);

  // Selected date
  const [selectedDate, setSelectedDate] = useState<string>(todayDateStr);

  // Navigation tab: 'mark' | 'employees' | 'leaves' | 'reports' | 'holidays'
  const [adminTab, setAdminTab] = useState<"mark" | "employees" | "leaves" | "reports" | "holidays">("mark");

  // Holiday management states
  const [holidays, setHolidays] = useState<Holiday[]>(() => {
    try {
      const cached = localStorage.getItem('digi_local_holidays');
      if (cached) {
        const parsed = JSON.parse(cached);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch (e) {}
    return DEFAULT_AGENCY_HOLIDAYS;
  });
  const [holidayYear, setHolidayYear] = useState<number>(2026);
  const [holidaySearch, setHolidaySearch] = useState<string>("");
  const [holidayTypeFilter, setHolidayTypeFilter] = useState<string>("All");
  const [showHolidayModal, setShowHolidayModal] = useState(false);
  const [holidayForm, setHolidayForm] = useState({
    title: "",
    date: todayDateStr,
    type: "Festival" as "National" | "Gazetted" | "Agency" | "Festival" | "Optional",
    description: "",
  });

  // Daily Marking temporary states
  const [dailyCheckIn, setDailyCheckIn] = useState<Record<string, string>>({});
  const [dailyCheckOut, setDailyCheckOut] = useState<Record<string, string>>({});
  const [dailyStatus, setDailyStatus] = useState<Record<string, "Present" | "Absent" | "Half Day" | "Late" | "Leave">>({});
  const [dailyNotes, setDailyNotes] = useState<Record<string, string>>({});

  // Modification tracking for Batch Save
  const [modifiedStaffIds, setModifiedStaffIds] = useState<Set<string>>(new Set());
  const [isSavingBatch, setIsSavingBatch] = useState(false);
  const [toastMessage, setToastMessage] = useState<{ text: string; type: "success" | "info" | "error" } | null>(null);

  // Search & Filter & Bulk Selection
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("All");
  const [selectedStaffIds, setSelectedStaffIds] = useState<Set<string>>(new Set());

  // Suggestive search state
  const [isSearchFocused, setIsSearchFocused] = useState(false);
  const searchContainerRef = useRef<HTMLDivElement>(null);

  // Summary Period View: 'daily' | 'monthly' | 'yearly'
  const [summaryPeriod, setSummaryPeriod] = useState<"daily" | "monthly" | "yearly">("daily");
  const [analyticsMonth, setAnalyticsMonth] = useState<string>(todayDateStr.substring(0, 7));
  const [analyticsYear, setAnalyticsYear] = useState<string>(todayDateStr.substring(0, 4));

  // Staff Directory filter
  const [staffDirectorySearch, setStaffDirectorySearch] = useState("");
  const [staffDirectoryDept, setStaffDirectoryDept] = useState("All");

  // Close search suggestions on click outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (searchContainerRef.current && !searchContainerRef.current.contains(e.target as Node)) {
        setIsSearchFocused(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Modals & Settings
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [shiftConfig, setShiftConfig] = useState<ShiftSettings>({
    season: "Summer",
    startTime: "09:00",
    endTime: "18:00",
    graceMinutes: 15,
    workingDays: 6,
  });

  // Employee Modal states (Onboarding / Edit)
  const [showEmployeeModal, setShowEmployeeModal] = useState(false);
  const [editingEmployee, setEditingEmployee] = useState<Employee | null>(null);
  const [empForm, setEmpForm] = useState({
    name: "",
    email: "",
    phone: "",
    role: "Graphic Designer",
    department: "Creative Production",
    joiningDate: todayDateStr,
    status: "Active" as "Active" | "Inactive",
    monthlySalary: 45000,
  });

  // Reports view states
  const [reportEmployeeId, setReportEmployeeId] = useState<string>(DEFAULT_AGENCY_EMPLOYEES[0].employeeId);
  const [reportMonth, setReportMonth] = useState<string>(new Date().toISOString().substring(0, 7));

  // Leave Form state for staff
  const [leaveForm, setLeaveForm] = useState({
    startDate: todayDateStr,
    endDate: todayDateStr,
    reason: "",
    leaveType: "Paid" as "Paid" | "Unpaid",
  });

  // Employee view linked state
  const [linkedEmployee, setLinkedEmployee] = useState<Employee | null>(DEFAULT_AGENCY_EMPLOYEES[0]);

  const showToast = (text: string, type: "success" | "info" | "error" = "success") => {
    setToastMessage({ text, type });
    setTimeout(() => setToastMessage(null), 3200);
  };

  // Keyboard shortcut: Ctrl+S to save attendance
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "s") {
        e.preventDefault();
        if (modifiedStaffIds.size > 0) {
          handleBatchSave();
        }
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [modifiedStaffIds, dailyStatus, dailyCheckIn, dailyCheckOut, dailyNotes, selectedDate, employees]);

  // 1. Real-time Firebase Listeners
  useEffect(() => {
    if (!profile && !user) return;

    let empQuery: any = collection(db, "employees");
    let attQuery: any = collection(db, "attendance");
    let leaveQuery: any = collection(db, "leaveRequests");

    if (profile && profile.role === "employee" && profile.email) {
      empQuery = query(collection(db, "employees"), where("email", "==", profile.email));
      attQuery = query(collection(db, "attendance"), where("employeeEmail", "==", profile.email));
      leaveQuery = query(collection(db, "leaveRequests"), where("employeeEmail", "==", profile.email));
    }

    const unsubEmp = onSnapshot(
      empQuery,
      (snap: any) => {
        const list: Employee[] = [];
        snap.forEach((d: any) => list.push({ employeeId: d.id, ...d.data() } as Employee));
        // Keep locally onboarded staff while Firestore catches up.  The
        // attendance screen used to replace the local list whenever the
        // snapshot returned the older set of employees, making newly added
        // staff disappear until a full refresh/sync.
        let merged = list;
        try {
          const cached = localStorage.getItem('digi_local_employees');
          const localList = cached ? JSON.parse(cached) : [];
          if (Array.isArray(localList) && localList.length > 0) {
            const byId = new Map<string, Employee>();
            localList.forEach((item: any) => {
              const id = item.employeeId || item.id;
              if (id) byId.set(id, { employeeId: id, ...item } as Employee);
            });
            // Firestore is authoritative for records it has, while local
            // records that are still pending sync remain visible.
            list.forEach((item) => byId.set(item.employeeId, item));
            merged = Array.from(byId.values());
          }
        } catch (e) {}

        if (merged.length > 0) {
          setEmployees(merged);
          localStorage.setItem('digi_local_employees', JSON.stringify(merged));
        } else {
          try {
            const cached = localStorage.getItem('digi_local_employees');
            if (cached) {
              const parsed = JSON.parse(cached);
              if (Array.isArray(parsed) && parsed.length > 0) {
                setEmployees(parsed);
                setLoading(false);
                return;
              }
            }
          } catch (e) {}
          setEmployees(DEFAULT_AGENCY_EMPLOYEES);
        }

        if (profile?.email) {
          const current = merged.length > 0 ? merged : DEFAULT_AGENCY_EMPLOYEES;
          const found = current.find((e) => e.email.toLowerCase() === profile.email.toLowerCase());
          if (found) {
            setLinkedEmployee(found);
            setReportEmployeeId(found.employeeId);
          }
        }
        setLoading(false);
      },
      () => {
        try {
          const cached = localStorage.getItem('digi_local_employees');
          if (cached) {
            const parsed = JSON.parse(cached);
            if (Array.isArray(parsed) && parsed.length > 0) {
              setEmployees(parsed);
              setLoading(false);
              return;
            }
          }
        } catch (e) {}
        setEmployees(DEFAULT_AGENCY_EMPLOYEES);
        setLoading(false);
      }
    );

    const unsubAtt = onSnapshot(
      attQuery,
      (snap: any) => {
        const list: Attendance[] = [];
        snap.forEach((d: any) => list.push({ attendanceId: d.id, ...d.data() } as Attendance));
        if (list.length > 0) {
          setAttendance(list);
          localStorage.setItem('digi_local_attendance', JSON.stringify(list));
        } else {
          try {
            const cached = localStorage.getItem('digi_local_attendance');
            if (cached) {
              const parsed = JSON.parse(cached);
              if (Array.isArray(parsed) && parsed.length > 0) {
                setAttendance(parsed);
                setLoading(false);
                return;
              }
            }
          } catch (e) {}
          setAttendance(DEFAULT_INITIAL_ATTENDANCE);
        }
        setLoading(false);
      },
      () => {
        try {
          const cached = localStorage.getItem('digi_local_attendance');
          if (cached) {
            const parsed = JSON.parse(cached);
            if (Array.isArray(parsed) && parsed.length > 0) {
              setAttendance(parsed);
              setLoading(false);
              return;
            }
          }
        } catch (e) {}
        setAttendance(DEFAULT_INITIAL_ATTENDANCE);
        setLoading(false);
      }
    );

    const unsubLeaves = onSnapshot(
      leaveQuery,
      (snap: any) => {
        const list: LeaveRequest[] = [];
        snap.forEach((d: any) => list.push({ requestId: d.id, ...d.data() } as LeaveRequest));
        if (list.length > 0) {
          list.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
          setLeaves(list);
        } else {
          setLeaves(DEFAULT_LEAVES_SAMPLE);
        }
        setLoading(false);
      },
      () => {
        setLeaves(DEFAULT_LEAVES_SAMPLE);
        setLoading(false);
      }
    );

    const unsubHolidays = onSnapshot(
      collection(db, "holidays"),
      (snap: any) => {
        const list: Holiday[] = [];
        snap.forEach((d: any) => list.push({ holidayId: d.id, ...d.data() } as Holiday));
        if (list.length > 0) {
          list.sort((a, b) => a.date.localeCompare(b.date));
          setHolidays(list);
          localStorage.setItem('digi_local_holidays', JSON.stringify(list));
        } else {
          try {
            const cached = localStorage.getItem('digi_local_holidays');
            if (cached) {
              const parsed = JSON.parse(cached);
              if (Array.isArray(parsed) && parsed.length > 0) {
                setHolidays(parsed);
                return;
              }
            }
          } catch (e) {}
          setHolidays(DEFAULT_AGENCY_HOLIDAYS);
        }
      },
      () => {
        try {
          const cached = localStorage.getItem('digi_local_holidays');
          if (cached) {
            const parsed = JSON.parse(cached);
            if (Array.isArray(parsed) && parsed.length > 0) {
              setHolidays(parsed);
              return;
            }
          }
        } catch (e) {}
        setHolidays(DEFAULT_AGENCY_HOLIDAYS);
      }
    );

    return () => {
      unsubEmp();
      unsubAtt();
      unsubLeaves();
      unsubHolidays();
    };
  }, [profile, user]);

  // Sync daily inputs whenever date, attendance, or employees change
  useEffect(() => {
    const inMap: Record<string, string> = {};
    const outMap: Record<string, string> = {};
    const statusMap: Record<string, "Present" | "Absent" | "Half Day" | "Late" | "Leave"> = {};
    const notesMap: Record<string, string> = {};

    employees.forEach((emp) => {
      const attId = `${emp.employeeId}_${selectedDate}`;
      const record = attendance.find((a) => a.attendanceId === attId);

      // Check if employee has approved leave on this date
      const approvedLeave = leaves.find(
        (l) =>
          l.employeeId === emp.employeeId &&
          l.status === "Approved" &&
          selectedDate >= l.startDate &&
          selectedDate <= l.endDate
      );

      if (record) {
        inMap[emp.employeeId] = record.checkIn || "";
        outMap[emp.employeeId] = record.checkOut || "";
        statusMap[emp.employeeId] = record.status;
        notesMap[emp.employeeId] = record.notes || "";
      } else if (approvedLeave) {
        inMap[emp.employeeId] = "";
        outMap[emp.employeeId] = "";
        statusMap[emp.employeeId] = "Leave";
        notesMap[emp.employeeId] = `Approved ${approvedLeave.leaveType} Leave (${approvedLeave.reason})`;
      } else {
        inMap[emp.employeeId] = "";
        outMap[emp.employeeId] = "";
        statusMap[emp.employeeId] = "Present";
        notesMap[emp.employeeId] = "";
      }
    });

    setDailyCheckIn(inMap);
    setDailyCheckOut(outMap);
    setDailyStatus(statusMap);
    setDailyNotes(notesMap);
    setModifiedStaffIds(new Set());
    setSelectedStaffIds(new Set());
  }, [selectedDate, employees, attendance, leaves]);

  // Status Change Handler with Auto Grace/Time Trigger
  const handleStatusChange = (empId: string, newStatus: "Present" | "Absent" | "Half Day" | "Late" | "Leave") => {
    setDailyStatus((prev) => ({ ...prev, [empId]: newStatus }));
    setModifiedStaffIds((prev) => new Set(prev).add(empId));

    if (newStatus === "Present" && !dailyCheckIn[empId]) {
      setDailyCheckIn((prev) => ({ ...prev, [empId]: shiftConfig.startTime }));
      if (!dailyCheckOut[empId]) {
        setDailyCheckOut((prev) => ({ ...prev, [empId]: shiftConfig.endTime }));
      }
    } else if (newStatus === "Late" && !dailyCheckIn[empId]) {
      setDailyCheckIn((prev) => ({ ...prev, [empId]: "09:45" }));
    } else if (newStatus === "Absent" || newStatus === "Leave") {
      setDailyCheckIn((prev) => ({ ...prev, [empId]: "" }));
      setDailyCheckOut((prev) => ({ ...prev, [empId]: "" }));
    }
  };

  // Time Change with Auto Late Detection
  const handleTimeChange = (empId: string, type: "in" | "out", value: string) => {
    setModifiedStaffIds((prev) => new Set(prev).add(empId));
    if (type === "in") {
      setDailyCheckIn((prev) => ({ ...prev, [empId]: value }));

      if (value) {
        const [h, m] = value.split(":").map(Number);
        const checkMins = h * 60 + m;
        const [sh, sm] = shiftConfig.startTime.split(":").map(Number);
        const shiftStartMins = sh * 60 + sm;
        const graceThreshold = shiftStartMins + shiftConfig.graceMinutes;

        if (checkMins > graceThreshold && dailyStatus[empId] === "Present") {
          setDailyStatus((prev) => ({ ...prev, [empId]: "Late" }));
        } else if (checkMins <= graceThreshold && dailyStatus[empId] === "Late") {
          setDailyStatus((prev) => ({ ...prev, [empId]: "Present" }));
        }
      }
    } else {
      setDailyCheckOut((prev) => ({ ...prev, [empId]: value }));
    }
  };

  // Quick Time Shortcut ("Now", "09:00 AM", "06:00 PM")
  const setQuickTime = (empId: string, type: "in" | "out", preset: "now" | "shift_start" | "shift_end") => {
    let timeStr = "";
    if (preset === "now") {
      const now = new Date();
      timeStr = `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;
    } else if (preset === "shift_start") {
      timeStr = shiftConfig.startTime;
    } else {
      timeStr = shiftConfig.endTime;
    }
    handleTimeChange(empId, type, timeStr);
  };

  // "Mark All Present" Action
  const handleMarkAllPresent = () => {
    const activeStaff = employees.filter((e) => e.status === "Active");
    const updatedStatus = { ...dailyStatus };
    const updatedIn = { ...dailyCheckIn };
    const updatedOut = { ...dailyCheckOut };
    const newModified = new Set(modifiedStaffIds);

    let count = 0;
    activeStaff.forEach((emp) => {
      // Do not overwrite approved Leave
      if (updatedStatus[emp.employeeId] !== "Leave") {
        updatedStatus[emp.employeeId] = "Present";
        if (!updatedIn[emp.employeeId]) updatedIn[emp.employeeId] = shiftConfig.startTime;
        if (!updatedOut[emp.employeeId]) updatedOut[emp.employeeId] = shiftConfig.endTime;
        newModified.add(emp.employeeId);
        count++;
      }
    });

    setDailyStatus(updatedStatus);
    setDailyCheckIn(updatedIn);
    setDailyCheckOut(updatedOut);
    setModifiedStaffIds(newModified);
    showToast(`✓ Marked ${count} employees as Present!`);
  };

  // Bulk Apply Status to Selected
  const handleBulkStatusApply = (status: "Present" | "Absent" | "Half Day" | "Late" | "Leave") => {
    if (selectedStaffIds.size === 0) return;
    const updatedStatus = { ...dailyStatus };
    const updatedIn = { ...dailyCheckIn };
    const updatedOut = { ...dailyCheckOut };
    const newModified = new Set(modifiedStaffIds);

    selectedStaffIds.forEach((empId) => {
      updatedStatus[empId] = status;
      newModified.add(empId);
      if (status === "Present" && !updatedIn[empId]) {
        updatedIn[empId] = shiftConfig.startTime;
        updatedOut[empId] = shiftConfig.endTime;
      } else if (status === "Absent" || status === "Leave") {
        updatedIn[empId] = "";
        updatedOut[empId] = "";
      }
    });

    setDailyStatus(updatedStatus);
    setDailyCheckIn(updatedIn);
    setDailyCheckOut(updatedOut);
    setModifiedStaffIds(newModified);
    showToast(`✓ Updated ${selectedStaffIds.size} employees to ${status}`);
    setSelectedStaffIds(new Set());
  };

  // Save single row immediately
  const handleSaveSingleRow = async (empId: string) => {
    const emp = employees.find((e) => e.employeeId === empId);
    if (!emp) return;

    const attId = `${empId}_${selectedDate}`;
    const status = dailyStatus[empId] || "Present";
    const checkIn = dailyCheckIn[empId] || "";
    const checkOut = dailyCheckOut[empId] || "";
    const notes = dailyNotes[empId] || "";

    const payload: Attendance = {
      attendanceId: attId,
      employeeId: emp.employeeId,
      employeeName: emp.name,
      employeeEmail: emp.email,
      date: selectedDate,
      status,
      checkIn: status === "Present" || status === "Late" || status === "Half Day" ? checkIn : "",
      checkOut: status === "Present" || status === "Late" || status === "Half Day" ? checkOut : "",
      isLate: status === "Late",
      notes,
      markedAt: new Date().toISOString(),
      markedBy: profile?.name || "Admin",
    };

    const updatedAttendance = [...attendance];
    const idx = updatedAttendance.findIndex((a) => a.attendanceId === attId);
    if (idx >= 0) updatedAttendance[idx] = payload;
    else updatedAttendance.push(payload);

    setAttendance(updatedAttendance);
    localStorage.setItem('digi_local_attendance', JSON.stringify(updatedAttendance));
    window.dispatchEvent(new CustomEvent('digi_attendance_sync', { detail: updatedAttendance }));

    setModifiedStaffIds((prev) => {
      const next = new Set(prev);
      next.delete(empId);
      return next;
    });

    try {
      await setDoc(doc(db, "attendance", attId), payload, { merge: true });
    } catch (err) {
      console.warn("Single save firestore notice (preserved locally):", err);
    }

    showToast(`✓ Attendance saved for ${emp.name}!`);
  };

  // Batch Save modified records to Firestore & localStorage
  const handleBatchSave = async () => {
    if (modifiedStaffIds.size === 0) return;
    setIsSavingBatch(true);

    try {
      const batch = writeBatch(db);
      const modifiedList = employees.filter((e) => modifiedStaffIds.has(e.employeeId));

      const updatedAttendance = [...attendance];

      for (const emp of modifiedList) {
        const attId = `${emp.employeeId}_${selectedDate}`;
        const status = dailyStatus[emp.employeeId] || "Present";
        const checkIn = dailyCheckIn[emp.employeeId] || "";
        const checkOut = dailyCheckOut[emp.employeeId] || "";
        const notes = dailyNotes[emp.employeeId] || "";

        const payload: Attendance = {
          attendanceId: attId,
          employeeId: emp.employeeId,
          employeeName: emp.name,
          employeeEmail: emp.email,
          date: selectedDate,
          status,
          checkIn: status === "Present" || status === "Late" || status === "Half Day" ? checkIn : "",
          checkOut: status === "Present" || status === "Late" || status === "Half Day" ? checkOut : "",
          isLate: status === "Late",
          notes,
          markedAt: new Date().toISOString(),
          markedBy: profile?.name || "Admin",
        };

        const docRef = doc(db, "attendance", attId);
        batch.set(docRef, payload, { merge: true });

        // Update local memory
        const idx = updatedAttendance.findIndex((a) => a.attendanceId === attId);
        if (idx >= 0) updatedAttendance[idx] = payload;
        else updatedAttendance.push(payload);
      }

      // Persist to localStorage immediately
      localStorage.setItem('digi_local_attendance', JSON.stringify(updatedAttendance));
      window.dispatchEvent(new CustomEvent('digi_attendance_sync', { detail: updatedAttendance }));
      setAttendance(updatedAttendance);
      setModifiedStaffIds(new Set());

      await batch.commit();
      showToast(`✓ Successfully saved attendance for ${modifiedList.length} staff members!`);
    } catch (err) {
      console.warn("Batch save notice (saved to local state):", err);
      setModifiedStaffIds(new Set());
      showToast(`✓ Attendance changes applied locally!`);
    } finally {
      setIsSavingBatch(false);
    }
  };

  // Discard Unsaved Changes
  const handleDiscardChanges = () => {
    // Reset to date snapshot
    const inMap: Record<string, string> = {};
    const outMap: Record<string, string> = {};
    const statusMap: Record<string, "Present" | "Absent" | "Half Day" | "Late" | "Leave"> = {};
    const notesMap: Record<string, string> = {};

    employees.forEach((emp) => {
      const attId = `${emp.employeeId}_${selectedDate}`;
      const record = attendance.find((a) => a.attendanceId === attId);
      if (record) {
        inMap[emp.employeeId] = record.checkIn || "";
        outMap[emp.employeeId] = record.checkOut || "";
        statusMap[emp.employeeId] = record.status;
        notesMap[emp.employeeId] = record.notes || "";
      } else {
        inMap[emp.employeeId] = "";
        outMap[emp.employeeId] = "";
        statusMap[emp.employeeId] = "Present";
        notesMap[emp.employeeId] = "";
      }
    });

    setDailyCheckIn(inMap);
    setDailyCheckOut(outMap);
    setDailyStatus(statusMap);
    setDailyNotes(notesMap);
    setModifiedStaffIds(new Set());
    showToast("Changes discarded", "info");
  };

  // Date Navigation
  const stepDate = (offsetDays: number) => {
    if (modifiedStaffIds.size > 0) {
      if (!window.confirm("You have unsaved attendance changes. Proceeding will discard them. Continue?")) {
        return;
      }
    }
    const curr = new Date(selectedDate);
    curr.setDate(curr.getDate() + offsetDays);
    setSelectedDate(curr.toISOString().split("T")[0]);
  };

  // Filtered staff list for Daily Marker (Searches name, role, department, email, employeeId, notes)
  const activeStaffList = useMemo(() => {
    // Include pending local records as well as the live state. AdminList can
    // save a new employee locally while the Firestore listener still has an
    // older snapshot, so deriving the table from state alone can hide them.
    let source = employees;
    try {
      const cached = localStorage.getItem('digi_local_employees');
      const localList = cached ? JSON.parse(cached) : [];
      if (Array.isArray(localList)) {
        const byId = new Map<string, Employee>();
        [...employees, ...localList].forEach((item: any) => {
          const id = item.employeeId || item.id;
          if (!id) return;
          byId.set(id, {
            ...item,
            employeeId: id,
            status: item.status === 'Inactive' || item.status === 'inactive' ? 'Inactive' : 'Active',
          } as Employee);
        });
        source = Array.from(byId.values());
      }
    } catch (e) {}

    return source.filter((e) => {
      if (e.status !== "Active" && (e.status as string)?.toLowerCase() !== "active") return false;
      const q = searchQuery.toLowerCase().trim();
      const currentNotes = (dailyNotes[e.employeeId] || "").toLowerCase();
      const matchesSearch =
        !q ||
        e.name.toLowerCase().includes(q) ||
        e.role.toLowerCase().includes(q) ||
        (e.department && e.department.toLowerCase().includes(q)) ||
        (e.email && e.email.toLowerCase().includes(q)) ||
        (e.employeeId && e.employeeId.toLowerCase().includes(q)) ||
        currentNotes.includes(q);

      if (!matchesSearch) return false;

      const currentStatus = dailyStatus[e.employeeId] || "Present";
      if (statusFilter === "All") return true;
      if (statusFilter === "Not Marked") return !dailyCheckIn[e.employeeId] && currentStatus === "Present";
      return currentStatus === statusFilter;
    });
  }, [employees, searchQuery, statusFilter, dailyStatus, dailyCheckIn, dailyNotes]);

  // Autocomplete Suggestions for Search Bar
  const searchSuggestions = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    const activeStaff = employees.filter((e) => e.status === "Active");

    const matchedStaff = activeStaff
      .filter(
        (e) =>
          !q ||
          e.name.toLowerCase().includes(q) ||
          e.role.toLowerCase().includes(q) ||
          (e.department && e.department.toLowerCase().includes(q)) ||
          e.email.toLowerCase().includes(q)
      )
      .slice(0, 6);

    const depts = Array.from(new Set(activeStaff.map((e) => e.department).filter(Boolean))) as string[];
    const matchedDepts = depts.filter((d) => !q || d.toLowerCase().includes(q)).slice(0, 5);

    const roles = Array.from(new Set(activeStaff.map((e) => e.role).filter(Boolean))) as string[];
    const matchedRoles = roles.filter((r) => !q || r.toLowerCase().includes(q)).slice(0, 5);

    return {
      staff: matchedStaff,
      departments: matchedDepts,
      roles: matchedRoles,
    };
  }, [employees, searchQuery]);

  // Filtered staff list for Staff Directory
  const staffDirectoryList = useMemo(() => {
    return employees.filter((e) => {
      const matchesSearch =
        !staffDirectorySearch ||
        e.name.toLowerCase().includes(staffDirectorySearch.toLowerCase()) ||
        e.email.toLowerCase().includes(staffDirectorySearch.toLowerCase()) ||
        e.role.toLowerCase().includes(staffDirectorySearch.toLowerCase()) ||
        (e.department && e.department.toLowerCase().includes(staffDirectorySearch.toLowerCase()));

      if (!matchesSearch) return false;

      if (staffDirectoryDept !== "All" && e.department !== staffDirectoryDept) {
        return false;
      }

      return true;
    });
  }, [employees, staffDirectorySearch, staffDirectoryDept]);

  // 1. COMBINED DAILY SUMMARY (Selected Date)
  const dailyCombinedSummary = useMemo(() => {
    const activeStaff = employees.filter((e) => e.status === "Active");
    let present = 0,
      late = 0,
      halfDay = 0,
      absent = 0,
      leave = 0,
      notMarked = 0;
    let totalHoursLogged = 0;

    activeStaff.forEach((emp) => {
      const s = dailyStatus[emp.employeeId] || "Present";
      const checkIn = dailyCheckIn[emp.employeeId];
      const checkOut = dailyCheckOut[emp.employeeId];

      if (s === "Present") present++;
      else if (s === "Late") late++;
      else if (s === "Half Day") halfDay++;
      else if (s === "Absent") absent++;
      else if (s === "Leave") leave++;

      if (!checkIn && s === "Present") notMarked++;

      if (checkIn && checkOut) {
        const duration = computeWorkDuration(checkIn, checkOut);
        totalHoursLogged += duration.hours;
      }
    });

    const total = activeStaff.length;
    const attended = present + late + halfDay;
    const attendanceRate = total > 0 ? Math.round((attended / total) * 100) : 0;
    const punctualityRate = attended > 0 ? Math.round((present / attended) * 100) : 100;

    return {
      total,
      present,
      late,
      halfDay,
      absent,
      leave,
      notMarked,
      totalHoursLogged: Math.round(totalHoursLogged * 10) / 10,
      attendanceRate,
      punctualityRate,
    };
  }, [employees, dailyStatus, dailyCheckIn, dailyCheckOut]);

  // 2. COMBINED MONTHLY SUMMARY (Selected Month across all staff)
  const monthlyCombinedSummary = useMemo(() => {
    const monthPrefix = analyticsMonth;
    const activeStaff = employees.filter((e) => e.status === "Active");
    const monthRecords = attendance.filter((a) => a.date.startsWith(monthPrefix));

    let totalPresent = 0,
      totalLate = 0,
      totalHalfDay = 0,
      totalAbsent = 0,
      totalLeave = 0;
    let totalHoursLogged = 0;
    let totalEstimatedPayroll = 0;

    const staffStats = activeStaff.map((emp) => {
      const empRecords = monthRecords.filter((r) => r.employeeId === emp.employeeId);
      const p = empRecords.filter((r) => r.status === "Present").length;
      const l = empRecords.filter((r) => r.status === "Late").length;
      const h = empRecords.filter((r) => r.status === "Half Day").length;
      const ab = empRecords.filter((r) => r.status === "Absent").length;
      const lv = empRecords.filter((r) => r.status === "Leave").length;

      totalPresent += p;
      totalLate += l;
      totalHalfDay += h;
      totalAbsent += ab;
      totalLeave += lv;

      empRecords.forEach((r) => {
        if (r.checkIn && r.checkOut) {
          totalHoursLogged += computeWorkDuration(r.checkIn, r.checkOut).hours;
        }
      });

      const effectivePresent = p + l + h * 0.5 + lv;
      const baseSalary = emp.monthlySalary || 45000;
      const earnedSalary = Math.round((baseSalary / 26) * Math.min(effectivePresent, 26));
      totalEstimatedPayroll += earnedSalary;

      const totalLoggedDays = p + l + h + ab + lv;
      const punctualityScore = p + l > 0 ? Math.round((p / (p + l)) * 100) : 100;
      const attendanceScore = totalLoggedDays > 0 ? Math.round((effectivePresent / totalLoggedDays) * 100) : 100;

      return {
        emp,
        present: p,
        late: l,
        halfDay: h,
        absent: ab,
        leave: lv,
        effectiveDays: effectivePresent,
        earnedSalary,
        punctualityScore,
        attendanceScore,
      };
    });

    const totalManDays = totalPresent + totalLate + totalHalfDay + totalAbsent + totalLeave;
    const effectiveManDays = totalPresent + totalLate + totalHalfDay * 0.5 + totalLeave;
    const avgAttendanceRate = totalManDays > 0 ? Math.round((effectiveManDays / totalManDays) * 100) : 96;
    const avgPunctualityRate =
      totalPresent + totalLate > 0 ? Math.round((totalPresent / (totalPresent + totalLate)) * 100) : 95;

    const starPerformers = [...staffStats]
      .filter((s) => s.present + s.late > 0)
      .sort((a, b) => b.punctualityScore - a.punctualityScore || b.present - a.present)
      .slice(0, 3);

    return {
      month: monthPrefix,
      totalStaff: activeStaff.length,
      totalManDays,
      totalPresent,
      totalLate,
      totalHalfDay,
      totalAbsent,
      totalLeave,
      totalHoursLogged: Math.round(totalHoursLogged * 10) / 10,
      totalEstimatedPayroll,
      avgAttendanceRate,
      avgPunctualityRate,
      staffStats,
      starPerformers,
    };
  }, [employees, attendance, analyticsMonth]);

  // 3. COMBINED YEARLY / TILL NOW SUMMARY (Cumulative across all staff)
  const yearlyCombinedSummary = useMemo(() => {
    const yearPrefix = analyticsYear;
    const activeStaff = employees.filter((e) => e.status === "Active");
    const yearRecords = attendance.filter((a) => a.date.startsWith(yearPrefix));

    let totalPresent = 0,
      totalLate = 0,
      totalHalfDay = 0,
      totalAbsent = 0,
      totalLeave = 0;
    let totalHoursLogged = 0;
    let totalYtdPayroll = 0;

    const staffStats = activeStaff.map((emp) => {
      const empRecords = yearRecords.filter((r) => r.employeeId === emp.employeeId);
      const p = empRecords.filter((r) => r.status === "Present").length;
      const l = empRecords.filter((r) => r.status === "Late").length;
      const h = empRecords.filter((r) => r.status === "Half Day").length;
      const ab = empRecords.filter((r) => r.status === "Absent").length;
      const lv = empRecords.filter((r) => r.status === "Leave").length;

      totalPresent += p;
      totalLate += l;
      totalHalfDay += h;
      totalAbsent += ab;
      totalLeave += lv;

      empRecords.forEach((r) => {
        if (r.checkIn && r.checkOut) {
          totalHoursLogged += computeWorkDuration(r.checkIn, r.checkOut).hours;
        }
      });

      const baseMonthly = emp.monthlySalary || 45000;
      const effectiveDays = p + l + h * 0.5 + lv;
      const estimatedYtdSalary = Math.round((baseMonthly / 26) * effectiveDays);
      totalYtdPayroll += estimatedYtdSalary;

      const totalLogged = p + l + h + ab + lv;
      const attendanceRate = totalLogged > 0 ? Math.round(((p + l + h * 0.5 + lv) / totalLogged) * 100) : 100;
      const punctualityRate = p + l > 0 ? Math.round((p / (p + l)) * 100) : 100;

      return {
        emp,
        present: p,
        late: l,
        halfDay: h,
        absent: ab,
        leave: lv,
        attendanceRate,
        punctualityRate,
        estimatedYtdSalary,
        effectiveDays,
      };
    });

    const totalYearEntries = totalPresent + totalLate + totalHalfDay + totalAbsent + totalLeave;
    const effectiveYearDays = totalPresent + totalLate + totalHalfDay * 0.5 + totalLeave;
    const overallAnnualRate = totalYearEntries > 0 ? Math.round((effectiveYearDays / totalYearEntries) * 100) : 95;
    const overallPunctuality =
      totalPresent + totalLate > 0 ? Math.round((totalPresent / (totalPresent + totalLate)) * 100) : 94;

    const topStars = [...staffStats]
      .filter((s) => s.present + s.late > 0)
      .sort((a, b) => b.punctualityRate - a.punctualityRate || b.present - a.present)
      .slice(0, 3);

    return {
      year: yearPrefix,
      totalStaff: activeStaff.length,
      totalYearEntries,
      totalPresent,
      totalLate,
      totalHalfDay,
      totalAbsent,
      totalLeave,
      totalHoursLogged: Math.round(totalHoursLogged * 10) / 10,
      totalYtdPayroll,
      overallAnnualRate,
      overallPunctuality,
      staffStats,
      topStars,
    };
  }, [employees, attendance, analyticsYear]);

  // Backward-compatible summaryCounts (aliased to dailyCombinedSummary)
  const summaryCounts = dailyCombinedSummary;

  // Employee CRUD operations
  const handleOpenEmpModal = (emp?: Employee) => {
    if (emp) {
      setEditingEmployee(emp);
      setEmpForm({
        name: emp.name,
        email: emp.email,
        phone: emp.phone,
        role: emp.role,
        department: emp.department || "Creative Production",
        joiningDate: emp.joiningDate,
        status: emp.status,
        monthlySalary: emp.monthlySalary,
      });
    } else {
      setEditingEmployee(null);
      setEmpForm({
        name: "",
        email: "",
        phone: "",
        role: "Graphic Designer",
        department: "Creative Production",
        joiningDate: todayDateStr,
        status: "Active",
        monthlySalary: 45000,
      });
    }
    setShowEmployeeModal(true);
  };

  const handleSaveEmployee = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!empForm.name || !empForm.email) {
      alert("Please enter employee name and email.");
      return;
    }

    const empId = editingEmployee ? editingEmployee.employeeId : `emp_${Date.now()}`;
    const payload: Employee = {
      employeeId: empId,
      name: empForm.name,
      email: empForm.email,
      phone: empForm.phone,
      role: empForm.role,
      department: empForm.department,
      joiningDate: empForm.joiningDate,
      status: empForm.status,
      monthlySalary: Number(empForm.monthlySalary) || 0,
      createdAt: editingEmployee ? editingEmployee.createdAt : new Date().toISOString(),
    };

    // 1. Update state
    setEmployees((prev) => {
      const idx = prev.findIndex((item) => item.employeeId === empId);
      if (idx >= 0) {
        const clone = [...prev];
        clone[idx] = payload;
        return clone;
      }
      return [payload, ...prev];
    });

    // 2. Sync to localStorage & broadcast event
    try {
      const existingStr = localStorage.getItem('digi_local_employees');
      let localList: any[] = existingStr ? JSON.parse(existingStr) : [];
      const existingIdx = localList.findIndex((item: any) => item.id === empId || item.employeeId === empId || item.email?.toLowerCase() === empForm.email.toLowerCase());
      if (existingIdx >= 0) {
        localList[existingIdx] = { ...localList[existingIdx], ...payload, id: empId };
      } else {
        localList = [{ ...payload, id: empId }, ...localList];
      }
      localStorage.setItem('digi_local_employees', JSON.stringify(localList));
      window.dispatchEvent(new CustomEvent('digi_employees_sync', { detail: localList }));
    } catch (err) {
      console.warn("Local storage sync notice:", err);
    }

    // 3. Write to Firestore
    try {
      await setDoc(doc(db, "employees", empId), payload, { merge: true });
    } catch (err) {
      console.warn("Save employee local fallback:", err);
    }

    setShowEmployeeModal(false);
    showToast(`✓ Employee ${empForm.name} saved successfully!`);
  };

  const handleToggleEmployeeStatus = async (emp: Employee) => {
    const newStatus: "Active" | "Inactive" = emp.status === "Active" ? "Inactive" : "Active";
    const updated = employees.map((item) => (item.employeeId === emp.employeeId ? { ...item, status: newStatus } : item));
    setEmployees(updated);

    try {
      const existingStr = localStorage.getItem('digi_local_employees');
      let localList: any[] = existingStr ? JSON.parse(existingStr) : [];
      const idx = localList.findIndex((item: any) => item.id === emp.employeeId || item.employeeId === emp.employeeId);
      if (idx >= 0) {
        localList[idx].status = newStatus;
      } else {
        localList = updated.map(e => ({ ...e, id: e.employeeId }));
      }
      localStorage.setItem('digi_local_employees', JSON.stringify(localList));
      window.dispatchEvent(new CustomEvent('digi_employees_sync', { detail: localList }));
    } catch (e) {}

    try {
      await updateDoc(doc(db, "employees", emp.employeeId), { status: newStatus });
    } catch (e) {}
    showToast(`Employee ${emp.name} marked as ${newStatus}.`);
  };

  const handleDeleteEmployee = async (emp: Employee) => {
    if (!window.confirm(`Are you sure you want to deactivate ${emp.name}?`)) return;
    handleToggleEmployeeStatus(emp);
  };

  // Leave Review
  const handleReviewLeave = async (req: LeaveRequest, newStatus: "Approved" | "Rejected") => {
    try {
      await updateDoc(doc(db, "leaveRequests", req.requestId), {
        status: newStatus,
        approvedBy: profile?.name || "Admin",
        reviewedAt: new Date().toISOString(),
      });
      showToast(`Leave request ${newStatus.toLowerCase()}!`);
    } catch (e) {
      setLeaves((prev) => prev.map((item) => (item.requestId === req.requestId ? { ...item, status: newStatus } : item)));
      showToast(`Leave request ${newStatus.toLowerCase()}!`);
    }
  };

  // ── Holiday Actions & Computed Stats ─────────────────────
  const handleSaveHoliday = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!holidayForm.title.trim() || !holidayForm.date) {
      showToast("Please provide holiday title and date", "error");
      return;
    }
    const dateYear = new Date(holidayForm.date).getFullYear() || 2026;
    const newHoliday: Holiday = {
      holidayId: `hol_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      title: holidayForm.title.trim(),
      date: holidayForm.date,
      type: holidayForm.type,
      description: holidayForm.description.trim(),
      year: dateYear,
      createdAt: new Date().toISOString(),
    };

    const updatedHolidays = [...holidays, newHoliday].sort((a, b) => a.date.localeCompare(b.date));
    setHolidays(updatedHolidays);

    try {
      localStorage.setItem('digi_local_holidays', JSON.stringify(updatedHolidays));
      window.dispatchEvent(new CustomEvent('digi_holidays_sync', { detail: updatedHolidays }));
      await setDoc(doc(db, "holidays", newHoliday.holidayId), newHoliday);
    } catch (err) {
      console.warn("Holiday save local fallback:", err);
    }

    setShowHolidayModal(false);
    setHolidayForm({
      title: "",
      date: todayDateStr,
      type: "Festival",
      description: "",
    });
    showToast(`✓ Holiday "${newHoliday.title}" added for ${newHoliday.date}!`);
  };

  const handleDeleteHoliday = async (holidayId: string, title: string) => {
    if (!window.confirm(`Are you sure you want to remove holiday "${title}" from the calendar?`)) return;
    const updatedHolidays = holidays.filter((h) => h.holidayId !== holidayId);
    setHolidays(updatedHolidays);

    try {
      localStorage.setItem('digi_local_holidays', JSON.stringify(updatedHolidays));
      window.dispatchEvent(new CustomEvent('digi_holidays_sync', { detail: updatedHolidays }));
      await deleteDoc(doc(db, "holidays", holidayId));
    } catch (err) {
      console.warn("Holiday delete local fallback:", err);
    }
    showToast(`Holiday "${title}" removed from calendar.`);
  };

  // Holiday for selected day
  const currentDateHoliday = useMemo(() => {
    return holidays.find((h) => h.date === selectedDate);
  }, [holidays, selectedDate]);

  // Year holiday statistics & list
  const yearlyHolidayStats = useMemo(() => {
    const yearHolidays = holidays.filter((h) => {
      const y = h.year || (h.date ? new Date(h.date).getFullYear() : 2026);
      return y === holidayYear;
    });

    const nowStr = todayDateStr;
    const upcoming = yearHolidays.filter((h) => h.date >= nowStr);
    const past = yearHolidays.filter((h) => h.date < nowStr);
    const nationalCount = yearHolidays.filter((h) => h.type === "National" || h.type === "Gazetted").length;
    const festivalAgencyCount = yearHolidays.filter((h) => h.type === "Festival" || h.type === "Agency" || h.type === "Optional").length;

    return {
      all: yearHolidays,
      total: yearHolidays.length,
      upcoming: upcoming.length,
      past: past.length,
      nationalCount,
      festivalAgencyCount,
    };
  }, [holidays, holidayYear, todayDateStr]);

  // Filtered Holidays for Holiday Management Tab
  const filteredHolidays = useMemo(() => {
    return yearlyHolidayStats.all.filter((h) => {
      const q = holidaySearch.toLowerCase().trim();
      const matchesSearch = !q || h.title.toLowerCase().includes(q) || (h.description && h.description.toLowerCase().includes(q)) || h.type.toLowerCase().includes(q) || h.date.includes(q);
      if (!matchesSearch) return false;
      if (holidayTypeFilter !== "All" && h.type !== holidayTypeFilter) return false;
      return true;
    });
  }, [yearlyHolidayStats, holidaySearch, holidayTypeFilter]);

  // Format date readable
  const formattedSelectedDate = useMemo(() => {
    const d = new Date(selectedDate);
    return d.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric", year: "numeric" });
  }, [selectedDate]);

  return (
    <div className="space-y-4 pb-24 text-slate-900 dark:text-slate-100">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed top-20 right-6 z-50 animate-bounce">
          <div
            className={`px-4 py-3 rounded-2xl shadow-2xl text-xs font-black uppercase tracking-wider flex items-center gap-2.5 text-white ${
              toastMessage.type === "success" ? "bg-emerald-600" : toastMessage.type === "info" ? "bg-blue-600" : "bg-rose-600"
            }`}
          >
            <CheckCircle2 className="w-4 h-4" />
            {toastMessage.text}
          </div>
        </div>
      )}

      {/* ─── 1. COMPACT PAGE HEADER ──────────────────────────── */}
      <div className="bg-[#0E1428] border border-white/10 rounded-2xl px-5 py-4 shadow-lg flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-blue-600/20 border border-blue-500/30 text-blue-400 flex items-center justify-center shrink-0">
            <Clock className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-lg md:text-xl font-black text-white tracking-tight">
                {isAdminOrSuper ? "Staff Attendance" : "My Attendance"}
              </h1>
              <span className="text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-full bg-blue-500/15 border border-blue-400/30 text-blue-300">
                {shiftConfig.season} · {shiftConfig.startTime} - {shiftConfig.endTime}
              </span>
            </div>
            <p className="text-xs text-slate-400 font-medium">
              Manage daily attendance, working hours and exceptions.
            </p>
          </div>
        </div>

        {isAdminOrSuper && (
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowSettingsModal(true)}
              className="px-3 py-2 bg-slate-800/80 hover:bg-slate-700 text-slate-200 text-xs font-bold rounded-xl border border-white/10 transition-all flex items-center gap-1.5"
              title="Configure shift timings & grace period"
            >
              <Settings className="w-3.5 h-3.5 text-slate-400" />
              <span>Shift Settings</span>
            </button>
            <button
              onClick={() => handleOpenEmpModal()}
              className="px-4 py-2 bg-[#2563FF] hover:bg-[#1d4ed8] text-white text-xs font-black rounded-xl shadow-md transition-all flex items-center gap-1.5 uppercase tracking-wider"
            >
              <Plus className="w-4 h-4" /> Onboard Staff
            </button>
          </div>
        )}
      </div>

      {/* ─── 2. STICKY NAVIGATION TABS ───────────────────────── */}
      {isAdminOrSuper && (
        <div className="sticky top-0 z-30 bg-[#080D1A]/95 backdrop-blur-md border-b border-white/10 py-1 flex items-center gap-1 overflow-x-auto">
          {[
            { id: "mark", label: "Daily Marker", icon: Clock },
            { id: "employees", label: "Staff Directory", icon: Users },
            { id: "leaves", label: "Leave Approvals", icon: Briefcase, badge: leaves.filter((l) => l.status === "Pending").length },
            { id: "reports", label: "Salary & Reports", icon: FileText },
            { id: "holidays", label: "Holiday Calendar", icon: CalendarDays },
          ].map((tab) => {
            const Icon = tab.icon;
            const isActive = adminTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setAdminTab(tab.id as any)}
                className={`px-4 py-2.5 text-xs font-black uppercase tracking-wider rounded-xl transition-all flex items-center gap-2 shrink-0 ${
                  isActive
                    ? "bg-[#2563FF] text-white shadow-md shadow-blue-500/20"
                    : "text-slate-400 hover:text-white hover:bg-white/5"
                }`}
              >
                <Icon className="w-4 h-4" />
                <span>{tab.label}</span>
                {Boolean(tab.badge) && (
                  <span className="px-1.5 py-0.2 rounded-full bg-rose-500 text-white text-[10px] font-bold animate-pulse">
                    {tab.badge}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      )}

      {/* ─── TAB 1: DAILY MARKER (MAIN OPERATIONAL INTERFACE) ──── */}
      {adminTab === "mark" && (
        <div className="space-y-3">
          {/* A. DATE + SHIFT CONTROL BAR */}
          <div className="bg-white dark:bg-[#111728] border border-slate-200 dark:border-white/10 rounded-2xl p-3 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-3">
            {/* Date Nav Controls */}
            <div className="flex items-center gap-1.5">
              <button
                onClick={() => stepDate(-1)}
                className="p-2 rounded-xl border border-slate-200 dark:border-white/10 hover:bg-slate-100 dark:hover:bg-white/5 text-slate-700 dark:text-slate-200 transition-colors"
                title="Previous Day"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>

              <div className="flex items-center gap-2 px-3 py-1.5 bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-xl">
                <CalendarIcon className="w-4 h-4 text-blue-500" />
                <input
                  type="date"
                  value={selectedDate}
                  onChange={(e) => {
                    if (modifiedStaffIds.size > 0 && !window.confirm("Discard unsaved changes and switch date?")) return;
                    setSelectedDate(e.target.value);
                  }}
                  className="bg-transparent font-black text-xs md:text-sm text-slate-900 dark:text-white outline-none cursor-pointer"
                />
              </div>

              <button
                onClick={() => setSelectedDate(todayDateStr)}
                className={`px-3 py-1.5 text-xs font-black uppercase tracking-wider rounded-xl border transition-all ${
                  selectedDate === todayDateStr
                    ? "bg-blue-600/10 border-blue-500 text-blue-600 dark:text-blue-400"
                    : "border-slate-200 dark:border-white/10 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-white/5"
                }`}
              >
                Today
              </button>

              <button
                onClick={() => stepDate(1)}
                className="p-2 rounded-xl border border-slate-200 dark:border-white/10 hover:bg-slate-100 dark:hover:bg-white/5 text-slate-700 dark:text-slate-200 transition-colors"
                title="Next Day"
              >
                <ChevronRight className="w-4 h-4" />
              </button>

              <span className="hidden lg:inline-block text-xs font-bold text-slate-500 dark:text-slate-400 pl-2">
                {formattedSelectedDate}
              </span>
            </div>

            {/* Shift Timings & Grace info */}
            <div className="flex items-center gap-3 text-xs font-bold text-slate-600 dark:text-slate-300">
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
                <span>Working Shift:</span>
                <span className="font-extrabold text-slate-900 dark:text-white">
                  {shiftConfig.startTime} – {shiftConfig.endTime}
                </span>
                <span className="text-[10px] text-slate-400 font-medium">
                  (Grace: {shiftConfig.graceMinutes}m)
                </span>
              </div>
            </div>
          </div>

          {/* Holiday Notice Banner (if today/selectedDate is a holiday) */}
          {currentDateHoliday && (
            <div className="bg-gradient-to-r from-amber-500/15 via-rose-500/15 to-purple-500/15 border border-amber-400/30 dark:border-amber-500/30 rounded-2xl p-3.5 flex items-center justify-between gap-3 animate-in fade-in">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-amber-500/20 border border-amber-500/30 text-amber-500 flex items-center justify-center text-xl shrink-0">
                  🎉
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-black uppercase text-amber-600 dark:text-amber-300">
                      Official Holiday: {currentDateHoliday.title}
                    </span>
                    <span className="px-2 py-0.5 rounded text-[9px] font-black uppercase bg-amber-500/20 text-amber-700 dark:text-amber-200 border border-amber-500/30">
                      {currentDateHoliday.type}
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-600 dark:text-slate-300 font-medium">
                    {currentDateHoliday.description || "Agency officially closed today for this holiday."}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setAdminTab("holidays")}
                className="px-3.5 py-1.5 bg-amber-500/20 hover:bg-amber-500/30 text-amber-800 dark:text-amber-200 border border-amber-500/30 rounded-xl text-xs font-bold transition-all whitespace-nowrap flex items-center gap-1.5"
              >
                <CalendarDays className="w-3.5 h-3.5" /> View Holidays
              </button>
            </div>
          )}

          {/* B. COMBINED SUMMARY OF ALL EMPLOYEES (DAY / MONTH / YEAR-TO-DATE) */}
          <div className="bg-white dark:bg-[#111728] border border-slate-200 dark:border-white/10 rounded-2xl p-4 shadow-sm space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 pb-2.5 border-b border-slate-100 dark:border-white/5">
              <div className="flex items-center gap-2">
                <PieChart className="w-4 h-4 text-blue-500" />
                <span className="text-xs font-black uppercase tracking-wider text-slate-800 dark:text-white">
                  Combined Agency Summary
                </span>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400 border border-blue-200 dark:border-blue-800/40">
                  {summaryPeriod === "daily" ? formattedSelectedDate : summaryPeriod === "monthly" ? analyticsMonth : `Year ${analyticsYear}`}
                </span>
              </div>

              {/* Timeframe selector tabs */}
              <div className="flex items-center gap-1.5 self-start sm:self-auto">
                <div className="bg-slate-100 dark:bg-white/5 p-0.5 rounded-xl border border-slate-200 dark:border-white/10 flex items-center">
                  <button
                    type="button"
                    onClick={() => setSummaryPeriod("daily")}
                    className={`px-3 py-1 text-[11px] font-black uppercase tracking-wider rounded-lg transition-all flex items-center gap-1 ${
                      summaryPeriod === "daily"
                        ? "bg-blue-600 text-white shadow-sm"
                        : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
                    }`}
                  >
                    <Clock className="w-3 h-3" /> Day
                  </button>
                  <button
                    type="button"
                    onClick={() => setSummaryPeriod("monthly")}
                    className={`px-3 py-1 text-[11px] font-black uppercase tracking-wider rounded-lg transition-all flex items-center gap-1 ${
                      summaryPeriod === "monthly"
                        ? "bg-blue-600 text-white shadow-sm"
                        : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
                    }`}
                  >
                    <CalendarDays className="w-3 h-3" /> Month
                  </button>
                  <button
                    type="button"
                    onClick={() => setSummaryPeriod("yearly")}
                    className={`px-3 py-1 text-[11px] font-black uppercase tracking-wider rounded-lg transition-all flex items-center gap-1 ${
                      summaryPeriod === "yearly"
                        ? "bg-blue-600 text-white shadow-sm"
                        : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
                    }`}
                  >
                    <Award className="w-3 h-3" /> Year
                  </button>
                </div>

                {summaryPeriod === "monthly" && (
                  <input
                    type="month"
                    value={analyticsMonth}
                    onChange={(e) => setAnalyticsMonth(e.target.value)}
                    className="px-2 py-1 text-xs bg-slate-100 dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-xl outline-none font-bold text-slate-800 dark:text-white"
                  />
                )}
                {summaryPeriod === "yearly" && (
                  <select
                    value={analyticsYear}
                    onChange={(e) => setAnalyticsYear(e.target.value)}
                    className="px-2 py-1 text-xs bg-slate-100 dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-xl outline-none font-bold text-slate-800 dark:text-white cursor-pointer"
                  >
                    <option value="2026">2026</option>
                    <option value="2025">2025</option>
                  </select>
                )}
              </div>
            </div>

            {/* Dynamic Metric Cards based on Period */}
            {summaryPeriod === "daily" && (
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2">
                {[
                  { label: "Active Staff", count: dailyCombinedSummary.total, sub: `${dailyCombinedSummary.attendanceRate}% Logged`, color: "text-slate-900 dark:text-white", bg: "bg-slate-50 dark:bg-white/5 border-slate-200 dark:border-white/10" },
                  { label: "Present Today", count: dailyCombinedSummary.present, sub: `${dailyCombinedSummary.punctualityRate}% Punctual`, color: "text-emerald-700 dark:text-emerald-400", bg: "bg-emerald-50/70 dark:bg-emerald-950/20 border-emerald-200 dark:border-emerald-800/40" },
                  { label: "Late Arrivals", count: dailyCombinedSummary.late, sub: "After Shift/Grace", color: "text-amber-700 dark:text-amber-400", bg: "bg-amber-50/70 dark:bg-amber-950/20 border-amber-200 dark:border-amber-800/40" },
                  { label: "Half Days", count: dailyCombinedSummary.halfDay, sub: "4 to 7.5 hrs", color: "text-orange-700 dark:text-orange-400", bg: "bg-orange-50/70 dark:bg-orange-950/20 border-orange-200 dark:border-orange-800/40" },
                  { label: "Absents", count: dailyCombinedSummary.absent, sub: "Unexcused", color: "text-rose-700 dark:text-rose-400", bg: "bg-rose-50/70 dark:bg-rose-950/20 border-rose-200 dark:border-rose-800/40" },
                  { label: "Approved Leave", count: dailyCombinedSummary.leave, sub: `${dailyCombinedSummary.totalHoursLogged}h agency hrs`, color: "text-purple-700 dark:text-purple-400", bg: "bg-purple-50/70 dark:bg-purple-950/20 border-purple-200 dark:border-purple-800/40" },
                ].map((card) => (
                  <div key={card.label} className={`p-3 rounded-xl border ${card.bg} flex flex-col justify-between transition-all`}>
                    <span className="text-[10px] font-black uppercase tracking-wider text-slate-500 dark:text-slate-400">
                      {card.label}
                    </span>
                    <div className="flex items-baseline justify-between mt-1">
                      <span className={`text-xl font-black ${card.color}`}>{card.count}</span>
                      <span className="text-[10px] font-bold text-slate-400">{card.sub}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {summaryPeriod === "monthly" && (
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2">
                {[
                  { label: "Total Man-Days", count: monthlyCombinedSummary.totalManDays, sub: `${monthlyCombinedSummary.totalStaff} staff members`, color: "text-slate-900 dark:text-white", bg: "bg-slate-50 dark:bg-white/5 border-slate-200 dark:border-white/10" },
                  { label: "Present Days", count: monthlyCombinedSummary.totalPresent, sub: `${monthlyCombinedSummary.avgAttendanceRate}% avg rate`, color: "text-emerald-700 dark:text-emerald-400", bg: "bg-emerald-50/70 dark:bg-emerald-950/20 border-emerald-200 dark:border-emerald-800/40" },
                  { label: "Late Instances", count: monthlyCombinedSummary.totalLate, sub: `${monthlyCombinedSummary.avgPunctualityRate}% on-time`, color: "text-amber-700 dark:text-amber-400", bg: "bg-amber-50/70 dark:bg-amber-950/20 border-amber-200 dark:border-amber-800/40" },
                  { label: "Half Days Logged", count: monthlyCombinedSummary.totalHalfDay, sub: "0.5 man-days each", color: "text-orange-700 dark:text-orange-400", bg: "bg-orange-50/70 dark:bg-orange-950/20 border-orange-200 dark:border-orange-800/40" },
                  { label: "Total Leaves", count: monthlyCombinedSummary.totalLeave, sub: `${monthlyCombinedSummary.totalAbsent} unexcused`, color: "text-purple-700 dark:text-purple-400", bg: "bg-purple-50/70 dark:bg-purple-950/20 border-purple-200 dark:border-purple-800/40" },
                  { label: "Est. Month Payroll", count: `₹${(monthlyCombinedSummary.totalEstimatedPayroll / 1000).toFixed(1)}k`, sub: `${monthlyCombinedSummary.totalHoursLogged}h logged`, color: "text-blue-700 dark:text-blue-400", bg: "bg-blue-50/70 dark:bg-blue-950/20 border-blue-200 dark:border-blue-800/40" },
                ].map((card) => (
                  <div key={card.label} className={`p-3 rounded-xl border ${card.bg} flex flex-col justify-between transition-all`}>
                    <span className="text-[10px] font-black uppercase tracking-wider text-slate-500 dark:text-slate-400">
                      {card.label}
                    </span>
                    <div className="flex items-baseline justify-between mt-1">
                      <span className={`text-xl font-black ${card.color}`}>{card.count}</span>
                      <span className="text-[10px] font-bold text-slate-400">{card.sub}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {summaryPeriod === "yearly" && (
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2">
                {[
                  { label: "Annual Man-Days", count: yearlyCombinedSummary.totalManDays, sub: `${yearlyCombinedSummary.totalStaff} staff pool`, color: "text-slate-900 dark:text-white", bg: "bg-slate-50 dark:bg-white/5 border-slate-200 dark:border-white/10" },
                  { label: "Cumulative Present", count: yearlyCombinedSummary.totalPresent, sub: `${yearlyCombinedSummary.overallAttendanceRate}% overall`, color: "text-emerald-700 dark:text-emerald-400", bg: "bg-emerald-50/70 dark:bg-emerald-950/20 border-emerald-200 dark:border-emerald-800/40" },
                  { label: "Cumulative Late", count: yearlyCombinedSummary.totalLate, sub: `${yearlyCombinedSummary.overallPunctualityRate}% punctuality`, color: "text-amber-700 dark:text-amber-400", bg: "bg-amber-50/70 dark:bg-amber-950/20 border-amber-200 dark:border-amber-800/40" },
                  { label: "Cumulative Half", count: yearlyCombinedSummary.totalHalfDay, sub: "Year-to-date", color: "text-orange-700 dark:text-orange-400", bg: "bg-orange-50/70 dark:bg-orange-950/20 border-orange-200 dark:border-orange-800/40" },
                  { label: "Cumulative Leave", count: yearlyCombinedSummary.totalLeave, sub: `${yearlyCombinedSummary.totalAbsent} absents`, color: "text-purple-700 dark:text-purple-400", bg: "bg-purple-50/70 dark:bg-purple-950/20 border-purple-200 dark:border-purple-800/40" },
                  { label: "YTD Total Payroll", count: `₹${(yearlyCombinedSummary.totalYtdPayroll / 100000).toFixed(2)}L`, sub: `${yearlyCombinedSummary.totalHoursLogged} hrs total`, color: "text-indigo-700 dark:text-indigo-400", bg: "bg-indigo-50/70 dark:bg-indigo-950/20 border-indigo-200 dark:border-indigo-800/40" },
                ].map((card) => (
                  <div key={card.label} className={`p-3 rounded-xl border ${card.bg} flex flex-col justify-between transition-all`}>
                    <span className="text-[10px] font-black uppercase tracking-wider text-slate-500 dark:text-slate-400">
                      {card.label}
                    </span>
                    <div className="flex items-baseline justify-between mt-1">
                      <span className={`text-xl font-black ${card.color}`}>{card.count}</span>
                      <span className="text-[10px] font-bold text-slate-400">{card.sub}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* C. SEARCH + SUGGESTIVE AUTOCOMPLETE + FILTER + ACTIONS TOOLBAR */}
          <div className="bg-white dark:bg-[#111728] border border-slate-200 dark:border-white/10 rounded-2xl p-3.5 shadow-sm flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-3">
            {/* Search Input with Suggestive Autocomplete Popover */}
            <div className="relative flex-1 max-w-xl" ref={searchContainerRef}>
              <div className="relative flex items-center">
                <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  type="text"
                  placeholder="Search by name, department, role, email, or notes..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onFocus={() => setIsSearchFocused(true)}
                  className="w-full pl-10 pr-9 py-2 text-xs md:text-sm bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-xl outline-none font-medium focus:border-blue-500 text-slate-900 dark:text-white transition-all shadow-inner"
                />
                {searchQuery && (
                  <button
                    type="button"
                    onClick={() => setSearchQuery("")}
                    className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-slate-600 dark:hover:text-white rounded-full transition-colors"
                    title="Clear search"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>

              {/* 💡 Suggestive Autocomplete Dropdown Popover */}
              {isSearchFocused && (
                <div className="absolute left-0 top-full mt-2 w-full max-h-80 overflow-y-auto z-50 bg-white dark:bg-[#0E1428] border border-slate-200 dark:border-white/15 rounded-2xl shadow-2xl p-3 space-y-3 animate-in fade-in slide-in-from-top-2">
                  {/* Matching Staff */}
                  <div>
                    <div className="flex items-center justify-between text-[10px] font-black uppercase tracking-wider text-slate-400 pb-1.5 border-b border-slate-100 dark:border-white/5">
                      <span className="flex items-center gap-1.5">
                        <Users className="w-3 h-3 text-blue-500" /> Staff Suggestions
                      </span>
                      <span>{searchSuggestions.staff.length} matches</span>
                    </div>
                    {searchSuggestions.staff.length > 0 ? (
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 mt-2">
                        {searchSuggestions.staff.map((emp) => (
                          <button
                            key={emp.employeeId}
                            type="button"
                            onClick={() => {
                              setSearchQuery(emp.name);
                              setIsSearchFocused(false);
                            }}
                            className="flex items-center gap-2.5 p-2 rounded-xl text-left hover:bg-blue-50 dark:hover:bg-white/5 border border-transparent hover:border-blue-200 dark:hover:border-white/10 transition-all group"
                          >
                            <div className="w-7 h-7 rounded-full bg-blue-600/15 border border-blue-500/30 text-blue-600 dark:text-blue-400 font-black text-xs flex items-center justify-center shrink-0">
                              {emp.name.charAt(0)}
                            </div>
                            <div className="min-w-0 flex-1">
                              <p className="text-xs font-bold text-slate-800 dark:text-white truncate group-hover:text-blue-600 dark:group-hover:text-blue-400">
                                {emp.name}
                              </p>
                              <p className="text-[10px] text-slate-400 truncate">
                                {emp.role} {emp.department ? `· ${emp.department}` : ""}
                              </p>
                            </div>
                          </button>
                        ))}
                      </div>
                    ) : (
                      <p className="text-xs text-slate-400 py-2 italic">No matching staff found</p>
                    )}
                  </div>

                  {/* Departments & Roles Badges */}
                  {(searchSuggestions.departments.length > 0 || searchSuggestions.roles.length > 0) && (
                    <div className="pt-2 border-t border-slate-100 dark:border-white/5 space-y-2">
                      {searchSuggestions.departments.length > 0 && (
                        <div>
                          <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 block mb-1.5 flex items-center gap-1">
                            <Building2 className="w-3 h-3 text-indigo-500" /> Filter by Department:
                          </span>
                          <div className="flex flex-wrap gap-1">
                            {searchSuggestions.departments.map((dept) => (
                              <button
                                key={dept}
                                type="button"
                                onClick={() => {
                                  setSearchQuery(dept);
                                  setIsSearchFocused(false);
                                }}
                                className="px-2.5 py-1 bg-indigo-50 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800/40 hover:bg-indigo-100 rounded-lg text-[10px] font-bold transition-all"
                              >
                                {dept}
                              </button>
                            ))}
                          </div>
                        </div>
                      )}

                      {searchSuggestions.roles.length > 0 && (
                        <div>
                          <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 block mb-1.5 flex items-center gap-1">
                            <Briefcase className="w-3 h-3 text-emerald-500" /> Filter by Role:
                          </span>
                          <div className="flex flex-wrap gap-1">
                            {searchSuggestions.roles.map((role) => (
                              <button
                                key={role}
                                type="button"
                                onClick={() => {
                                  setSearchQuery(role);
                                  setIsSearchFocused(false);
                                }}
                                className="px-2.5 py-1 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800/40 hover:bg-emerald-100 rounded-lg text-[10px] font-bold transition-all"
                              >
                                {role}
                              </button>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Status Filter Pills & Quick Action */}
            <div className="flex flex-wrap items-center gap-2 justify-between lg:justify-end">
              <div className="flex items-center gap-1 overflow-x-auto py-0.5 max-w-full">
                {["All", "Present", "Late", "Half Day", "Absent", "Leave", "Not Marked"].map((tab) => (
                  <button
                    key={tab}
                    onClick={() => setStatusFilter(tab)}
                    className={`px-3 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all whitespace-nowrap ${
                      statusFilter === tab
                        ? "bg-[#2563FF] text-white shadow-md shadow-blue-500/20"
                        : "bg-slate-100 dark:bg-white/5 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-white/10"
                    }`}
                  >
                    {tab}
                  </button>
                ))}
              </div>

              <button
                onClick={handleMarkAllPresent}
                className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-black rounded-xl shadow-sm transition-all flex items-center gap-1.5 uppercase tracking-wider whitespace-nowrap shrink-0"
              >
                <CheckCircle2 className="w-4 h-4" /> Mark All Present
              </button>
            </div>
          </div>

          {/* D. FLOATING BULK SELECTION ACTIONS BAR (When staff checked) */}
          {selectedStaffIds.size > 0 && (
            <div className="bg-blue-600 text-white px-4 py-2.5 rounded-2xl shadow-xl flex flex-wrap items-center justify-between gap-3 animate-in fade-in">
              <div className="flex items-center gap-2">
                <span className="text-xs font-black uppercase tracking-wider">
                  {selectedStaffIds.size} Selected
                </span>
                <button
                  onClick={() => setSelectedStaffIds(new Set())}
                  className="text-[10px] underline hover:text-slate-200 font-bold"
                >
                  Clear Selection
                </button>
              </div>

              <div className="flex flex-wrap items-center gap-1.5">
                <button
                  onClick={() => handleBulkStatusApply("Present")}
                  className="px-2.5 py-1 bg-white/20 hover:bg-white/30 text-white text-xs font-black rounded-lg uppercase tracking-wider transition-all"
                >
                  Mark Present
                </button>
                <button
                  onClick={() => handleBulkStatusApply("Late")}
                  className="px-2.5 py-1 bg-white/20 hover:bg-white/30 text-white text-xs font-black rounded-lg uppercase tracking-wider transition-all"
                >
                  Mark Late
                </button>
                <button
                  onClick={() => handleBulkStatusApply("Half Day")}
                  className="px-2.5 py-1 bg-white/20 hover:bg-white/30 text-white text-xs font-black rounded-lg uppercase tracking-wider transition-all"
                >
                  Mark Half Day
                </button>
                <button
                  onClick={() => handleBulkStatusApply("Absent")}
                  className="px-2.5 py-1 bg-white/20 hover:bg-white/30 text-white text-xs font-black rounded-lg uppercase tracking-wider transition-all"
                >
                  Mark Absent
                </button>
                <button
                  onClick={() => handleBulkStatusApply("Leave")}
                  className="px-2.5 py-1 bg-white/20 hover:bg-white/30 text-white text-xs font-black rounded-lg uppercase tracking-wider transition-all"
                >
                  Mark Leave
                </button>
              </div>
            </div>
          )}

          {/* E. ATTENDANCE TABLE (DESKTOP & TABLET) */}
          <div className="bg-white dark:bg-[#111728] border border-slate-200 dark:border-white/10 rounded-2xl shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-50 dark:bg-white/5 border-b border-slate-200 dark:border-white/10 text-[10px] font-black uppercase text-slate-500 dark:text-slate-400 tracking-wider">
                    <th className="p-3.5 pl-4 w-10">
                      <input
                        type="checkbox"
                        checked={
                          activeStaffList.length > 0 &&
                          activeStaffList.every((e) => selectedStaffIds.has(e.employeeId))
                        }
                        onChange={(e) => {
                          if (e.target.checked) {
                            setSelectedStaffIds(new Set(activeStaffList.map((emp) => emp.employeeId)));
                          } else {
                            setSelectedStaffIds(new Set());
                          }
                        }}
                        className="rounded border-slate-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
                      />
                    </th>
                    <th className="p-3.5">Staff Member</th>
                    <th className="p-3.5">Attendance Status</th>
                    <th className="p-3.5">Check-In</th>
                    <th className="p-3.5">Check-Out</th>
                    <th className="p-3.5">Hours</th>
                    <th className="p-3.5">Notes / Exception</th>
                    <th className="p-3.5 pr-4 text-right">Save Action</th>
                  </tr>
                </thead>

                <tbody className="divide-y divide-slate-100 dark:divide-white/5 text-xs">
                  {activeStaffList.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="p-12 text-center text-slate-400 font-bold italic">
                        No employees found matching the current search / filter.
                      </td>
                    </tr>
                  ) : (
                    activeStaffList.map((emp) => {
                      const status = dailyStatus[emp.employeeId] || "Present";
                      const checkIn = dailyCheckIn[emp.employeeId] || "";
                      const checkOut = dailyCheckOut[emp.employeeId] || "";
                      const notes = dailyNotes[emp.employeeId] || "";
                      const isModified = modifiedStaffIds.has(emp.employeeId);
                      const isSelected = selectedStaffIds.has(emp.employeeId);
                      const duration = computeWorkDuration(checkIn, checkOut);

                      // Smart state enablement
                      const timesDisabled = status === "Absent" || status === "Leave";

                      return (
                        <tr
                          key={emp.employeeId}
                          className={`transition-colors ${
                            isModified
                              ? "bg-blue-50/50 dark:bg-blue-950/20 border-l-4 border-l-blue-600"
                              : isSelected
                              ? "bg-slate-50 dark:bg-white/5"
                              : "hover:bg-slate-50/70 dark:hover:bg-white/[0.02]"
                          }`}
                        >
                          {/* 1. Selection Checkbox */}
                          <td className="p-3.5 pl-4">
                            <input
                              type="checkbox"
                              checked={isSelected}
                              onChange={(e) => {
                                const next = new Set(selectedStaffIds);
                                if (e.target.checked) next.add(emp.employeeId);
                                else next.delete(emp.employeeId);
                                setSelectedStaffIds(next);
                              }}
                              className="rounded border-slate-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
                            />
                          </td>

                          {/* 2. Employee Info */}
                          <td className="p-3.5">
                            <div className="flex items-center gap-3">
                              <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-blue-600 to-indigo-600 text-white font-black text-xs flex items-center justify-center shadow-sm shrink-0">
                                {emp.name.charAt(0)}
                              </div>
                              <div className="min-w-0">
                                <div className="font-black text-slate-900 dark:text-white flex items-center gap-1.5">
                                  <span className="truncate">{emp.name}</span>
                                  {isModified && (
                                    <span className="w-2 h-2 rounded-full bg-blue-500 animate-pulse" title="Unsaved changes" />
                                  )}
                                </div>
                                <div className="text-[10px] text-slate-500 dark:text-slate-400 truncate">
                                  {emp.role} {emp.department ? `· ${emp.department}` : ""}
                                </div>
                              </div>
                            </div>
                          </td>

                          {/* 3. Segmented Status Selector */}
                          <td className="p-3.5">
                            <div className="inline-flex p-1 bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-white/10 rounded-xl gap-0.5">
                              {(
                                [
                                  { id: "Present", label: "Present", activeCls: "bg-emerald-600 text-white shadow-sm" },
                                  { id: "Late", label: "Late", activeCls: "bg-amber-500 text-slate-950 font-black shadow-sm" },
                                  { id: "Half Day", label: "Half Day", activeCls: "bg-orange-500 text-white shadow-sm" },
                                  { id: "Absent", label: "Absent", activeCls: "bg-rose-600 text-white shadow-sm" },
                                  { id: "Leave", label: "Leave", activeCls: "bg-purple-600 text-white shadow-sm" },
                                ] as const
                              ).map((opt) => {
                                const active = status === opt.id;
                                return (
                                  <button
                                    key={opt.id}
                                    type="button"
                                    onClick={() => handleStatusChange(emp.employeeId, opt.id)}
                                    className={`px-2.5 py-1 text-[10px] font-black uppercase rounded-lg transition-all ${
                                      active
                                        ? opt.activeCls
                                        : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-200/60 dark:hover:bg-white/5"
                                    }`}
                                  >
                                    {opt.label}
                                  </button>
                                );
                              })}
                            </div>
                          </td>

                          {/* 4. Check-In Control */}
                          <td className="p-3.5">
                            <div className="flex items-center gap-1.5">
                              <input
                                type="time"
                                disabled={timesDisabled}
                                value={checkIn}
                                onChange={(e) => handleTimeChange(emp.employeeId, "in", e.target.value)}
                                className={`w-28 px-2.5 py-1 text-xs font-bold rounded-lg border outline-none font-mono ${
                                  timesDisabled
                                    ? "bg-slate-100 dark:bg-slate-850 text-slate-400 border-slate-200 dark:border-slate-800 cursor-not-allowed"
                                    : "bg-slate-50 dark:bg-white/5 text-slate-900 dark:text-white border-slate-200 dark:border-white/15 focus:border-blue-500"
                                }`}
                              />
                              {!timesDisabled && (
                                <button
                                  type="button"
                                  onClick={() => setQuickTime(emp.employeeId, "in", "now")}
                                  className="px-1.5 py-0.5 text-[9px] font-black uppercase text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/40 hover:bg-blue-100 rounded border border-blue-200 dark:border-blue-800"
                                  title="Set to Current Time"
                                >
                                  Now
                                </button>
                              )}
                            </div>
                          </td>

                          {/* 5. Check-Out Control */}
                          <td className="p-3.5">
                            <div className="flex items-center gap-1.5">
                              <input
                                type="time"
                                disabled={timesDisabled}
                                value={checkOut}
                                onChange={(e) => handleTimeChange(emp.employeeId, "out", e.target.value)}
                                className={`w-28 px-2.5 py-1 text-xs font-bold rounded-lg border outline-none font-mono ${
                                  timesDisabled
                                    ? "bg-slate-100 dark:bg-slate-850 text-slate-400 border-slate-200 dark:border-slate-800 cursor-not-allowed"
                                    : "bg-slate-50 dark:bg-white/5 text-slate-900 dark:text-white border-slate-200 dark:border-white/15 focus:border-blue-500"
                                }`}
                              />
                              {!timesDisabled && (
                                <button
                                  type="button"
                                  onClick={() => setQuickTime(emp.employeeId, "out", "now")}
                                  className="px-1.5 py-0.5 text-[9px] font-black uppercase text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/40 hover:bg-blue-100 rounded border border-blue-200 dark:border-blue-800"
                                  title="Set to Current Time"
                                >
                                  Now
                                </button>
                              )}
                            </div>
                          </td>

                          {/* 6. Work Duration */}
                          <td className="p-3.5">
                            <div className="flex items-center gap-1.5">
                              <span className="font-mono font-bold text-slate-700 dark:text-slate-300">
                                {duration.text}
                              </span>
                              {duration.tag !== "-" && duration.tag !== "In Progress" && (
                                <span
                                  className={`text-[9px] font-black px-1.5 py-0.5 rounded uppercase ${
                                    duration.tag === "Full Day"
                                      ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/30 dark:text-emerald-400"
                                      : duration.tag === "Overtime"
                                      ? "bg-indigo-100 text-indigo-800 dark:bg-indigo-950/30 dark:text-indigo-400"
                                      : "bg-amber-100 text-amber-800 dark:bg-amber-950/30 dark:text-amber-400"
                                  }`}
                                >
                                  {duration.tag}
                                </span>
                              )}
                            </div>
                          </td>

                          {/* 7. Notes / Exception Input */}
                          <td className="p-3.5">
                            <input
                              type="text"
                              placeholder="Add exception note..."
                              value={notes}
                              onChange={(e) => {
                                setDailyNotes((prev) => ({ ...prev, [emp.employeeId]: e.target.value }));
                                setModifiedStaffIds((prev) => new Set(prev).add(emp.employeeId));
                              }}
                              className="w-full text-xs px-2.5 py-1 bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-lg outline-none text-slate-800 dark:text-slate-200 focus:border-blue-500 placeholder:text-slate-400"
                            />
                          </td>

                          {/* 8. Quick 1-Click Row Save */}
                          <td className="p-3.5 pr-4 text-right">
                            {isModified ? (
                              <button
                                type="button"
                                onClick={() => handleSaveSingleRow(emp.employeeId)}
                                className="px-3 py-1 bg-blue-600 hover:bg-blue-500 text-white text-[11px] font-black rounded-lg shadow-sm transition-all uppercase tracking-wider flex items-center gap-1 ml-auto"
                                title="Save this employee's attendance"
                              >
                                <Check className="w-3.5 h-3.5" /> Save
                              </button>
                            ) : (
                              <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-500 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/30 px-2 py-0.5 rounded-md border border-emerald-200/50 dark:border-emerald-800/30">
                                <CheckCircle2 className="w-3 h-3" /> Synced
                              </span>
                            )}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* F. STICKY BATCH SAVE BAR (Shows when unsaved changes exist) */}
          {modifiedStaffIds.size > 0 && (
            <div className="fixed bottom-6 right-6 z-40 animate-in slide-in-from-bottom-4">
              <div className="bg-[#0E1428] border-2 border-[#2563FF] text-white px-5 py-3.5 rounded-2xl shadow-2xl flex items-center gap-4">
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-blue-500 animate-ping" />
                  <span className="text-xs font-black uppercase tracking-wider">
                    {modifiedStaffIds.size} {modifiedStaffIds.size === 1 ? "record" : "records"} modified
                  </span>
                </div>

                <button
                  type="button"
                  onClick={handleDiscardChanges}
                  disabled={isSavingBatch}
                  className="px-3 py-1.5 text-xs font-bold text-slate-300 hover:text-white bg-white/10 hover:bg-white/15 rounded-xl transition-all"
                >
                  Discard
                </button>

                <button
                  type="button"
                  onClick={handleBatchSave}
                  disabled={isSavingBatch}
                  className="px-5 py-2 bg-[#2563FF] hover:bg-[#1d4ed8] text-white text-xs font-black rounded-xl shadow-lg transition-all flex items-center gap-2 uppercase tracking-wider"
                >
                  {isSavingBatch ? (
                    <>
                      <Clock className="w-4 h-4 animate-spin" /> Saving...
                    </>
                  ) : (
                    <>
                      <Check className="w-4 h-4" /> Save Attendance
                    </>
                  )}
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ─── TAB 2: STAFF DIRECTORY ──────────────────────────── */}
      {adminTab === "employees" && (
        <div className="space-y-4">
          <div className="bg-white dark:bg-[#111728] border border-slate-200 dark:border-white/10 rounded-2xl p-4 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <h2 className="text-sm font-black uppercase tracking-wider text-slate-900 dark:text-white">
                Active Staff Directory ({employees.length} Members)
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Manage roles, monthly compensation, and employment status.
              </p>
            </div>
            
            <div className="flex flex-wrap items-center gap-2.5">
              <div className="relative min-w-[200px]">
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="Search directory..."
                  value={staffDirectorySearch}
                  onChange={(e) => setStaffDirectorySearch(e.target.value)}
                  className="w-full pl-8 pr-3 py-1.5 text-xs bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-xl outline-none font-medium focus:border-blue-500 text-slate-900 dark:text-white"
                />
              </div>

              <select
                value={staffDirectoryDept}
                onChange={(e) => setStaffDirectoryDept(e.target.value)}
                className="px-3 py-1.5 text-xs bg-slate-50 dark:bg-[#15192B] border border-slate-200 dark:border-white/10 rounded-xl outline-none font-bold text-slate-900 dark:text-white cursor-pointer"
              >
                <option value="All">All Departments</option>
                <option value="Creative Production">Creative Production</option>
                <option value="Growth & Ads">Growth & Ads</option>
                <option value="Engineering">Engineering</option>
                <option value="Design & Branding">Design & Branding</option>
                <option value="Copy & Social">Copy & Social</option>
                <option value="Operations">Operations</option>
                <option value="Executive">Executive</option>
              </select>

              <button
                onClick={() => handleOpenEmpModal()}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-black rounded-xl shadow-sm transition-all flex items-center gap-1.5 uppercase tracking-wider whitespace-nowrap"
              >
                <Plus className="w-4 h-4" /> Onboard Staff
              </button>
            </div>
          </div>

          <div className="bg-white dark:bg-[#111728] border border-slate-200 dark:border-white/10 rounded-2xl shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-50 dark:bg-white/5 border-b border-slate-200 dark:border-white/10 text-[10px] font-black uppercase text-slate-500 dark:text-slate-400 tracking-wider">
                    <th className="p-3.5 pl-4">Staff Member</th>
                    <th className="p-3.5">Department & Role</th>
                    <th className="p-3.5">Contact</th>
                    <th className="p-3.5">Joined</th>
                    <th className="p-3.5">Monthly Base</th>
                    <th className="p-3.5">Status</th>
                    <th className="p-3.5 pr-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-white/5 text-xs">
                  {staffDirectoryList.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="p-12 text-center text-slate-400 font-bold italic">
                        No team members found matching your search.
                      </td>
                    </tr>
                  ) : (
                    staffDirectoryList.map((emp) => (
                      <tr key={emp.employeeId} className="hover:bg-slate-50/70 dark:hover:bg-white/[0.02]">
                        <td className="p-3.5 pl-4">
                          <div className="flex items-center gap-2.5">
                            <div className="w-8 h-8 rounded-xl bg-blue-600/15 text-blue-600 dark:text-blue-400 font-black text-xs flex items-center justify-center">
                              {emp.name.charAt(0)}
                            </div>
                            <div>
                              <div className="font-black text-slate-900 dark:text-white">{emp.name}</div>
                              <div className="text-[10px] text-slate-400">{emp.employeeId}</div>
                            </div>
                          </div>
                        </td>
                        <td className="p-3.5">
                          <div className="font-bold text-slate-800 dark:text-slate-200">{emp.role}</div>
                          <div className="text-[10px] text-slate-400">{emp.department || "Operations"}</div>
                        </td>
                        <td className="p-3.5">
                          <div className="text-slate-700 dark:text-slate-300">{emp.email}</div>
                          <div className="text-[10px] text-slate-400">{emp.phone || "—"}</div>
                        </td>
                        <td className="p-3.5 text-slate-600 dark:text-slate-400">{emp.joiningDate || "—"}</td>
                        <td className="p-3.5 font-bold text-slate-900 dark:text-white font-mono">
                          ₹{emp.monthlySalary?.toLocaleString()}
                        </td>
                        <td className="p-3.5">
                          <span
                            className={`px-2 py-0.5 rounded text-[9px] font-black uppercase ${
                              emp.status === "Active"
                                ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-400"
                                : "bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400"
                            }`}
                          >
                            {emp.status}
                          </span>
                        </td>
                        <td className="p-3.5 pr-4 text-right">
                          <div className="flex items-center gap-2 justify-end">
                            <button
                              onClick={() => handleToggleEmployeeStatus(emp)}
                              className={`px-2.5 py-1 rounded-lg text-[10px] font-bold border transition-all ${
                                emp.status === "Active"
                                  ? "text-rose-400 border-rose-500/20 hover:bg-rose-500/10"
                                  : "text-emerald-400 border-emerald-500/20 hover:bg-emerald-500/10"
                              }`}
                              title={emp.status === "Active" ? "Deactivate" : "Activate"}
                            >
                              {emp.status === "Active" ? "Deactivate" : "Activate"}
                            </button>
                            <button
                              onClick={() => handleOpenEmpModal(emp)}
                              className="p-1.5 hover:bg-slate-100 dark:hover:bg-white/10 rounded-lg text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-white/10"
                              title="Edit"
                            >
                              <Edit3 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ─── TAB 3: LEAVE APPROVALS ──────────────────────────── */}
      {adminTab === "leaves" && (
        <div className="space-y-4">
          <div className="bg-white dark:bg-[#111728] border border-slate-200 dark:border-white/10 rounded-2xl p-4 shadow-sm">
            <h2 className="text-sm font-black uppercase tracking-wider text-slate-900 dark:text-white">
              Leave Requests Queue ({leaves.length})
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Review and approve staff time-off requests. Approved leaves automatically reflect on the Daily Marker.
            </p>
          </div>

          <div className="bg-white dark:bg-[#111728] border border-slate-200 dark:border-white/10 rounded-2xl shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-50 dark:bg-white/5 border-b border-slate-200 dark:border-white/10 text-[10px] font-black uppercase text-slate-500 dark:text-slate-400 tracking-wider">
                    <th className="p-3.5 pl-4">Staff Applicant</th>
                    <th className="p-3.5">Dates & Days</th>
                    <th className="p-3.5">Type</th>
                    <th className="p-3.5">Reason</th>
                    <th className="p-3.5">Status</th>
                    <th className="p-3.5 pr-4 text-right">Review Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-white/5 text-xs">
                  {leaves.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="p-12 text-center text-slate-400 font-bold italic">
                        No pending or reviewed leave requests.
                      </td>
                    </tr>
                  ) : (
                    leaves.map((req) => (
                      <tr key={req.requestId} className="hover:bg-slate-50/70 dark:hover:bg-white/[0.02]">
                        <td className="p-3.5 pl-4">
                          <div className="font-black text-slate-900 dark:text-white">{req.employeeName}</div>
                          <div className="text-[10px] text-slate-400">{req.employeeEmail}</div>
                        </td>
                        <td className="p-3.5">
                          <div className="font-bold text-slate-800 dark:text-slate-200">
                            {req.startDate} to {req.endDate}
                          </div>
                          <div className="text-[10px] text-blue-600 dark:text-blue-400">{req.days} Working Days</div>
                        </td>
                        <td className="p-3.5">
                          <span
                            className={`px-2 py-0.5 rounded text-[9px] font-black uppercase ${
                              req.leaveType === "Paid"
                                ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-400"
                                : "bg-amber-100 text-amber-800 dark:bg-amber-950/40 dark:text-amber-400"
                            }`}
                          >
                            {req.leaveType} Leave
                          </span>
                        </td>
                        <td className="p-3.5 text-slate-600 dark:text-slate-300 max-w-xs truncate" title={req.reason}>
                          {req.reason}
                        </td>
                        <td className="p-3.5">
                          <span
                            className={`px-2 py-0.5 rounded text-[9px] font-black uppercase ${
                              req.status === "Approved"
                                ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-400"
                                : req.status === "Rejected"
                                ? "bg-rose-100 text-rose-800 dark:bg-rose-950/40 dark:text-rose-400"
                                : "bg-amber-100 text-amber-800 dark:bg-amber-950/40 dark:text-amber-400 animate-pulse"
                            }`}
                          >
                            {req.status}
                          </span>
                        </td>
                        <td className="p-3.5 pr-4 text-right">
                          {req.status === "Pending" ? (
                            <div className="flex items-center gap-1.5 justify-end">
                              <button
                                onClick={() => handleReviewLeave(req, "Approved")}
                                className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-500 text-white text-[10px] font-black rounded-lg uppercase tracking-wider shadow-sm"
                              >
                                Approve
                              </button>
                              <button
                                onClick={() => handleReviewLeave(req, "Rejected")}
                                className="px-2.5 py-1 bg-rose-600 hover:bg-rose-500 text-white text-[10px] font-black rounded-lg uppercase tracking-wider shadow-sm"
                              >
                                Reject
                              </button>
                            </div>
                          ) : (
                            <span className="text-[10px] text-slate-400 italic">Reviewed</span>
                          )}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ─── TAB 4: SALARY & AGENCY COMBINED REPORTS ────────── */}
      {adminTab === "reports" && (
        <div className="space-y-4">
          {/* Header Controls */}
          <div className="bg-white dark:bg-[#111728] border border-slate-200 dark:border-white/10 rounded-2xl p-4 shadow-sm flex flex-col lg:flex-row lg:items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-sm md:text-base font-black uppercase tracking-wider text-slate-900 dark:text-white">
                  Combined Agency Attendance & Payroll Summary
                </h2>
                <span className="px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30 text-[10px] font-black uppercase">
                  All {employees.length} Staff
                </span>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Comprehensive breakdown of all employees across Day, Month, and Year-to-Date.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2.5">
              {/* Period Switcher */}
              <div className="bg-slate-100 dark:bg-white/5 p-1 rounded-xl border border-slate-200 dark:border-white/10 flex items-center">
                <button
                  type="button"
                  onClick={() => setSummaryPeriod("daily")}
                  className={`px-3 py-1.5 text-xs font-black uppercase tracking-wider rounded-lg transition-all flex items-center gap-1.5 ${
                    summaryPeriod === "daily"
                      ? "bg-blue-600 text-white shadow-sm"
                      : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
                  }`}
                >
                  <Clock className="w-3.5 h-3.5" /> Daily
                </button>
                <button
                  type="button"
                  onClick={() => setSummaryPeriod("monthly")}
                  className={`px-3 py-1.5 text-xs font-black uppercase tracking-wider rounded-lg transition-all flex items-center gap-1.5 ${
                    summaryPeriod === "monthly"
                      ? "bg-blue-600 text-white shadow-sm"
                      : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
                  }`}
                >
                  <CalendarDays className="w-3.5 h-3.5" /> Monthly
                </button>
                <button
                  type="button"
                  onClick={() => setSummaryPeriod("yearly")}
                  className={`px-3 py-1.5 text-xs font-black uppercase tracking-wider rounded-lg transition-all flex items-center gap-1.5 ${
                    summaryPeriod === "yearly"
                      ? "bg-blue-600 text-white shadow-sm"
                      : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
                  }`}
                >
                  <Award className="w-3.5 h-3.5" /> Year-to-Date
                </button>
              </div>

              {summaryPeriod === "daily" && (
                <input
                  type="date"
                  value={selectedDate}
                  onChange={(e) => setSelectedDate(e.target.value)}
                  className="px-3 py-1.5 text-xs bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-xl outline-none font-bold text-slate-900 dark:text-white cursor-pointer"
                />
              )}

              {summaryPeriod === "monthly" && (
                <input
                  type="month"
                  value={analyticsMonth}
                  onChange={(e) => setAnalyticsMonth(e.target.value)}
                  className="px-3 py-1.5 text-xs bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-xl outline-none font-bold text-slate-900 dark:text-white cursor-pointer"
                />
              )}

              {summaryPeriod === "yearly" && (
                <select
                  value={analyticsYear}
                  onChange={(e) => setAnalyticsYear(e.target.value)}
                  className="px-3 py-1.5 text-xs bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-xl outline-none font-bold text-slate-900 dark:text-white cursor-pointer"
                >
                  <option value="2026">Year 2026</option>
                  <option value="2025">Year 2025</option>
                </select>
              )}
            </div>
          </div>

          {/* Agency Metric Highlights */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            <div className="p-4 rounded-2xl bg-white dark:bg-[#111728] border border-slate-200 dark:border-white/10 shadow-sm flex items-center justify-between">
              <div>
                <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 block">
                  {summaryPeriod === "daily" ? "Agency Today Payout" : summaryPeriod === "monthly" ? "Est. Monthly Payroll" : "Total YTD Payroll"}
                </span>
                <span className="text-2xl font-black text-emerald-600 dark:text-emerald-400 mt-0.5 block">
                  ₹
                  {summaryPeriod === "daily"
                    ? Math.round(monthlyCombinedSummary.totalEstimatedPayroll / 26).toLocaleString()
                    : summaryPeriod === "monthly"
                    ? monthlyCombinedSummary.totalEstimatedPayroll.toLocaleString()
                    : yearlyCombinedSummary.totalYtdPayroll.toLocaleString()}
                </span>
                <span className="text-[10px] text-slate-400 font-bold">
                  {summaryPeriod === "yearly" ? "Cumulative all months" : "Calculated on logged attendance"}
                </span>
              </div>
              <div className="w-12 h-12 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-500 flex items-center justify-center font-bold text-lg">
                ₹
              </div>
            </div>

            <div className="p-4 rounded-2xl bg-white dark:bg-[#111728] border border-slate-200 dark:border-white/10 shadow-sm flex items-center justify-between">
              <div>
                <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 block">
                  Total Working Hours
                </span>
                <span className="text-2xl font-black text-blue-600 dark:text-blue-400 mt-0.5 block">
                  {summaryPeriod === "daily"
                    ? `${dailyCombinedSummary.totalHoursLogged} hrs`
                    : summaryPeriod === "monthly"
                    ? `${monthlyCombinedSummary.totalHoursLogged} hrs`
                    : `${yearlyCombinedSummary.totalHoursLogged} hrs`}
                </span>
                <span className="text-[10px] text-slate-400 font-bold">
                  Across all active team members
                </span>
              </div>
              <div className="w-12 h-12 rounded-xl bg-blue-500/10 border border-blue-500/20 text-blue-500 flex items-center justify-center">
                <Clock className="w-6 h-6" />
              </div>
            </div>

            <div className="p-4 rounded-2xl bg-white dark:bg-[#111728] border border-slate-200 dark:border-white/10 shadow-sm flex items-center justify-between">
              <div>
                <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 block">
                  Agency Attendance Rate
                </span>
                <span className="text-2xl font-black text-indigo-600 dark:text-indigo-400 mt-0.5 block">
                  {summaryPeriod === "daily"
                    ? `${dailyCombinedSummary.attendanceRate}%`
                    : summaryPeriod === "monthly"
                    ? `${monthlyCombinedSummary.avgAttendanceRate}%`
                    : `${yearlyCombinedSummary.overallAttendanceRate}%`}
                </span>
                <span className="text-[10px] text-slate-400 font-bold">
                  Present + Half Day + Leaves
                </span>
              </div>
              <div className="w-12 h-12 rounded-xl bg-indigo-500/10 border border-indigo-500/20 text-indigo-500 flex items-center justify-center">
                <PieChart className="w-6 h-6" />
              </div>
            </div>

            <div className="p-4 rounded-2xl bg-white dark:bg-[#111728] border border-slate-200 dark:border-white/10 shadow-sm flex items-center justify-between">
              <div>
                <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 block">
                  Agency Punctuality
                </span>
                <span className="text-2xl font-black text-amber-600 dark:text-amber-400 mt-0.5 block">
                  {summaryPeriod === "daily"
                    ? `${dailyCombinedSummary.punctualityRate}%`
                    : summaryPeriod === "monthly"
                    ? `${monthlyCombinedSummary.avgPunctualityRate}%`
                    : `${yearlyCombinedSummary.overallPunctualityRate}%`}
                </span>
                <span className="text-[10px] text-slate-400 font-bold">
                  On-time check-in adherence
                </span>
              </div>
              <div className="w-12 h-12 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-500 flex items-center justify-center">
                <Award className="w-6 h-6" />
              </div>
            </div>
          </div>

          {/* COMBINED ALL-EMPLOYEES BREAKDOWN TABLE */}
          <div className="bg-white dark:bg-[#111728] border border-slate-200 dark:border-white/10 rounded-2xl shadow-sm overflow-hidden space-y-4 p-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-2 border-b border-slate-100 dark:border-white/5">
              <div>
                <h3 className="text-xs font-black uppercase tracking-wider text-slate-900 dark:text-white">
                  Employee-by-Employee Combined Report ({employees.length} Members)
                </h3>
                <span className="text-[10px] text-slate-400 font-medium">
                  {summaryPeriod === "daily"
                    ? `Status on ${formattedSelectedDate}`
                    : summaryPeriod === "monthly"
                    ? `Aggregated stats for ${analyticsMonth}`
                    : `Year-to-Date stats for ${analyticsYear}`}
                </span>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-50 dark:bg-white/5 border-b border-slate-200 dark:border-white/10 text-[10px] font-black uppercase text-slate-500 dark:text-slate-400 tracking-wider">
                    <th className="p-3.5 pl-4">Staff Member</th>
                    <th className="p-3.5">Department</th>
                    <th className="p-3.5 text-center">
                      {summaryPeriod === "daily" ? "Status" : "Present"}
                    </th>
                    <th className="p-3.5 text-center">Late</th>
                    <th className="p-3.5 text-center">Half Day</th>
                    <th className="p-3.5 text-center">Absent</th>
                    <th className="p-3.5 text-center">Leaves</th>
                    <th className="p-3.5 text-center">Attendance %</th>
                    <th className="p-3.5 text-right pr-4">Calculated Payout</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-white/5 text-xs">
                  {summaryPeriod === "daily" && (
                    employees.map((emp) => {
                      const status = dailyStatus[emp.employeeId] || "Present";
                      const checkIn = dailyCheckIn[emp.employeeId] || "";
                      const checkOut = dailyCheckOut[emp.employeeId] || "";
                      const duration = computeWorkDuration(checkIn, checkOut);
                      const baseSalary = emp.monthlySalary || 45000;
                      const dailyRate = Math.round(baseSalary / 26);
                      const earnedToday =
                        status === "Present" || status === "Late" || status === "Leave"
                          ? dailyRate
                          : status === "Half Day"
                          ? Math.round(dailyRate * 0.5)
                          : 0;

                      return (
                        <tr key={emp.employeeId} className="hover:bg-slate-50/50 dark:hover:bg-white/[0.02] transition-colors">
                          <td className="p-3.5 pl-4">
                            <div className="flex items-center gap-2.5">
                              <div className="w-7 h-7 rounded-full bg-blue-600/10 text-blue-600 dark:text-blue-400 font-black text-xs flex items-center justify-center shrink-0">
                                {emp.name.charAt(0)}
                              </div>
                              <div>
                                <p className="font-bold text-slate-900 dark:text-white">{emp.name}</p>
                                <p className="text-[10px] text-slate-400">{emp.role}</p>
                              </div>
                            </div>
                          </td>
                          <td className="p-3.5 text-slate-600 dark:text-slate-300">
                            {emp.department || "General"}
                          </td>
                          <td className="p-3.5 text-center">
                            <span
                              className={`px-2 py-0.5 rounded text-[10px] font-black uppercase ${
                                status === "Present"
                                  ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-400"
                                  : status === "Late"
                                  ? "bg-amber-100 text-amber-800 dark:bg-amber-950/40 dark:text-amber-400"
                                  : status === "Half Day"
                                  ? "bg-orange-100 text-orange-800 dark:bg-orange-950/40 dark:text-orange-400"
                                  : status === "Leave"
                                  ? "bg-purple-100 text-purple-800 dark:bg-purple-950/40 dark:text-purple-400"
                                  : "bg-rose-100 text-rose-800 dark:bg-rose-950/40 dark:text-rose-400"
                              }`}
                            >
                              {status}
                            </span>
                          </td>
                          <td className="p-3.5 text-center font-bold text-slate-700 dark:text-slate-300">
                            {status === "Late" ? "1" : "0"}
                          </td>
                          <td className="p-3.5 text-center font-bold text-slate-700 dark:text-slate-300">
                            {status === "Half Day" ? "1" : "0"}
                          </td>
                          <td className="p-3.5 text-center font-bold text-slate-700 dark:text-slate-300">
                            {status === "Absent" ? "1" : "0"}
                          </td>
                          <td className="p-3.5 text-center font-bold text-slate-700 dark:text-slate-300">
                            {status === "Leave" ? "1" : "0"}
                          </td>
                          <td className="p-3.5 text-center font-mono font-bold text-blue-600 dark:text-blue-400">
                            {duration.text !== "-" ? duration.text : "N/A"}
                          </td>
                          <td className="p-3.5 pr-4 text-right font-black text-emerald-600 dark:text-emerald-400">
                            ₹{earnedToday.toLocaleString()}
                          </td>
                        </tr>
                      );
                    })
                  )}

                  {summaryPeriod === "monthly" && (
                    monthlyCombinedSummary.staffStats.map(({ emp, present, late, halfDay, absent, leave, attendanceScore, earnedSalary }) => (
                      <tr key={emp.employeeId} className="hover:bg-slate-50/50 dark:hover:bg-white/[0.02] transition-colors">
                        <td className="p-3.5 pl-4">
                          <div className="flex items-center gap-2.5">
                            <div className="w-7 h-7 rounded-full bg-blue-600/10 text-blue-600 dark:text-blue-400 font-black text-xs flex items-center justify-center shrink-0">
                              {emp.name.charAt(0)}
                            </div>
                            <div>
                              <p className="font-bold text-slate-900 dark:text-white">{emp.name}</p>
                              <p className="text-[10px] text-slate-400">{emp.role}</p>
                            </div>
                          </div>
                        </td>
                        <td className="p-3.5 text-slate-600 dark:text-slate-300">
                          {emp.department || "General"}
                        </td>
                        <td className="p-3.5 text-center font-bold text-emerald-600 dark:text-emerald-400">
                          {present}
                        </td>
                        <td className="p-3.5 text-center font-bold text-amber-600 dark:text-amber-400">
                          {late}
                        </td>
                        <td className="p-3.5 text-center font-bold text-orange-600 dark:text-orange-400">
                          {halfDay}
                        </td>
                        <td className="p-3.5 text-center font-bold text-rose-600 dark:text-rose-400">
                          {absent}
                        </td>
                        <td className="p-3.5 text-center font-bold text-purple-600 dark:text-purple-400">
                          {leave}
                        </td>
                        <td className="p-3.5 text-center">
                          <span className={`font-mono font-bold text-xs ${attendanceScore >= 90 ? "text-emerald-500" : attendanceScore >= 75 ? "text-amber-500" : "text-rose-500"}`}>
                            {attendanceScore}%
                          </span>
                        </td>
                        <td className="p-3.5 pr-4 text-right font-black text-emerald-600 dark:text-emerald-400">
                          ₹{earnedSalary.toLocaleString()}
                        </td>
                      </tr>
                    ))
                  )}

                  {summaryPeriod === "yearly" && (
                    yearlyCombinedSummary.staffStats.map(({ emp, present, late, halfDay, absent, leave, attendanceScore, ytdEarnedSalary }) => (
                      <tr key={emp.employeeId} className="hover:bg-slate-50/50 dark:hover:bg-white/[0.02] transition-colors">
                        <td className="p-3.5 pl-4">
                          <div className="flex items-center gap-2.5">
                            <div className="w-7 h-7 rounded-full bg-blue-600/10 text-blue-600 dark:text-blue-400 font-black text-xs flex items-center justify-center shrink-0">
                              {emp.name.charAt(0)}
                            </div>
                            <div>
                              <p className="font-bold text-slate-900 dark:text-white">{emp.name}</p>
                              <p className="text-[10px] text-slate-400">{emp.role}</p>
                            </div>
                          </div>
                        </td>
                        <td className="p-3.5 text-slate-600 dark:text-slate-300">
                          {emp.department || "General"}
                        </td>
                        <td className="p-3.5 text-center font-bold text-emerald-600 dark:text-emerald-400">
                          {present}
                        </td>
                        <td className="p-3.5 text-center font-bold text-amber-600 dark:text-amber-400">
                          {late}
                        </td>
                        <td className="p-3.5 text-center font-bold text-orange-600 dark:text-orange-400">
                          {halfDay}
                        </td>
                        <td className="p-3.5 text-center font-bold text-rose-600 dark:text-rose-400">
                          {absent}
                        </td>
                        <td className="p-3.5 text-center font-bold text-purple-600 dark:text-purple-400">
                          {leave}
                        </td>
                        <td className="p-3.5 text-center">
                          <span className={`font-mono font-bold text-xs ${attendanceScore >= 90 ? "text-emerald-500" : attendanceScore >= 75 ? "text-amber-500" : "text-rose-500"}`}>
                            {attendanceScore}%
                          </span>
                        </td>
                        <td className="p-3.5 pr-4 text-right font-black text-emerald-600 dark:text-emerald-400">
                          ₹{ytdEarnedSalary.toLocaleString()}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ─── TAB 5: HOLIDAY CALENDAR MANAGEMENT ──────────────── */}
      {adminTab === "holidays" && (
        <div className="space-y-4">
          {/* Header & Control Bar */}
          <div className="bg-white dark:bg-[#111728] border border-slate-200 dark:border-white/10 rounded-2xl p-4 shadow-sm flex flex-col lg:flex-row lg:items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-sm md:text-base font-black uppercase tracking-wider text-slate-900 dark:text-white">
                  Annual Holiday Calendar · {holidayYear}
                </h2>
                <span className="px-2.5 py-0.5 rounded-full bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/30 text-[10px] font-black uppercase">
                  {yearlyHolidayStats.total} Holidays Total
                </span>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                Official public, gazetted, festive, and agency holidays across the entire calendar year.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2.5">
              {/* Year Switcher Buttons */}
              <div className="bg-slate-100 dark:bg-white/5 p-1 rounded-xl border border-slate-200 dark:border-white/10 flex items-center">
                {[2025, 2026, 2027].map((yr) => (
                  <button
                    key={yr}
                    type="button"
                    onClick={() => setHolidayYear(yr)}
                    className={`px-3 py-1.5 text-xs font-black uppercase tracking-wider rounded-lg transition-all ${
                      holidayYear === yr
                        ? "bg-blue-600 text-white shadow-sm"
                        : "text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white"
                    }`}
                  >
                    {yr}
                  </button>
                ))}
              </div>

              {/* Add Holiday Button */}
              <button
                type="button"
                onClick={() => {
                  setHolidayForm({
                    title: "",
                    date: `${holidayYear}-01-01`,
                    type: "Festival",
                    description: "",
                  });
                  setShowHolidayModal(true);
                }}
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-black rounded-xl shadow-md transition-all flex items-center gap-1.5 uppercase tracking-wider whitespace-nowrap"
              >
                <Plus className="w-4 h-4" /> Add Holiday
              </button>
            </div>
          </div>

          {/* Holiday KPI Metrics Strip */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="p-4 rounded-2xl bg-white dark:bg-[#111728] border border-slate-200 dark:border-white/10 shadow-sm flex items-center justify-between">
              <div>
                <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 block">
                  Total Annual Holidays
                </span>
                <span className="text-2xl font-black text-slate-900 dark:text-white mt-0.5 block">
                  {yearlyHolidayStats.total} Days
                </span>
                <span className="text-[10px] text-slate-400 font-bold">
                  In {holidayYear} calendar
                </span>
              </div>
              <div className="w-10 h-10 rounded-xl bg-blue-500/10 border border-blue-500/20 text-blue-500 flex items-center justify-center font-bold">
                <CalendarDays className="w-5 h-5" />
              </div>
            </div>

            <div className="p-4 rounded-2xl bg-white dark:bg-[#111728] border border-slate-200 dark:border-white/10 shadow-sm flex items-center justify-between">
              <div>
                <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 block">
                  Upcoming Holidays
                </span>
                <span className="text-2xl font-black text-emerald-600 dark:text-emerald-400 mt-0.5 block">
                  {yearlyHolidayStats.upcoming} Days
                </span>
                <span className="text-[10px] text-slate-400 font-bold">
                  Scheduled ahead
                </span>
              </div>
              <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-500 flex items-center justify-center font-bold">
                <Clock className="w-5 h-5" />
              </div>
            </div>

            <div className="p-4 rounded-2xl bg-white dark:bg-[#111728] border border-slate-200 dark:border-white/10 shadow-sm flex items-center justify-between">
              <div>
                <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 block">
                  Observed / Past
                </span>
                <span className="text-2xl font-black text-slate-500 dark:text-slate-300 mt-0.5 block">
                  {yearlyHolidayStats.past} Days
                </span>
                <span className="text-[10px] text-slate-400 font-bold">
                  Passed in {holidayYear}
                </span>
              </div>
              <div className="w-10 h-10 rounded-xl bg-slate-500/10 border border-slate-500/20 text-slate-400 flex items-center justify-center font-bold">
                <CheckCircle2 className="w-5 h-5" />
              </div>
            </div>

            <div className="p-4 rounded-2xl bg-white dark:bg-[#111728] border border-slate-200 dark:border-white/10 shadow-sm flex items-center justify-between">
              <div>
                <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 block">
                  National & Gazetted
                </span>
                <span className="text-2xl font-black text-amber-600 dark:text-amber-400 mt-0.5 block">
                  {yearlyHolidayStats.nationalCount} Days
                </span>
                <span className="text-[10px] text-slate-400 font-bold">
                  Mandatory closures
                </span>
              </div>
              <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-500 flex items-center justify-center font-bold">
                <Award className="w-5 h-5" />
              </div>
            </div>
          </div>

          {/* Search & Type Filter Bar */}
          <div className="bg-white dark:bg-[#111728] border border-slate-200 dark:border-white/10 rounded-2xl p-3 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-3">
            <div className="relative flex-1 max-w-md">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="text"
                placeholder="Search holiday by name, date or festival..."
                value={holidaySearch}
                onChange={(e) => setHolidaySearch(e.target.value)}
                className="w-full pl-9 pr-3 py-1.5 text-xs bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-xl outline-none font-medium focus:border-blue-500 text-slate-900 dark:text-white"
              />
              {holidaySearch && (
                <button
                  type="button"
                  onClick={() => setHolidaySearch("")}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                >
                  <X className="w-3 h-3" />
                </button>
              )}
            </div>

            <div className="flex items-center gap-1 overflow-x-auto py-0.5">
              {["All", "National", "Gazetted", "Festival", "Agency", "Optional"].map((type) => (
                <button
                  key={type}
                  type="button"
                  onClick={() => setHolidayTypeFilter(type)}
                  className={`px-3 py-1 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all whitespace-nowrap ${
                    holidayTypeFilter === type
                      ? "bg-blue-600 text-white shadow-sm"
                      : "bg-slate-100 dark:bg-white/5 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-white/10"
                  }`}
                >
                  {type}
                </button>
              ))}
            </div>
          </div>

          {/* Visual Holiday Cards Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {filteredHolidays.length === 0 ? (
              <div className="col-span-full bg-white dark:bg-[#111728] border border-slate-200 dark:border-white/10 rounded-2xl p-10 text-center space-y-2">
                <CalendarDays className="w-10 h-10 text-slate-400 mx-auto opacity-50" />
                <p className="text-xs font-bold text-slate-500 dark:text-slate-400">
                  No holidays found matching your search or filters for {holidayYear}.
                </p>
              </div>
            ) : (
              filteredHolidays.map((hol) => {
                const holidayDate = new Date(hol.date);
                const dayOfMonth = holidayDate.getDate();
                const monthName = holidayDate.toLocaleDateString("en-US", { month: "short" }).toUpperCase();
                const dayName = holidayDate.toLocaleDateString("en-US", { weekday: "long" });
                const isPast = hol.date < todayDateStr;
                const isToday = hol.date === todayDateStr;

                return (
                  <div
                    key={hol.holidayId}
                    className={`bg-white dark:bg-[#111728] border rounded-2xl p-4 shadow-sm transition-all hover:border-blue-500/50 flex flex-col justify-between gap-3 relative group ${
                      isToday
                        ? "border-amber-500/60 ring-2 ring-amber-500/20 dark:bg-amber-950/10"
                        : isPast
                        ? "border-slate-200/80 dark:border-white/5 opacity-80"
                        : "border-slate-200 dark:border-white/10"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-start gap-3">
                        {/* Date Calendar Box */}
                        <div className={`w-12 h-14 rounded-2xl flex flex-col items-center justify-center border shrink-0 ${
                          isToday
                            ? "bg-amber-500/20 border-amber-500/40 text-amber-500"
                            : isPast
                            ? "bg-slate-100 dark:bg-white/5 border-slate-200 dark:border-white/10 text-slate-400"
                            : "bg-blue-50 dark:bg-blue-950/30 border-blue-200 dark:border-blue-800/40 text-blue-600 dark:text-blue-400"
                        }`}>
                          <span className="text-[10px] font-black uppercase tracking-wider leading-none">
                            {monthName}
                          </span>
                          <span className="text-xl font-black mt-0.5 leading-none">
                            {dayOfMonth}
                          </span>
                        </div>

                        {/* Title & Details */}
                        <div className="min-w-0">
                          <h4 className="text-sm font-black text-slate-900 dark:text-white leading-tight">
                            {hol.title}
                          </h4>
                          <p className="text-[11px] text-slate-400 font-bold mt-0.5">
                            {dayName} · {hol.date}
                          </p>
                          {hol.description && (
                            <p className="text-[11px] text-slate-500 dark:text-slate-400 line-clamp-1 mt-1 font-medium">
                              {hol.description}
                            </p>
                          )}
                        </div>
                      </div>

                      {/* Delete Button */}
                      <button
                        type="button"
                        onClick={() => handleDeleteHoliday(hol.holidayId, hol.title)}
                        className="p-1.5 text-slate-400 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/40 rounded-xl transition-all"
                        title="Remove this holiday"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>

                    {/* Badge & Timing Indicator */}
                    <div className="flex items-center justify-between pt-2 border-t border-slate-100 dark:border-white/5 text-[10px]">
                      <span className={`px-2 py-0.5 rounded-lg font-black uppercase ${
                        hol.type === "National"
                          ? "bg-rose-100 text-rose-800 dark:bg-rose-950/40 dark:text-rose-300"
                          : hol.type === "Gazetted"
                          ? "bg-indigo-100 text-indigo-800 dark:bg-indigo-950/40 dark:text-indigo-300"
                          : hol.type === "Festival"
                          ? "bg-amber-100 text-amber-800 dark:bg-amber-950/40 dark:text-amber-300"
                          : "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300"
                      }`}>
                        {hol.type} Holiday
                      </span>

                      {isToday ? (
                        <span className="font-black text-amber-600 dark:text-amber-400 flex items-center gap-1 animate-pulse">
                          🎉 Observed Today
                        </span>
                      ) : isPast ? (
                        <span className="font-bold text-slate-400">Passed</span>
                      ) : (
                        <span className="font-bold text-emerald-600 dark:text-emerald-400">
                          Upcoming
                        </span>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}

      {/* ─── MODAL 1: ONBOARD / EDIT STAFF ───────────────────── */}
      {showEmployeeModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#0E1428] border border-white/10 rounded-2xl max-w-lg w-full p-6 shadow-2xl space-y-4 animate-in fade-in">
            <div className="flex items-center justify-between pb-3 border-b border-white/10">
              <h3 className="text-sm font-black uppercase tracking-wider text-white">
                {editingEmployee ? "Edit Employee Profile" : "Onboard New Staff Member"}
              </h3>
              <button onClick={() => setShowEmployeeModal(false)} className="text-slate-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveEmployee} className="space-y-3">
              <div>
                <label className="block text-[10px] font-bold uppercase text-slate-400 mb-1">Full Name *</label>
                <input
                  type="text"
                  required
                  value={empForm.name}
                  onChange={(e) => setEmpForm({ ...empForm, name: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-xl text-white text-xs font-bold outline-none focus:border-blue-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] font-bold uppercase text-slate-400 mb-1">Email *</label>
                  <input
                    type="email"
                    required
                    value={empForm.email}
                    onChange={(e) => setEmpForm({ ...empForm, email: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-xl text-white text-xs font-bold outline-none focus:border-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold uppercase text-slate-400 mb-1">Phone</label>
                  <input
                    type="text"
                    value={empForm.phone}
                    onChange={(e) => setEmpForm({ ...empForm, phone: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-xl text-white text-xs font-bold outline-none focus:border-blue-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] font-bold uppercase text-slate-400 mb-1">Designation / Role</label>
                  <input
                    type="text"
                    value={empForm.role}
                    onChange={(e) => setEmpForm({ ...empForm, role: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-xl text-white text-xs font-bold outline-none focus:border-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold uppercase text-slate-400 mb-1">Department</label>
                  <input
                    type="text"
                    value={empForm.department}
                    onChange={(e) => setEmpForm({ ...empForm, department: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-xl text-white text-xs font-bold outline-none focus:border-blue-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] font-bold uppercase text-slate-400 mb-1">Monthly Salary (₹)</label>
                  <input
                    type="number"
                    value={empForm.monthlySalary}
                    onChange={(e) => setEmpForm({ ...empForm, monthlySalary: Number(e.target.value) })}
                    className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-xl text-white text-xs font-bold outline-none focus:border-blue-500 font-mono"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold uppercase text-slate-400 mb-1">Joining Date</label>
                  <input
                    type="date"
                    value={empForm.joiningDate}
                    onChange={(e) => setEmpForm({ ...empForm, joiningDate: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-xl text-white text-xs font-bold outline-none focus:border-blue-500"
                  />
                </div>
              </div>

              <div className="flex gap-2 justify-end pt-3 border-t border-white/10">
                <button
                  type="button"
                  onClick={() => setShowEmployeeModal(false)}
                  className="px-4 py-2 bg-white/10 hover:bg-white/15 text-slate-300 text-xs font-bold rounded-xl"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-blue-600 hover:bg-blue-500 text-white text-xs font-black rounded-xl uppercase tracking-wider"
                >
                  Save Staff Member
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ─── MODAL 2: SHIFT SETTINGS MODAL ───────────────────── */}
      {showSettingsModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#0E1428] border border-white/10 rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4 animate-in fade-in">
            <div className="flex items-center justify-between pb-3 border-b border-white/10">
              <div className="flex items-center gap-2">
                <Settings className="w-4 h-4 text-blue-400" />
                <h3 className="text-sm font-black uppercase tracking-wider text-white">Shift Timings & Grace</h3>
              </div>
              <button onClick={() => setShowSettingsModal(false)} className="text-slate-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3">
              <div>
                <label className="block text-[10px] font-bold uppercase text-slate-400 mb-1">Season / Shift Mode</label>
                <div className="grid grid-cols-3 gap-2">
                  {(["Summer", "Winter", "Custom"] as const).map((s) => (
                    <button
                      key={s}
                      type="button"
                      onClick={() => {
                        if (s === "Summer") setShiftConfig({ ...shiftConfig, season: "Summer", startTime: "09:00", endTime: "18:00", graceMinutes: 15 });
                        else if (s === "Winter") setShiftConfig({ ...shiftConfig, season: "Winter", startTime: "10:00", endTime: "19:00", graceMinutes: 15 });
                        else setShiftConfig({ ...shiftConfig, season: "Custom" });
                      }}
                      className={`py-2 text-xs font-black uppercase rounded-xl border transition-all ${
                        shiftConfig.season === s
                          ? "bg-blue-600 text-white border-blue-500 shadow-md"
                          : "bg-slate-900 border-slate-700 text-slate-400 hover:text-white"
                      }`}
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] font-bold uppercase text-slate-400 mb-1">Shift Start Time</label>
                  <input
                    type="time"
                    value={shiftConfig.startTime}
                    onChange={(e) => setShiftConfig({ ...shiftConfig, startTime: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-xl text-white text-xs font-bold outline-none font-mono"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold uppercase text-slate-400 mb-1">Shift End Time</label>
                  <input
                    type="time"
                    value={shiftConfig.endTime}
                    onChange={(e) => setShiftConfig({ ...shiftConfig, endTime: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-xl text-white text-xs font-bold outline-none font-mono"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-bold uppercase text-slate-400 mb-1">
                  Grace Period (Minutes before marking Late)
                </label>
                <input
                  type="number"
                  min="0"
                  max="60"
                  value={shiftConfig.graceMinutes}
                  onChange={(e) => setShiftConfig({ ...shiftConfig, graceMinutes: Number(e.target.value) })}
                  className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-xl text-white text-xs font-bold outline-none font-mono"
                />
              </div>

              <div className="pt-2">
                <button
                  type="button"
                  onClick={() => {
                    setShowSettingsModal(false);
                    showToast("✓ Shift configuration updated!");
                  }}
                  className="w-full py-2.5 bg-blue-600 hover:bg-blue-500 text-white text-xs font-black rounded-xl uppercase tracking-wider"
                >
                  Save Shift Settings
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ─── MODAL 3: ADD HOLIDAY MODAL ───────────────────────── */}
      {showHolidayModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#0E1428] border border-white/10 rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4 animate-in fade-in">
            <div className="flex items-center justify-between pb-3 border-b border-white/10">
              <div className="flex items-center gap-2">
                <CalendarDays className="w-4 h-4 text-emerald-400" />
                <h3 className="text-sm font-black uppercase tracking-wider text-white">Add New Calendar Holiday</h3>
              </div>
              <button onClick={() => setShowHolidayModal(false)} className="text-slate-400 hover:text-white">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveHoliday} className="space-y-3">
              <div>
                <label className="block text-[10px] font-bold uppercase text-slate-400 mb-1">Holiday Title / Name *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Diwali, Holi, Republic Day..."
                  value={holidayForm.title}
                  onChange={(e) => setHolidayForm({ ...holidayForm, title: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-xl text-white text-xs font-bold outline-none focus:border-blue-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] font-bold uppercase text-slate-400 mb-1">Holiday Date *</label>
                  <input
                    type="date"
                    required
                    value={holidayForm.date}
                    onChange={(e) => setHolidayForm({ ...holidayForm, date: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-xl text-white text-xs font-bold outline-none focus:border-blue-500 font-mono"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold uppercase text-slate-400 mb-1">Holiday Category *</label>
                  <select
                    value={holidayForm.type}
                    onChange={(e) => setHolidayForm({ ...holidayForm, type: e.target.value as any })}
                    className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-xl text-white text-xs font-bold outline-none focus:border-blue-500 cursor-pointer"
                  >
                    <option value="National">National Holiday</option>
                    <option value="Gazetted">Gazetted Public Holiday</option>
                    <option value="Festival">Festival Celebration</option>
                    <option value="Agency">Agency Annual Holiday</option>
                    <option value="Optional">Optional / Restricted</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-[10px] font-bold uppercase text-slate-400 mb-1">Description / Notes</label>
                <textarea
                  rows={2}
                  placeholder="Additional notes about agency closure or celebrations..."
                  value={holidayForm.description}
                  onChange={(e) => setHolidayForm({ ...holidayForm, description: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-xl text-white text-xs font-medium outline-none focus:border-blue-500 resize-none"
                />
              </div>

              <div className="flex gap-2 justify-end pt-3 border-t border-white/10">
                <button
                  type="button"
                  onClick={() => setShowHolidayModal(false)}
                  className="px-4 py-2 bg-white/10 hover:bg-white/15 text-slate-300 text-xs font-bold rounded-xl transition-all"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-black rounded-xl uppercase tracking-wider shadow-md transition-all flex items-center gap-1.5"
                >
                  <Check className="w-4 h-4" /> Save Holiday
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
