
import React, { useState, useEffect, useRef } from 'react';

interface ScrollFadeWrapperProps {
  children: React.ReactNode;
  className?: string;
}

const ScrollFadeWrapper: React.FC<ScrollFadeWrapperProps> = ({ children, className = "" }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [styles, setStyles] = useState({
    opacity: 1,
    transform: 'translateY(0px) scale(1)',
    filter: 'blur(0px)',
  });

  useEffect(() => {
    const handleScroll = () => {
      if (!containerRef.current) return;

      const rect = containerRef.current.getBoundingClientRect();
      const scrollThreshold = 400; // How many pixels of scroll it takes to fully evaporate
      
      // We only care if the top of the element is moving above the viewport (rect.top < 0)
      if (rect.top < 0) {
        const progress = Math.min(Math.abs(rect.top) / scrollThreshold, 1);
        
        setStyles({
          opacity: 1 - progress,
          transform: `translateY(-${progress * 100}px) scale(${1 - progress * 0.05})`,
          filter: `blur(${progress * 8}px)`,
        });
      } else {
        // Reset to default when in view or below viewport
        setStyles({
          opacity: 1,
          transform: 'translateY(0px) scale(1)',
          filter: 'blur(0px)',
        });
      }
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    handleScroll(); // Initial check

    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  return (
    <div 
      ref={containerRef} 
      className={`transition-all duration-150 ease-out will-change-transform ${className}`}
      style={styles}
    >
      {children}
    </div>
  );
};

export default ScrollFadeWrapper;
