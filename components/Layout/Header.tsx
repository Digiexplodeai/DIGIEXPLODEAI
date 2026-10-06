import React, { useState, useEffect, useRef } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Menu, X, ArrowRight, Sparkles } from 'lucide-react';
import { siteConfig } from '../../config/site';
import ThemeToggle from '../UI/ThemeToggle';

const Header: React.FC = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const [activeSection, setActiveSection] = useState<string>('');
  const location = useLocation();
  const [btnOffset, setBtnOffset] = useState({ x: 0, y: 0 });
  const btnRef = useRef<HTMLAnchorElement>(null);

  // Scroll detection for navbar background opacity & height transition
  useEffect(() => {
    const onScroll = () => {
      setScrolled(window.scrollY > 20);

      // Detect active section on homepage
      if (location.pathname === '/') {
        const sections = ['contact', 'pricing', 'process', 'work', 'calculator', 'services'];
        const scrollPosition = window.scrollY + 200;
        let found = '';
        for (const id of sections) {
          const el = document.getElementById(id);
          if (el && el.offsetTop <= scrollPosition) {
            found = id;
            break;
          }
        }
        setActiveSection(found);
      } else {
        setActiveSection('');
      }
    };

    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll();
    return () => window.removeEventListener('scroll', onScroll);
  }, [location.pathname]);

  // Close mobile drawer on route navigation
  useEffect(() => { 
    setIsOpen(false); 
    document.body.style.overflow = 'unset';
  }, [location.pathname]);

  // Lock body scroll when mobile drawer is open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }
    return () => {
      document.body.style.overflow = 'unset';
    };
  }, [isOpen]);

  // Subtle magnetic hover for desktop CTA button
  const handleMouseMove = (e: React.MouseEvent<HTMLAnchorElement>) => {
    if (!btnRef.current || window.innerWidth < 1024) return;
    const rect = btnRef.current.getBoundingClientRect();
    const x = (e.clientX - (rect.left + rect.width / 2)) * 0.18;
    const y = (e.clientY - (rect.top + rect.height / 2)) * 0.18;
    setBtnOffset({ x, y });
  };

  const handleMouseLeave = () => {
    setBtnOffset({ x: 0, y: 0 });
  };

  const navLinks = [
    { label: 'Work',      path: '/projects', isAnchor: false },
    { label: 'Services',  path: '/#services', isAnchor: true, sectionId: 'services' },
    { label: 'About',     path: '/about',    isAnchor: false },
    { label: 'Contact',   path: '/contact',  isAnchor: false },
  ];

  return (
    <header
      className="fixed top-0 left-0 w-full z-50 transition-all duration-300"
      style={{
        background: scrolled 
          ? 'var(--bg-page)' 
          : 'transparent',
        backdropFilter: 'blur(18px)',
        WebkitBackdropFilter: 'blur(18px)',
        borderBottom: scrolled ? '1px solid var(--border-subtle)' : '1px solid transparent',
        boxShadow: scrolled ? '0 4px 24px rgba(17, 19, 29, 0.05)' : 'none',
      }}
    >
      <div
        className="editorial-container flex items-center justify-between transition-all duration-300"
        style={{
          height: scrolled ? '74px' : '78px',
        }}
      >
        {/* ── Brand Logo & Wordmark ── */}
        <Link
          to="/"
          className="flex items-center gap-3 text-decoration-none group flex-shrink-0"
          aria-label="Digiexplode AI Homepage"
        >
          {/* Prominent brand icon badge */}
          <div
            className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 transition-transform duration-200 group-hover:scale-105 shadow-md"
            style={{
              background: 'linear-gradient(135deg, #6C4CFF 0%, #2563FF 100%)',
              boxShadow: '0 4px 14px rgba(108, 76, 255, 0.30)',
            }}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#B8F36B" strokeWidth="2.8" className="transform -rotate-6 group-hover:rotate-0 transition-transform">
              <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" />
            </svg>
          </div>

          {/* Prominent brand wordmark */}
          <span 
            className="font-extrabold text-xl sm:text-[22px] tracking-tight transition-colors duration-200 leading-none select-none"
            style={{ 
              fontFamily: 'Manrope, sans-serif', 
              color: 'var(--text-primary)',
            }}
          >
            Digiexplode<span className="text-[#6C4CFF] ml-0.5">AI</span>
          </span>
        </Link>

        {/* ── Desktop Primary Navigation (Centered & Balanced) ── */}
        <nav className="hidden lg:flex items-center gap-1.5 p-1 rounded-2xl bg-black/[0.03] dark:bg-white/[0.04] border border-black/5 dark:border-white/10 backdrop-blur-md">
          {navLinks.map(link => {
            const isRouteActive = !link.isAnchor && location.pathname === link.path;
            const isSectionActive = link.isAnchor && location.pathname === '/' && activeSection === link.sectionId;
            const isActive = isRouteActive || isSectionActive;

            return (
              <Link
                key={link.path}
                to={link.path}
                className={`px-4 py-2 rounded-xl text-[14.5px] font-bold tracking-wide transition-all duration-200 h-10 flex items-center justify-center ${
                  isActive
                    ? 'bg-[#6C4CFF]/12 dark:bg-[#6C4CFF]/25 text-[#6C4CFF] dark:text-[#F3F1FF] shadow-sm'
                    : 'text-neutral-600 dark:text-neutral-300 hover:text-neutral-900 dark:hover:text-white hover:bg-black/5 dark:hover:bg-white/5'
                }`}
              >
                {link.label}
              </Link>
            );
          })}
          
          {/* Portal Capsule Item (Visually Secondary) */}
          <div className="h-5 w-[1px] bg-black/10 dark:bg-white/10 mx-1" />
          
          <Link
            to="/portal"
            className={`px-4 py-2 rounded-xl text-[14px] font-bold tracking-wide transition-all duration-200 h-10 flex items-center justify-center gap-1.5 border ${
              location.pathname.startsWith('/portal')
                ? 'bg-[#6C4CFF] text-white border-[#6C4CFF] shadow-md'
                : 'border-black/10 dark:border-white/15 text-neutral-600 dark:text-neutral-300 hover:text-[#6C4CFF] dark:hover:text-white hover:border-[#6C4CFF] bg-white/40 dark:bg-black/20'
            }`}
          >
            Portal
          </Link>
        </nav>

        {/* ── Right Utility Actions: Theme Toggle + Primary CTA ── */}
        <div className="hidden lg:flex items-center gap-3">
          <ThemeToggle className="h-11 w-11" />
          
          <Link
            ref={btnRef}
            onMouseMove={handleMouseMove}
            onMouseLeave={handleMouseLeave}
            to="/start-project"
            className="btn-primary group h-11 flex items-center justify-center px-6 text-[14.5px] font-extrabold rounded-xl shadow-md"
            style={{ 
              transform: `translate(${btnOffset.x}px, ${btnOffset.y}px)`,
              transition: btnOffset.x === 0 ? 'transform 0.3s var(--ease-out-expo), background 0.2s ease, box-shadow 0.2s ease' : 'background 0.2s ease, box-shadow 0.2s ease',
            }}
          >
            Start a Project <ArrowRight size={16} className="arrow-right-hover" />
          </Link>
        </div>

        {/* ── Mobile Trigger & Theme Control ── */}
        <div className="lg:hidden flex items-center gap-2">
          <ThemeToggle className="h-10 w-10" />
          
          <button
            onClick={() => setIsOpen(!isOpen)}
            className="h-10 w-10 rounded-xl border flex items-center justify-center transition-colors cursor-pointer"
            style={{
              borderColor: 'var(--border-strong)',
              color: 'var(--text-primary)',
              background: 'var(--bg-surface)'
            }}
            aria-label={isOpen ? 'Close navigation menu' : 'Open navigation menu'}
          >
            {isOpen ? <X size={20} /> : <Menu size={20} />}
          </button>
        </div>
      </div>

      {/* ── Mobile Navigation Drawer ── */}
      {isOpen && (
        <div 
          className="lg:hidden fixed inset-x-0 top-[74px] bottom-0 z-50 flex flex-col justify-between animate-fade-up overflow-y-auto"
          style={{
            background: 'var(--bg-page)',
            borderTop: '1px solid var(--border-subtle)',
            padding: '24px 20px 40px 20px',
            boxShadow: '0 24px 48px rgba(17, 19, 29, 0.2)',
          }}
        >
          <div className="flex flex-col gap-2">
            {[
              { label: 'Work', path: '/projects' },
              { label: 'Services', path: '/#services' },
              { label: 'About', path: '/about' },
              { label: 'Contact', path: '/contact' },
              { label: 'Client Portal', path: '/portal' },
            ].map(link => {
              const isActive = location.pathname === link.path;
              return (
                <Link
                  key={link.path}
                  to={link.path}
                  onClick={() => setIsOpen(false)}
                  className={`px-5 py-3.5 rounded-xl text-lg font-extrabold transition-all flex items-center justify-between ${
                    isActive 
                      ? 'bg-[#6C4CFF] text-white shadow-md' 
                      : 'text-neutral-800 dark:text-neutral-100 hover:bg-black/5 dark:hover:bg-white/10'
                  }`}
                >
                  <span>{link.label}</span>
                  <ArrowRight size={18} className={isActive ? 'text-white' : 'text-neutral-400'} />
                </Link>
              );
            })}
          </div>
          
          <div className="mt-8 pt-6 border-t flex flex-col gap-3" style={{ borderColor: 'var(--border-subtle)' }}>
            <Link
              to="/start-project"
              onClick={() => setIsOpen(false)}
              className="btn-primary w-full justify-center text-center py-4 text-base font-extrabold shadow-lg"
            >
              Start a Project <ArrowRight size={16} />
            </Link>

            <a
              href={siteConfig.whatsappLink}
              target="_blank"
              rel="noopener noreferrer"
              className="btn-coral w-full justify-center text-center py-3.5 text-sm font-bold"
            >
              WhatsApp Free Consultation
            </a>
          </div>
        </div>
      )}
    </header>
  );
};

export default Header;
