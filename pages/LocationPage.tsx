import React from 'react';
import { useNavigate } from 'react-router-dom';
import SEOHead from '../components/SEO/SEOHead';

export interface CityConfig {
  slug: string; name: string; state: string; tagline: string; heroSub: string;
  stats: { label: string; value: string }[];
  about: string; industries: string[]; whyUs: string[];
  faqs: { q: string; a: string }[];
  phone: string;
}

export const CITIES: Record<string, CityConfig> = {
  chandigarh: {
    slug: 'chandigarh', name: 'Chandigarh', state: 'Punjab & Haryana',
    tagline: "Chandigarh's #1 Digital Marketing & Web Development Agency",
    heroSub: "We help Chandigarh businesses dominate Google, scale Meta Ads, and build brand empires. Tricity's fastest-growing digital partner.",
    stats: [{ label: 'Clients in Tricity', value: '40+' }, { label: 'Avg. ROAS Delivered', value: '6.8x' }, { label: 'Leads Generated', value: '12,000+' }, { label: 'Google Top-3 Rankings', value: '200+' }],
    about: "DigiExplodeAI is Chandigarh's premium performance marketing and web development agency. We have helped doctors, real estate developers, e-commerce brands, and local businesses across Sector 17, Sector 35, and IT Park explode their digital presence. From high-ROAS Meta Ads to conversion-optimised websites, we deliver measurable ROI — not just vanity metrics.",
    industries: ['Real Estate', 'Healthcare & Clinics', 'Education & Coaching', 'Restaurants & Cafes', 'Fashion & Retail', 'IT & SaaS Startups'],
    whyUs: ['Dedicated Chandigarh account manager with local market expertise', 'Proven results in competitive Tricity real estate & healthcare niches', 'Hindi + English creatives — culturally resonant ads that actually convert', 'No retainer lock-in — pay for results, not promises'],
    faqs: [{ q: 'Do you have an office in Chandigarh?', a: 'Yes — our team serves the Tricity area (Chandigarh, Panchkula, Mohali) with on-ground support and regular client meetings.' }, { q: 'Which services are most popular in Chandigarh?', a: 'Meta & Google Ads for real estate lead generation, clinic/hospital SEO, and high-converting websites for coaching institutes.' }, { q: 'What is your minimum project budget?', a: 'We work with budgets starting from Rs. 25,000/month for focused digital campaigns.' }],
    phone: '+91-98765-43210',
  },
  panchkula: {
    slug: 'panchkula', name: 'Panchkula', state: 'Haryana',
    tagline: "Panchkula's Fastest-Growing Digital Marketing Agency",
    heroSub: "From Sector 5 to Sector 20 — we help Panchkula businesses generate real leads, real revenue, and real brand authority online.",
    stats: [{ label: 'Panchkula Clients', value: '25+' }, { label: 'Avg. ROAS Delivered', value: '7.2x' }, { label: 'Leads Generated', value: '8,000+' }, { label: 'Local SEO Rankings', value: '150+' }],
    about: "DigiExplodeAI is Panchkula's go-to digital growth partner. We specialise in helping local businesses — from real estate developers in Sector 20 to clinics in MDC — build a powerful online presence that generates inbound clients. Our data-driven approach means you never waste a rupee on untracked advertising.",
    industries: ['Real Estate & Housing', 'Clinics & Hospitals', 'Schools & Coaching', 'Interior Design', 'Gyms & Wellness', 'Food & Hospitality'],
    whyUs: ["Deep knowledge of Panchkula's competitive real estate market", 'Local language creatives (Hindi/Punjabi) for higher engagement', 'Weekly transparent reports — you always know your ROI', 'Specialised clinic & healthcare digital marketing compliance'],
    faqs: [{ q: 'Can you help my Panchkula real estate project get leads?', a: 'Absolutely. We have generated 500+ verified real estate leads for projects in Panchkula sectors through hyper-local Meta Ads.' }, { q: 'Do you do local SEO for Panchkula businesses?', a: 'Yes — we optimise your Google Business Profile, local citations, and on-site SEO to rank for near-me searches in Panchkula.' }, { q: 'How fast can we start?', a: 'Within 72 hours of signing — we move fast and believe in quick wins.' }],
    phone: '+91-98765-43210',
  },
  mohali: {
    slug: 'mohali', name: 'Mohali', state: 'Punjab',
    tagline: "Mohali's Premier Digital Agency — IT Hub Meets Marketing Power",
    heroSub: "Mohali's tech ecosystem deserves world-class digital marketing. We bring Silicon Valley-level strategy to Punjab's fastest-growing city.",
    stats: [{ label: 'Mohali IT Clients', value: '30+' }, { label: 'Avg. ROAS Delivered', value: '6.5x' }, { label: 'App Downloads Driven', value: '50,000+' }, { label: 'SaaS Leads Generated', value: '3,500+' }],
    about: "DigiExplodeAI is Mohali's top-rated digital marketing and web development agency. From Phase 7 startups to Phase 10 enterprises, we have helped companies in Mohali's tech hub scale with precision-targeted Google Ads, SEO dominance, and custom web applications built for performance.",
    industries: ['IT Companies & SaaS', 'Real Estate (Aerocity)', 'E-Commerce & D2C', 'Education Technology', 'Pharma & Healthcare', 'Logistics & Manufacturing'],
    whyUs: ["Specialist B2B digital marketing for Mohali's IT & SaaS companies", 'Full-stack web & mobile app development with React/Next.js', 'LinkedIn Ads for B2B lead generation — specialty in tech sector', 'Aerocity & JLPL sector real estate lead generation experts'],
    faqs: [{ q: 'Can you help my Mohali IT company get B2B clients?', a: 'Yes — B2B lead gen is our strength. We run LinkedIn Ads, Google Search campaigns, and SEO content strategies that attract decision-makers.' }, { q: 'Do you build websites for Mohali startups?', a: "Absolutely. We have built 30+ high-converting websites for Mohali-based tech startups, from MVP landing pages to full SaaS platforms." }, { q: 'What makes you different from other Mohali agencies?', a: 'We are performance-obsessed. Every rupee is tracked, every campaign is optimised weekly, and we share transparent reports.' }],
    phone: '+91-98765-43210',
  },
  gurugram: {
    slug: 'gurugram', name: 'Gurugram', state: 'Haryana',
    tagline: "Gurugram's ROI-Obsessed Digital Marketing Agency",
    heroSub: "In Gurugram's brutally competitive market, only data-driven agencies win. We deliver 6x ROAS minimum or we optimise until we do.",
    stats: [{ label: 'Gurugram Clients', value: '55+' }, { label: 'Avg. ROAS Delivered', value: '8.1x' }, { label: 'Revenue Generated', value: 'Rs. 12 Cr+' }, { label: 'Google Page-1 Rankings', value: '300+' }],
    about: "DigiExplodeAI serves Gurugram's most ambitious brands — from DLF Cyber City fintech startups to Sohna Road real estate developers. In NCR's corporate capital, we deliver enterprise-grade digital marketing: performance Meta & Google Ads, full-funnel SEO, and creative content that cuts through the noise.",
    industries: ['Fintech & Banking', 'Real Estate (DLF, Sohna)', 'Healthcare & Hospitals', 'Ed-Tech & Coaching', 'Luxury Retail', 'Corporate Services & B2B'],
    whyUs: ["Experienced in Gurugram's ultra-competitive real estate & fintech verticals", 'Google Premier Partner — certified campaign managers', 'Dedicated creative studio producing high-converting video ads & reels', 'CRO-focused websites — we track every micro-conversion, not just clicks'],
    faqs: [{ q: 'Do you work with large Gurugram enterprises?', a: 'Yes — we work with brands spending Rs. 50,000 to Rs. 50 lakhs/month on digital. We have dedicated enterprise account teams for large-budget campaigns.' }, { q: 'Can you handle Gurugram real estate lead gen at scale?', a: 'This is our strongest vertical. We have generated 10,000+ verified buyer leads for Gurugram real estate projects in sectors 65, 92, 67, and Dwarka Expressway.' }, { q: 'What industries do you NOT serve?', a: 'We do not work with gambling, unlicensed crypto, or any content violating Meta/Google advertising policies.' }],
    phone: '+91-98765-43210',
  },
  delhi: {
    slug: 'delhi', name: 'Delhi', state: 'Delhi NCR',
    tagline: "Delhi's Performance Marketing Agency — Rs. 18 Cr+ Revenue Generated",
    heroSub: "From Connaught Place to Karol Bagh — we power Delhi's boldest brands with explosive digital marketing, high-converting websites, and AI-driven campaigns.",
    stats: [{ label: 'Delhi NCR Clients', value: '80+' }, { label: 'Avg. ROAS Delivered', value: '7.4x' }, { label: 'Revenue Generated', value: 'Rs. 18 Cr+' }, { label: 'Leads Generated', value: '25,000+' }],
    about: "DigiExplodeAI is Delhi's fastest-scaling digital marketing and technology agency. We have partnered with brands across South Delhi, Lajpat Nagar, Rajouri Garden, Pitampura, and Noida Extension to dominate their digital verticals. Whether you are a healthcare chain in East Delhi or a luxury fashion brand in Hauz Khas Village — we engineer campaigns that deliver measurable growth.",
    industries: ['E-Commerce & D2C', 'Healthcare & Hospital Chains', 'Fashion & Lifestyle', 'Real Estate & Builders', 'Education & UPSC Coaching', 'Restaurants & QSR'],
    whyUs: ["Delhi NCR's most data-obsessed performance marketing team", 'In-house Hindi & English creative production — reels, ads, banners', 'Google & Meta certified — no outsourcing, no middlemen', 'Transparent weekly reporting with actual revenue attribution'],
    faqs: [{ q: 'Can you generate leads for my Delhi real estate project?', a: 'Yes — we have generated 10,000+ verified real estate leads across Greater Noida West, Dwarka Expressway, and Delhi NCR micro-markets.' }, { q: 'Do you create social media content in Hindi?', a: 'Absolutely. Our in-house creative team produces high-engagement Hindi reels, stories, and ad copies specifically tuned for the Delhi audience.' }, { q: 'What is the minimum engagement period?', a: 'We offer flexible 3-month starter contracts. Most clients stay 12+ months because of consistent results.' }],
    phone: '+91-98765-43210',
  },
  noida: {
    slug: 'noida', name: 'Noida', state: 'Uttar Pradesh',
    tagline: "Noida's #1 Digital Agency — IT Sector to Consumer Brands",
    heroSub: "Sector 18 to Sector 62 — DigiExplodeAI is the partner Noida's growing brands trust for Meta Ads, SEO, and conversion-ready websites.",
    stats: [{ label: 'Noida Clients', value: '45+' }, { label: 'Avg. ROAS Delivered', value: '6.9x' }, { label: 'Leads Generated', value: '15,000+' }, { label: 'Rankings Achieved', value: '250+' }],
    about: "DigiExplodeAI powers Noida's most ambitious digital transformations — from film city creative studios to Sector 18's retail brands and Greater Noida West's real estate market. We combine performance marketing, UI/UX-driven web development, and AI-assisted content to give Noida brands an unfair competitive advantage.",
    industries: ['Real Estate (Noida Expressway)', 'IT & Software Services', 'Film & Creative Production', 'E-Commerce', 'Healthcare', 'Coaching & EdTech'],
    whyUs: ["Deep expertise in Noida's real estate & IT B2B markets", 'Multilingual campaigns (Hindi, English, regional) for UP market', 'Custom web apps built for performance — React/Next.js specialists', 'Greater Noida West & Noida Extension hyper-local lead generation'],
    faqs: [{ q: 'Do you serve Greater Noida & Noida Extension?', a: 'Yes — we are highly active in Greater Noida West, Noida Extension, and Yamuna Expressway real estate markets with proven lead generation campaigns.' }, { q: 'Can you help a Noida IT company with B2B marketing?', a: 'Yes — LinkedIn Ads, Google B2B campaigns, and content-led SEO are our B2B specialties for Noida IT companies.' }, { q: 'How soon can we see results?', a: 'Meta Ads: leads within 48 hours. SEO: measurable movement in 6-8 weeks. Website: launched within 2-3 weeks.' }],
    phone: '+91-98765-43210',
  },
  ludhiana: {
    slug: 'ludhiana', name: 'Ludhiana', state: 'Punjab',
    tagline: "Ludhiana's Digital Marketing Agency — Punjab's Business Capital Goes Digital",
    heroSub: "From hosiery exports to real estate — DigiExplodeAI helps Ludhiana's industrial powerhouses build digital empires that generate global clients.",
    stats: [{ label: 'Ludhiana Clients', value: '20+' }, { label: 'Avg. ROAS Delivered', value: '6.2x' }, { label: 'B2B Leads Generated', value: '5,000+' }, { label: 'Export Inquiries Driven', value: '800+' }],
    about: "DigiExplodeAI is Punjab's industrial capital's digital growth partner. We help Ludhiana's manufacturers, exporters, real estate developers, and local businesses build powerful online presences that generate global inquiries and local dominance.",
    industries: ['Manufacturing & Export', 'Real Estate', 'Textile & Hosiery', 'Automotive Parts', 'Healthcare & Hospitals', 'Education & Coaching'],
    whyUs: ['B2B export marketing — Google Ads & LinkedIn for international buyers', 'Punjabi creative content that resonates with local audience', "Real estate lead gen proven in Ludhiana's competitive market", 'Industrial website development with multi-language export catalogues'],
    faqs: [{ q: 'Can you help my Ludhiana factory get international inquiries?', a: 'Yes — we specialise in export-focused Google Ads and LinkedIn campaigns that drive global B2B inquiries for Ludhiana manufacturers.' }, { q: 'Do you create content in Punjabi?', a: 'Absolutely. Our creative team produces Punjabi + Hindi + English content to maximise reach across Punjab.' }, { q: 'Can you help real estate projects in Ludhiana?', a: 'Yes — we have generated 1,000+ verified buyer leads for Ludhiana real estate projects through hyper-local Meta Ads campaigns.' }],
    phone: '+91-98765-43210',
  },
  amritsar: {
    slug: 'amritsar', name: 'Amritsar', state: 'Punjab',
    tagline: "Amritsar's Digital Marketing Agency — Holy City, Explosive Growth",
    heroSub: "Tourism, hospitality, healthcare, education — DigiExplodeAI helps Amritsar's diverse business ecosystem dominate digital and grow beyond borders.",
    stats: [{ label: 'Amritsar Clients', value: '15+' }, { label: 'Tourism Leads Driven', value: '3,000+' }, { label: 'Avg. ROAS', value: '5.9x' }, { label: 'Instagram Growth', value: '500K+ reach' }],
    about: "DigiExplodeAI helps Amritsar's businesses capture the enormous opportunity of a city that attracts millions of tourists annually. From heritage hospitality brands to Majitha Road real estate, from export-focused manufacturers to private schools — we create digital campaigns that resonate with both local Amritsaris and global visitors.",
    industries: ['Tourism & Hospitality', 'Real Estate', 'Healthcare & Clinics', 'Education & Boarding Schools', 'Textile & Export', 'Restaurants & Dhabas'],
    whyUs: ['Tourism marketing specialists — Google Ads, TripAdvisor, and social targeting', 'Bilingual Punjabi/English content for global reach', 'Heritage brand storytelling — authentic, compelling digital narratives', 'Local SEO dominance for best hotel in Amritsar type searches'],
    faqs: [{ q: 'Can you help my hotel in Amritsar get more bookings?', a: 'Yes — we run Google Hotel Ads, Meta retargeting, and local SEO campaigns that have consistently grown direct bookings for Amritsar hospitality brands.' }, { q: 'Do you manage Instagram for Amritsar restaurants?', a: 'Absolutely. We create scroll-stopping food reels and manage Instagram/Facebook pages for Amritsar restaurants with proven engagement growth.' }, { q: 'Can you target NRI audiences for Amritsar real estate?', a: 'Yes — NRI targeting via Meta Ads and Google for Amritsar real estate is one of our specialties, reaching diaspora audiences in UK, Canada, and USA.' }],
    phone: '+91-98765-43210',
  },
  jalandhar: {
    slug: 'jalandhar', name: 'Jalandhar', state: 'Punjab',
    tagline: "Jalandhar's Digital Marketing Agency — Sports Capital Meets Digital Power",
    heroSub: "Sports goods exporters, real estate developers, schools — DigiExplodeAI gives Jalandhar's ambitious businesses the digital edge to win globally.",
    stats: [{ label: 'Jalandhar Clients', value: '18+' }, { label: 'Export Inquiries Driven', value: '2,000+' }, { label: 'Avg. ROAS', value: '6.1x' }, { label: 'Local SEO Rankings', value: '100+' }],
    about: "DigiExplodeAI is Jalandhar's digital growth engine. We help the city's thriving sports goods industry attract international buyers, real estate developers generate NRI and local leads, and educational institutions attract quality admissions.",
    industries: ['Sports Goods Export', 'Real Estate & Plots', 'Education & Schools', 'Healthcare', 'Manufacturing & Industrial', 'Retail Chains'],
    whyUs: ['Sports goods export marketing — B2B digital for global buyers', 'NRI real estate targeting for Jalandhar properties', 'Educational institution admissions campaign specialists', "Cost-effective packages designed for Jalandhar's business scale"],
    faqs: [{ q: 'Can you help my Jalandhar sports goods company get international orders?', a: 'Yes — we create B2B-focused digital campaigns targeting sports retailers and distributors in Europe, Middle East, and Americas.' }, { q: 'Do you help schools in Jalandhar with admissions?', a: 'Absolutely. We run targeted Meta Ads and Google campaigns during admission seasons with proven results for Jalandhar schools and colleges.' }, { q: 'How do I get started?', a: "Call us or fill the form below. We will do a free 30-min strategy call and tell you exactly how we would grow your Jalandhar business." }],
    phone: '+91-98765-43210',
  },
  shimla: {
    slug: 'shimla', name: 'Shimla', state: 'Himachal Pradesh',
    tagline: "Shimla's Digital Marketing Agency — Mountain Business, Global Reach",
    heroSub: "Hotels, homestays, real estate, apple orchards — DigiExplodeAI gives Shimla's businesses the digital presence to attract pan-India and global clients.",
    stats: [{ label: 'Himachal Clients', value: '12+' }, { label: 'Hotel Bookings Driven', value: '5,000+' }, { label: 'Avg. ROAS', value: '5.5x' }, { label: 'Tourism Inquiries', value: '8,000+' }],
    about: "DigiExplodeAI helps Shimla and Himachal Pradesh's businesses tap into India's massive tourism boom. From Mall Road hotels to Mashobra homestays, from Kasauli real estate to Solan apple exporters — we create beautiful, high-converting digital campaigns that bring the world to your doorstep.",
    industries: ['Hotels & Homestays', 'Tourism & Travel', 'Real Estate & Holiday Homes', 'Apple & Agri Export', 'Education & Boarding Schools', 'Adventure & Trekking'],
    whyUs: ['Tourism digital marketing specialists with Himachal market expertise', 'Instagram & Pinterest visual marketing for beautiful mountain brands', 'Google Hotel Ads and OTA strategy for maximum direct bookings', 'Holiday home & real estate NRI targeting'],
    faqs: [{ q: 'Can you help my Shimla hotel get direct bookings without paying OTA commission?', a: 'Yes — we run Google Hotel Ads, Meta retargeting, and build direct booking websites that reduce your OTA dependency by 40-60%.' }, { q: 'Do you market Himachal real estate to NRIs?', a: 'Absolutely. NRI targeting for Himachal holiday homes and land is a growing specialty — we reach diaspora audiences across USA, Canada, UK, and Middle East.' }, { q: 'Can you run digital marketing from Shimla or is it remote?', a: 'Everything is remote-first with digital delivery. We serve Shimla clients with full-stack digital marketing just like Delhi or Gurugram clients.' }],
    phone: '+91-98765-43210',
  },
  dehradun: {
    slug: 'dehradun', name: 'Dehradun', state: 'Uttarakhand',
    tagline: "Dehradun's Digital Marketing Agency — Uttarakhand's Capital Goes Digital",
    heroSub: "Education hub, real estate boom, tourism magnet — DigiExplodeAI helps Dehradun's businesses grow with performance marketing that delivers real results.",
    stats: [{ label: 'Dehradun Clients', value: '22+' }, { label: 'Education Leads', value: '4,000+' }, { label: 'Avg. ROAS', value: '6.3x' }, { label: 'Real Estate Leads', value: '2,500+' }],
    about: "DigiExplodeAI is Dehradun's leading digital growth partner. From prestigious boarding schools in Rajpur Road to real estate on Sahastradhara Road, from eco-resorts in Mussoorie to IT companies in Ballupur — we deliver precision-targeted digital campaigns that fill your pipeline with qualified leads, year-round.",
    industries: ['Education & Boarding Schools', 'Real Estate & Townships', 'Tourism & Eco-Resorts', 'Healthcare', 'IT & Startups', 'Retail & Restaurants'],
    whyUs: ['Education institution admissions campaign specialists (boarding schools, colleges)', 'Uttarakhand real estate lead generation with NRI targeting', 'Tourism campaigns for Mussoorie, Rishikesh, and Dehradun destinations', "Cost-effective packages for Uttarakhand's growing business community"],
    faqs: [{ q: 'Can you help my Dehradun school get admissions?', a: 'Yes — school admissions campaigns are our specialty. We run geo-targeted Meta Ads reaching parents in Delhi NCR, Punjab, and Haryana who seek Dehradun boarding schools.' }, { q: 'Do you handle Mussoorie and Rishikesh tourism marketing?', a: 'Absolutely. We manage digital campaigns for tourism businesses across the Uttarakhand region including Mussoorie, Rishikesh, and Haridwar.' }, { q: 'What results can I expect in 90 days?', a: 'Typically: 3x increase in qualified website traffic, 50-100 verified leads per month for real estate/education, and measurable brand awareness growth.' }],
    phone: '+91-98765-43210',
  },
};

