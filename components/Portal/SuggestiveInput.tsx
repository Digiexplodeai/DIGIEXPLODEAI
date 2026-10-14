import React, { useState, useRef, useEffect, useMemo } from 'react';
import { History, Clock, X, Check } from 'lucide-react';
import {
  getFieldHistory,
  saveFormFieldHistory,
  removeFormFieldHistory,
  subscribeToFieldHistory,
  isLikelyPlaceholder
} from '../../lib/formHistoryStorage';

export interface SuggestiveInputProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'onChange'> {
  fieldKey: string;
  value: string;
  onChange: (value: string) => void;
  extraSeeds?: string[];
  maxSuggestions?: number;
  wrapperClassName?: string;
  showBadge?: boolean;
}

/**
 * SuggestiveInput - An intelligent input component that presents past history suggestions
 * based on previously entered values and existing system data.
 * 
 * - When typing: Automatically shows matching suggestions from past history.
 * - When empty: Keeps the form clean and unobtrusive. The user can click the History (🕒) 
 *   icon or press ArrowDown to view past entries.
 */
export const SuggestiveInput: React.FC<SuggestiveInputProps> = ({
  fieldKey,
  value,
  onChange,
  extraSeeds = [],
  maxSuggestions = 6,
  wrapperClassName = '',
  showBadge = false,
  className = '',
  placeholder,
  onFocus,
  onBlur,
  onKeyDown,
  required,
  type = 'text',
  disabled,
  ...restProps
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState<number>(-1);
  const [allHistory, setAllHistory] = useState<string[]>(() => getFieldHistory(fieldKey, extraSeeds));
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Subscribe to reactive history updates for this field
  useEffect(() => {
    return subscribeToFieldHistory(fieldKey, (newHistory) => {
      setAllHistory(newHistory);
    });
  }, [fieldKey]);

  // Combine with live extraSeeds whenever extraSeeds changes
  useEffect(() => {
    if (extraSeeds && extraSeeds.length > 0) {
      setAllHistory(getFieldHistory(fieldKey, extraSeeds));
    }
  }, [extraSeeds, fieldKey]);

  // Clean tainted placeholder strings from localStorage on mount
  useEffect(() => {
    if (typeof window !== 'undefined') {
      try {
        const k = `digi_form_hist_v2_${fieldKey}`;
        const raw = localStorage.getItem(k);
        if (raw) {
          const parsed = JSON.parse(raw);
          if (Array.isArray(parsed)) {
            const clean = parsed.filter(i => typeof i === 'string' && !isLikelyPlaceholder(i));
            if (clean.length !== parsed.length) {
              localStorage.setItem(k, JSON.stringify(clean));
              setAllHistory(clean);
            }
          }
        }
      } catch (e) {}
    }
  }, [fieldKey]);

  // Effective candidate pool merging extraSeeds, live board tasks, and persistent history
  const effectiveHistory = useMemo(() => {
    const raw = getFieldHistory(fieldKey, extraSeeds);
    const combined = [...(extraSeeds || []), ...(allHistory || []), ...raw];
    const seen = new Set<string>();
    const result: string[] = [];
    for (const item of combined) {
      if (!item || typeof item !== 'string') continue;
      const clean = item.trim();
      if (!clean || isLikelyPlaceholder(clean)) continue;
      const lower = clean.toLowerCase();
      if (!seen.has(lower)) {
        seen.add(lower);
        result.push(clean);
      }
    }
    return result;
  }, [fieldKey, extraSeeds, allHistory]);

  // Filter history based on current input text
  const filteredSuggestions = useMemo(() => {
    const q = (value || '').trim().toLowerCase();
    if (!q) {
      return effectiveHistory.slice(0, maxSuggestions);
    }
    const matches = effectiveHistory
      .filter(item => item.toLowerCase().includes(q))
      .slice(0, maxSuggestions);

    // If the only suggestion is already an exact case-insensitive match, don't nag the user
    if (matches.length === 1 && matches[0].toLowerCase() === q) {
      return [];
    }
    return matches;
  }, [effectiveHistory, value, maxSuggestions]);

  // Close dropdown on click outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Reset keyboard highlight when suggestions list changes
  useEffect(() => {
    setHighlightedIndex(filteredSuggestions.length > 0 ? 0 : -1);
  }, [filteredSuggestions.length, value]);

  const handleSelect = (selectedVal: string) => {
    onChange(selectedVal);
    saveFormFieldHistory(fieldKey, selectedVal);
    setIsOpen(false);
    if (inputRef.current) {
      inputRef.current.focus();
    }
  };

  const handleRemove = (e: React.MouseEvent, itemToRemove: string) => {
    e.stopPropagation();
    e.preventDefault();
    removeFormFieldHistory(fieldKey, itemToRemove);
  };

  const handleKeyDownInternal = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (onKeyDown) onKeyDown(e);

    if (!isOpen) {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setIsOpen(true);
      }
      return;
    }

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setHighlightedIndex(prev => (prev < filteredSuggestions.length - 1 ? prev + 1 : prev));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setHighlightedIndex(prev => (prev > 0 ? prev - 1 : 0));
    } else if (e.key === 'Enter') {
      if (highlightedIndex >= 0 && highlightedIndex < filteredSuggestions.length) {
        e.preventDefault();
        handleSelect(filteredSuggestions[highlightedIndex]);
      } else {
        if (value.trim()) {
          saveFormFieldHistory(fieldKey, value.trim());
        }
        setIsOpen(false);
      }
    } else if (e.key === 'Escape') {
      e.preventDefault();
      setIsOpen(false);
    }
  };

  const handleFocusInternal = (e: React.FocusEvent<HTMLInputElement>) => {
    if (onFocus) onFocus(e);
    // Show suggestions as soon as user focuses the field
    if (effectiveHistory.length > 0) {
      setIsOpen(true);
    }
  };

  const handleBlurInternal = (e: React.FocusEvent<HTMLInputElement>) => {
    if (onBlur) onBlur(e);
    if (value && value.trim().length >= 2) {
      saveFormFieldHistory(fieldKey, value.trim());
    }
  };

  // Helper to render matched bold text
  const renderHighlightedText = (text: string, query: string) => {
    if (!query.trim()) return <span>{text}</span>;
    const qLower = query.toLowerCase();
    const index = text.toLowerCase().indexOf(qLower);
    if (index === -1) return <span>{text}</span>;

    const before = text.substring(0, index);
    const match = text.substring(index, index + query.length);
    const after = text.substring(index + query.length);

    return (
      <span>
        {before}
        <span className="text-[#5B4BFF] dark:text-[#806CFF] font-black underline decoration-[#5B4BFF]/40">{match}</span>
        {after}
      </span>
    );
  };

  return (
    <div 
      ref={containerRef} 
      className={`relative font-sans ${isOpen ? 'z-[100]' : 'z-auto'} ${wrapperClassName}`}
      style={{ zIndex: isOpen ? 9999 : undefined }}
    >
      <div className="relative flex items-center">
        <input
          ref={inputRef}
          type={type}
          value={value}
          onChange={e => {
            onChange(e.target.value);
            // Open matching suggestions as user types
            if (e.target.value.trim().length > 0) {
              setIsOpen(true);
            } else {
              setIsOpen(true);
            }
          }}
          onClick={e => {
            if (restProps.onClick) restProps.onClick(e);
            if (effectiveHistory.length > 0) {
              setIsOpen(true);
            }
          }}
          onFocus={handleFocusInternal}
          onBlur={handleBlurInternal}
          onKeyDown={handleKeyDownInternal}
          placeholder={placeholder}
          required={required}
          disabled={disabled}
          autoComplete="off"
          className={`${className} ${allHistory.length > 0 ? 'pr-9' : ''}`}
          {...restProps}
        />

        {/* Subtle History indicator button on the right */}
        {allHistory.length > 0 && !disabled && (
          <button
            type="button"
            tabIndex={-1}
            onClick={() => setIsOpen(!isOpen)}
            title={isOpen ? "Close suggestions" : `Click to view past suggestions (${allHistory.length} available)`}
            className={`absolute right-2 p-1.5 rounded-lg transition-colors cursor-pointer ${
              isOpen 
                ? 'text-[#5B4BFF] bg-[#5B4BFF]/10 dark:text-[#806CFF] dark:bg-[#806CFF]/20' 
                : 'text-slate-400 hover:text-[#5B4BFF] dark:hover:text-[#806CFF] hover:bg-slate-100 dark:hover:bg-white/10'
            }`}
          >
            <History className="w-3.5 h-3.5" />
          </button>
        )}
      </div>

      {/* Floating Past History Suggestions Menu */}
      {isOpen && filteredSuggestions.length > 0 && (
        <div 
          style={{ zIndex: 10000 }}
          className="absolute left-0 right-0 top-full mt-1.5 z-[100] bg-white dark:bg-[#111728] border border-[#D8DEE9] dark:border-white/15 rounded-2xl shadow-2xl overflow-hidden py-1 animate-in fade-in zoom-in-95"
        >
          {/* Header indicator */}
          <div className="px-3 py-1.5 text-[10px] font-black uppercase tracking-wider text-[#7A8496] border-b border-[#D8DEE9]/60 dark:border-white/10 flex items-center justify-between bg-slate-50/70 dark:bg-[#161B31]/70">
            <span className="flex items-center gap-1.5">
              <History className="w-3 h-3 text-[#5B4BFF] dark:text-[#806CFF]" />
              <span>Past Suggestions ({filteredSuggestions.length})</span>
            </span>
            <span className="font-mono text-[9px] text-slate-400">↑↓ to navigate · Enter to select</span>
          </div>

          <div className="max-h-48 overflow-y-auto divide-y divide-slate-100 dark:divide-white/5">
            {filteredSuggestions.map((item, idx) => {
              const isSelected = item.toLowerCase() === (value || '').trim().toLowerCase();
              const isHighlighted = idx === highlightedIndex;

              return (
                <div
                  key={`${item}-${idx}`}
                  onMouseDown={() => handleSelect(item)}
                  onMouseEnter={() => setHighlightedIndex(idx)}
                  className={`px-3 py-2 flex items-center justify-between gap-2.5 cursor-pointer transition-colors text-xs ${
                    isHighlighted
                      ? 'bg-[#EEECFF] dark:bg-[#201D45] text-[#5B4BFF] dark:text-[#806CFF]'
                      : 'hover:bg-[#F8FAFC] dark:hover:bg-[#161B31] text-[#101828] dark:text-[#F7F8FC]'
                  } ${isSelected ? 'font-black bg-[#EEECFF]/60 dark:bg-[#201D45]/60' : 'font-medium'}`}
                >
                  <div className="flex items-center gap-2 min-w-0 flex-1">
                    <Clock className="w-3.5 h-3.5 text-slate-400 shrink-0 opacity-70" />
                    <span className="truncate" title={item}>
                      {renderHighlightedText(item, value)}
                    </span>
                  </div>

                  <div className="flex items-center gap-1.5 shrink-0">
                    {isSelected && (
                      <Check className="w-3.5 h-3.5 text-[#5B4BFF] dark:text-[#806CFF]" />
                    )}
                    <button
                      type="button"
                      tabIndex={-1}
                      title="Remove from history"
                      onMouseDown={(e) => handleRemove(e, item)}
                      className="p-1 rounded-md text-slate-300 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-colors"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};

export interface SuggestiveTextareaProps extends Omit<React.TextareaHTMLAttributes<HTMLTextAreaElement>, 'onChange'> {
  fieldKey: string;
  value: string;
  onChange: (value: string) => void;
  extraSeeds?: string[];
  maxSuggestions?: number;
  wrapperClassName?: string;
}

/**
 * SuggestiveTextarea - Multi-line textarea with intelligent history suggestions
 */
export const SuggestiveTextarea: React.FC<SuggestiveTextareaProps> = ({
  fieldKey,
  value,
  onChange,
  extraSeeds = [],
  maxSuggestions = 5,
  wrapperClassName = '',
  className = '',
  placeholder,
  onFocus,
  onBlur,
  rows = 3,
  disabled,
  ...restProps
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [allHistory, setAllHistory] = useState<string[]>(() => getFieldHistory(fieldKey, extraSeeds));
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    return subscribeToFieldHistory(fieldKey, (newHistory) => {
      setAllHistory(newHistory);
    });
  }, [fieldKey]);

  useEffect(() => {
    if (extraSeeds && extraSeeds.length > 0) {
      setAllHistory(getFieldHistory(fieldKey, extraSeeds));
    }
  }, [extraSeeds, fieldKey]);

  const effectiveHistory = useMemo(() => {
    const raw = getFieldHistory(fieldKey, extraSeeds);
    const combined = [...(extraSeeds || []), ...(allHistory || []), ...raw];
    const seen = new Set<string>();
    const result: string[] = [];
    for (const item of combined) {
      if (!item || typeof item !== 'string') continue;
      const clean = item.trim();
      if (!clean || isLikelyPlaceholder(clean)) continue;
      const lower = clean.toLowerCase();
      if (!seen.has(lower)) {
        seen.add(lower);
        result.push(clean);
      }
    }
    return result;
  }, [fieldKey, extraSeeds, allHistory]);

  const filteredSuggestions = useMemo(() => {
    const q = (value || '').trim().toLowerCase();
    if (!q) {
      return effectiveHistory.slice(0, maxSuggestions);
    }
    const matches = effectiveHistory
      .filter(item => item.toLowerCase().includes(q))
      .slice(0, maxSuggestions);

    if (matches.length === 1 && matches[0].toLowerCase() === q) {
      return [];
    }
    return matches;
  }, [effectiveHistory, value, maxSuggestions]);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSelect = (selectedVal: string) => {
    onChange(selectedVal);
    saveFormFieldHistory(fieldKey, selectedVal);
    setIsOpen(false);
  };

  const handleRemove = (e: React.MouseEvent, itemToRemove: string) => {
    e.stopPropagation();
    e.preventDefault();
    removeFormFieldHistory(fieldKey, itemToRemove);
  };

  const handleBlurInternal = (e: React.FocusEvent<HTMLTextAreaElement>) => {
    if (onBlur) onBlur(e);
    if (value && value.trim().length >= 3) {
      saveFormFieldHistory(fieldKey, value.trim());
    }
  };

  return (
    <div 
      ref={containerRef} 
      className={`relative font-sans ${isOpen ? 'z-[100]' : 'z-auto'} ${wrapperClassName}`}
      style={{ zIndex: isOpen ? 9999 : undefined }}
    >
      <div className="relative">
        <textarea
          value={value}
          onChange={e => {
            onChange(e.target.value);
            if (e.target.value.trim().length > 0) {
              setIsOpen(true);
            } else {
              setIsOpen(true);
            }
          }}
          onClick={e => {
            if (restProps.onClick) restProps.onClick(e);
            if (effectiveHistory.length > 0) {
              setIsOpen(true);
            }
          }}
          onFocus={(e) => {
            if (onFocus) onFocus(e);
            if (effectiveHistory.length > 0) {
              setIsOpen(true);
            }
          }}
          onBlur={handleBlurInternal}
          placeholder={placeholder}
          rows={rows}
          disabled={disabled}
          className={`${className} ${allHistory.length > 0 ? 'pr-8' : ''}`}
          {...restProps}
        />

        {/* History indicator icon inside top right of textarea */}
        {allHistory.length > 0 && !disabled && (
          <button
            type="button"
            tabIndex={-1}
            onClick={() => setIsOpen(!isOpen)}
            title={isOpen ? "Close suggestions" : `Click to view past suggestions (${allHistory.length} available)`}
            className={`absolute top-2.5 right-2.5 p-1 rounded-lg transition-colors cursor-pointer ${
              isOpen 
                ? 'text-[#5B4BFF] bg-[#5B4BFF]/10 dark:text-[#806CFF] dark:bg-[#806CFF]/20' 
                : 'text-slate-400 hover:text-[#5B4BFF] dark:hover:text-[#806CFF] hover:bg-slate-100 dark:hover:bg-white/10'
            }`}
          >
            <History className="w-3.5 h-3.5" />
          </button>
        )}
      </div>

      {/* Floating Suggestions for Textarea */}
      {isOpen && filteredSuggestions.length > 0 && (
        <div 
          style={{ zIndex: 10000 }}
          className="absolute left-0 right-0 top-full mt-1.5 z-[100] bg-white dark:bg-[#111728] border border-[#D8DEE9] dark:border-white/15 rounded-2xl shadow-2xl overflow-hidden py-1 animate-in fade-in zoom-in-95"
        >
          <div className="px-3 py-1.5 text-[10px] font-black uppercase tracking-wider text-[#7A8496] border-b border-[#D8DEE9]/60 dark:border-white/10 flex items-center justify-between bg-slate-50/70 dark:bg-[#161B31]/70">
            <span className="flex items-center gap-1.5">
              <History className="w-3 h-3 text-[#5B4BFF] dark:text-[#806CFF]" />
              <span>Past Notes & Details ({filteredSuggestions.length})</span>
            </span>
            <span className="font-mono text-[9px] text-slate-400">Click to fill</span>
          </div>

          <div className="max-h-44 overflow-y-auto divide-y divide-slate-100 dark:divide-white/5">
            {filteredSuggestions.map((item, idx) => (
              <div
                key={`${item}-${idx}`}
                onMouseDown={() => handleSelect(item)}
                className="px-3 py-2 flex items-start justify-between gap-2.5 cursor-pointer hover:bg-[#EEECFF] dark:hover:bg-[#201D45] transition-colors text-xs text-[#101828] dark:text-[#F7F8FC]"
              >
                <div className="flex items-start gap-2 min-w-0 flex-1">
                  <Clock className="w-3.5 h-3.5 text-slate-400 shrink-0 mt-0.5 opacity-70" />
                  <span className="line-clamp-2 font-medium" title={item}>{item}</span>
                </div>
                <button
                  type="button"
                  tabIndex={-1}
                  title="Remove from history"
                  onMouseDown={(e) => handleRemove(e, item)}
                  className="p-1 rounded-md text-slate-300 hover:text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-colors shrink-0"
                >
                  <X className="w-3 h-3" />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
