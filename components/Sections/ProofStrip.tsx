import React, { useState, useRef, useEffect } from 'react';
import { useCountUp } from '../../hooks/useCountUp';
import { Award, Zap, TrendingUp, Users } from 'lucide-react';

const metrics = [
  { val: '150+', label: 'Campaigns Scaled', sub: 'Across 12+ high-growth verticals', icon: Award, color: '#6C4CFF' },
  { val: '4.8x', label: 'Average ROAS', sub: 'Performance attribution benchmark', icon: TrendingUp, color: '#2563FF' },
  { val: '10M+', label: 'Reach Delivered', sub: 'Targeted high-intent impressions', icon: Users, color: '#B8F36B' },
  { val: '40%', label: 'Lower Cost / Lead', sub: 'Versus unoptimized industry benchmarks', icon: Zap, color: '#FF5A5F' },
];

const MetricItem: React.FC<{
  val: string;
  label: string;
  sub: string;
  color: string;
  icon: React.ElementType;
  index: number;
  isVisible: boolean;
}> = ({ val, label, sub, color, icon: Icon, index, isVisible }) => {
  const animatedVal = useCountUp(val, isVisible, { duration: 1500 });
  const [hovered, setHovered] = useState(false);

  return (
    <div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      className="p-6 md:p-8 relative flex flex-col justify-between transition-all duration-300"
      style={{
        opacity: isVisible ? 1 : 0,
        transform: isVisible ? (hovered ? 'translateY(-3px)' : 'translateY(0)') : 'translateY(20px)',
        transition: `opacity 0.6s var(--ease-out-expo) ${index * 100}ms, transform 0.3s ease`,
      }}
    >
      {/* Vertical divider */}
      {index > 0 && (
        <div
          className="hidden md:block absolute left-0 top-1/6 bottom-1/6 w-[1px]"
          style={{
            background: 'var(--border-subtle)',
            transform: isVisible ? 'scaleY(1)' : 'scaleY(0)',
            transition: `transform 0.6s ease ${index * 100}ms`,
          }}
        />
      )}

      <div>
        <div className="flex items-center gap-2 mb-3">
          <div 
            className="w-7 h-7 rounded-lg flex items-center justify-center transition-transform duration-200"
            style={{ 
              background: `rgba(${color === '#5546F5' ? '85,70,245' : color === '#FF784F' ? '255,120,79' : '184,243,107'}, 0.15)`,
              transform: hovered ? 'scale(1.1)' : 'scale(1)',
            }}
          >
            <Icon size={14} color={color === '#B8F36B' ? '#4A8500' : color} />
          </div>
          <span 
            className="text-[11px] font-extrabold uppercase tracking-wider"
            style={{ color: 'var(--text-muted)' }}
          >
            {label}
          </span>
        </div>

        <div
          className="font-extrabold text-3xl sm:text-4xl md:text-5xl tracking-tight leading-none mb-2 transition-colors duration-200"
          style={{
            fontFamily: 'Manrope, sans-serif',
            color: hovered ? color : 'var(--text-primary)',
          }}
        >
          {animatedVal}
        </div>
      </div>

      <p 
        className="text-xs font-medium mt-2"
        style={{ color: 'var(--text-secondary)' }}
      >
        {sub}
      </p>
    </div>
  );
};

const ProofStrip: React.FC = () => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    if (typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      setIsVisible(true);
      return;
    }

    const observer = new IntersectionObserver(
      entries => {
        if (entries[0].isIntersecting) {
          setIsVisible(true);
          observer.disconnect();
        }
      },
      { threshold: 0.15 }
    );

    if (containerRef.current) observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, []);

  return (
    <div
      ref={containerRef}
      className="border-y relative z-20 transition-colors"
      style={{
        background: 'var(--bg-surface)',
        borderColor: 'var(--border-subtle)',
      }}
    >
      <div className="editorial-container">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 divide-y sm:divide-y-0 divide-black/5 dark:divide-white/5">
          {metrics.map((m, i) => (
            <MetricItem
              key={m.label}
              val={m.val}
              label={m.label}
              sub={m.sub}
              color={m.color}
              icon={m.icon}
              index={i}
              isVisible={isVisible}
            />
          ))}
        </div>
      </div>
    </div>
  );
};

export default ProofStrip;
