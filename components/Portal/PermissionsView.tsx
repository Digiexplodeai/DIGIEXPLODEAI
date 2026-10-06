import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import {
  Lock, Check, X, Save, RefreshCw, AlertTriangle, Loader2,
  CheckCircle, Eye, Shield, ShieldCheck, HelpCircle
} from 'lucide-react';
import {
  PermissionService,
  CANONICAL_ROLES,
  CANONICAL_MODULES,
  CANONICAL_ACTIONS,
  DEFAULT_ROLE_PERMISSIONS
} from '../../lib/controlPlane/PermissionService';
import { RolePermissions, CanonicalRole, CanonicalAction } from '../../lib/controlPlane/types';
import { WorkspaceEventService } from '../../lib/controlPlane/WorkspaceEventService';

export const PermissionsView: React.FC = () => {
  const { profile } = useAuth();
  const [matrix, setMatrix] = useState<RolePermissions>(DEFAULT_ROLE_PERMISSIONS);
  const [initialMatrix, setInitialMatrix] = useState<RolePermissions>(DEFAULT_ROLE_PERMISSIONS);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [activeModule, setActiveModule] = useState(CANONICAL_MODULES[0]);
  const [previewRole, setPreviewRole] = useState<CanonicalRole | null>(() => PermissionService.getPreviewRole());

  const isSuperAdmin = profile?.role === 'superAdmin';

  const load = () => {
    setLoading(true);
    try {
      const perms = PermissionService.getPermissions();
      setMatrix(perms);
      setInitialMatrix(JSON.parse(JSON.stringify(perms)));
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    const handleUpdate = () => {
      setMatrix(PermissionService.getPermissions());
    };
    const handlePreviewUpdate = () => {
      setPreviewRole(PermissionService.getPreviewRole());
    };
    window.addEventListener('digi_permissions_updated', handleUpdate);
    window.addEventListener('digi_preview_role_changed', handlePreviewUpdate);
    return () => {
      window.removeEventListener('digi_permissions_updated', handleUpdate);
      window.removeEventListener('digi_preview_role_changed', handlePreviewUpdate);
    };
  }, []);

  const hasUnsavedChanges = JSON.stringify(matrix) !== JSON.stringify(initialMatrix);

  const toggle = (module: string, role: CanonicalRole, action: CanonicalAction) => {
    if (role === 'superAdmin') return; // Super admin permissions are immutable

    setMatrix(prev => {
      const currentVal = prev[module]?.[role]?.[action] ?? false;
      return {
        ...prev,
        [module]: {
          ...prev[module],
          [role]: {
            ...prev[module]?.[role],
            [action]: !currentVal,
          }
        }
      };
    });
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await PermissionService.savePermissions(matrix);
      setInitialMatrix(JSON.parse(JSON.stringify(matrix)));

      // Emit audit workspace event
      await WorkspaceEventService.emit({
        eventType: 'permissions.updated',
        entityType: 'permissions',
        entityId: 'canonical_role_matrix',
        actorId: profile?.userId || 'admin',
        actorName: profile?.name || 'Super Admin',
        actorRole: profile?.role || 'superAdmin',
        customDescription: `Updated platform role permissions matrix across 15 modules`,
        metadata: {
          updatedAt: new Date().toISOString(),
          activeModule
        }
      });

      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    } catch (e) {
      console.error(e);
    } finally {
      setSaving(false);
    }
  };

  const handleTogglePreview = (role: CanonicalRole) => {
    if (previewRole === role) {
      PermissionService.setPreviewRole(null);
    } else {
      PermissionService.setPreviewRole(role);
    }
  };

  if (!isSuperAdmin) {
    return (
      <div className="flex flex-col items-center gap-4 py-20 text-center font-sans">
        <AlertTriangle className="w-12 h-12 text-rose-500" />
        <p className="font-bold text-base text-slate-300">Super Admin Only</p>
        <p className="text-xs text-slate-500">Only Super Admins are authorized to view and modify role access matrix.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 font-sans">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Lock className="w-4 h-4 text-[#3557FF]" />
            <span className="text-xs font-black uppercase tracking-widest text-[#3557FF]">Canonical Security Model</span>
          </div>
          <h1 className="text-2xl font-black text-slate-900 dark:text-white tracking-tight">Roles & Permissions</h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Single authoritative control matrix governing access, actions, mutations and data scope across Agency OS
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {hasUnsavedChanges && (
            <span className="px-3 py-1.5 rounded-xl bg-amber-500/10 text-amber-400 border border-amber-500/20 text-xs font-bold animate-pulse flex items-center gap-1.5">
              <AlertTriangle className="w-3.5 h-3.5" /> Unsaved Changes
            </span>
          )}

          <button
            onClick={handleSave}
            disabled={saving || !hasUnsavedChanges}
            className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-bold transition-all shadow-md cursor-pointer ${
              saved
                ? 'bg-emerald-600 text-white'
                : hasUnsavedChanges
                  ? 'bg-[#3557FF] hover:bg-[#2846DF] text-white'
                  : 'bg-slate-200 dark:bg-white/10 text-slate-400 cursor-not-allowed'
            }`}
          >
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : saved ? <CheckCircle className="w-4 h-4" /> : <Save className="w-4 h-4" />}
            {saving ? 'Persisting…' : saved ? 'Permissions Live!' : 'Save Changes'}
          </button>
        </div>
      </div>

      {/* Role Preview Bar */}
      <div className="bg-white dark:bg-[#0E1326] p-4 rounded-2xl border border-slate-200 dark:border-white/10 shadow-xs space-y-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Eye className="w-4 h-4 text-purple-400" />
            <h3 className="text-xs font-black uppercase tracking-wider text-slate-700 dark:text-slate-300">
              Preview Workspace as Role (Testing Simulator)
            </h3>
          </div>
          {previewRole && (
            <button
              onClick={() => PermissionService.setPreviewRole(null)}
              className="text-[11px] text-rose-400 hover:underline font-bold"
            >
              Reset to Super Admin
            </button>
          )}
        </div>
        <p className="text-[11px] text-slate-500">
          Simulate how the UI and actions behave for different roles without changing actual user records.
        </p>
        <div className="flex flex-wrap gap-2 pt-1">
          {CANONICAL_ROLES.filter(r => r.id !== 'superAdmin').map(role => {
            const isSelected = previewRole === role.id;
            return (
              <button
                key={role.id}
                onClick={() => handleTogglePreview(role.id)}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold border transition-all flex items-center gap-1.5 cursor-pointer ${
                  isSelected
                    ? 'bg-purple-600 text-white border-purple-500 shadow-md scale-105'
                    : 'bg-slate-50 dark:bg-white/4 border-slate-200 dark:border-white/8 text-slate-700 dark:text-slate-300 hover:border-purple-400'
                }`}
              >
                <span className="w-2 h-2 rounded-full" style={{ background: role.color }} />
                <span>{role.label}</span>
                {isSelected && <Eye className="w-3 h-3 ml-1" />}
              </button>
            );
          })}
        </div>
      </div>

      {/* Grid: Module Selector (Left) & Permission Matrix (Right) */}
      <div className="grid grid-cols-1 xl:grid-cols-4 gap-4">
        {/* Module list */}
        <div className="xl:col-span-1">
          <div className="bg-white dark:bg-[#0E1326] rounded-2xl border border-slate-200 dark:border-white/10 overflow-hidden shadow-xs">
            <div className="px-4 py-3 border-b border-slate-100 dark:border-white/8">
              <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Target Modules</span>
            </div>
            <div className="p-2 space-y-0.5">
              {CANONICAL_MODULES.map(mod => (
                <button
                  key={mod}
                  onClick={() => setActiveModule(mod)}
                  className={`w-full text-left px-3 py-2.5 rounded-xl text-xs font-bold transition-all flex items-center justify-between cursor-pointer ${
                    activeModule === mod
                      ? 'bg-[#3557FF]/15 text-[#3557FF] dark:text-[#7B9FFF] border border-[#3557FF]/30'
                      : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-white/4'
                  }`}
                >
                  <span>{mod}</span>
                  {activeModule === mod && <Check className="w-3.5 h-3.5" />}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Matrix Table */}
        <div className="xl:col-span-3">
          <div className="bg-white dark:bg-[#0E1326] rounded-2xl border border-slate-200 dark:border-white/10 overflow-hidden shadow-xs">
            <div className="px-5 py-4 border-b border-slate-100 dark:border-white/8 flex items-center justify-between">
              <div>
                <h3 className="text-sm font-black text-slate-900 dark:text-white">{activeModule}</h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Configure allowed actions for each canonical platform role.
                </p>
              </div>
              <span className="text-[10px] font-bold px-2.5 py-1 rounded-lg bg-blue-500/10 text-blue-400 border border-blue-500/20">
                15 Modules Enforced
              </span>
            </div>

            {loading ? (
              <div className="flex items-center justify-center py-20">
                <Loader2 className="w-6 h-6 animate-spin text-[#3557FF]" />
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left">
                  <thead>
                    <tr className="border-b border-slate-100 dark:border-white/8 bg-slate-50 dark:bg-white/3 text-[10px] font-black uppercase tracking-wider text-slate-400">
                      <th className="px-5 py-3 w-48">Canonical Role</th>
                      {CANONICAL_ACTIONS.map(action => (
                        <th key={action} className="px-3 py-3 text-center">
                          {action}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-white/5">
                    {CANONICAL_ROLES.map(role => {
                      const isSuper = role.id === 'superAdmin';
                      return (
                        <tr
                          key={role.id}
                          className={isSuper ? 'bg-blue-500/5' : 'hover:bg-slate-50 dark:hover:bg-white/2'}
                        >
                          <td className="px-5 py-3.5">
                            <div className="flex items-center gap-2">
                              <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: role.color }} />
                              <div>
                                <div className="text-xs font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                                  {role.label}
                                  {isSuper && (
                                    <span className="text-[9px] font-black uppercase px-1.5 py-0.2 rounded bg-blue-600 text-white">
                                      Locked
                                    </span>
                                  )}
                                </div>
                                <div className="text-[10px] text-slate-400">{role.desc}</div>
                              </div>
                            </div>
                          </td>

                          {CANONICAL_ACTIONS.map(action => {
                            const isChecked = isSuper ? true : (matrix[activeModule]?.[role.id]?.[action] ?? false);
                            return (
                              <td key={action} className="px-3 py-3.5 text-center">
                                <button
                                  type="button"
                                  disabled={isSuper}
                                  onClick={() => toggle(activeModule, role.id, action)}
                                  className={`w-7 h-7 rounded-lg flex items-center justify-center mx-auto transition-all ${
                                    isSuper
                                      ? 'bg-blue-600/20 border border-blue-500/30 text-blue-400 cursor-not-allowed opacity-80'
                                      : isChecked
                                        ? 'bg-[#3557FF] text-white border border-[#3557FF] shadow-xs cursor-pointer hover:scale-105'
                                        : 'bg-slate-100 dark:bg-white/5 border border-slate-200 dark:border-white/10 text-slate-400 hover:border-slate-400 cursor-pointer'
                                  }`}
                                  title={isSuper ? 'Super Admin always has full access' : `${action} permission for ${role.label}`}
                                >
                                  {isChecked ? <Check className="w-3.5 h-3.5" /> : <X className="w-3 h-3 opacity-40" />}
                                </button>
                              </td>
                            );
                          })}
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}

            <div className="p-4 bg-slate-50 dark:bg-white/2 border-t border-slate-100 dark:border-white/8 flex items-center justify-between text-[11px] text-slate-400">
              <span>⚠ Super Admin access is immutable and cannot be restricted.</span>
              <span>Single authoritative source of truth for the entire platform.</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PermissionsView;
