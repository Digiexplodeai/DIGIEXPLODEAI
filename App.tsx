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
