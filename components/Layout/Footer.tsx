import React from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, ArrowUpRight, Instagram, Linkedin, Twitter, Mail, Phone, MessageSquare } from 'lucide-react';
import { siteConfig } from '../../config/site';

const Footer: React.FC = () => {
  const year = new Date().getFullYear();

  return (
    <footer 
      className="relative overflow-hidden transition-colors"
      style={{ background: '#07080D', color: '#F7F8FC' }}
    >
      {/* Background noise */}
      <div className="noise-overlay absolute inset-0 pointer-events-none opacity-30" />

      {/* Pre-footer High Impact CTA Strip */}
      <div className="border-b border-white/10 py-16 sm:py-20 relative z-10">
        <div className="editorial-container">
          <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-8">
            <div className="max-w-xl">
              <div className="flex items-center gap-2 mb-4">
                <div className="live-pulse-dot w-2.5 h-2.5 rounded-full bg-[#B8F36B]" />
                <span className="text-xs font-bold uppercase tracking-wider text-[#B8F36B]">
                  Strategic Partners Active · Avg Reply Under 2h
                </span>
              </div>
              <h2 className="display-md text-white mb-3">
                Your next growth leap starts with a brief.
              </h2>
              <p className="text-white/65 text-base">
                Let's discuss your targets, unit economics, and campaign roadmap. No sales pitch, just honest growth insights.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-3 self-start lg:self-end">
              <Link to="/start-project" className="btn-primary group h-12 flex items-center px-6 text-sm font-extrabold rounded-xl shadow-lg">
                Start a Project <ArrowRight size={15} className="arrow-right-hover" />
              </Link>
              <a 
                href={siteConfig.whatsappLink} 
                target="_blank" 
                rel="noopener noreferrer" 
                className="btn-outline-light group h-12 flex items-center px-6 text-sm font-bold rounded-xl"
              >
                <MessageSquare size={16} /> WhatsApp Consultation <ArrowUpRight size={14} className="arrow-shift-hover" />
              </a>
            </div>
          </div>
        </div>
      </div>

      {/* Footer Main Navigation Body */}
      <div className="pt-16 pb-12 relative z-10">
        <div className="editorial-container">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-10 lg:gap-8 mb-16">

            {/* Brand Column (2 cols on lg) */}
            <div className="lg:col-span-2">
              <Link to="/" className="flex items-center gap-3 text-decoration-none mb-4 group" aria-label="Digiexplode AI Homepage">
                <div
                  className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 transition-transform group-hover:scale-105 shadow-md"
                  style={{ 
                    background: 'linear-gradient(135deg, #6C4CFF 0%, #2563FF 100%)',
                    boxShadow: '0 4px 14px rgba(108, 76, 255, 0.35)'
                  }}
                >
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#B8F36B" strokeWidth="2.8">
                    <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" />
                  </svg>
                </div>
                <span className="font-extrabold text-xl sm:text-[22px] tracking-tight text-white leading-none">
                  Digiexplode<span className="text-[#6C4CFF] ml-0.5">AI</span>
                </span>
              </Link>

              <p className="text-sm text-white/60 leading-relaxed mb-6 max-w-sm">
                A modern creative technology & performance marketing agency delivering explosive ROAS, high-converting digital web apps, and authority brands worldwide.
              </p>

              {/* Social Media Links */}
              <div className="flex items-center gap-2.5">
                {[
                  { Icon: Instagram, href: siteConfig.social.instagram, label: 'Instagram' },
                  { Icon: Linkedin, href: siteConfig.social.linkedin, label: 'LinkedIn' },
                  { Icon: Twitter, href: siteConfig.social.twitter, label: 'Twitter' },
                ].map(({ Icon, href, label }) => (
                  <a
                    key={label}
                    href={href}
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label={label}
                    className="w-10 h-10 rounded-xl border border-white/10 flex items-center justify-center text-white/60 hover:text-white hover:border-[#6C4CFF] hover:bg-white/5 transition-all"
                  >
                    <Icon size={17} />
                  </a>
                ))}
              </div>
            </div>

            {/* Capabilities */}
            <div>
              <h4 className="text-xs font-bold uppercase tracking-wider text-white/40 mb-4">
                Capabilities
              </h4>
              <ul className="flex flex-col gap-2.5 list-none p-0 m-0">
                {[
                  'Performance Marketing',
                  'Meta & Google Ads',
                  'Social Media Engine',
                  'SEO Authority',
                  'Web & App Dev',
                  'Creative Production'
                ].map(s => (
                  <li key={s}>
                    <Link to="/start-project" className="text-xs sm:text-sm text-white/65 hover:text-white transition-colors">
                      {s}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>

            {/* Agency */}
            <div>
              <h4 className="text-xs font-bold uppercase tracking-wider text-white/40 mb-4">
                Company
              </h4>
              <ul className="flex flex-col gap-2.5 list-none p-0 m-0">
                {[
                  { label: 'Featured Work', path: '/projects' },
                  { label: 'About Us', path: '/about' },
                  { label: 'Pricing Tiers', path: '/#pricing' },
                  { label: 'Start a Project', path: '/start-project' },
                  { label: 'Client Portal', path: '/portal' },
                  { label: 'Contact Us', path: '/contact' },
                ].map(l => (
                  <li key={l.label}>
                    <Link to={l.path} className="text-xs sm:text-sm text-white/65 hover:text-white transition-colors">
                      {l.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>

            {/* Direct Contact */}
            <div>
              <h4 className="text-xs font-bold uppercase tracking-wider text-white/40 mb-4">
                Direct Contact
              </h4>
              <ul className="flex flex-col gap-3 list-none p-0 m-0 text-xs sm:text-sm text-white/65">
                <li>
                  <a href={`mailto:${siteConfig.email}`} className="hover:text-white transition-colors flex items-center gap-2">
                    <Mail size={14} className="text-[#6C4CFF]" /> {siteConfig.email}
                  </a>
                </li>
                <li>
                  <a href={`tel:${siteConfig.phone}`} className="hover:text-white transition-colors flex items-center gap-2">
                    <Phone size={14} className="text-[#B8F36B]" /> {siteConfig.phone}
                  </a>
                </li>
                <li>
                  <a href={siteConfig.whatsappLink} target="_blank" rel="noopener noreferrer" className="hover:text-white transition-colors flex items-center gap-2">
                    <MessageSquare size={14} className="text-[#FF5A5F]" /> WhatsApp Support
                  </a>
                </li>
                <li className="text-white/40 text-xs pt-2">
                  Innovate Hub, Sector 62, Noida, India
                </li>
              </ul>
            </div>

          </div>

          {/* Bottom Copyright & Legal */}
          <div className="pt-8 border-t border-white/10 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-white/45">
            <p className="m-0">
              © {year} Digiexplode AI Agency. All rights reserved. Crafted with precision for high-growth brands.
            </p>
            <div className="flex items-center gap-5">
              <Link to="/contact" className="hover:text-white transition-colors">Privacy Policy</Link>
              <span>·</span>
              <Link to="/contact" className="hover:text-white transition-colors">Terms of Service</Link>
            </div>
          </div>

        </div>
      </div>
    </footer>
  );
};

export default Footer;
