import React, { useState, useEffect, useRef } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { Menu, X, ArrowRight, Sparkles, Phone, MessageSquare, Briefcase, Layers, Users, Mail, ExternalLink } from 'lucide-react';
import { siteConfig } from '../../config/site';
import ThemeToggle from '../UI/ThemeToggle';

const Header: React.FC = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const [activeSection, setActiveSection] = useState<string>('');
  const location = useLocation();
  const navigate = useNavigate();
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

  // Magnetic hover for desktop CTA button
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

  const handleNavClick = (path: string, isAnchor?: boolean, sectionId?: string) => {
    setIsOpen(false);
    if (isAnchor && sectionId) {
      if (location.pathname === '/') {
        const el = document.getElementById(sectionId);
        if (el) {
          el.scrollIntoView({ behavior: 'smooth' });
          return;
        }
      } else {
        navigate(`/#${sectionId}`);
      }
    }
  };

  const navLinks = [
    { label: 'Work',      path: '/projects', isAnchor: false, icon: Briefcase, desc: 'Portfolio & Case Studies' },
    { label: 'Services',  path: '/#services', isAnchor: true, sectionId: 'services', icon: Layers, desc: 'Engineering & Marketing' },
    { label: 'About',     path: '/about',    isAnchor: false, icon: Users, desc: 'Agency Story & Team' },
    { label: 'Contact',   path: '/contact',  isAnchor: false, icon: Mail, desc: 'Get in Touch' },
  ];

  return (
    <header
      className={`fixed top-0 left-0 w-full z-50 transition-all duration-200 ${
        isOpen ? 'h-[100dvh] flex flex-col' : ''
      }`}
      style={{
        background: isOpen || scrolled ? 'var(--bg-page)' : 'transparent',
        backdropFilter: isOpen ? 'none' : (scrolled ? 'blur(18px)' : 'none'),
        WebkitBackdropFilter: isOpen ? 'none' : (scrolled ? 'blur(18px)' : 'none'),
        borderBottom: (scrolled || isOpen) ? '1px solid var(--border-subtle)' : '1px solid transparent',
        boxShadow: scrolled && !isOpen ? '0 4px 24px rgba(17, 19, 29, 0.05)' : 'none',
      }}
    >
      <div
        className="editorial-container flex items-center justify-between transition-all duration-200 w-full flex-shrink-0"
        style={{
          height: scrolled ? '72px' : '78px',
        }}
      >
        {/* ── Brand Logo & Wordmark ── */}
        <Link
          to="/"
          onClick={() => setIsOpen(false)}
          className="flex items-center gap-3 text-decoration-none group flex-shrink-0"
          aria-label="Digiexplode AI Homepage"
        >
          {/* Brand icon badge */}
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

          {/* Wordmark */}
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

        {/* ── Desktop Primary Navigation ── */}
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
          
          {/* Portal Capsule */}
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

        {/* ── Desktop CTA ── */}
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

        {/* ── Mobile Controls (Theme Toggle & Menu Button) ── */}
        <div className="lg:hidden flex items-center gap-2">
          <ThemeToggle className="h-10 w-10" />
          
          <button
            onClick={() => setIsOpen(!isOpen)}
            className="h-10 w-10 rounded-xl border flex items-center justify-center transition-all cursor-pointer shadow-sm active:scale-95"
            style={{
              borderColor: isOpen ? 'var(--brand-primary)' : 'var(--border-strong)',
              color: isOpen ? '#6C4CFF' : 'var(--text-primary)',
              background: 'var(--bg-surface)'
            }}
            aria-label={isOpen ? 'Close navigation menu' : 'Open navigation menu'}
          >
            {isOpen ? <X size={22} className="animate-in fade-in" /> : <Menu size={22} />}
          </button>
        </div>
      </div>

      {/* ── Mobile Navigation Drawer ── */}
      {isOpen && (
        <div 
          className="lg:hidden flex-1 flex flex-col justify-between overflow-y-auto w-full px-5 py-5 animate-fade-up"
          style={{
            background: 'var(--bg-page)',
          }}
        >
          {/* Navigation Links List */}
          <div className="flex flex-col gap-2.5">
            <div className="px-1 text-[11px] font-bold uppercase tracking-wider text-neutral-400 dark:text-neutral-500">
              Navigation
            </div>

            {navLinks.map(link => {
              const Icon = link.icon;
              const isRouteActive = !link.isAnchor && location.pathname === link.path;
              const isSectionActive = link.isAnchor && location.pathname === '/' && activeSection === link.sectionId;
              const isActive = isRouteActive || isSectionActive;

              return (
                <Link
                  key={link.path}
                  to={link.path}
                  onClick={() => handleNavClick(link.path, link.isAnchor, link.sectionId)}
                  className={`px-4 py-3.5 rounded-2xl transition-all flex items-center justify-between border ${
                    isActive 
                      ? 'bg-[#6C4CFF] text-white border-[#6C4CFF] shadow-lg shadow-[#6C4CFF]/20' 
                      : 'bg-white dark:bg-[#111728] border-black/5 dark:border-white/10 text-neutral-800 dark:text-neutral-100 hover:border-[#6C4CFF]/40'
                  }`}
                >
                  <div className="flex items-center gap-3.5">
                    <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${
                      isActive ? 'bg-white/20 text-white' : 'bg-[#6C4CFF]/10 text-[#6C4CFF]'
                    }`}>
                      <Icon size={18} />
                    </div>
                    <div>
                      <div className="text-[15px] font-extrabold leading-snug">{link.label}</div>
                      <div className={`text-[12px] font-medium ${isActive ? 'text-white/80' : 'text-neutral-400 dark:text-neutral-400'}`}>
                        {link.desc}
                      </div>
                    </div>
                  </div>
                  <ArrowRight size={18} className={isActive ? 'text-white' : 'text-neutral-400'} />
                </Link>
              );
            })}

            {/* Portal Link in Drawer */}
            <Link
              to="/portal"
              onClick={() => setIsOpen(false)}
              className={`px-4 py-3.5 rounded-2xl transition-all flex items-center justify-between border ${
                location.pathname.startsWith('/portal')
                  ? 'bg-[#6C4CFF] text-white border-[#6C4CFF] shadow-lg shadow-[#6C4CFF]/20'
                  : 'bg-gradient-to-r from-violet-500/5 to-blue-500/5 dark:from-violet-500/10 dark:to-blue-500/10 border-[#6C4CFF]/30 text-neutral-800 dark:text-neutral-100'
              }`}
            >
              <div className="flex items-center gap-3.5">
                <div className="w-9 h-9 rounded-xl flex items-center justify-center bg-[#6C4CFF] text-white shadow-sm">
                  <Sparkles size={18} />
                </div>
                <div>
                  <div className="text-[15px] font-extrabold flex items-center gap-2">
                    Client & Team Portal
                    <span className="text-[10px] font-black uppercase px-2 py-0.5 rounded-full bg-[#B8F36B] text-[#101828]">
                      Desk
                    </span>
                  </div>
                  <div className="text-[12px] font-medium text-neutral-400 dark:text-neutral-400">
                    Tasks, Content & Approvals
                  </div>
                </div>
              </div>
              <ArrowRight size={18} className="text-[#6C4CFF] dark:text-[#B8F36B]" />
            </Link>
          </div>
          
          {/* Action CTAs & Quick Info Footer */}
          <div className="mt-6 pt-5 border-t flex flex-col gap-3" style={{ borderColor: 'var(--border-subtle)' }}>
            <Link
              to="/start-project"
              onClick={() => setIsOpen(false)}
              className="btn-primary w-full justify-center text-center py-3.5 text-[15px] font-extrabold shadow-lg flex items-center gap-2"
            >
              <Sparkles size={18} />
              Start a Project
              <ArrowRight size={16} />
            </Link>

            <a
              href={siteConfig.whatsappLink}
              target="_blank"
              rel="noopener noreferrer"
              onClick={() => setIsOpen(false)}
              className="btn-coral w-full justify-center text-center py-3 text-[14px] font-bold flex items-center gap-2"
            >
              <MessageSquare size={16} />
              WhatsApp Free Consultation
            </a>

            {/* Direct Contact Pill */}
            <div className="mt-2 p-3 rounded-xl bg-black/[0.02] dark:bg-white/[0.03] border border-black/5 dark:border-white/5 flex items-center justify-between text-xs text-neutral-500 dark:text-neutral-400">
              <span className="flex items-center gap-1.5 font-semibold">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse inline-block" />
                Available for New Projects
              </span>
              <a href={`tel:${siteConfig.phone.replace(/\s+/g, '')}`} className="font-bold text-[#6C4CFF] dark:text-[#B8F36B] flex items-center gap-1">
                <Phone size={12} /> Call
              </a>
            </div>
          </div>
        </div>
      )}
    </header>
  );
};

export default Header;
