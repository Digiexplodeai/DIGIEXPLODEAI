import React, { useRef, useState } from 'react';
import { ArrowRight, ArrowLeft, Play, Eye, Sparkles } from 'lucide-react';
import ScrollReveal from '../UI/ScrollReveal';

interface CreativeItem {
  id: string;
  title: string;
  category: string;
  platform: string;
  metric: string;
  image: string;
  type: 'video' | 'image' | 'carousel';
}

const creatives: CreativeItem[] = [
  {
    id: 'c1',
    title: 'Direct-Response Coaching Video Hook',
    category: 'Meta Video Ad',
    platform: 'Meta Ads',
    metric: '4.9x ROAS · 420 Leads',
    image: 'https://images.unsplash.com/photo-1557804506-669a67965ba0?auto=format&fit=crop&q=80&w=700',
    type: 'video',
  },
  {
    id: 'c2',
    title: 'Luxury E-Commerce Summer Drop Campaign',
    category: 'Instagram Reel Creative',
    platform: 'Instagram',
    metric: '1.4M Organic Views',
    image: 'https://images.unsplash.com/photo-1490481651871-ab68de25d43d?auto=format&fit=crop&q=80&w=700',
    type: 'video',
  },
  {
    id: 'c3',
    title: 'SaaS Value Prop Carousel Sequence',
    category: 'LinkedIn Thought Leadership',
    platform: 'LinkedIn',
    metric: '8.4% High Click-Through',
    image: 'https://images.unsplash.com/photo-1460925895917-afdab827c52f?auto=format&fit=crop&q=80&w=700',
    type: 'carousel',
  },
  {
    id: 'c4',
    title: 'D2C Skincare Performance UGC Ad Hook',
    category: 'UGC Style Ad',
    platform: 'Meta Ads',
    metric: '5.2x Blended ROAS',
    image: 'https://images.unsplash.com/photo-1522337360788-8b13dee7a37e?auto=format&fit=crop&q=80&w=700',
    type: 'video',
  },
  {
    id: 'c5',
    title: 'Fintech Mobile App User Acquisition Ad',
    category: 'Display & Social Ad',
    platform: 'Google & Meta',
    metric: '18K App Installs',
    image: 'https://images.unsplash.com/photo-1559526324-4b87b5e36e44?auto=format&fit=crop&q=80&w=700',
    type: 'image',
  },
];

const CreativeGallery: React.FC = () => {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [startX, setStartX] = useState(0);
  const [scrollLeft, setScrollLeft] = useState(0);

  const handleMouseDown = (e: React.MouseEvent) => {
    if (!scrollRef.current) return;
    setIsDragging(true);
    setStartX(e.pageX - scrollRef.current.offsetLeft);
    setScrollLeft(scrollRef.current.scrollLeft);
  };

  const handleMouseLeave = () => {
    setIsDragging(false);
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging || !scrollRef.current) return;
    e.preventDefault();
    const x = e.pageX - scrollRef.current.offsetLeft;
    const walk = (x - startX) * 1.5;
    scrollRef.current.scrollLeft = scrollLeft - walk;
  };

  const scrollBy = (offset: number) => {
    if (scrollRef.current) {
      scrollRef.current.scrollBy({ left: offset, behavior: 'smooth' });
    }
  };

  return (
    <section 
      className="transition-colors overflow-hidden"
      style={{ 
        background: 'var(--bg-warm)', 
        paddingTop: 'var(--section-y)', 
        paddingBottom: 'var(--section-y)',
      }}
    >
      <div className="editorial-container">
        
        {/* Header */}
        <ScrollReveal direction="up" distance={20}>
          <div className="flex items-center justify-between gap-4 mb-8 flex-wrap">
            <div>
              <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full text-xs font-bold uppercase tracking-wider mb-3 bg-[#FF5A5F]/12 text-[#FF5A5F] border border-[#FF5A5F]/25">
                <Sparkles size={13} />
                <span>Creative Showcase</span>
              </div>
              <h2 className="display-lg tracking-tight" style={{ color: 'var(--text-primary)' }}>
                Creatives that stop the scroll.
              </h2>
            </div>

            {/* Scroll navigation arrows */}
            <div className="flex items-center gap-2">
              <button
                onClick={() => scrollBy(-360)}
                aria-label="Scroll left"
                className="w-10 h-10 rounded-xl border flex items-center justify-center transition-all cursor-pointer hover:bg-black/5 dark:hover:bg-white/10"
                style={{
                  borderColor: 'var(--border-strong)',
                  color: 'var(--text-primary)',
                  background: 'var(--bg-surface)'
                }}
              >
                <ArrowLeft size={16} />
              </button>
              <button
                onClick={() => scrollBy(360)}
                aria-label="Scroll right"
                className="w-10 h-10 rounded-xl border flex items-center justify-center transition-all cursor-pointer hover:bg-black/5 dark:hover:bg-white/10"
                style={{
                  borderColor: 'var(--border-strong)',
                  color: 'var(--text-primary)',
                  background: 'var(--bg-surface)'
                }}
              >
                <ArrowRight size={16} />
              </button>
            </div>
          </div>
        </ScrollReveal>

        {/* Horizontal Card Scroll Container */}
        <div
          ref={scrollRef}
          onMouseDown={handleMouseDown}
          onMouseLeave={handleMouseLeave}
          onMouseUp={handleMouseUp}
          onMouseMove={handleMouseMove}
          className="flex gap-6 overflow-x-auto pb-6 cursor-grab active:cursor-grabbing scrollbar-none select-none"
        >
          {creatives.map((item) => (
            <div
              key={item.id}
              className="flex-shrink-0 w-[290px] sm:w-[340px] card-modern group rounded-2xl p-0 overflow-hidden border transition-all duration-300 shadow-sm hover:shadow-xl"
              style={{
                background: 'var(--bg-card)',
                borderColor: 'var(--border-subtle)',
              }}
            >
              {/* Media Preview Frame */}
              <div className="relative h-64 sm:h-72 overflow-hidden bg-neutral-950">
                <img
                  src={item.image}
                  alt={item.title}
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700 pointer-events-none"
                  loading="lazy"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/20 to-transparent" />
                
                {/* Platform Tag */}
                <div className="absolute top-3.5 left-3.5">
                  <span className="px-2.5 py-1 rounded-md text-[11px] font-bold uppercase tracking-wider bg-black/60 backdrop-blur-md text-white border border-white/10">
                    {item.platform}
                  </span>
                </div>

                {/* Metric pill */}
                <div className="absolute bottom-3.5 left-3.5 right-3.5">
                  <span className="px-3 py-1.5 rounded-lg text-xs font-extrabold bg-[#080A12]/90 backdrop-blur-md text-[#B8F36B] border border-white/15 block truncate">
                    {item.metric}
                  </span>
                </div>
              </div>

              {/* Caption */}
              <div className="p-5">
                <span className="text-[11px] font-bold uppercase tracking-wider text-[#FF5A5F] block mb-1">
                  {item.category}
                </span>
                <h3 className="font-extrabold text-base line-clamp-2" style={{ color: 'var(--text-primary)' }}>
                  {item.title}
                </h3>
              </div>
            </div>
          ))}
        </div>

      </div>
    </section>
  );
};

export default CreativeGallery;
