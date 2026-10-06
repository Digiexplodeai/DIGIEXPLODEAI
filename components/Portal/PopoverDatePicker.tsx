import React, { useState, useEffect, useRef } from 'react';
import { 
  Calendar as CalendarIcon, 
  ChevronLeft, 
  ChevronRight, 
  ChevronDown, 
  Clock, 
  Sparkles,
  X
} from 'lucide-react';

export interface PopoverDatePickerProps {
  selectedDate: string; // Canonical YYYY-MM-DD format (e.g. "2026-09-28")
  onChange: (dateStr: string) => void;
  label?: string;
  placeholder?: string;
  required?: boolean;
  disabled?: boolean;
  minDate?: string; // Optional minimum date YYYY-MM-DD
  className?: string;
  showQuickChips?: boolean;
}

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];

const WEEKDAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export const PopoverDatePicker: React.FC<PopoverDatePickerProps> = ({
  selectedDate,
  onChange,
  label,
  placeholder = 'Select date...',
  required = false,
  disabled = false,
  minDate,
  className = '',
  showQuickChips = true
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Parse selected date or default to current date
  const parseSelected = () => {
    if (selectedDate && /^\d{4}-\d{2}-\d{2}$/.test(selectedDate)) {
      const [y, m, d] = selectedDate.split('-').map(Number);
      return new Date(y, m - 1, d);
    }
    return new Date();
  };

  const [viewDate, setViewDate] = useState<Date>(() => parseSelected());

  // Keep viewDate synchronized if selectedDate changes externally
  useEffect(() => {
    if (selectedDate && /^\d{4}-\d{2}-\d{2}$/.test(selectedDate)) {
      const [y, m, d] = selectedDate.split('-').map(Number);
      setViewDate(new Date(y, m - 1, d));
    }
  }, [selectedDate]);

  // Click outside and Escape key handler
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        setIsOpen(false);
      }
    };

    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('keydown', handleKeyDown);
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  // Format date for display: "Sep 28, 2026"
  const formatDisplayDate = (dateStr: string) => {
    if (!dateStr || !/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) return '';
    try {
      const [y, m, d] = dateStr.split('-').map(Number);
      const dateObj = new Date(y, m - 1, d);
      return dateObj.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric'
      });
    } catch {
      return dateStr;
    }
  };

  // Convert Date object to canonical YYYY-MM-DD string
  const toDateString = (d: Date): string => {
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  const handleSelectDate = (d: Date) => {
    const dateStr = toDateString(d);
    onChange(dateStr);
    setIsOpen(false);
  };

  // Quick select helpers
  const handleQuickSelect = (offsetDays: number) => {
    const d = new Date();
    d.setDate(d.getDate() + offsetDays);
    handleSelectDate(d);
  };

  const handleQuickNextMonday = () => {
    const d = new Date();
    const day = d.getDay();
    const diff = (8 - day) % 7 || 7;
    d.setDate(d.getDate() + diff);
    handleSelectDate(d);
  };

  // Month navigation
  const prevMonth = (e: React.MouseEvent) => {
    e.stopPropagation();
    setViewDate(new Date(viewDate.getFullYear(), viewDate.getMonth() - 1, 1));
  };

  const nextMonth = (e: React.MouseEvent) => {
    e.stopPropagation();
    setViewDate(new Date(viewDate.getFullYear(), viewDate.getMonth() + 1, 1));
  };

  // Grid calculations
  const year = viewDate.getFullYear();
  const month = viewDate.getMonth();

  const firstDayIndex = new Date(year, month, 1).getDay(); // 0 = Sun
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const daysInPrevMonth = new Date(year, month, 0).getDate();

  const todayStr = toDateString(new Date());

  // Generate calendar cells (prev month padding + current month days + next month padding)
  const calendarCells = [];

  // Previous month padding
  for (let i = firstDayIndex - 1; i >= 0; i--) {
    const dayNum = daysInPrevMonth - i;
    const dateObj = new Date(year, month - 1, dayNum);
    calendarCells.push({
      date: dateObj,
      isCurrentMonth: false,
      dayNum
    });
  }

  // Current month days
  for (let i = 1; i <= daysInMonth; i++) {
    const dateObj = new Date(year, month, i);
    calendarCells.push({
      date: dateObj,
      isCurrentMonth: true,
      dayNum: i
    });
  }

  // Next month padding (to fill 42 cells standard 6-row grid)
  const remainingCells = 42 - calendarCells.length;
  for (let i = 1; i <= remainingCells; i++) {
    const dateObj = new Date(year, month + 1, i);
    calendarCells.push({
      date: dateObj,
      isCurrentMonth: false,
      dayNum: i
    });
  }

  const displayText = formatDisplayDate(selectedDate);

  return (
    <div className={`relative ${className}`} ref={containerRef}>
      {label && (
        <div className="flex justify-between items-center mb-1">
          <label className="text-[10px] font-black uppercase tracking-wider text-slate-400 dark:text-slate-400">
            {label} {required && <span className="text-rose-500">*</span>}
          </label>
        </div>
      )}

      {/* Main Trigger Field */}
      <button
        type="button"
        disabled={disabled}
        onClick={() => setIsOpen(!isOpen)}
        aria-haspopup="dialog"
        aria-expanded={isOpen}
        aria-label={label || 'Select Due Date'}
        className={`w-full h-9 sm:h-9.5 px-3 rounded-xl text-xs font-bold transition-all flex items-center justify-between text-left border cursor-pointer ${
          isOpen
            ? 'bg-white dark:bg-[#111728] border-indigo-500 dark:border-indigo-400 ring-2 ring-indigo-500/20 shadow-xs'
            : 'bg-slate-50/70 dark:bg-slate-950/40 border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700'
        } ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
      >
        <div className="flex items-center gap-2 truncate">
          <CalendarIcon className="w-3.5 h-3.5 text-indigo-600 dark:text-indigo-400 shrink-0" />
          <span className={displayText ? 'text-slate-900 dark:text-slate-100 font-bold' : 'text-slate-400 font-normal'}>
            {displayText || placeholder}
          </span>
        </div>
        <ChevronDown
          className={`w-3.5 h-3.5 text-slate-400 transition-transform duration-200 shrink-0 ${
            isOpen ? 'rotate-180 text-indigo-600 dark:text-indigo-400' : ''
          }`}
        />
      </button>

      {/* Floating Popover Calendar */}
      {isOpen && (
        <div
          role="dialog"
          aria-modal="true"
          className="absolute left-0 z-50 mt-1.5 w-[305px] sm:w-[320px] bg-white dark:bg-[#111728] border border-[#D8DEE9] dark:border-[#293248] rounded-2xl shadow-[0_12px_30px_rgba(16,24,40,0.14)] p-3.5 sm:p-4 animate-in fade-in-50 zoom-in-95"
        >
          {/* Quick Date Action Chips */}
          {showQuickChips && (
            <div className="flex items-center justify-between gap-1.5 pb-3 mb-3 border-b border-slate-100 dark:border-slate-800/80">
              <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 shrink-0">Quick:</span>
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => handleQuickSelect(0)}
                  className="px-2 py-1 text-[10px] font-bold rounded-lg bg-indigo-50 hover:bg-indigo-100 dark:bg-indigo-950/50 dark:hover:bg-indigo-900/60 text-indigo-700 dark:text-indigo-300 transition-colors cursor-pointer"
                >
                  Today
                </button>
                <button
                  type="button"
                  onClick={() => handleQuickSelect(1)}
                  className="px-2 py-1 text-[10px] font-bold rounded-lg bg-indigo-50 hover:bg-indigo-100 dark:bg-indigo-950/50 dark:hover:bg-indigo-900/60 text-indigo-700 dark:text-indigo-300 transition-colors cursor-pointer"
                >
                  Tomorrow
                </button>
                <button
                  type="button"
                  onClick={handleQuickNextMonday}
                  className="px-2 py-1 text-[10px] font-bold rounded-lg bg-indigo-50 hover:bg-indigo-100 dark:bg-indigo-950/50 dark:hover:bg-indigo-900/60 text-indigo-700 dark:text-indigo-300 transition-colors cursor-pointer"
                >
                  Next Mon
                </button>
              </div>
            </div>
          )}

          {/* Month / Year Header */}
          <div className="flex items-center justify-between mb-3">
            <button
              type="button"
              onClick={prevMonth}
              aria-label="Previous Month"
              className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300 transition-colors cursor-pointer"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>

            <span className="text-xs font-black text-slate-900 dark:text-slate-100 tracking-tight">
              {MONTH_NAMES[month]} {year}
            </span>

            <button
              type="button"
              onClick={nextMonth}
              aria-label="Next Month"
              className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300 transition-colors cursor-pointer"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>

          {/* Weekdays Row */}
          <div className="grid grid-cols-7 gap-1 text-center mb-1.5">
            {WEEKDAY_NAMES.map((name) => (
              <span
                key={name}
                className="text-[10px] font-black uppercase text-slate-400 dark:text-slate-500 py-1"
              >
                {name}
              </span>
            ))}
          </div>

          {/* Days 6-Row Grid */}
          <div className="grid grid-cols-7 gap-1 text-center">
            {calendarCells.map((cell, idx) => {
              const cellDateStr = toDateString(cell.date);
              const isSelected = cellDateStr === selectedDate;
              const isToday = cellDateStr === todayStr;

              return (
                <button
                  key={idx}
                  type="button"
                  onClick={() => handleSelectDate(cell.date)}
                  className={`h-8 w-8 mx-auto rounded-xl text-xs font-bold flex items-center justify-center transition-all cursor-pointer relative ${
                    isSelected
                      ? 'bg-indigo-600 dark:bg-indigo-500 text-white shadow-xs font-black scale-105'
                      : isToday
                        ? 'border border-indigo-500 dark:border-indigo-400 text-indigo-600 dark:text-indigo-400 font-extrabold hover:bg-indigo-50 dark:hover:bg-indigo-950/40'
                        : cell.isCurrentMonth
                          ? 'text-slate-800 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800'
                          : 'text-slate-300 dark:text-slate-600 hover:bg-slate-50 dark:hover:bg-slate-850/50'
                  }`}
                >
                  <span>{cell.dayNum}</span>
                  {isToday && !isSelected && (
                    <span className="absolute bottom-1 w-1 h-1 rounded-full bg-indigo-600 dark:bg-indigo-400" />
                  )}
                </button>
              );
            })}
          </div>

          {/* Footer Info / Today Jump */}
          <div className="mt-3 pt-2.5 border-t border-slate-100 dark:border-slate-800/80 flex items-center justify-between text-[10px] text-slate-400">
            <span>Selected: <strong className="text-slate-700 dark:text-slate-300 font-bold">{displayText || 'None'}</strong></span>
            <button
              type="button"
              onClick={() => handleSelectDate(new Date())}
              className="font-bold text-indigo-600 dark:text-indigo-400 hover:underline cursor-pointer"
            >
              Jump to Today
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
