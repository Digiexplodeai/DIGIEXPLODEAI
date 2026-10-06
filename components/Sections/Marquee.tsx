import React from 'react';

const marqueeItems = [
  'STRATEGY',
  'CREATIVE',
  'PERFORMANCE',
  'MEDIA BUYING',
  'SEO DOMINANCE',
  'AI AUTOMATION',
  'CONTENT ENGINE',
  'GROWTH SCALING',
];

const MarqueeList: React.FC<{ ariaHidden?: boolean }> = ({ ariaHidden }) => (
  <div 
    className="flex items-center gap-12 flex-shrink-0"
    aria-hidden={ariaHidden}
  >
    {marqueeItems.map((item, idx) => {
      const isStroked = idx % 2 === 0;

      return (
        <React.Fragment key={idx}>
          <span
            className={`font-extrabold text-2xl sm:text-3xl md:text-4xl tracking-tight whitespace-nowrap transition-all duration-200 cursor-default ${
              isStroked
                ? 'text-transparent [-webkit-text-stroke:1.5px_rgba(23,25,35,0.25)] dark:[-webkit-text-stroke:1.5px_rgba(255,255,255,0.40)] hover:[-webkit-text-stroke-color:var(--electric-violet)]'
                : 'text-[#171923] dark:text-[#F7F5F0] hover:text-[#5546F5] dark:hover:text-[#B8F36B]'
            }`}
            style={{
              fontFamily: 'Manrope, sans-serif',
            }}
          >
            {item}
          </span>

          {/* Theme-aware glowing separator dot */}
          <span
            className="w-2 h-2 rounded-full flex-shrink-0"
            style={{
              background: 'var(--electric-violet)',
              boxShadow: '0 0 8px rgba(85, 70, 245, 0.5)',
            }}
          />
        </React.Fragment>
      );
    })}
  </div>
);

const Marquee: React.FC = () => {
  return (
    <section 
      className="relative overflow-hidden transition-colors border-y user-select-none"
      style={{ 
        background: 'var(--bg-page)', 
        borderColor: 'var(--border-subtle)',
        padding: '24px 0',
      }}
      aria-label="Core competencies marquee"
    >
      {/* Left and Right edge gradient fades */}
      <div 
        className="absolute left-0 top-0 bottom-0 w-16 sm:w-28 z-10 pointer-events-none"
        style={{
          background: 'linear-gradient(90deg, var(--bg-page) 0%, transparent 100%)',
        }}
      />
      <div 
        className="absolute right-0 top-0 bottom-0 w-16 sm:w-28 z-10 pointer-events-none"
        style={{
          background: 'linear-gradient(270deg, var(--bg-page) 0%, transparent 100%)',
        }}
      />

      <div 
        className="marquee-track flex gap-12 items-center"
      >
        <MarqueeList />
        <MarqueeList ariaHidden />
      </div>
    </section>
  );
};

export default Marquee;
