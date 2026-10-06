import React, { useState, useRef, useEffect, useMemo } from 'react';
import { Search, ChevronDown, Check, Building2, Eye, EyeOff } from 'lucide-react';
import { type ClientData } from './ClientList';

interface ClientSelectProps {
  clients: ClientData[];
  selectedClientId: string;
  onSelectClient: (clientId: string, client?: ClientData) => void;
  placeholder?: string;
  allowAllOption?: boolean;
  allOptionLabel?: string;
  className?: string;
  showInactiveToggle?: boolean;
  disabled?: boolean;
  required?: boolean;
}

export const ClientSelect: React.FC<ClientSelectProps> = ({
  clients,
  selectedClientId,
  onSelectClient,
  placeholder = '-- Select Client Brand --',
  allowAllOption = false,
  allOptionLabel = '-- All Clients --',
  className = '',
  showInactiveToggle = true,
  disabled = false,
  required = false
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [showInactive, setShowInactive] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Close dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Filter and sort alphabetically by client name
  const filteredClients = useMemo(() => {
    return clients
      .filter(client => {
        // Active status filtering
        if (!showInactive && client.status === 'Paused') {
          // If the currently selected client is inactive, keep it visible
          if (client.clientId !== selectedClientId) {
            return false;
          }
        }
        // Search query matching (alphabetical/name/category/business)
        if (!searchQuery.trim()) return true;
        const q = searchQuery.toLowerCase();
        return (
          client.clientName.toLowerCase().includes(q) ||
          (client.businessName && client.businessName.toLowerCase().includes(q)) ||
          (client.category && client.category.toLowerCase().includes(q))
        );
      })
      .sort((a, b) => a.clientName.localeCompare(b.clientName));
  }, [clients, searchQuery, showInactive, selectedClientId]);

  const selectedClient = useMemo(() => {
    return clients.find(c => c.clientId === selectedClientId);
  }, [clients, selectedClientId]);

  const handleSelect = (clientId: string) => {
    const chosen = clients.find(c => c.clientId === clientId);
    onSelectClient(clientId, chosen);
    setIsOpen(false);
    setSearchQuery('');
  };

  return (
    <div ref={containerRef} className={`relative ${className}`}>
      {/* Hidden native input for form validation if required */}
      {required && (
        <input 
          type="text" 
          value={selectedClientId} 
          onChange={() => {}} 
          required 
          className="sr-only" 
          tabIndex={-1} 
        />
      )}

      {/* Trigger Button */}
      <button
        type="button"
        disabled={disabled}
        onClick={() => {
          if (!disabled) {
            setIsOpen(!isOpen);
            if (!isOpen) {
              setTimeout(() => inputRef.current?.focus(), 50);
            }
          }
        }}
        className={`w-full flex items-center justify-between text-xs bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-2xl p-2.5 sm:p-3 outline-none font-bold text-slate-800 dark:text-slate-100 hover:border-purple-400 dark:hover:border-purple-500/50 transition-all ${
          isOpen ? 'ring-2 ring-purple-500/20 border-purple-500' : ''
        } ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
      >
        <div className="flex items-center gap-2 truncate">
          {selectedClient ? (
            <>
              <div className="w-5 h-5 rounded-lg bg-gradient-to-br from-purple-500 to-cyan-500 text-white font-black flex items-center justify-center text-[10px] shrink-0">
                {selectedClient.clientName.charAt(0).toUpperCase()}
              </div>
              <span className="truncate">{selectedClient.clientName}</span>
              {selectedClient.category && (
                <span className="text-[10px] text-slate-400 font-semibold truncate hidden sm:inline">
                  • {selectedClient.category}
                </span>
              )}
            </>
          ) : allowAllOption && !selectedClientId ? (
            <span className="text-slate-600 dark:text-slate-300 font-bold">{allOptionLabel}</span>
          ) : (
            <span className="text-slate-400 font-medium">{placeholder}</span>
          )}
        </div>
        <ChevronDown className={`w-4 h-4 text-slate-400 transition-transform duration-200 shrink-0 ml-2 ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {/* Popover Menu */}
      {isOpen && (
        <div className="absolute top-full left-0 right-0 mt-1.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-xl z-50 overflow-hidden animate-in fade-in slide-in-from-top-1 duration-150">
          {/* Search Header */}
          <div className="p-2.5 border-b border-slate-150 dark:border-slate-800/80 bg-slate-50/50 dark:bg-slate-950/40 space-y-2">
            <div className="flex items-center gap-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 px-2.5 py-1.5 rounded-xl">
              <Search className="w-3.5 h-3.5 text-slate-400 shrink-0" />
              <input
                ref={inputRef}
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search by name, category..."
                className="w-full text-xs font-semibold bg-transparent outline-none border-none text-slate-800 dark:text-slate-100 placeholder-slate-400"
              />
            </div>

            {showInactiveToggle && (
              <div className="flex items-center justify-between px-1">
                <span className="text-[9px] font-black uppercase tracking-wider text-slate-400">
                  Alphabetical Master List ({filteredClients.length})
                </span>
                <button
                  type="button"
                  onClick={() => setShowInactive(!showInactive)}
                  className="flex items-center gap-1 text-[9px] font-bold text-slate-500 hover:text-purple-600 dark:hover:text-cyan-400 transition-colors"
                >
                  {showInactive ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
                  {showInactive ? 'Hide Paused' : 'Show Paused'}
                </button>
              </div>
            )}
          </div>

          {/* List Options */}
          <div className="max-h-60 overflow-y-auto p-1.5 space-y-1">
            {allowAllOption && (
              <button
                type="button"
                onClick={() => handleSelect('')}
                className={`w-full text-left px-3 py-2 rounded-xl text-xs font-bold transition-all flex items-center justify-between ${
                  !selectedClientId
                    ? 'bg-gradient-to-r from-purple-600/10 to-cyan-500/10 text-purple-600 dark:text-cyan-400 font-black'
                    : 'text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-850'
                }`}
              >
                <span>{allOptionLabel}</span>
                {!selectedClientId && <Check className="w-3.5 h-3.5 text-purple-600 dark:text-cyan-400" />}
              </button>
            )}

            {filteredClients.length === 0 ? (
              <div className="py-6 text-center text-xs text-slate-400 font-medium italic">
                No clients found matching "{searchQuery}"
              </div>
            ) : (
              filteredClients.map((client) => {
                const isSelected = client.clientId === selectedClientId;
                return (
                  <button
                    key={client.clientId}
                    type="button"
                    onClick={() => handleSelect(client.clientId)}
                    className={`w-full text-left px-3 py-2 rounded-xl text-xs transition-all flex items-center justify-between group ${
                      isSelected
                        ? 'bg-gradient-to-r from-purple-600/15 to-cyan-500/15 text-purple-700 dark:text-cyan-300 font-black'
                        : 'text-slate-750 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-850'
                    }`}
                  >
                    <div className="flex items-center gap-2.5 truncate">
                      <div className="w-6 h-6 rounded-lg bg-gradient-to-br from-purple-500/20 to-cyan-500/20 text-purple-600 dark:text-cyan-400 font-black flex items-center justify-center text-[10px] shrink-0 border border-purple-500/20">
                        {client.clientName.charAt(0).toUpperCase()}
                      </div>
                      <div className="truncate text-left">
                        <div className="truncate font-black">{client.clientName}</div>
                        <div className="text-[10px] text-slate-400 dark:text-slate-500 font-medium truncate">
                          {client.category || client.businessName || 'General'}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0 ml-2">
                      {client.status === 'Paused' && (
                        <span className="text-[8px] font-black uppercase tracking-wider px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-600 border border-amber-500/20">
                          Paused
                        </span>
                      )}
                      {isSelected && <Check className="w-3.5 h-3.5 text-purple-600 dark:text-cyan-400" />}
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
};
