import React, { useEffect, useState } from 'react';
import { Sun, Moon } from 'lucide-react';

const ThemeToggle: React.FC<{ className?: string }> = ({ className = '' }) => {
  const [isDark, setIsDark] = useState(() => {
    if (typeof window !== 'undefined') {
      const v2 = localStorage.getItem('digi_agency_theme_v2');
      if (v2) return v2 !== 'light';
      const legacy = localStorage.getItem('digi_agency_theme') || localStorage.getItem('theme');
      if (legacy === 'light') return false;
      return true; // Default dark
    }
    return true; // Default dark
  });

  useEffect(() => {
    // Sync state with DOM attribute
    const observer = new MutationObserver(() => {
      setIsDark(document.documentElement.classList.contains('dark'));
    });
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });
    return () => observer.disconnect();
  }, []);

  const toggleTheme = () => {
    const nextDark = !isDark;
    setIsDark(nextDark);
    
    if (nextDark) {
      document.documentElement.classList.add('dark');
      document.documentElement.setAttribute('data-theme', 'dark');
      try {
        localStorage.setItem('digi_agency_theme_v2', 'dark');
        localStorage.setItem('digi_agency_theme', 'dark');
        localStorage.setItem('theme', 'dark');
      } catch (e) {}
    } else {
      document.documentElement.classList.remove('dark');
      document.documentElement.setAttribute('data-theme', 'light');
      try {
        localStorage.setItem('digi_agency_theme_v2', 'light');
        localStorage.setItem('digi_agency_theme', 'light');
        localStorage.setItem('theme', 'light');
      } catch (e) {}
    }
  };

  return (
    <button
      onClick={toggleTheme}
      type="button"
      className={`relative p-2 rounded-lg transition-all duration-200 border border-black/10 dark:border-white/15 bg-black/5 dark:bg-white/10 hover:bg-black/10 dark:hover:bg-white/20 text-neutral-800 dark:text-neutral-100 flex items-center justify-center focus:outline-none focus:ring-2 focus:ring-[#5546F5] ${className}`}
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
