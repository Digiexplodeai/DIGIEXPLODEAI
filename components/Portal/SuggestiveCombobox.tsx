import React, { useState, useRef, useEffect, useMemo } from 'react';
import { Search, ChevronDown, X, Check, Plus, User, Building2 } from 'lucide-react';

export interface SuggestiveOption {
  id: string;
  label: string;
  sublabel?: string;
  badge?: string;
  avatarText?: string;
  category?: string;
}

interface SuggestiveComboboxProps {
  options: SuggestiveOption[];
  value: string;
  onChange: (id: string, option?: SuggestiveOption) => void;
  placeholder?: string;
  emptyText?: string;
  allowCustom?: boolean;
  icon?: 'client' | 'user' | 'search';
  className?: string;
  disabled?: boolean;
}

export const SuggestiveCombobox: React.FC<SuggestiveComboboxProps> = ({
  options,
  value,
  onChange,
  placeholder = 'Search or select…',
  emptyText = 'No matching suggestions found',
  allowCustom = false,
  icon = 'search',
  className = '',
  disabled = false,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [highlightedIndex, setHighlightedIndex] = useState<number>(-1);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Find currently selected option
  const selectedOption = useMemo(() => {
    return options.find(o => o.id === value);
  }, [options, value]);

  // Filter options based on search query
  const filteredOptions = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return options;
    return options.filter(opt => {
      const matchLabel = opt.label.toLowerCase().includes(q);
      const matchSub = opt.sublabel?.toLowerCase().includes(q);
      const matchBadge = opt.badge?.toLowerCase().includes(q);
      return matchLabel || matchSub || matchBadge;
    });
  }, [options, searchQuery]);

  // Close when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Reset highlight on query change
  useEffect(() => {
    setHighlightedIndex(filteredOptions.length > 0 ? 0 : -1);
  }, [searchQuery, filteredOptions.length]);

  const handleSelect = (opt: SuggestiveOption) => {
    onChange(opt.id, opt);
    setSearchQuery('');
    setIsOpen(false);
  };

  const handleClear = (e: React.MouseEvent) => {
    e.stopPropagation();
    onChange('', undefined);
    setSearchQuery('');
    if (inputRef.current) inputRef.current.focus();
  };

  const handleCustomSelect = () => {
    if (!searchQuery.trim()) return;
    const customId = `custom_${Date.now()}`;
    const customOpt: SuggestiveOption = {
      id: customId,
      label: searchQuery.trim(),
      sublabel: 'Custom',
    };
    onChange(customId, customOpt);
    setSearchQuery('');
    setIsOpen(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!isOpen) {
      if (e.key === 'ArrowDown' || e.key === 'Enter') {
        e.preventDefault();
        setIsOpen(true);
      }
      return;
    }

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setHighlightedIndex(prev => (prev < filteredOptions.length - 1 ? prev + 1 : prev));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setHighlightedIndex(prev => (prev > 0 ? prev - 1 : 0));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (highlightedIndex >= 0 && highlightedIndex < filteredOptions.length) {
        handleSelect(filteredOptions[highlightedIndex]);
      } else if (allowCustom && searchQuery.trim()) {
        handleCustomSelect();
      }
    } else if (e.key === 'Escape') {
      e.preventDefault();
      setIsOpen(false);
    }
  };

  return (
    <div 
      ref={containerRef} 
      className={`relative font-sans ${isOpen ? 'z-[100]' : 'z-auto'} ${className}`}
      style={{ zIndex: isOpen ? 9999 : undefined }}
    >
      {/* Input / Trigger Control */}
      <div
        onClick={() => {
          if (!disabled) {
            setIsOpen(true);
            inputRef.current?.focus();
          }
        }}
        className={`w-full min-h-[42px] bg-[#F8FAFC] dark:bg-[#161B31] border rounded-xl px-3 py-2 flex items-center gap-2 cursor-pointer transition-all shadow-2xs ${
          isOpen
            ? 'border-[#5B4BFF] ring-2 ring-[#5B4BFF]/20 bg-white dark:bg-[#1A203C]'
            : 'border-[#D8DEE9] dark:border-white/10 hover:border-[#5B4BFF]/60'
        } ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
      >
        {/* Leading Icon / Avatar */}
        <div className="shrink-0 text-[#7A8496] flex items-center justify-center">
          {selectedOption ? (
            <div className="w-5 h-5 rounded-full bg-[#5B4BFF]/10 text-[#5B4BFF] dark:text-[#806CFF] text-[10px] font-black flex items-center justify-center uppercase">
              {selectedOption.avatarText || selectedOption.label.charAt(0)}
            </div>
          ) : icon === 'client' ? (
            <Building2 className="w-4 h-4 text-[#7A8496]" />
          ) : icon === 'user' ? (
            <User className="w-4 h-4 text-[#7A8496]" />
          ) : (
            <Search className="w-4 h-4 text-[#7A8496]" />
          )}
        </div>

        {/* Search Input / Selected Label Display */}
        <div className="flex-1 min-w-0">
          {isOpen ? (
            <input
              ref={inputRef}
              type="text"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={selectedOption ? selectedOption.label : placeholder}
              className="w-full bg-transparent text-xs font-bold text-[#101828] dark:text-[#F7F8FC] outline-none placeholder-[#98A2B3]"
              autoFocus
            />
          ) : (
            <div className="truncate text-xs font-bold">
              {selectedOption ? (
                <span className="text-[#101828] dark:text-[#F7F8FC]">
                  {selectedOption.label}
                  {selectedOption.sublabel && (
                    <span className="ml-1.5 font-normal text-[11px] text-[#64748B] dark:text-[#94A3B8]">
                      · {selectedOption.sublabel}
                    </span>
                  )}
                </span>
              ) : (
                <span className="text-[#98A2B3] font-medium">{placeholder}</span>
              )}
            </div>
          )}
        </div>

        {/* Clear & Dropdown Actions */}
        <div className="flex items-center gap-1 shrink-0">
          {selectedOption && !disabled && (
            <button
              type="button"
              onClick={handleClear}
              title="Clear selection"
              className="p-1 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-white/10 transition-colors cursor-pointer"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
          <div className="text-slate-400 pointer-events-none">
            <ChevronDown className={`w-3.5 h-3.5 transition-transform duration-200 ${isOpen ? 'rotate-180 text-[#5B4BFF]' : ''}`} />
          </div>
        </div>
      </div>

      {/* Floating Suggestive Results Menu */}
      {isOpen && (
        <div 
          style={{ zIndex: 10000 }}
          className="absolute left-0 right-0 top-full mt-1.5 z-[100] bg-white dark:bg-[#111728] border border-[#D8DEE9] dark:border-white/10 rounded-2xl shadow-2xl overflow-hidden py-1.5 max-h-60 overflow-y-auto animate-in fade-in zoom-in-95"
        >
          {/* Header indicator when filtering */}
          {searchQuery.trim() && (
            <div className="px-3 py-1.5 text-[10px] font-black uppercase tracking-wider text-[#7A8496] border-b border-[#D8DEE9]/60 dark:border-white/10 flex items-center justify-between">
              <span>Matching suggestions ({filteredOptions.length})</span>
              <span className="font-mono text-[9px]">Press Enter to select</span>
            </div>
          )}

          {filteredOptions.length === 0 ? (
            <div className="p-3 text-center space-y-2">
              <p className="text-xs text-[#64748B] dark:text-[#94A3B8] font-medium">
                {emptyText}
              </p>
              {allowCustom && searchQuery.trim() && (
                <button
                  type="button"
                  onClick={handleCustomSelect}
                  className="px-3 py-1.5 rounded-xl bg-[#EEECFF] dark:bg-[#201D45] text-[#5B4BFF] dark:text-[#806CFF] text-xs font-black hover:bg-[#5B4BFF] hover:text-white transition-all inline-flex items-center gap-1.5 cursor-pointer shadow-2xs"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Use custom: "{searchQuery.trim()}"</span>
                </button>
              )}
            </div>
          ) : (
            filteredOptions.map((opt, idx) => {
              const isSelected = opt.id === value;
              const isHighlighted = idx === highlightedIndex;

              return (
                <div
                  key={opt.id}
                  onClick={() => handleSelect(opt)}
                  onMouseEnter={() => setHighlightedIndex(idx)}
                  className={`px-3 py-2 flex items-center justify-between gap-2.5 cursor-pointer transition-colors text-xs ${
                    isHighlighted
                      ? 'bg-[#F8FAFC] dark:bg-[#161B31]'
                      : 'hover:bg-[#F8FAFC] dark:hover:bg-[#161B31]'
                  } ${isSelected ? 'font-black text-[#5B4BFF] dark:text-[#806CFF]' : 'text-[#101828] dark:text-[#F7F8FC]'}`}
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className={`w-6 h-6 rounded-lg flex items-center justify-center font-black text-[10px] shrink-0 uppercase ${
                      isSelected
                        ? 'bg-[#5B4BFF] text-white shadow-2xs'
                        : 'bg-slate-100 dark:bg-white/10 text-[#475467] dark:text-[#CBD5E1]'
                    }`}>
                      {opt.avatarText || opt.label.charAt(0)}
                    </div>
                    <div className="min-w-0">
                      <div className="truncate font-bold leading-tight">
                        {opt.label}
                      </div>
                      {opt.sublabel && (
                        <div className="text-[10px] text-[#64748B] dark:text-[#94A3B8] font-medium truncate">
                          {opt.sublabel}
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    {opt.badge && (
                      <span className="text-[9px] font-bold px-2 py-0.5 rounded-full bg-slate-100 dark:bg-white/10 text-[#475467] dark:text-[#BAC1D1] border border-slate-200 dark:border-white/5">
                        {opt.badge}
                      </span>
                    )}
                    {isSelected && (
                      <Check className="w-4 h-4 text-[#5B4BFF] dark:text-[#806CFF]" />
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>
      )}
    </div>
  );
};
