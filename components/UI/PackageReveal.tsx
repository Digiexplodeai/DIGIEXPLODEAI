
import React, { useState, useEffect, useRef } from 'react';

interface PackageRevealProps {
  children: React.ReactNode;
  delay?: number;
  className?: string;
  threshold?: number;
  once?: boolean;
}

const PackageReveal: React.FC<PackageRevealProps> = ({ 
  children, 
  delay = 0, 
  className = "",
  threshold = 0.1,
  once = false
}) => {
  const [isVisible, setIsVisible] = useState(false);
  const domRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const observer = new IntersectionObserver(entries => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          setIsVisible(true);
          if (once) observer.unobserve(entry.target);
        } else if (!once) {
          setIsVisible(false);
        }
      });
    }, { 
      threshold,
      rootMargin: '0px 0px -100px 0px' 
    });

    const currentRef = domRef.current;
    if (currentRef) observer.observe(currentRef);

    return () => {
      if (currentRef) observer.unobserve(currentRef);
    };
  }, [threshold, once]);

  return (
    <div
      ref={domRef}
      className={`perspective-1000 ${className}`}
      style={{ perspective: '1200px' }}
    >
      <div
        className="transition-all duration-1000 ease-[cubic-bezier(0.175,0.885,0.32,1.275)]"
        style={{
          opacity: isVisible ? 1 : 0,
          transform: isVisible 
            ? 'rotateX(0deg) translateY(0)' 
            : 'rotateX(-90deg) translateY(50px)',
          transformOrigin: 'bottom',
          transitionDelay: isVisible ? `${delay}ms` : '0ms',
          willChange: 'transform, opacity',
          backfaceVisibility: 'hidden'
        }}
      >
        {children}
      </div>
    </div>
  );
};

export default PackageReveal;