const IC = [
  { bg: 'rgba(108,76,255,0.12)', br: 'rgba(108,76,255,0.3)', tx: '#A78BFF' },
  { bg: 'rgba(37,99,255,0.12)', br: 'rgba(37,99,255,0.3)', tx: '#60A5FA' },
  { bg: 'rgba(57,217,198,0.12)', br: 'rgba(57,217,198,0.3)', tx: '#34D399' },
  { bg: 'rgba(184,243,107,0.1)', br: 'rgba(184,243,107,0.25)', tx: '#A3E635' },
  { bg: 'rgba(255,90,95,0.1)', br: 'rgba(255,90,95,0.25)', tx: '#FB7185' },
  { bg: 'rgba(255,255,255,0.06)', br: 'rgba(255,255,255,0.12)', tx: '#94A3B8' },
];

const SVCS = [
  { e: '🎯', t: 'Meta & Google Ads', c: '#6C4CFF' },
  { e: '📈', t: 'SEO & Search Authority', c: '#2563FF' },
  { e: '🌐', t: 'Website Development', c: '#39D9C6' },
  { e: '📱', t: 'Social Media Management', c: '#B8F36B' },
  { e: '🎬', t: 'Video & Creative Production', c: '#FF5A5F' },
  { e: '🤖', t: 'AI Marketing Automation', c: '#F59E0B' },
];

