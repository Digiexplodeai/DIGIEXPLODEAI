import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  Globe, Search, Code, CheckCircle, Download, RefreshCw,
  FileText, AlertCircle, Clock, History, Shield, Share2, Tag, BarChart2,
  Save, RotateCcw, AlertTriangle, Check, Copy,
  Loader2, Settings, List, ChevronRight
} from 'lucide-react';

// ─── Types ─────────────────────────────────────────────────────────────────

interface SeoConfig {
  pageKey: string;
  path: string;
  title: string;
  description: string;
  keywords: string;
  canonical: string;
  ogTitle: string;
  ogDescription: string;
  ogImage: string;
  twitterCard: string;
  robots: string;
  schema: string;
  publishedAt?: string;
  history?: SeoHistoryEntry[];
}

interface SeoHistoryEntry {
  savedAt: string;
  title: string;
  description: string;
  keywords: string;
  canonical: string;
  robots: string;
}

interface SeoScore {
  total: number;
  items: { label: string; pass: boolean; tip: string }[];
}

// ─── Pages ─────────────────────────────────────────────────────────────────

const PAGES = [
  { key: 'home',          label: 'Home',          path: '/',              icon: '🏠' },
  { key: 'projects',      label: 'Projects',       path: '/projects',      icon: '💼' },
  { key: 'about',         label: 'About',          path: '/about',         icon: '👥' },
  { key: 'contact',       label: 'Contact',        path: '/contact',       icon: '📬' },
  { key: 'start-project', label: 'Start Project',  path: '/start-project', icon: '🚀' },
];

// ─── SEO Scorer ─────────────────────────────────────────────────────────────

function computeSeoScore(cfg: SeoConfig): SeoScore {
  const items = [
    {
      label: 'Title length (30-60 chars)',
      pass: cfg.title.length >= 30 && cfg.title.length <= 60,
      tip: `Current: ${cfg.title.length} chars. Aim for 30-60.`
    },
    {
      label: 'Description (120-160 chars)',
      pass: cfg.description.length >= 120 && cfg.description.length <= 160,
      tip: `Current: ${cfg.description.length} chars. Aim for 120-160.`
    },
    {
      label: 'Keywords defined (3+)',
      pass: cfg.keywords.trim().length > 0 && cfg.keywords.split(',').length >= 3,
      tip: 'Add at least 3 comma-separated keywords.'
    },
    {
      label: 'Canonical URL (https)',
      pass: cfg.canonical.startsWith('https://'),
      tip: 'Canonical URL must start with https://'
    },
    {
      label: 'OG title defined',
      pass: cfg.ogTitle.length >= 10,
      tip: 'OpenGraph title is used when shared on social media.'
    },
    {
      label: 'OG description (50+ chars)',
      pass: cfg.ogDescription.length >= 50,
      tip: 'OG description should be at least 50 characters.'
    },
    {
      label: 'OG image (https URL)',
      pass: cfg.ogImage.startsWith('https://'),
      tip: 'Use an absolute HTTPS URL for OG image (1200x630px).'
    },
    {
      label: 'Robots: index, follow',
      pass: cfg.robots === 'index, follow',
      tip: `Current: "${cfg.robots}". Use "index, follow" for public pages.`
    },
    {
      label: 'Schema.org type selected',
      pass: !!cfg.schema && cfg.schema !== 'None',
      tip: 'Structured data helps Google show rich results.'
    },
    {
      label: 'Brand name in title',
      pass: cfg.title.toLowerCase().includes('digiexplode'),
      tip: 'Include the brand name in the page title.'
    }
  ];
  const passed = items.filter(i => i.pass).length;
  return { total: Math.round((passed / items.length) * 100), items };
}

// ─── Generators ─────────────────────────────────────────────────────────────

