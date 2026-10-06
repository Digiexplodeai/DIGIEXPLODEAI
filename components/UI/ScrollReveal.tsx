import React, { useState, useEffect, useRef } from 'react';

interface ScrollRevealProps {
  children: React.ReactNode;
  direction?: 'left' | 'right' | 'up' | 'down' | 'none';
  delay?: number;
  duration?: number;
  className?: string;
  threshold?: number;
  distance?: number;
  scale?: number;
  blur?: boolean;
  once?: boolean;
  onVisible?: () => void;
  style?: React.CSSProperties;
}

const ScrollReveal: React.FC<ScrollRevealProps> = ({ 
  children, 
  direction = 'up', 
  delay = 0,
  duration = 800,
  className = '',
  threshold = 0.15,
  distance = 32,
  scale = 1,
  blur = true,
  once = true,
  onVisible,
  style = {}
}) => {
  const [isVisible, setIsVisible] = useState(false);
  const domRef = useRef<HTMLDivElement>(null);
  const callbackCalled = useRef(false);

  useEffect(() => {
    // Check prefers-reduced-motion
    if (typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      setIsVisible(true);
      if (onVisible && !callbackCalled.current) {
        callbackCalled.current = true;
        onVisible();
      }
      return;
    }

    const observer = new IntersectionObserver(entries => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          setIsVisible(true);
          if (onVisible && !callbackCalled.current) {
            callbackCalled.current = true;
            onVisible();
          }
          if (once) {
            observer.unobserve(entry.target);
          }
        } else if (!once) {
          setIsVisible(false);
        }
      });
    }, { 
      threshold,
      rootMargin: '0px 0px -40px 0px' 
    });

    const currentRef = domRef.current;
    if (currentRef) {
      observer.observe(currentRef);
    }

    return () => {
      if (currentRef) observer.unobserve(currentRef);
    };
  }, [threshold, once, onVisible]);

  const getInitialTransform = () => {
    const scaleStr = scale !== 1 ? ` scale(${scale})` : '';
    switch (direction) {
      case 'left': return `translateX(-${distance}px)${scaleStr}`;
      case 'right': return `translateX(${distance}px)${scaleStr}`;
      case 'up': return `translateY(${distance}px)${scaleStr}`;
      case 'down': return `translateY(-${distance}px)${scaleStr}`;
      case 'none': return scaleStr ? scaleStr.trim() : 'none';
      default: return 'none';
    }
  };

  return (
    <div
      ref={domRef}
      className={className}
      style={{
        opacity: isVisible ? 1 : 0,
        transform: isVisible ? 'translate(0, 0) scale(1)' : getInitialTransform(),
        filter: blur ? (isVisible ? 'blur(0px)' : 'blur(4px)') : 'none',
        transitionProperty: 'opacity, transform, filter',
        transitionDuration: `${duration}ms`,
        transitionTimingFunction: 'cubic-bezier(0.16, 1, 0.3, 1)',
        transitionDelay: isVisible ? `${delay}ms` : '0ms',
        willChange: 'transform, opacity',
        ...style
      }}
    >
      {children}
    </div>
  );
};

export default ScrollReveal;
