import { useState, useEffect, useMemo, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';
import { 
  type MasterEmployee, 
  CENTRAL_EMPLOYEES_MASTER_LIST, 
  getCachedEmployees, 
  subscribeToCanonicalEmployees, 
  resolveCurrentEmployee,
  mergeWithSuperAdmin,
  PERMANENT_SUPER_ADMIN_MEMBER,
  LOCAL_STORAGE_VIEW_AS_KEY,
  getViewAsEmployeeId,
  setViewAsEmployeeId as setGlobalViewAsId
} from '../lib/employeeMaster';

export function useActiveEmployee() {
  const { user, profile } = useAuth();
  const [employees, setEmployees] = useState<MasterEmployee[]>(() => getCachedEmployees());
  const [viewAsId, setViewAsId] = useState<string | null>(() => getViewAsEmployeeId());

  // Listen to Firestore canonical employees collection
  // setEmployees always calls mergeWithSuperAdmin to guarantee emp_superadmin stays first
  useEffect(() => {
    const unsub = subscribeToCanonicalEmployees((updated) => {
      if (updated && updated.length > 0) {
        // Always merge SA so employee creation can never displace it
        const safeList = mergeWithSuperAdmin(updated);
        console.debug('[useActiveEmployee] employees updated, member[0]:', safeList[0]?.id, 'total:', safeList.length);
        setEmployees(safeList);
      }
    });
    return () => unsub();
  }, []);

  // Listen to cross-component View-As changes
  useEffect(() => {
    const handleViewAsChange = () => {
      setViewAsId(getViewAsEmployeeId());
    };
    window.addEventListener('digi_view_as_changed', handleViewAsChange);
    return () => window.removeEventListener('digi_view_as_changed', handleViewAsChange);
  }, []);

  const isAdmin = profile?.role === 'superAdmin' || profile?.role === 'admin';
  const directlyMatchedEmployee = useMemo(() => {
    return resolveCurrentEmployee(user, profile, employees);
  }, [user, profile, employees]);

  const activeEmployee = useMemo<MasterEmployee | null>(() => {
    const masterList = employees && employees.length > 0 ? employees : CENTRAL_EMPLOYEES_MASTER_LIST;
    
    // If Super Admin has selected an explicit View-As employee (other than super admin / self)
    if (isAdmin && viewAsId && viewAsId !== 'emp_superadmin' && viewAsId !== 'self' && viewAsId !== directlyMatchedEmployee?.id) {
      const found = masterList.find(e => (e.id || e.employeeId) === viewAsId);
      if (found) return found;
    }

    // Default to directly matched employee (which for Super Admin is Digiexplode Super Admin)
    if (directlyMatchedEmployee) {
      return directlyMatchedEmployee;
    }

    // If Super Admin has no linked employee profile, always return permanent SA member
    if (isAdmin) {
      const superAdmin = masterList.find(e => e.id === 'emp_superadmin' || e.name.toLowerCase().includes('super admin'));
      if (superAdmin) return superAdmin;
      // Hardcoded fallback — always safe, never an employee
      return PERMANENT_SUPER_ADMIN_MEMBER;
    }

    // Non-admin fallback: look by id, never blindly use index 0
    const safeDefault = masterList.find(e => e.id === 'emp_superadmin');
    return safeDefault || masterList[0] || null;
  }, [isAdmin, viewAsId, directlyMatchedEmployee, employees]);

  const isViewAs = Boolean(
    isAdmin && 
    viewAsId && 
    viewAsId !== 'emp_superadmin' && 
    viewAsId !== 'self' && 
    activeEmployee && 
    directlyMatchedEmployee && 
    activeEmployee.id !== directlyMatchedEmployee.id
  );

  const setViewAsEmployee = useCallback((empId: string | null) => {
    if (empId === 'emp_superadmin' || empId === 'self' || empId === directlyMatchedEmployee?.id) {
      setGlobalViewAsId(null);
      setViewAsId(null);
    } else {
      setGlobalViewAsId(empId);
      setViewAsId(empId);
    }
  }, [directlyMatchedEmployee]);

  const resolvedEmployeeId = activeEmployee?.id || activeEmployee?.employeeId || 'emp_superadmin';
  const activeEmployeeName = activeEmployee?.name || 'Digiexplode Super Admin';
  const activeEmployeeRole = activeEmployee?.role || 'Super Admin / Managing Director';

  return {
    activeEmployee,
    resolvedEmployeeId,
    activeEmployeeName,
    activeEmployeeRole,
    isViewAs,
    isAdmin,
    directlyMatchedEmployee,
    employees: employees && employees.length > 0 ? employees : CENTRAL_EMPLOYEES_MASTER_LIST,
    setViewAsEmployee
  };
}