function buildSitemap(): string {
  const d = new Date().toISOString().split('T')[0];
  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url><loc>https://digiexplode.ai/</loc><lastmod>${d}</lastmod><changefreq>weekly</changefreq><priority>1.0</priority></url>
  <url><loc>https://digiexplode.ai/projects</loc><lastmod>${d}</lastmod><changefreq>weekly</changefreq><priority>0.9</priority></url>
  <url><loc>https://digiexplode.ai/about</loc><lastmod>${d}</lastmod><changefreq>monthly</changefreq><priority>0.8</priority></url>
  <url><loc>https://digiexplode.ai/contact</loc><lastmod>${d}</lastmod><changefreq>monthly</changefreq><priority>0.8</priority></url>
  <url><loc>https://digiexplode.ai/start-project</loc><lastmod>${d}</lastmod><changefreq>monthly</changefreq><priority>0.95</priority></url>
</urlset>`;
}

function buildRobots(): string {
  return 'User-agent: *\nAllow: /\nDisallow: /admin\nDisallow: /portal\nDisallow: /attendance\n\nSitemap: https://digiexplode.ai/sitemap.xml';
}

function downloadFile(content: string, filename: string, type: string) {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = filename; a.click();
  URL.revokeObjectURL(url);
}

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  const hrs = Math.floor(mins / 60);
  const days = Math.floor(hrs / 24);
  if (days > 0) return `${days}d ago`;
  if (hrs > 0) return `${hrs}h ago`;
  if (mins > 0) return `${mins}m ago`;
  return 'Just now';
}

// ─── Component ───────────────────────────────────────────────────────────────

export const SEOStudioView: React.FC = () => {
  const [activePageKey, setActivePageKey] = useState<string>('home');
  const [allConfigs, setAllConfigs] = useState<Record<string, SeoConfig>>({});
  const [form, setForm] = useState<SeoConfig | null>(null);
  const [isDirty, setIsDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'success' | 'error'>('idle');
  const [loadingPage, setLoadingPage] = useState(false);
  const [activeTab, setActiveTab] = useState<'meta' | 'social' | 'schema' | 'technical' | 'history'>('meta');
  const [pageHistory, setPageHistory] = useState<SeoHistoryEntry[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [copiedTag, setCopiedTag] = useState('');
  const [verifying, setVerifying] = useState(false);
  const [verifyResult, setVerifyResult] = useState<{ ok: boolean; msg: string } | null>(null);
  const [showSerpMobile, setShowSerpMobile] = useState(false);
  const prevPageKey = useRef<string>('');

  // Load all configs on mount
  useEffect(() => {
    fetch('/api/seo')
      .then(r => r.json())
      .then(data => {
        setAllConfigs(data);
        if (data['home']) setForm(data['home']);
      })
      .catch(() => {});
  }, []);

  // Switch page
  useEffect(() => {
    if (prevPageKey.current === activePageKey) return;
    prevPageKey.current = activePageKey;
    setIsDirty(false);
    setSaveStatus('idle');
    setVerifyResult(null);
    setActiveTab('meta');
    setLoadingPage(true);
    fetch(`/api/seo/${activePageKey}`)
      .then(r => r.json())
      .then(data => {
        setForm(data);
        setAllConfigs(prev => ({ ...prev, [activePageKey]: data }));
      })
      .catch(() => {})
      .finally(() => setLoadingPage(false));
  }, [activePageKey]);

  // Load history
  const loadHistory = useCallback(() => {
    setLoadingHistory(true);
    fetch(`/api/seo/${activePageKey}/history`)
      .then(r => r.json())
      .then(data => setPageHistory(data.history || []))
      .catch(() => setPageHistory([]))
      .finally(() => setLoadingHistory(false));
  }, [activePageKey]);

  useEffect(() => {
    if (activeTab === 'history') loadHistory();
  }, [activeTab, loadHistory]);

  // Form field update
  const update = (field: keyof SeoConfig, value: string) => {
    setForm(prev => prev ? { ...prev, [field]: value } : prev);
    setIsDirty(true);
    setSaveStatus('idle');
  };

  // Save & Publish
  const handleSave = async () => {
    if (!form) return;
    setSaving(true);
    setSaveStatus('idle');
    try {
      const res = await fetch(`/api/seo/${activePageKey}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form)
      });
      if (!res.ok) throw new Error('Save failed');
      const data = await res.json();
      setForm(data.config);
      setAllConfigs(prev => ({ ...prev, [activePageKey]: data.config }));
      setIsDirty(false);
      setSaveStatus('success');
      setTimeout(() => setSaveStatus('idle'), 4000);
    } catch {
      setSaveStatus('error');
    } finally {
      setSaving(false);
    }
  };

  // Restore revision
  const handleRestore = async (index: number) => {
    const res = await fetch(`/api/seo/${activePageKey}/restore/${index}`, { method: 'POST' });
    if (!res.ok) return;
    const data = await res.json();
    setForm(data.config);
    setAllConfigs(prev => ({ ...prev, [activePageKey]: data.config }));
    setIsDirty(false);
    setActiveTab('meta');
  };

  // Verify live output
  const handleVerify = async () => {
    if (!form) return;
    setVerifying(true);
    setVerifyResult(null);
    try {
      const apiRes = await fetch(`/api/seo/${activePageKey}`);
      const live = await apiRes.json();
      const matches = live.title === form.title && live.description === form.description;
      setVerifyResult({
        ok: matches,
        msg: matches
          ? `✅ Live config verified for "${activePageKey === 'home' ? '/' : '/' + activePageKey}"`
          : '⚠️ Unsaved changes detected. Click Save & Publish to sync live metadata.'
      });
    } catch {
      setVerifyResult({ ok: false, msg: '❌ Could not reach the server.' });
    } finally {
      setVerifying(false);
    }
  };

  // Copy to clipboard
  const copyTag = (tag: string, value: string) => {
    navigator.clipboard.writeText(value).catch(() => {});
    setCopiedTag(tag);
    setTimeout(() => setCopiedTag(''), 2000);
  };

  if (!form) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-indigo-500" />
      </div>
    );
  }

  const score = computeSeoScore(form);
  const scoreGrad = score.total >= 80 ? 'from-emerald-500 to-teal-400' : score.total >= 60 ? 'from-amber-400 to-orange-500' : 'from-red-500 to-rose-400';
  const scoreBadge = score.total >= 80 ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400' : score.total >= 60 ? 'bg-amber-400/10 border-amber-400/20 text-amber-400' : 'bg-red-500/10 border-red-500/20 text-red-400';

  const metaHtml = [
    `<title>${form.title}</title>`,
    `<meta name="description" content="${form.description}" />`,
    `<meta name="keywords" content="${form.keywords}" />`,
    `<link rel="canonical" href="${form.canonical}" />`,
    `<meta name="robots" content="${form.robots}" />`,
  ].join('\n');

  const ogHtml = [
    `<meta property="og:title" content="${form.ogTitle}" />`,
    `<meta property="og:description" content="${form.ogDescription}" />`,
    `<meta property="og:image" content="${form.ogImage}" />`,
    `<meta property="og:type" content="website" />`,
    `<meta name="twitter:card" content="${form.twitterCard}" />`,
    `<meta name="twitter:title" content="${form.ogTitle}" />`,
    `<meta name="twitter:description" content="${form.ogDescription}" />`,
  ].join('\n');

  const tabs = [
    { key: 'meta' as const,      label: 'Meta Tags',   icon: '🏷️' },
    { key: 'social' as const,    label: 'Social / OG', icon: '📣' },
    { key: 'schema' as const,    label: 'Schema',      icon: '🧩' },
    { key: 'technical' as const, label: 'Technical',   icon: '⚙️' },
    { key: 'history' as const,   label: 'History',     icon: '🕐' },
  ];

  return (
    <div className="space-y-5">

      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-gradient-to-br from-indigo-500 to-violet-600 rounded-xl text-white shadow-lg shadow-indigo-500/25">
            <Globe className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
              SEO &amp; Meta Studio
              <span className="text-[10px] font-black uppercase tracking-widest px-2 py-0.5 bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 rounded-full">Live</span>
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">Real-time metadata control · SERP preview · SEO audit · Revision history</p>
          </div>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <button onClick={() => downloadFile(buildSitemap(), 'sitemap.xml', 'text/xml')}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 rounded-lg text-xs font-semibold hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors">
            <Download className="w-3 h-3" /> sitemap.xml
          </button>
          <button onClick={() => downloadFile(buildRobots(), 'robots.txt', 'text/plain')}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 rounded-lg text-xs font-semibold hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors">
            <FileText className="w-3 h-3" /> robots.txt
          </button>
          <button onClick={() => downloadFile(metaHtml + '\n' + ogHtml, `${activePageKey}-meta.html`, 'text/html')}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 rounded-lg text-xs font-semibold hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors">
            <Code className="w-3 h-3" /> Export HTML
          </button>
        </div>
      </div>

      {/* Main Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">

        {/* LEFT COL */}
        <div className="lg:col-span-3 space-y-4">

          {/* Page Selector */}
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
            <div className="px-4 pt-4 pb-2">
              <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 flex items-center gap-1.5">
                <List className="w-3 h-3" /> Website Pages
              </p>
            </div>
            <div className="p-2 space-y-1">
              {PAGES.map(pg => {
                const pgCfg = allConfigs[pg.key];
                const pgScore = pgCfg ? computeSeoScore(pgCfg).total : 0;
                const isActive = activePageKey === pg.key;
                return (
                  <button key={pg.key} onClick={() => setActivePageKey(pg.key)}
                    className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-left transition-all ${
                      isActive
                        ? 'bg-gradient-to-r from-indigo-600 to-violet-600 text-white shadow-lg shadow-indigo-500/20'
                        : 'hover:bg-slate-50 dark:hover:bg-slate-800/60 text-slate-700 dark:text-slate-300'
                    }`}>
                    <span className="text-base">{pg.icon}</span>
                    <div className="flex-1 min-w-0">
                      <div className="text-xs font-bold truncate">{pg.label}</div>
                      <div className={`text-[10px] font-mono ${isActive ? 'text-indigo-100' : 'text-slate-400'}`}>{pg.path}</div>
                    </div>
                    <span className={`text-[10px] font-black px-1.5 py-0.5 rounded-full ${
                      isActive ? 'bg-white/20 text-white' :
                      pgScore >= 80 ? 'bg-emerald-500/15 text-emerald-400' :
                      pgScore >= 60 ? 'bg-amber-400/15 text-amber-400' :
                                     'bg-red-500/15 text-red-400'
                    }`}>{pgScore}%</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* SEO Score */}
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm p-4 space-y-3">
            <div className="flex items-center justify-between">
              <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 flex items-center gap-1.5">
                <BarChart2 className="w-3 h-3 text-indigo-400" /> SEO Score
              </p>
              <span className={`text-[10px] px-2 py-0.5 rounded-full border ${scoreBadge} font-bold`}>
                {score.total >= 80 ? 'Excellent' : score.total >= 60 ? 'Good' : 'Needs Work'}
              </span>
            </div>
            <div className="flex items-center gap-3">
              <div className={`w-16 h-16 rounded-full bg-gradient-to-tr ${scoreGrad} text-white flex items-center justify-center text-xl font-extrabold shadow-md flex-shrink-0`}>
                {score.total}
              </div>
              <div className="flex-1">
                <div className="h-1.5 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                  <div className={`h-full bg-gradient-to-r ${scoreGrad} rounded-full transition-all duration-700`} style={{ width: `${score.total}%` }} />
                </div>
                <p className="text-[10px] text-slate-400 mt-1">{score.items.filter(i => i.pass).length}/{score.items.length} checks passed</p>
              </div>
            </div>
            <div className="space-y-1.5 max-h-52 overflow-y-auto">
              {score.items.map((item, i) => (
                <div key={i} className={`flex items-start gap-2 text-[11px] ${item.pass ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-500 dark:text-red-400'}`}>
                  {item.pass
                    ? <CheckCircle className="w-3.5 h-3.5 mt-0.5 flex-shrink-0" />
                    : <AlertCircle className="w-3.5 h-3.5 mt-0.5 flex-shrink-0" />
                  }
                  <div>
                    <span className="font-semibold">{item.label}</span>
                    {!item.pass && <p className="text-[10px] text-slate-400 mt-0.5 leading-relaxed">{item.tip}</p>}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Verify Live */}
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm p-4 space-y-3">
            <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 flex items-center gap-1.5">
              <Shield className="w-3 h-3 text-indigo-400" /> Live Verification
            </p>
            <button onClick={handleVerify} disabled={verifying}
              className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-indigo-50 dark:bg-indigo-950/50 text-indigo-600 dark:text-indigo-400 border border-indigo-200 dark:border-indigo-800/60 rounded-xl text-xs font-bold hover:bg-indigo-100 transition-colors disabled:opacity-50">
              {verifying ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
              {verifying ? 'Verifying...' : 'Verify Live Output'}
            </button>
            {verifyResult && (
              <div className={`p-3 rounded-xl text-xs border leading-relaxed ${
                verifyResult.ok
                  ? 'bg-emerald-50 dark:bg-emerald-950/30 border-emerald-200 dark:border-emerald-800/40 text-emerald-700 dark:text-emerald-300'
                  : 'bg-amber-50 dark:bg-amber-950/30 border-amber-200 dark:border-amber-800/40 text-amber-700 dark:text-amber-300'
              }`}>{verifyResult.msg}</div>
            )}
            {form.publishedAt && (
              <p className="text-[10px] text-slate-400 flex items-center gap-1">
                <Clock className="w-3 h-3" /> Published: {timeAgo(form.publishedAt)}
              </p>
            )}
          </div>
        </div>

        {/* RIGHT COL */}
        <div className="lg:col-span-9 space-y-4">

          {/* SERP Preview */}
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm p-5 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 flex items-center gap-2">
                <Search className="w-3.5 h-3.5 text-emerald-500" /> Google SERP Preview
              </h3>
              <div className="flex items-center bg-slate-100 dark:bg-slate-800 rounded-lg p-0.5">
                <button onClick={() => setShowSerpMobile(false)}
                  className={`px-3 py-1 rounded-md text-[10px] font-semibold transition-all ${!showSerpMobile ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-sm' : 'text-slate-500'}`}>
                  Desktop
                </button>
                <button onClick={() => setShowSerpMobile(true)}
                  className={`px-3 py-1 rounded-md text-[10px] font-semibold transition-all ${showSerpMobile ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-sm' : 'text-slate-500'}`}>
                  Mobile
                </button>
              </div>
            </div>

            <div className={`bg-white dark:bg-[#1a1c2e] rounded-xl border border-slate-100 dark:border-slate-800/60 p-5 font-sans ${showSerpMobile ? 'max-w-sm' : 'max-w-2xl'}`}>
              <div className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-400 mb-1">
                <div className="w-5 h-5 rounded-full bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center text-white text-[9px] font-black flex-shrink-0">D</div>
                <span className="font-medium text-slate-700 dark:text-slate-300">DigiexplodeAI</span>
                <ChevronRight className="w-3 h-3 text-slate-400" />
                <span className="text-xs text-slate-500">{PAGES.find(p => p.key === activePageKey)?.path}</span>
              </div>
              <div className={`text-[#1a0dab] dark:text-[#8ab4f8] hover:underline cursor-pointer font-normal leading-snug line-clamp-2 ${showSerpMobile ? 'text-base' : 'text-xl'}`}>
                {form.title || 'Page Title Here'}
              </div>
              <div className={`text-slate-600 dark:text-[#bdc1c6] leading-relaxed mt-1 ${showSerpMobile ? 'text-xs line-clamp-3' : 'text-sm line-clamp-2 max-w-xl'}`}>
                {form.description || 'Meta description placeholder text.'}
              </div>
            </div>

            <div>
              <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-2">Twitter / X Card Preview</p>
              <div className="rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden max-w-xs">
                <div className="h-20 bg-gradient-to-br from-slate-100 to-slate-200 dark:from-slate-800 dark:to-slate-700 flex items-center justify-center">
                  <span className="text-slate-400 text-xs">OG Image Preview (1200x630px)</span>
                </div>
                <div className="p-3 bg-white dark:bg-slate-900">
                  <div className="text-[10px] text-slate-400 uppercase mb-0.5">digiexplode.ai</div>
                  <div className="text-xs font-semibold text-slate-800 dark:text-white line-clamp-1">{form.ogTitle}</div>
                  <div className="text-[10px] text-slate-500 line-clamp-2 mt-0.5">{form.ogDescription}</div>
                </div>
              </div>
            </div>
          </div>

          {/* Editor Card */}
          <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">

            {/* Tab Bar */}
            <div className="flex items-center border-b border-slate-200 dark:border-slate-800 px-4 pt-3 overflow-x-auto gap-0.5">
              {tabs.map(tab => (
                <button key={tab.key} onClick={() => setActiveTab(tab.key)}
                  className={`flex items-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-t-lg whitespace-nowrap transition-all border-b-2 -mb-px ${
                    activeTab === tab.key
                      ? 'border-indigo-500 text-indigo-600 dark:text-indigo-400 bg-indigo-50/50 dark:bg-indigo-950/30'
                      : 'border-transparent text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'
                  }`}>
                  <span>{tab.icon}</span> {tab.label}
                </button>
              ))}
            </div>

            {loadingPage ? (
              <div className="flex items-center justify-center h-32">
                <Loader2 className="w-6 h-6 animate-spin text-indigo-500" />
              </div>
            ) : (
              <div className="p-5">

                {/* META TAGS TAB */}
                {activeTab === 'meta' && (
                  <div className="space-y-4">
                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <label className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">Page Title</label>
                        <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${
                          form.title.length >= 30 && form.title.length <= 60
                            ? 'bg-emerald-100 dark:bg-emerald-950/30 text-emerald-600 dark:text-emerald-400'
                            : 'bg-amber-100 dark:bg-amber-950/30 text-amber-600 dark:text-amber-400'
                        }`}>{form.title.length}/60</span>
                      </div>
                      <input type="text" value={form.title} onChange={e => update('title', e.target.value)}
                        className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 rounded-xl text-sm text-slate-900 dark:text-white focus:outline-none focus:border-indigo-500 transition-colors" />
                    </div>

                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <label className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">Meta Description</label>
                        <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${
                          form.description.length >= 120 && form.description.length <= 160
                            ? 'bg-emerald-100 dark:bg-emerald-950/30 text-emerald-600 dark:text-emerald-400'
                            : 'bg-amber-100 dark:bg-amber-950/30 text-amber-600 dark:text-amber-400'
                        }`}>{form.description.length}/160</span>
                      </div>
                      <textarea rows={3} value={form.description} onChange={e => update('description', e.target.value)}
                        className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 rounded-xl text-sm text-slate-900 dark:text-white focus:outline-none focus:border-indigo-500 transition-colors resize-none" />
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1">
                          Keywords <span className="font-normal normal-case text-slate-400">(comma separated)</span>
                        </label>
                        <input type="text" value={form.keywords} onChange={e => update('keywords', e.target.value)}
                          className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 rounded-xl text-sm text-slate-900 dark:text-white focus:outline-none focus:border-indigo-500 transition-colors" />
                        <div className="flex flex-wrap gap-1.5 mt-2">
                          {form.keywords.split(',').filter(k => k.trim()).map((k, i) => (
                            <span key={i} className="text-[10px] px-2 py-0.5 bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 border border-indigo-200 dark:border-indigo-800/50 rounded-full">
                              {k.trim()}
                            </span>
                          ))}
                        </div>
                      </div>
                      <div>
                        <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1">Canonical URL</label>
                        <input type="url" value={form.canonical} onChange={e => update('canonical', e.target.value)}
                          className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-mono text-slate-900 dark:text-white focus:outline-none focus:border-indigo-500 transition-colors" />
                      </div>
                    </div>

                    <div className="bg-slate-950 rounded-xl p-4">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-[10px] text-slate-400 font-mono">Generated HTML</span>
                        <button onClick={() => copyTag('html', metaHtml)}
                          className="flex items-center gap-1 text-[10px] text-slate-400 hover:text-indigo-400 transition-colors">
                          {copiedTag === 'html' ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                          {copiedTag === 'html' ? 'Copied!' : 'Copy'}
                        </button>
                      </div>
                      <pre className="text-[10px] text-emerald-400 overflow-x-auto leading-relaxed whitespace-pre-wrap">{metaHtml}</pre>
                    </div>
                  </div>
                )}

                {/* SOCIAL / OG TAB */}
                {activeTab === 'social' && (
                  <div className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1">OG Title</label>
                        <input type="text" value={form.ogTitle} onChange={e => update('ogTitle', e.target.value)}
                          className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 rounded-xl text-sm text-slate-900 dark:text-white focus:outline-none focus:border-indigo-500" />
                      </div>
                      <div>
                        <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1">Twitter Card Type</label>
                        <select value={form.twitterCard} onChange={e => update('twitterCard', e.target.value)}
                          className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 rounded-xl text-sm text-slate-900 dark:text-white focus:outline-none focus:border-indigo-500">
                          <option value="summary_large_image">Summary Large Image</option>
                          <option value="summary">Summary</option>
                          <option value="app">App</option>
                          <option value="player">Player</option>
                        </select>
                      </div>
                      <div className="md:col-span-2">
                        <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1">OG Description</label>
                        <textarea rows={2} value={form.ogDescription} onChange={e => update('ogDescription', e.target.value)}
                          className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 rounded-xl text-sm text-slate-900 dark:text-white focus:outline-none focus:border-indigo-500 resize-none" />
                      </div>
                      <div className="md:col-span-2">
                        <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1">
                          OG Image URL <span className="font-normal normal-case text-slate-400">(1200x630px recommended)</span>
                        </label>
                        <input type="url" value={form.ogImage} onChange={e => update('ogImage', e.target.value)}
                          className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-mono text-slate-900 dark:text-white focus:outline-none focus:border-indigo-500" />
                      </div>
                    </div>
                    <div className="bg-slate-950 rounded-xl p-4">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-[10px] text-slate-400 font-mono">OpenGraph + Twitter Tags</span>
                        <button onClick={() => copyTag('og', ogHtml)}
                          className="flex items-center gap-1 text-[10px] text-slate-400 hover:text-indigo-400 transition-colors">
                          {copiedTag === 'og' ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />} Copy
                        </button>
                      </div>
                      <pre className="text-[10px] text-emerald-400 overflow-x-auto leading-relaxed whitespace-pre-wrap">{ogHtml}</pre>
                    </div>
                  </div>
                )}

                {/* SCHEMA TAB */}
                {activeTab === 'schema' && (
                  <div className="space-y-4">
                    <div>
                      <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1">Schema.org Type</label>
                      <select value={form.schema} onChange={e => update('schema', e.target.value)}
                        className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 rounded-xl text-sm text-slate-900 dark:text-white focus:outline-none focus:border-indigo-500">
                        <option value="None">None</option>
                        <option value="Organization">Organization</option>
                        <option value="WebSite">WebSite</option>
                        <option value="WebPage">WebPage</option>
                        <option value="AboutPage">AboutPage</option>
                        <option value="ContactPage">ContactPage</option>
                        <option value="ItemList">ItemList</option>
                        <option value="WebApplication">WebApplication</option>
                        <option value="LocalBusiness">LocalBusiness</option>
                        <option value="Service">Service</option>
                        <option value="FAQPage">FAQPage</option>
                      </select>
                    </div>
                    {form.schema && form.schema !== 'None' && (() => {
                      const schemaObj: Record<string, unknown> = {
                        '@context': 'https://schema.org',
                        '@type': form.schema,
                        name: 'DigiexplodeAI',
                        url: form.canonical,
                        description: form.description,
                      };
                      if (form.schema === 'Organization') {
                        schemaObj['logo'] = 'https://digiexplode.ai/logo.png';
                        schemaObj['sameAs'] = ['https://twitter.com/digiexplodeai', 'https://linkedin.com/company/digiexplodeai'];
                      }
                      const jsonStr = JSON.stringify(schemaObj, null, 2);
                      return (
                        <div className="bg-slate-950 rounded-xl p-4">
                          <div className="flex items-center justify-between mb-2">
                            <span className="text-[10px] text-slate-400 font-mono">JSON-LD Output</span>
                            <button onClick={() => copyTag('schema', jsonStr)}
                              className="flex items-center gap-1 text-[10px] text-slate-400 hover:text-indigo-400 transition-colors">
                              {copiedTag === 'schema' ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />} Copy
                            </button>
                          </div>
                          <pre className="text-[10px] text-emerald-400 overflow-x-auto leading-relaxed">{jsonStr}</pre>
                        </div>
                      );
                    })()}
                    <div className="p-4 bg-indigo-50 dark:bg-indigo-950/30 border border-indigo-200 dark:border-indigo-800/50 rounded-xl">
                      <p className="text-xs text-indigo-700 dark:text-indigo-300 leading-relaxed">
                        Schema.org structured data helps Google display rich results (knowledge panels, breadcrumbs). Place the JSON-LD inside a{' '}
                        <code className="font-mono bg-indigo-100 dark:bg-indigo-900 px-1 rounded text-[10px]">script type="application/ld+json"</code> tag in the page head.
                      </p>
                    </div>
                  </div>
                )}

                {/* TECHNICAL TAB */}
                {activeTab === 'technical' && (
                  <div className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1">Robots Directive</label>
                        <select value={form.robots} onChange={e => update('robots', e.target.value)}
                          className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 rounded-xl text-sm text-slate-900 dark:text-white focus:outline-none focus:border-indigo-500">
                          <option value="index, follow">index, follow (Default)</option>
                          <option value="noindex, follow">noindex, follow</option>
                          <option value="index, nofollow">index, nofollow</option>
                          <option value="noindex, nofollow">noindex, nofollow</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1">Canonical URL</label>
                        <input type="url" value={form.canonical} onChange={e => update('canonical', e.target.value)}
                          className="w-full px-4 py-2.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-mono text-slate-900 dark:text-white focus:outline-none focus:border-indigo-500" />
                      </div>
                    </div>

                    <div className="border border-slate-200 dark:border-slate-700 rounded-xl overflow-hidden">
                      <div className="px-4 py-2 bg-slate-50 dark:bg-slate-800/50 border-b border-slate-200 dark:border-slate-700">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">All Pages SEO Overview</span>
                      </div>
                      <div className="divide-y divide-slate-100 dark:divide-slate-800">
                        {PAGES.map(pg => {
                          const pgCfg = allConfigs[pg.key];
                          const pgScore = pgCfg ? computeSeoScore(pgCfg).total : 0;
                          return (
                            <div key={pg.key} className="flex items-center justify-between px-4 py-2.5 hover:bg-slate-50 dark:hover:bg-slate-800/30 transition-colors">
                              <div className="flex items-center gap-2 text-xs text-slate-700 dark:text-slate-300">
                                <span>{pg.icon}</span>
                                <span className="font-medium">{pg.label}</span>
                                <span className="font-mono text-slate-400 text-[10px]">{pg.path}</span>
                              </div>
                              <div className="flex items-center gap-3">
                                <div className="flex items-center gap-1.5">
                                  <div className="h-1.5 w-16 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
                                    <div className={`h-full rounded-full ${pgScore >= 80 ? 'bg-emerald-500' : pgScore >= 60 ? 'bg-amber-400' : 'bg-red-500'}`}
                                      style={{ width: `${pgScore}%` }} />
                                  </div>
                                  <span className={`font-bold text-[10px] ${pgScore >= 80 ? 'text-emerald-500' : pgScore >= 60 ? 'text-amber-400' : 'text-red-500'}`}>{pgScore}%</span>
                                </div>
                                <button onClick={() => setActivePageKey(pg.key)}
                                  className="text-[10px] text-indigo-500 hover:underline">Edit</button>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>

                    <div className="border border-slate-200 dark:border-slate-700 rounded-xl p-4 space-y-3">
                      <h4 className="text-xs font-bold text-slate-700 dark:text-slate-300">Generated Files</h4>
                      <div className="grid grid-cols-2 gap-3">
                        <button onClick={() => downloadFile(buildSitemap(), 'sitemap.xml', 'text/xml')}
                          className="flex items-center justify-center gap-2 px-4 py-2.5 bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400 border border-indigo-200 dark:border-indigo-800/50 rounded-xl text-xs font-bold hover:bg-indigo-100 transition-colors">
                          <Download className="w-3.5 h-3.5" /> Download sitemap.xml
                        </button>
                        <button onClick={() => downloadFile(buildRobots(), 'robots.txt', 'text/plain')}
                          className="flex items-center justify-center gap-2 px-4 py-2.5 bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700 rounded-xl text-xs font-bold hover:bg-slate-100 transition-colors">
                          <FileText className="w-3.5 h-3.5" /> Download robots.txt
                        </button>
                      </div>
                    </div>
                  </div>
                )}

                {/* HISTORY TAB */}
                {activeTab === 'history' && (
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <p className="text-xs text-slate-500 dark:text-slate-400">
                        Revision history — <span className="font-bold text-slate-700 dark:text-slate-300 capitalize">{activePageKey}</span>
                      </p>
                      <button onClick={loadHistory} className="flex items-center gap-1 text-xs text-indigo-500 hover:underline">
                        <RefreshCw className="w-3 h-3" /> Refresh
                      </button>
                    </div>
                    {loadingHistory && (
                      <div className="flex items-center justify-center h-24">
                        <Loader2 className="w-5 h-5 animate-spin text-indigo-500" />
                      </div>
                    )}
                    {!loadingHistory && pageHistory.length === 0 && (
                      <div className="flex flex-col items-center justify-center h-32 text-slate-400 gap-2">
                        <History className="w-8 h-8 opacity-30" />
                        <p className="text-xs text-center">No revision history yet. Save changes to create the first revision.</p>
                      </div>
                    )}
                    {!loadingHistory && pageHistory.map((entry, i) => (
                      <div key={i} className="border border-slate-200 dark:border-slate-700 rounded-xl p-4 space-y-2 hover:border-indigo-300 dark:hover:border-indigo-700 transition-colors">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2 text-[10px] text-slate-400">
                            <Clock className="w-3 h-3" />
                            <span>{new Date(entry.savedAt).toLocaleString()}</span>
                            <span>·</span>
                            <span>{timeAgo(entry.savedAt)}</span>
                          </div>
                          <button onClick={() => handleRestore(pageHistory.length - 1 - i)}
                            className="flex items-center gap-1 text-[10px] font-semibold text-indigo-600 dark:text-indigo-400 px-2 py-1 bg-indigo-50 dark:bg-indigo-950/40 rounded-lg border border-indigo-200 dark:border-indigo-800/50 hover:bg-indigo-100 transition-colors">
                            <RotateCcw className="w-3 h-3" /> Restore
                          </button>
                        </div>
                        <p className="text-xs font-semibold text-slate-800 dark:text-white line-clamp-1">{entry.title}</p>
                        <p className="text-[11px] text-slate-500 dark:text-slate-400 line-clamp-2">{entry.description}</p>
                      </div>
                    ))}
                  </div>
                )}

              </div>
            )}

            {/* Save Bar */}
            {!loadingPage && (
              <div className={`border-t border-slate-200 dark:border-slate-800 px-5 py-3 flex items-center justify-between transition-all ${isDirty ? 'bg-amber-50/40 dark:bg-amber-950/10' : ''}`}>
                <div>
                  {isDirty && (
                    <span className="flex items-center gap-1.5 text-xs text-amber-600 dark:text-amber-400 font-semibold">
                      <AlertTriangle className="w-3.5 h-3.5" /> Unsaved changes
                    </span>
                  )}
                  {saveStatus === 'success' && (
                    <span className="flex items-center gap-1.5 text-xs text-emerald-600 dark:text-emerald-400 font-semibold">
                      <CheckCircle className="w-3.5 h-3.5" /> Saved &amp; Published to server
                    </span>
                  )}
                  {saveStatus === 'error' && (
                    <span className="flex items-center gap-1.5 text-xs text-red-500 font-semibold">
                      <AlertCircle className="w-3.5 h-3.5" /> Save failed — check server
                    </span>
                  )}
                </div>
                <button onClick={handleSave} disabled={saving || !isDirty}
                  className={`flex items-center gap-2 px-5 py-2 rounded-xl text-xs font-bold transition-all ${
                    isDirty
                      ? 'bg-gradient-to-r from-indigo-600 to-violet-600 text-white hover:shadow-lg hover:shadow-indigo-500/25 hover:-translate-y-0.5 active:translate-y-0'
                      : 'bg-slate-100 dark:bg-slate-800 text-slate-400 cursor-not-allowed'
                  }`}>
                  {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
                  {saving ? 'Publishing...' : 'Save & Publish'}
                </button>
              </div>
            )}

          </div>
        </div>
      </div>
    </div>
  );
};

export default SEOStudioView;