const SVCS_DESC = (city: string) => [
  `High-ROAS ad campaigns crafted for ${city}'s competitive market. Every rupee tracked, every lead verified.`,
  `Rank #1 on Google for "${city} [your service]" searches. Organic traffic that compounds every month.`,
  `High-converting React/Next.js websites built for ${city} businesses. Mobile-first, fast, and CRO-optimised.`,
  `Instagram, Facebook, and LinkedIn management with ${city}-relevant content that builds real audience.`,
  'Scroll-stopping reels, ad videos, and product photography. In-house production — no outsourcing.',
  'Automated lead nurturing, WhatsApp follow-ups, and CRM integration — so no lead ever falls through the cracks.',
];

interface LocationPageProps { citySlug: string; }

const LocationPage: React.FC<LocationPageProps> = ({ citySlug }) => {
  const navigate = useNavigate();
  const city = CITIES[citySlug];

  if (!city) return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', background: '#080A12' }}>
      <p>City page not found.</p>
    </div>
  );

  const jsonLd = {
    '@context': 'https://schema.org', '@type': 'LocalBusiness',
    '@id': `https://www.digiexplodeai.com/${city.slug}`,
    name: 'DigiExplodeAI', description: city.heroSub,
    url: `https://www.digiexplodeai.com/${city.slug}`, telephone: city.phone,
    address: { '@type': 'PostalAddress', addressLocality: city.name, addressRegion: city.state, addressCountry: 'IN' },
    areaServed: { '@type': 'City', name: city.name },
    serviceType: ['Digital Marketing', 'SEO Services', 'Meta Ads', 'Google Ads', 'Web Development', 'Social Media Marketing'],
    priceRange: 'Rs.Rs.Rs.',
    sameAs: ['https://instagram.com/digiexplodeai', 'https://linkedin.com/company/digiexplodeai'],
  };

  const hover = (scale: string) => ({
    onMouseEnter: (e: React.MouseEvent<HTMLElement>) => { (e.currentTarget as HTMLElement).style.transform = `scale(${scale})`; },
    onMouseLeave: (e: React.MouseEvent<HTMLElement>) => { (e.currentTarget as HTMLElement).style.transform = 'scale(1)'; },
  });

  return (
    <>
      <SEOHead
        title={`${city.tagline} | DigiExplodeAI`}
        description={`${city.heroSub} DigiExplodeAI offers Meta Ads, Google Ads, SEO, and web development services in ${city.name}, ${city.state}.`}
        keywords={`digital marketing agency ${city.name}, SEO ${city.name}, Meta Ads ${city.name}, Google Ads ${city.name}, web development ${city.name}, social media marketing ${city.name}, DigiExplodeAI ${city.name}`}
        canonicalUrl={`https://www.digiexplodeai.com/${city.slug}`}
        jsonLd={jsonLd}
      />
      <div style={{ minHeight: '100vh' }}>

        {/* HERO */}
        <section style={{ position: 'relative', overflow: 'hidden', paddingTop: 112, paddingBottom: 80, padding: '112px 16px 80px', background: 'linear-gradient(135deg,#080A12 0%,#0E1220 50%,#12172E 100%)' }}>
          <div style={{ position: 'absolute', top: -80, left: '20%', width: 500, height: 500, borderRadius: '50%', background: 'radial-gradient(circle,rgba(108,76,255,.18) 0%,transparent 70%)', pointerEvents: 'none' }} />
          <div style={{ position: 'absolute', bottom: -60, right: '10%', width: 400, height: 400, borderRadius: '50%', background: 'radial-gradient(circle,rgba(37,99,255,.14) 0%,transparent 70%)', pointerEvents: 'none' }} />
          <div style={{ maxWidth: 900, margin: '0 auto', position: 'relative', zIndex: 10, textAlign: 'center' }}>
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '6px 16px', borderRadius: 999, background: 'rgba(108,76,255,.15)', border: '1px solid rgba(108,76,255,.35)', color: '#A78BFF', fontSize: 12, fontWeight: 700, marginBottom: 24 }}>
              <span style={{ width: 7, height: 7, borderRadius: '50%', background: '#6C4CFF', display: 'inline-block' }} />
              Digital Marketing Agency in {city.name}, {city.state}
            </div>
            <h1 style={{ fontFamily: 'Manrope,sans-serif', fontSize: 'clamp(1.9rem,4.5vw,3.2rem)', fontWeight: 900, color: '#FFFFFF', lineHeight: 1.15, marginBottom: 24 }}>{city.tagline}</h1>
            <p style={{ fontSize: 'clamp(1rem,2vw,1.15rem)', color: '#94A3B8', maxWidth: 700, margin: '0 auto 40px', lineHeight: 1.75 }}>{city.heroSub}</p>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 16, justifyContent: 'center', marginBottom: 64 }}>
              <button onClick={() => navigate('/start-project')} style={{ padding: '15px 32px', borderRadius: 16, fontWeight: 900, fontSize: 15, background: 'linear-gradient(135deg,#6C4CFF,#2563FF)', color: '#fff', boxShadow: '0 8px 32px rgba(108,76,255,.35)', border: 'none', cursor: 'pointer', transition: 'transform .2s' }} {...hover('1.05')}>🚀 Get Free Strategy Call</button>
              <a href={`tel:${city.phone}`} style={{ padding: '15px 32px', borderRadius: 16, fontWeight: 700, fontSize: 15, background: 'rgba(255,255,255,.06)', border: '1px solid rgba(255,255,255,.15)', color: '#CBD5E1', textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: 8, transition: 'transform .2s' }} {...hover('1.05')}>📞 {city.phone}</a>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(160px,1fr))', gap: 16, maxWidth: 800, margin: '0 auto' }}>
              {city.stats.map((s, i) => (
                <div key={i} style={{ borderRadius: 16, padding: '16px 12px', textAlign: 'center', background: 'rgba(255,255,255,.04)', border: '1px solid rgba(255,255,255,.09)' }}>
                  <div style={{ fontSize: 28, fontWeight: 900, marginBottom: 4, color: i % 2 === 0 ? '#A78BFF' : '#60A5FA' }}>{s.value}</div>
                  <div style={{ fontSize: 11, fontWeight: 600, color: '#64748B' }}>{s.label}</div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ABOUT */}
        <section style={{ padding: '80px 16px', background: '#0A0D18' }}>
          <div style={{ maxWidth: 900, margin: '0 auto', display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(300px,1fr))', gap: 48, alignItems: 'center' }}>
            <div>
              <div style={{ fontSize: 11, fontWeight: 900, letterSpacing: '.15em', color: '#6C4CFF', marginBottom: 12 }}>ABOUT US IN {city.name.toUpperCase()}</div>
              <h2 style={{ fontFamily: 'Manrope,sans-serif', fontSize: 'clamp(1.5rem,3vw,2.2rem)', fontWeight: 900, color: '#F1F5F9', lineHeight: 1.2, marginBottom: 20 }}>Your Local Growth Partner in {city.name}</h2>
              <p style={{ fontSize: 15, lineHeight: 1.75, color: '#94A3B8', marginBottom: 24 }}>{city.about}</p>
              <button onClick={() => navigate('/start-project')} style={{ padding: '12px 24px', borderRadius: 12, fontWeight: 700, fontSize: 14, background: 'rgba(108,76,255,.15)', border: '1px solid rgba(108,76,255,.4)', color: '#A78BFF', cursor: 'pointer' }}>Talk to Our {city.name} Expert →</button>
            </div>
            <div style={{ borderRadius: 24, padding: 32, background: 'rgba(255,255,255,.03)', border: '1px solid rgba(255,255,255,.07)' }}>
              <div style={{ fontSize: 14, fontWeight: 900, color: '#F1F5F9', marginBottom: 20 }}>Industries We Serve in {city.name}</div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                {city.industries.map((ind, i) => { const c = IC[i % 6]; return (<span key={i} style={{ padding: '6px 12px', borderRadius: 12, fontSize: 12, fontWeight: 700, background: c.bg, border: `1px solid ${c.br}`, color: c.tx }}>{ind}</span>); })}
              </div>
            </div>
          </div>
        </section>

        {/* SERVICES */}
        <section style={{ padding: '80px 16px', background: '#080A12' }}>
          <div style={{ maxWidth: 900, margin: '0 auto' }}>
            <div style={{ textAlign: 'center', marginBottom: 56 }}>
              <div style={{ fontSize: 11, fontWeight: 900, letterSpacing: '.15em', color: '#6C4CFF', marginBottom: 12 }}>OUR SERVICES IN {city.name.toUpperCase()}</div>
              <h2 style={{ fontFamily: 'Manrope,sans-serif', fontSize: 'clamp(1.5rem,3vw,2.2rem)', fontWeight: 900, color: '#F1F5F9', lineHeight: 1.2 }}>Everything You Need to Dominate {city.name}</h2>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(255px,1fr))', gap: 20 }}>
              {SVCS.map((s, i) => (
                <div key={i} onClick={() => navigate('/start-project')} style={{ borderRadius: 16, padding: 24, background: 'rgba(255,255,255,.03)', border: '1px solid rgba(255,255,255,.07)', cursor: 'pointer', transition: 'transform .2s,border-color .2s' }}
                  onMouseEnter={e => { (e.currentTarget as HTMLElement).style.transform = 'scale(1.04)'; (e.currentTarget as HTMLElement).style.borderColor = 'rgba(108,76,255,.35)'; }}
                  onMouseLeave={e => { (e.currentTarget as HTMLElement).style.transform = 'scale(1)'; (e.currentTarget as HTMLElement).style.borderColor = 'rgba(255,255,255,.07)'; }}>
                  <div style={{ fontSize: 32, marginBottom: 16 }}>{s.e}</div>
                  <h3 style={{ fontWeight: 900, fontSize: 15, marginBottom: 8, color: s.c }}>{s.t}</h3>
                  <p style={{ fontSize: 13, lineHeight: 1.65, color: '#64748B' }}>{SVCS_DESC(city.name)[i]}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* WHY US */}
        <section style={{ padding: '80px 16px', background: '#0A0D18' }}>
          <div style={{ maxWidth: 900, margin: '0 auto' }}>
            <div style={{ textAlign: 'center', marginBottom: 48 }}>
              <div style={{ fontSize: 11, fontWeight: 900, letterSpacing: '.15em', color: '#39D9C6', marginBottom: 12 }}>WHY DIGIEXPLODEAI IN {city.name.toUpperCase()}</div>
              <h2 style={{ fontFamily: 'Manrope,sans-serif', fontSize: 'clamp(1.5rem,3vw,2.2rem)', fontWeight: 900, color: '#F1F5F9' }}>The {city.name} Advantage</h2>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(290px,1fr))', gap: 20 }}>
              {city.whyUs.map((point, i) => (
                <div key={i} style={{ display: 'flex', gap: 16, borderRadius: 16, padding: 24, background: 'rgba(255,255,255,.03)', border: '1px solid rgba(255,255,255,.07)' }}>
                  <div style={{ width: 32, height: 32, borderRadius: 12, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, fontSize: 14, fontWeight: 900, background: 'rgba(108,76,255,.2)', color: '#A78BFF' }}>✓</div>
                  <p style={{ fontSize: 14, lineHeight: 1.65, color: '#CBD5E1', margin: 0 }}>{point}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* FAQ */}
        <section style={{ padding: '80px 16px', background: '#080A12' }}>
          <div style={{ maxWidth: 720, margin: '0 auto' }}>
            <div style={{ textAlign: 'center', marginBottom: 48 }}>
              <div style={{ fontSize: 11, fontWeight: 900, letterSpacing: '.15em', color: '#6C4CFF', marginBottom: 12 }}>FREQUENTLY ASKED</div>
              <h2 style={{ fontFamily: 'Manrope,sans-serif', fontSize: 'clamp(1.5rem,3vw,2.2rem)', fontWeight: 900, color: '#F1F5F9' }}>Questions About Our {city.name} Services</h2>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              {city.faqs.map((faq, i) => (
                <div key={i} style={{ borderRadius: 16, padding: 24, background: 'rgba(255,255,255,.03)', border: '1px solid rgba(255,255,255,.07)' }}>
                  <h3 style={{ fontWeight: 900, fontSize: 14, color: '#F1F5F9', margin: '0 0 12px' }}>Q: {faq.q}</h3>
                  <p style={{ fontSize: 14, lineHeight: 1.7, color: '#94A3B8', margin: 0 }}>{faq.a}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* CTA */}
        <section style={{ padding: '80px 16px', textAlign: 'center', background: 'linear-gradient(135deg,rgba(108,76,255,.15) 0%,rgba(37,99,255,.10) 100%)', borderTop: '1px solid rgba(108,76,255,.2)' }}>
          <div style={{ maxWidth: 720, margin: '0 auto' }}>
            <div style={{ fontSize: 48, marginBottom: 24 }}>🚀</div>
            <h2 style={{ fontFamily: 'Manrope,sans-serif', fontSize: 'clamp(1.8rem,4vw,2.8rem)', fontWeight: 900, color: '#FFFFFF', marginBottom: 20 }}>Ready to Dominate {city.name}?</h2>
            <p style={{ fontSize: 17, color: '#94A3B8', marginBottom: 40, lineHeight: 1.7 }}>Free 30-minute strategy call. No commitment. We will show you exactly where your competitors are beating you — and how to flip it.</p>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 16, justifyContent: 'center' }}>
              <button onClick={() => navigate('/start-project')} style={{ padding: '18px 40px', borderRadius: 16, fontWeight: 900, fontSize: 16, background: 'linear-gradient(135deg,#6C4CFF,#2563FF)', color: '#fff', boxShadow: '0 8px 32px rgba(108,76,255,.4)', border: 'none', cursor: 'pointer', transition: 'transform .2s' }} {...hover('1.05')}>Start My Free Strategy Call</button>
              <a href={`tel:${city.phone}`} style={{ padding: '18px 40px', borderRadius: 16, fontWeight: 700, fontSize: 16, background: 'rgba(255,255,255,.06)', border: '1px solid rgba(255,255,255,.15)', color: '#CBD5E1', textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: 8, transition: 'transform .2s' }} {...hover('1.05')}>📞 Call Us Now</a>
            </div>
          </div>
        </section>

      </div>
    </>
  );
};

export default LocationPage;
