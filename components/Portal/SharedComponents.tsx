import React, { useState, useRef, useEffect } from 'react';
import {
  Search, Filter, ChevronDown, Check, X, AlertCircle, AlertTriangle,
  CheckCircle2, Info, Loader2, ArrowUpDown, MoreVertical, Plus
} from 'lucide-react';

// ─── 1. PageHeader ───────────────────────────────────────────────────
export interface PageHeaderProps {
  title: string;
  subtitle?: string;
  badge?: string;
  badgeColor?: string;
  actions?: React.ReactNode;
  icon?: React.ElementType;
}

export const PageHeader: React.FC<PageHeaderProps> = ({
  title,
  subtitle,
  badge,
  badgeColor = 'bg-[#5B4BFF]/10 text-[#5B4BFF] border-[#5B4BFF]/20 dark:bg-[#806CFF]/15 dark:text-[#806CFF]',
  actions,
  icon: Icon
}) => {
  return (
    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-[#D7DEE9] dark:border-[#293248]">
      <div className="flex items-center gap-3">
        {Icon && (
          <div className="w-10 h-10 rounded-xl bg-[#EEECFF] dark:bg-[#201D45] text-[#5B4BFF] dark:text-[#806CFF] flex items-center justify-center border border-[#5B4BFF]/20 shrink-0">
            <Icon className="w-5 h-5" />
          </div>
        )}
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-xl sm:text-2xl font-black text-[#101828] dark:text-[#F7F8FC] tracking-tight">
              {title}
            </h1>
            {badge && (
              <span className={`text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full border ${badgeColor}`}>
                {badge}
              </span>
            )}
          </div>
          {subtitle && (
            <p className="text-xs text-[#475467] dark:text-[#BAC1D1] mt-0.5 font-medium">
              {subtitle}
            </p>
          )}
        </div>
      </div>
      {actions && (
        <div className="flex items-center gap-2 flex-wrap sm:flex-nowrap">
          {actions}
        </div>
      )}
    </div>
  );
};

// ─── 2. Button & ActionButton ────────────────────────────────────────
export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'outline' | 'danger' | 'ghost' | 'success';
  size?: 'sm' | 'md' | 'lg';
  icon?: React.ElementType;
  iconPosition?: 'left' | 'right';
  loading?: boolean;
}

export const Button: React.FC<ButtonProps> = ({
  children,
  variant = 'primary',
  size = 'md',
  icon: Icon,
  iconPosition = 'left',
  loading = false,
  className = '',
  disabled,
  ...props
}) => {
  const sizeClasses = {
    sm: 'px-2.5 py-1.5 text-xs rounded-lg gap-1.5 font-bold',
    md: 'px-3.5 py-2 text-xs rounded-xl gap-2 font-bold',
    lg: 'px-5 py-2.5 text-sm rounded-xl gap-2.5 font-black',
  };

  const variantClasses = {
    primary: 'bg-[#5B4BFF] hover:bg-[#4E3FE6] text-white shadow-xs dark:bg-[#806CFF] dark:hover:bg-[#725DEF]',
    secondary: 'bg-[#F7F8FC] hover:bg-[#EEF1F6] text-[#101828] border border-[#D7DEE9] dark:bg-[#171E31] dark:hover:bg-[#1C2439] dark:text-[#F7F8FC] dark:border-[#293248]',
    outline: 'bg-transparent hover:bg-[#EEECFF] text-[#5B4BFF] border border-[#5B4BFF]/30 dark:text-[#806CFF] dark:hover:bg-[#201D45] dark:border-[#806CFF]/30',
    danger: 'bg-rose-600 hover:bg-rose-700 text-white shadow-xs dark:bg-rose-600 dark:hover:bg-rose-700',
    ghost: 'bg-transparent hover:bg-[#EEF1F6] text-[#475467] dark:text-[#BAC1D1] dark:hover:bg-[#171E31]',
    success: 'bg-[#16A34A] hover:bg-[#15803D] text-white shadow-xs',
  };

  return (
    <button
      className={`inline-flex items-center justify-center transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed ${sizeClasses[size]} ${variantClasses[variant]} ${className}`}
      disabled={disabled || loading}
      {...props}
    >
      {loading ? (
        <Loader2 className="w-3.5 h-3.5 animate-spin" />
      ) : (
        <>
          {Icon && iconPosition === 'left' && <Icon className="w-3.5 h-3.5 shrink-0" />}
          {children}
          {Icon && iconPosition === 'right' && <Icon className="w-3.5 h-3.5 shrink-0" />}
        </>
      )}
    </button>
  );
};

export const ActionButton = Button;

// ─── 3. StatusBadge ──────────────────────────────────────────────────
export interface StatusBadgeProps {
  status: string;
  variant?: 'auto' | 'success' | 'warning' | 'danger' | 'info' | 'review' | 'muted';
  size?: 'sm' | 'md';
}

export const StatusBadge: React.FC<StatusBadgeProps> = ({
  status,
  variant = 'auto',
  size = 'md'
}) => {
  const getBadgeStyle = (stat: string) => {
    const s = stat.toLowerCase().trim();
    if (['done', 'completed', 'approved', 'active', 'present', 'posted', 'paid'].includes(s)) {
      return 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800/40';
    }
    if (['in review', 'internal review', 'client review', 'pending', 'changes required', 'revision'].includes(s)) {
      return 'bg-purple-50 text-purple-700 border-purple-200 dark:bg-purple-950/40 dark:text-purple-300 dark:border-purple-800/40';
    }
    if (['in progress', 'in_progress', 'shot', 'in editing'].includes(s)) {
      return 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/40 dark:text-blue-300 dark:border-blue-800/40';
    }
    if (['urgent', 'overdue', 'late', 'absent', 'rejected', 'failed'].includes(s)) {
      return 'bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/40 dark:text-rose-300 dark:border-rose-800/40';
    }
    if (['high', 'paused', 'half day', 'leave'].includes(s)) {
      return 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-800/40';
    }
    return 'bg-slate-100 text-slate-700 border-slate-200 dark:bg-[#171E31] dark:text-[#BAC1D1] dark:border-[#293248]';
  };

  const resolvedClass = variant === 'auto' ? getBadgeStyle(status) : {
    success: 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800/40',
    warning: 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-800/40',
    danger: 'bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/40 dark:text-rose-300 dark:border-rose-800/40',
    info: 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/40 dark:text-blue-300 dark:border-blue-800/40',
    review: 'bg-purple-50 text-purple-700 border-purple-200 dark:bg-purple-950/40 dark:text-purple-300 dark:border-purple-800/40',
    muted: 'bg-slate-100 text-slate-700 border-slate-200 dark:bg-[#171E31] dark:text-[#BAC1D1] dark:border-[#293248]',
  }[variant];

  const sizeCls = size === 'sm' ? 'text-[9px] px-1.5 py-0.5' : 'text-[10px] px-2 py-0.5';

  return (
    <span className={`inline-flex items-center gap-1 font-bold uppercase tracking-wider rounded-md border ${sizeCls} ${resolvedClass}`}>
      <span className="w-1.5 h-1.5 rounded-full bg-current opacity-80" />
      {status}
    </span>
  );
};

// ─── 4. KpiCard ──────────────────────────────────────────────────────
export interface KpiCardProps {
  title: string;
  value: string | number;
  subValue?: string;
  change?: string;
  isPositive?: boolean;
  icon?: React.ElementType;
  iconColor?: string;
  onClick?: () => void;
}

export const KpiCard: React.FC<KpiCardProps> = ({
  title,
  value,
  subValue,
  change,
  isPositive,
  icon: Icon,
  iconColor = 'text-[#5B4BFF] dark:text-[#806CFF]',
  onClick
}) => {
  return (
    <div
      onClick={onClick}
      className={`bg-white dark:bg-[#111728] border border-[#D7DEE9] dark:border-[#293248] p-4 rounded-xl shadow-2xs transition-all ${
        onClick ? 'cursor-pointer hover:border-[#5B4BFF]/40 dark:hover:border-[#806CFF]/40 hover:shadow-xs' : ''
      }`}
    >
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs font-bold text-[#475467] dark:text-[#BAC1D1] uppercase tracking-wider">
          {title}
        </span>
        {Icon && (
          <div className="w-8 h-8 rounded-lg bg-[#F7F8FC] dark:bg-[#171E31] border border-[#D7DEE9] dark:border-[#293248] flex items-center justify-center shrink-0">
            <Icon className={`w-4 h-4 ${iconColor}`} />
          </div>
        )}
      </div>
      <div className="mt-2 flex items-baseline gap-2">
        <span className="text-2xl font-black text-[#101828] dark:text-[#F7F8FC] tracking-tight">
          {value}
        </span>
        {subValue && (
          <span className="text-xs font-medium text-[#7A8496] dark:text-[#828BA1]">
            {subValue}
          </span>
        )}
      </div>
      {change && (
        <div className="mt-2 text-[11px] font-bold flex items-center gap-1">
          <span className={isPositive ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}>
            {isPositive ? '↑' : '↓'} {change}
          </span>
          <span className="text-[#7A8496] dark:text-[#828BA1]">vs last cycle</span>
        </div>
      )}
    </div>
  );
};

// ─── 5. Tabs ─────────────────────────────────────────────────────────
export interface TabOption {
  id: string;
  label: string;
  count?: number;
  icon?: React.ElementType;
}

export interface TabsProps {
  tabs: TabOption[];
  activeTab: string;
  onChange: (tabId: string) => void;
}

export const Tabs: React.FC<TabsProps> = ({ tabs, activeTab, onChange }) => {
  return (
    <div className="flex items-center gap-1 bg-[#F7F8FC] dark:bg-[#171E31] p-1 rounded-xl border border-[#D7DEE9] dark:border-[#293248] overflow-x-auto scrollbar-none">
      {tabs.map(tab => {
        const isActive = activeTab === tab.id;
        const Icon = tab.icon;
        return (
          <button
            key={tab.id}
            onClick={() => onChange(tab.id)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all whitespace-nowrap cursor-pointer ${
              isActive
                ? 'bg-white dark:bg-[#111728] text-[#101828] dark:text-[#F7F8FC] shadow-2xs border border-[#D7DEE9] dark:border-[#293248]'
                : 'text-[#475467] dark:text-[#BAC1D1] hover:text-[#101828] dark:hover:text-white'
            }`}
          >
            {Icon && <Icon className={`w-3.5 h-3.5 ${isActive ? 'text-[#5B4BFF] dark:text-[#806CFF]' : ''}`} />}
            <span>{tab.label}</span>
            {tab.count !== undefined && (
              <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-mono ${
                isActive
                  ? 'bg-[#EEECFF] text-[#5B4BFF] dark:bg-[#201D45] dark:text-[#806CFF]'
                  : 'bg-[#D7DEE9]/50 text-[#475467] dark:bg-[#293248] dark:text-[#BAC1D1]'
              }`}>
                {tab.count}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
};

// ─── 6. SearchInput & FilterBar ──────────────────────────────────────
export interface SearchInputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  onClear?: () => void;
}

export const SearchInput: React.FC<SearchInputProps> = ({ value, onClear, ...props }) => {
  return (
    <div className="relative flex items-center w-full min-w-[200px] max-w-md">
      <Search className="absolute left-3 w-3.5 h-3.5 text-[#7A8496] pointer-events-none" />
      <input
        value={value}
        className="w-full bg-[#F7F8FC] dark:bg-[#171E31] text-[#101828] dark:text-[#F7F8FC] placeholder-[#7A8496] border border-[#D7DEE9] dark:border-[#293248] rounded-xl pl-9 pr-8 py-2 text-xs font-semibold outline-none focus:border-[#5B4BFF] dark:focus:border-[#806CFF] transition-all"
        {...props}
      />
      {value && onClear && (
        <button
          type="button"
          onClick={onClear}
          className="absolute right-2.5 p-0.5 rounded-full text-[#7A8496] hover:text-[#101828] dark:hover:text-white"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      )}
    </div>
  );
};

// ─── 7. Modal ────────────────────────────────────────────────────────
export interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
  maxWidth?: 'sm' | 'md' | 'lg' | 'xl' | '2xl' | '3xl';
}

export const Modal: React.FC<ModalProps> = ({
  isOpen,
  onClose,
  title,
  subtitle,
  children,
  footer,
  maxWidth = 'lg'
}) => {
  if (!isOpen) return null;

  const widthClasses = {
    sm: 'max-w-sm',
    md: 'max-w-md',
    lg: 'max-w-lg',
    xl: 'max-w-xl',
    '2xl': 'max-w-2xl',
    '3xl': 'max-w-3xl',
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in-50">
      <div className={`bg-white dark:bg-[#111728] border border-[#D7DEE9] dark:border-[#293248] rounded-2xl shadow-2xl w-full ${widthClasses[maxWidth]} max-h-[90vh] flex flex-col overflow-hidden animate-in zoom-in-95`}>
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#D7DEE9] dark:border-[#293248]">
          <div>
            <h3 className="text-base font-black text-[#101828] dark:text-[#F7F8FC]">
              {title}
            </h3>
            {subtitle && (
              <p className="text-xs text-[#475467] dark:text-[#BAC1D1] mt-0.5">
                {subtitle}
              </p>
            )}
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-[#7A8496] hover:text-[#101828] dark:hover:text-white hover:bg-[#EEF1F6] dark:hover:bg-[#171E31] transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          {children}
        </div>

        {/* Footer */}
        {footer && (
          <div className="px-6 py-3.5 bg-[#F7F8FC] dark:bg-[#171E31] border-t border-[#D7DEE9] dark:border-[#293248] flex items-center justify-end gap-2.5">
            {footer}
          </div>
        )}
      </div>
    </div>
  );
};

// ─── 8. Drawer ───────────────────────────────────────────────────────
export interface DrawerProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
}

export const Drawer: React.FC<DrawerProps> = ({
  isOpen,
  onClose,
  title,
  subtitle,
  children,
  footer
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/50 backdrop-blur-xs animate-in fade-in-50">
      <div className="bg-white dark:bg-[#111728] border-l border-[#D7DEE9] dark:border-[#293248] w-full max-w-md h-full shadow-2xl flex flex-col overflow-hidden animate-in slide-in-from-right">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-[#D7DEE9] dark:border-[#293248]">
          <div>
            <h3 className="text-base font-black text-[#101828] dark:text-[#F7F8FC]">
              {title}
            </h3>
            {subtitle && (
              <p className="text-xs text-[#475467] dark:text-[#BAC1D1] mt-0.5">
                {subtitle}
              </p>
            )}
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-[#7A8496] hover:text-[#101828] dark:hover:text-white hover:bg-[#EEF1F6] dark:hover:bg-[#171E31]"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          {children}
        </div>

        {/* Footer */}
        {footer && (
          <div className="p-4 bg-[#F7F8FC] dark:bg-[#171E31] border-t border-[#D7DEE9] dark:border-[#293248] flex items-center justify-end gap-2.5">
            {footer}
          </div>
        )}
      </div>
    </div>
  );
};

// ─── 9. FormField ────────────────────────────────────────────────────
export interface FormFieldProps {
  label: string;
  required?: boolean;
  error?: string;
  hint?: string;
  children: React.ReactNode;
}

export const FormField: React.FC<FormFieldProps> = ({
  label,
  required,
  error,
  hint,
  children
}) => {
  return (
    <div className="space-y-1.5 text-left">
      <div className="flex items-center justify-between">
        <label className="text-xs font-bold text-[#101828] dark:text-[#F7F8FC]">
          {label} {required && <span className="text-rose-500">*</span>}
        </label>
        {hint && <span className="text-[10px] text-[#7A8496] dark:text-[#828BA1]">{hint}</span>}
      </div>
      {children}
      {error && (
        <p className="text-[10px] font-bold text-rose-600 dark:text-rose-400 flex items-center gap-1">
          <AlertCircle className="w-3 h-3" /> {error}
        </p>
      )}
    </div>
  );
};

// ─── 10. EmptyState ──────────────────────────────────────────────────
export interface EmptyStateProps {
  title: string;
  description?: string;
  icon?: React.ElementType;
  action?: React.ReactNode;
}

export const EmptyState: React.FC<EmptyStateProps> = ({
  title,
  description,
  icon: Icon = Info,
  action
}) => {
  return (
    <div className="flex flex-col items-center justify-center p-6 sm:p-8 text-center bg-white/50 dark:bg-[#111728]/50 border border-dashed border-[#D7DEE9] dark:border-[#293248] rounded-xl my-2 max-h-[160px]">
      <Icon className="w-6 h-6 text-[#7A8496] mb-2 opacity-80" />
      <h4 className="text-xs font-bold text-[#101828] dark:text-[#F7F8FC]">
        {title}
      </h4>
      {description && (
        <p className="text-[11px] text-[#475467] dark:text-[#BAC1D1] mt-0.5 max-w-sm">
          {description}
        </p>
      )}
      {action && <div className="mt-3">{action}</div>}
    </div>
  );
};

// ─── 11. LoadingSkeleton ─────────────────────────────────────────────
export const LoadingSkeleton: React.FC<{ rows?: number; height?: string }> = ({
  rows = 3,
  height = 'h-12'
}) => {
  return (
    <div className="space-y-3 w-full animate-pulse">
      {Array.from({ length: rows }).map((_, i) => (
        <div
          key={i}
          className={`w-full ${height} bg-[#D7DEE9]/40 dark:bg-[#293248]/60 rounded-xl`}
        />
      ))}
    </div>
  );
};

// ─── 12. ConfirmationDialog ──────────────────────────────────────────
export interface ConfirmationDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  isDestructive?: boolean;
}

export const ConfirmationDialog: React.FC<ConfirmationDialogProps> = ({
  isOpen,
  onClose,
  onConfirm,
  title,
  message,
  confirmText = 'Confirm',
  cancelText = 'Cancel',
  isDestructive = false
}) => {
  if (!isOpen) return null;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={title}
      maxWidth="sm"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            {cancelText}
          </Button>
          <Button
            variant={isDestructive ? 'danger' : 'primary'}
            onClick={() => {
              onConfirm();
              onClose();
            }}
          >
            {confirmText}
          </Button>
        </>
      }
    >
      <div className="flex items-start gap-3">
        {isDestructive ? (
          <AlertTriangle className="w-5 h-5 text-rose-500 shrink-0 mt-0.5" />
        ) : (
          <Info className="w-5 h-5 text-[#5B4BFF] shrink-0 mt-0.5" />
        )}
        <p className="text-xs text-[#475467] dark:text-[#BAC1D1] leading-relaxed">
          {message}
        </p>
      </div>
    </Modal>
  );
};
