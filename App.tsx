import React, { useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, useLocation } from 'react-router-dom';
import Header from './components/Layout/Header';
import Footer from './components/Layout/Footer';
import Home from './pages/Home';
import Projects from './pages/Projects';
import ProjectDetail from './pages/ProjectDetail';
import About from './pages/About';
import Contact from './pages/Contact';
import StartProject from './pages/StartProject';
import PortalDashboard from './pages/PortalDashboard';
import { AuthProvider } from './context/AuthContext';
import { ThemeProvider } from './context/ThemeContext';
import { MotionalBackground } from './components/UI/MotionalBackground';

import { collection, getDocs, deleteDoc } from 'firebase/firestore';
import { db } from './lib/firebase';

// Nuclear clean slate — purges ALL cached mock/seed data so portal starts empty
// Version bump forces re-run on all existing browsers that ran older purges
if (typeof window !== 'undefined') {
  const PURGE_KEY = 'digi_agency_clean_slate_v4';
  if (!localStorage.getItem(PURGE_KEY)) {
    // Remove old purge flags so this one supersedes them
    localStorage.removeItem('digi_agency_clean_slate_v1');
    localStorage.removeItem('digi_agency_clean_slate_v2');
    localStorage.removeItem('digi_agency_clean_slate_v3');
    const keysToPurge = [
      // Tasks & rollover
      'digi_persisted_tasks_v2',
      'digi_rollover_settings_v1',
      // Employees
      'digi_local_employees',
      // Video tracker
      'digi_video_tracker_cache',
      // Social / content calendar
      'digi_social_calendar_cache_v2',
      // Approvals
      'digi_persisted_approvals_v2',
      // Work logs
      'digi_persisted_worklogs_v2',
      // Payroll
      'digi_payroll_records',
      'digi_payroll_seq',
      // HR docs
      'digi_hr_documents',
      'digi_hr_docs_seq',
      // Notifications & audit
      'digi_notifications_local',
      'digi_audit_log_local',
      // Attendance
      'digi_local_attendance',
      // Old cache key names (legacy)
      'digi_tasks_cache_v2',
      'digi_clients_cache',
      'digi_attendance_cache',
      'digi_work_log_cache',
      'digi_approvals_cache'
    ];
    keysToPurge.forEach(k => {
      try { localStorage.removeItem(k); } catch (e) {}
    });
    localStorage.setItem(PURGE_KEY, 'true');
  }
}

const ScrollToTop = () => {
  const { pathname } = useLocation();
  useEffect(() => {
    window.scrollTo(0, 0);

  }, [pathname]);
  return null;
};

const LayoutContainer: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const location = useLocation();

  const isPortal =
    location.pathname.startsWith('/portal') ||
    location.pathname.startsWith('/admin') ||
    location.pathname.startsWith('/attendance') ||
    location.pathname.startsWith('/attendence');

  return (
    <div className="min-h-screen flex flex-col" style={{ background: 'transparent', color: 'var(--ink)' }}>
      {/* Motional Background — subtle on light, vivid on dark */}
      <MotionalBackground />

      {!isPortal && <Header />}
      <main className="flex-grow relative z-10">
        {children}
      </main>
      {!isPortal && <Footer />}

      {/* Back to Top */}
      {!isPortal && (
        <button
          onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
          className="fixed bottom-8 right-8 w-11 h-11 flex items-center justify-center z-50"
          style={{
            background: '#101828',
            color: '#FFFFFF',
            borderRadius: 8,
            border: 'none',
            cursor: 'pointer',
            boxShadow: '0 4px 16px rgba(0,0,0,0.20)',
            transition: 'all 0.25s ease',
          }}
          aria-label="Back to top"
          onMouseEnter={e => { (e.currentTarget as HTMLElement).style.transform = 'translateY(-2px)'; }}
          onMouseLeave={e => { (e.currentTarget as HTMLElement).style.transform = 'translateY(0)'; }}
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 10l7-7m0 0l7 7m-7-7v18" />
          </svg>
        </button>
      )}
    </div>
  );
};

const App: React.FC = () => {
  return (
    <ThemeProvider>
      <AuthProvider>
        <Router>
          <ScrollToTop />
          <LayoutContainer>
            <Routes>
              <Route path="/" element={<Home />} />
              <Route path="/projects" element={<Projects />} />
              <Route path="/projects/:slug" element={<ProjectDetail />} />
              <Route path="/about" element={<About />} />
              <Route path="/contact" element={<Contact />} />
              <Route path="/start-project" element={<StartProject />} />
              <Route path="/portal" element={<PortalDashboard key="portal" defaultTab="attendance" />} />
              <Route path="/admin" element={<PortalDashboard key="admin" defaultTab="attendance" />} />
              <Route path="/attendance" element={<PortalDashboard key="attendance" defaultTab="attendance" />} />
              <Route path="/attendence" element={<PortalDashboard key="attendence" defaultTab="attendance" />} />
            </Routes>
          </LayoutContainer>
        </Router>
      </AuthProvider>
    </ThemeProvider>
  );
};

export default App;
