import React from 'react';
import { Sun, Moon } from 'lucide-react';
import { useTheme } from '../../context/ThemeContext';

const ThemeToggle: React.FC<{ className?: string }> = ({ className = '' }) => {
  const { resolvedTheme, toggleTheme } = useTheme();
  const isDark = resolvedTheme === 'dark';

  return (
    <button
      onClick={toggleTheme}
      type="button"
      className={`relative p-2 rounded-lg transition-all duration-200 border border-black/10 dark:border-white/15 bg-black/5 dark:bg-white/10 hover:bg-black/10 dark:hover:bg-white/20 text-neutral-800 dark:text-neutral-100 flex items-center justify-center focus:outline-none focus:ring-2 focus:ring-[#5546F5] cursor-pointer ${className}`}
      aria-label={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
      title={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
    >
      <div className="relative w-4 h-4 flex items-center justify-center">
        {isDark ? (
          <Sun className="w-4 h-4 text-[#B8F36B] transition-transform duration-300 rotate-0 scale-100" />
        ) : (
          <Moon className="w-4 h-4 text-[#5546F5] transition-transform duration-300 rotate-0 scale-100" />
        )}
      </div>
    </button>
  );
};

export default ThemeToggle;
