import express from 'express';
import path from 'path';
import fs from 'fs';
import { createServer as createViteServer } from 'vite';
import { GoogleGenAI, Type } from '@google/genai';

const app = express();
const PORT = 3000;

app.use(express.json({ limit: '50mb' }));

// Initialize Gemini SDK
const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY || '',
  httpOptions: {
    headers: {
      'User-Agent': 'aistudio-build',
    }
  }
});

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', hasGeminiKey: !!process.env.GEMINI_API_KEY });
});


/**
 * Intelligent Rule-Based Natural Language Engine for English, Hindi, and Hinglish instructions.
 * Used when Gemini API key is not configured or as instant robust fallback.
 */
function parseInstructionNLP(
  instruction: string, 
  clients: any[] = [], 
  employees: any[] = [], 
  currentDateStr: string = new Date().toISOString()
) {
  const text = instruction.trim();
  const lower = text.toLowerCase();
  const refDate = new Date(currentDateStr);

  // 1. MATCH CLIENT
  let matchedClient: any = null;
  for (const c of clients) {
    const cName = (c.clientName || '').toLowerCase();
    const bName = (c.businessName || '').toLowerCase();
    
    // Check direct substring
    if (cName && lower.includes(cName)) {
      matchedClient = c;
      break;
    }
    if (bName && lower.includes(bName)) {
      matchedClient = c;
      break;
    }

    // Token matching (e.g. "puneet" in "Dr. Puneet Kumar", "gangotri" in "Gangotri Ice Cubes", "sankalp", "akash", "anupam")
    const tokens = cName.split(/[\s\.\-_]+/).filter((t: string) => t.length > 2 && !['dr', 'the', 'inc', 'co', 'ltd'].includes(t));
    for (const token of tokens) {
      if (lower.includes(token)) {
        matchedClient = c;
        break;
      }
    }
    if (matchedClient) break;
  }

  const clientId = matchedClient ? matchedClient.clientId : '';
  const clientName = matchedClient ? matchedClient.clientName : (clients[0]?.clientName || 'General Campaign');

  // 2. DETECT FORMAT
  let format = 'Static Post';
  let category = 'Social Media';
  let primaryPlatform = 'Instagram';

  if (/reel|reels|short|shorts|video|videos|clip/i.test(lower)) {
    format = /short|shorts/i.test(lower) ? 'YouTube Short' : 'Reel';
    category = 'Video Production';
  } else if (/carousel|carousels|slides|slide/i.test(lower)) {
    format = 'Carousel';
    category = 'Graphic Design';
  } else if (/story|stories/i.test(lower)) {
    format = 'Story';
    category = 'Social Media';
  } else if (/website|webpage|landing page|seo/i.test(lower)) {
    format = 'Website Work';
    category = 'Website';
    primaryPlatform = 'Website';
  } else if (/gmb|google business/i.test(lower)) {
    format = 'GMB Post';
    category = 'Social Media';
    primaryPlatform = 'Google Business Profile';
  }

  // 3. DETECT PLATFORMS
  const platforms: string[] = [];
  if (/instagram|insta|ig/i.test(lower)) platforms.push('Instagram');
  if (/facebook|fb/i.test(lower)) platforms.push('Facebook');
  if (/youtube|yt/i.test(lower)) platforms.push('YouTube');
  if (/linkedin/i.test(lower)) platforms.push('LinkedIn');
  if (/gmb|google/i.test(lower) && !platforms.includes('Google Business Profile')) platforms.push('Google Business Profile');
  if (platforms.length === 0) platforms.push(primaryPlatform);

  // 4. DETECT QUANTITY (digits or words in English / Hindi / Hinglish)
  let quantity = 1;
  const numMatch = lower.match(/\b(\d+)\s*(reel|reels|post|posts|carousel|carousels|short|shorts|video|videos|slide|slides|item|items)?\b/);
  if (numMatch && parseInt(numMatch[1], 10) > 0) {
    quantity = Math.min(parseInt(numMatch[1], 10), 12); // Cap at 12 for batch sanity
  } else if (/\b(one|ek|single)\b/i.test(lower)) {
    quantity = 1;
  } else if (/\b(two|do|dono|pair)\b/i.test(lower)) {
    quantity = 2;
  } else if (/\b(three|teen)\b/i.test(lower)) {
    quantity = 3;
  } else if (/\b(four|char|chaar)\b/i.test(lower)) {
    quantity = 4;
  } else if (/\b(five|panch|paanch)\b/i.test(lower)) {
    quantity = 5;
  } else if (/\b(six|chhe|che)\b/i.test(lower)) {
    quantity = 6;
  } else if (/\b(seven|saat)\b/i.test(lower)) {
    quantity = 7;
  } else if (/\b(eight|aath)\b/i.test(lower)) {
    quantity = 8;
  } else if (/\b(nine|nau)\b/i.test(lower)) {
    quantity = 9;
  } else if (/\b(ten|das)\b/i.test(lower)) {
    quantity = 10;
  }

  // 5. DETECT TIMEFRAME & COMPUTE DATES
  const toDateStr = (d: Date) => {
    const yr = d.getFullYear();
    const mo = String(d.getMonth() + 1).padStart(2, '0');
    const dy = String(d.getDate()).padStart(2, '0');
    return `${yr}-${mo}-${dy}`;
  };

  const dates: string[] = [];

  if (/today|aaj/i.test(lower)) {
    for (let i = 0; i < quantity; i++) dates.push(toDateStr(refDate));
  } else if (/tomorrow|kal/i.test(lower) && !/yesterday/i.test(lower)) {
    const tmrw = new Date(refDate);
    tmrw.setDate(tmrw.getDate() + 1);
    for (let i = 0; i < quantity; i++) dates.push(toDateStr(tmrw));
  } else if (/next week|agle hafte|coming week/i.test(lower)) {
    // Distribute across Monday to Friday of next week
    const day = refDate.getDay();
    const daysUntilNextMon = (8 - day) % 7 || 7;
    const nextMon = new Date(refDate);
    nextMon.setDate(nextMon.getDate() + daysUntilNextMon);

    for (let i = 0; i < quantity; i++) {
      const d = new Date(nextMon);
      // Spread evenly across the week
      const step = quantity === 1 ? 0 : Math.floor((i * 6) / Math.max(quantity - 1, 1));
      d.setDate(d.getDate() + step);
      dates.push(toDateStr(d));
    }
  } else if (/this month|is mahine|coming month/i.test(lower)) {
    const endOfMonth = new Date(refDate.getFullYear(), refDate.getMonth() + 1, 0);
    const totalDays = Math.max(endOfMonth.getDate() - refDate.getDate(), 5);
    for (let i = 0; i < quantity; i++) {
      const d = new Date(refDate);
      const step = Math.floor(((i + 1) * totalDays) / (quantity + 1));
      d.setDate(d.getDate() + Math.max(step, 1));
      dates.push(toDateStr(d));
    }
  } else {
    // Default forward distribution: 1 every 2 days
    for (let i = 0; i < quantity; i++) {
      const d = new Date(refDate);
      d.setDate(d.getDate() + (i + 1) * 2);
      dates.push(toDateStr(d));
    }
  }

  // 6. MATCH EMPLOYEE (if mentioned in prompt)
  let matchedEmpId = '';
  let matchedEmpName = '';
  for (const emp of employees) {
    const eName = (emp.name || '').toLowerCase();
    const tokens = eName.split(/[\s\.\-_]+/).filter((t: string) => t.length > 2);
    for (const token of tokens) {
      if (lower.includes(token)) {
        matchedEmpId = emp.employeeId || emp.id;
        matchedEmpName = emp.name;
        break;
      }
    }
    if (matchedEmpId) break;
  }

  // 7. EXTRACT SUBJECT / TOPIC DETAIL
  let cleanedSubject = text
    .replace(/(dr\s+[\w\s]+|gangotri\s+[\w\s]+|bajwa\s+[\w\s]+)/gi, '')
    .replace(/(ke liye|for|plan karo|karo|bana do|banao|chahiye|create|schedule|make)/gi, '')
    .replace(/(\d+|one|two|three|four|five|six|seven|eight|nine|ten|char|teen|panch|do)\s*(reels|reel|posts|post|carousels|carousel|shorts|short|videos|video)?/gi, '')
    .replace(/(next week|this week|this month|today|tomorrow|aaj|kal|agle hafte)/gi, '')
    .trim();

  if (!cleanedSubject || cleanedSubject.length < 3) {
    cleanedSubject = `${clientName} ${format}`;
  }

  // 8. GENERATE STRUCTURED TASKS
  const tasks = [];
  for (let i = 0; i < quantity; i++) {
    const taskDate = dates[i] || dates[0] || toDateStr(refDate);
    const itemNum = quantity > 1 ? ` #${i + 1}` : '';
    const taskTitle = quantity > 1 ? `${format}${itemNum}: ${cleanedSubject}` : `${cleanedSubject} (${format})`;

    tasks.push({
      title: taskTitle,
      category,
      format,
      platforms,
      quantity: 1,
      priority: 'Medium',
      assigneeId: matchedEmpId,
      assigneeName: matchedEmpName,
      collaboratorIds: [],
      startDate: toDateStr(refDate),
      dueDate: taskDate,
      publishDate: taskDate,
      estimatedHours: format === 'Reel' || format === 'Video' ? 4 : 2,
      instructions: `AI Planned for ${clientName}. Original instruction: "${text}". Platform: ${platforms.join(', ')}`,
      status: 'Planned',
      isRecurring: false,
      recurrenceRule: '',
      confidence: 0.95,
      inferredFields: ['platforms', 'dueDate', 'priority']
    });
  }

  return {
    clientId,
    clientName,
    projectName: `${clientName} ${format} Campaign`,
    tasks,
    needsClarification: !clientId,
    clarificationQuestion: !clientId ? `Which client brand is this for?` : ''
  };
}

// ────────────────────────────────────────────────────────────────────────────
// 1. AI Natural Language Parsing Endpoint
// ────────────────────────────────────────────────────────────────────────────
app.post('/api/gemini/parse', async (req, res) => {
  try {
    const { instruction, clients = [], employees = [], currentDate = new Date().toISOString() } = req.body;

    if (!instruction || !instruction.trim()) {
      return res.status(400).json({ error: 'Instruction text is required' });
    }

    // Try Gemini API if key is present
    if (process.env.GEMINI_API_KEY) {
      try {
        const systemInstruction = `You are an expert AI project coordinator for "DigiexplodeAI Portal Desk", a premium web, mobile and social media marketing agency.
Parse the natural language instruction (written in English, Hindi, or Hinglish) into structured task objects.
Clients list: ${JSON.stringify(clients)}
Employees list: ${JSON.stringify(employees)}
Current date: ${currentDate}`;

        const response = await ai.models.generateContent({
          model: 'gemini-2.5-flash',
          contents: `Parse this instruction: "${instruction}"`,
          config: {
            systemInstruction,
            responseMimeType: 'application/json',
            responseSchema: {
              type: Type.OBJECT,
              properties: {
                clientId: { type: Type.STRING },
                clientName: { type: Type.STRING },
                projectName: { type: Type.STRING },
                tasks: {
                  type: Type.ARRAY,
                  items: {
                    type: Type.OBJECT,
                    properties: {
                      title: { type: Type.STRING },
                      category: { type: Type.STRING },
                      format: { type: Type.STRING },
                      platforms: { type: Type.ARRAY, items: { type: Type.STRING } },
                      quantity: { type: Type.INTEGER },
                      priority: { type: Type.STRING },
                      assigneeId: { type: Type.STRING },
                      startDate: { type: Type.STRING },
                      dueDate: { type: Type.STRING },
                      publishDate: { type: Type.STRING },
                      estimatedHours: { type: Type.NUMBER },
                      instructions: { type: Type.STRING },
                      status: { type: Type.STRING },
                      isRecurring: { type: Type.BOOLEAN },
                      recurrenceRule: { type: Type.STRING },
                      confidence: { type: Type.NUMBER }
                    },
                    required: ['title', 'format', 'dueDate', 'status']
                  }
                },
                needsClarification: { type: Type.BOOLEAN },
                clarificationQuestion: { type: Type.STRING }
              },
              required: ['clientName', 'tasks', 'needsClarification']
            }
          }
        });

        const resultText = response.text || '{}';
        const parsed = JSON.parse(resultText);
        if (parsed.tasks && parsed.tasks.length > 0) {
          return res.json(parsed);
        }
      } catch (geminiErr) {
        console.warn('Gemini cloud parsing fallback to local NLP:', geminiErr);
      }
    }

    // High-accuracy fallback NLP parser
    const fallbackResult = parseInstructionNLP(instruction, clients, employees, currentDate);
    res.json(fallbackResult);

  } catch (error: any) {
    console.error('Parsing error:', error);
    // Even if top-level error occurs, return intelligent NLP
    try {
      const fallbackResult = parseInstructionNLP(req.body.instruction || '', req.body.clients, req.body.employees);
      return res.json(fallbackResult);
    } catch {
      res.status(500).json({ error: error?.message || 'Failed to parse natural language instruction.' });
    }
  }
});

// ────────────────────────────────────────────────────────────────────────────
// 2. Audio Speech-To-Text Transcription Endpoint
// ────────────────────────────────────────────────────────────────────────────
app.post('/api/gemini/transcribe', async (req, res) => {
  try {
    const { audioBase64, mimeType = 'audio/webm', language = 'auto' } = req.body;

    if (!audioBase64) {
      return res.status(400).json({ error: 'Audio data is required' });
    }

    if (process.env.GEMINI_API_KEY) {
      try {
        const response = await ai.models.generateContent({
          model: 'gemini-2.5-flash',
          contents: [
            {
              role: 'user',
              parts: [
                {
                  inlineData: {
                    mimeType,
                    data: audioBase64
                  }
                },
                {
                  text: 'Accurately transcribe this audio recording into plain text. Support Hindi, English, and Hinglish. Output ONLY the transcribed text, nothing else.'
                }
              ]
            }
          ]
        });

        const transcript = (response.text || '').trim();
        return res.json({ transcript });
      } catch (audioErr: any) {
        console.warn('Gemini audio transcription warning:', audioErr);
      }
    }

    // Default response if audio cannot be processed server-side without API key
    res.json({ 
      transcript: '',
      message: 'Server audio transcription ready. Use client-side Web Speech recognition.'
    });

  } catch (error: any) {
    console.error('Transcription error:', error);
    res.status(500).json({ error: error?.message || 'Failed to transcribe audio.' });
  }
});

// ────────────────────────────────────────────────────────────────────────────
// 3. SEO Meta Management API — Real persistence with history
// ────────────────────────────────────────────────────────────────────────────

const SEO_DATA_FILE = path.join(process.cwd(), 'data', 'seo-config.json');

// Default SEO configs for all pages
const DEFAULT_SEO_CONFIG: Record<string, any> = {
  home: {
    pageKey: 'home',
    path: '/',
    title: 'DigiexplodeAI — Digital Dreams, Explosive Results | Website & Mobile App Agency',
    description: 'DigiexplodeAI is a premier digital agency building high-performance web applications, mobile apps, AI automation solutions, and explosive social media campaigns.',
    keywords: 'DigiexplodeAI, Web Development Agency, AI Solutions, Custom Web Apps, React Vite Agency, Mobile App Development, UI UX Design',
    canonical: 'https://digiexplode.ai',
    ogTitle: 'DigiexplodeAI — Digital Dreams, Explosive Results',
    ogDescription: 'Transforming visions into high-impact digital experiences with React, AI integrations, custom web apps, and next-gen mobile platforms.',
    ogImage: 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?auto=format&fit=crop&w=1200&q=80',
    twitterCard: 'summary_large_image',
    robots: 'index, follow',
    schema: 'Organization',
    publishedAt: new Date().toISOString(),
    history: []
  },
  projects: {
    pageKey: 'projects',
    path: '/projects',
    title: 'Our Featured Works & Case Studies | DigiexplodeAI Portfolio',
    description: 'Explore DigiexplodeAI portfolio of custom web apps, mobile solutions, AI tools, and explosive digital marketing campaigns engineered for high ROI.',
    keywords: 'DigiexplodeAI Projects, Web App Portfolio, Mobile Apps Case Studies, UI UX Showcase',
    canonical: 'https://digiexplode.ai/projects',
    ogTitle: 'Our Featured Works & Case Studies | DigiexplodeAI Portfolio',
    ogDescription: 'Explore DigiexplodeAI portfolio of custom web apps, mobile solutions, AI tools, and explosive digital marketing campaigns.',
    ogImage: 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?auto=format&fit=crop&w=1200&q=80',
    twitterCard: 'summary_large_image',
    robots: 'index, follow',
    schema: 'ItemList',
    publishedAt: new Date().toISOString(),
    history: []
  },
  about: {
    pageKey: 'about',
    path: '/about',
    title: 'About DigiexplodeAI — Premier Digital Agency & Engineering Team',
    description: 'Learn about DigiexplodeAI team, mission, technology stack, and how we turn ambitious client ideas into explosive market leaders.',
    keywords: 'About DigiexplodeAI, Engineering Team, Web Agency Mission, Tech Experts',
    canonical: 'https://digiexplode.ai/about',
    ogTitle: 'About DigiexplodeAI — Premier Digital Agency & Engineering Team',
    ogDescription: 'Learn about our team, mission, and how we turn ideas into explosive market leaders.',
    ogImage: 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?auto=format&fit=crop&w=1200&q=80',
    twitterCard: 'summary_large_image',
    robots: 'index, follow',
    schema: 'AboutPage',
    publishedAt: new Date().toISOString(),
    history: []
  },
  contact: {
    pageKey: 'contact',
    path: '/contact',
    title: 'Contact DigiexplodeAI — Book Free Tech & Growth Strategy Call',
    description: 'Get in touch with DigiexplodeAI web and mobile app experts. Request a custom quote, consultation, or instant project estimate.',
    keywords: 'Contact DigiexplodeAI, Hire Web Developers, Mobile App Quote, Consultation',
    canonical: 'https://digiexplode.ai/contact',
    ogTitle: 'Contact DigiexplodeAI — Book Free Consultation',
    ogDescription: 'Get in touch with our web and mobile app experts for a custom quote or consultation.',
    ogImage: 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?auto=format&fit=crop&w=1200&q=80',
    twitterCard: 'summary_large_image',
    robots: 'index, follow',
    schema: 'ContactPage',
    publishedAt: new Date().toISOString(),
    history: []
  },
  'start-project': {
    pageKey: 'start-project',
    path: '/start-project',
    title: 'Start Your Project | Instant Calculator & Proposal Builder',
    description: 'Use our interactive project calculator to estimate scope, timelines, and budgets for your next web app, mobile app, or AI solution.',
    keywords: 'Start Project, App Cost Estimator, Web App Calculator, DigiexplodeAI Estimate',
    canonical: 'https://digiexplode.ai/start-project',
    ogTitle: 'Start Your Project — Instant Calculator & Proposal Builder',
    ogDescription: 'Use our interactive calculator to estimate scope, timelines, and budgets for your next project.',
    ogImage: 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?auto=format&fit=crop&w=1200&q=80',
    twitterCard: 'summary_large_image',
    robots: 'index, follow',
    schema: 'WebApplication',
    publishedAt: new Date().toISOString(),
    history: []
  }
};

// Load or initialize SEO data from disk
function loadSeoData(): Record<string, any> {
  try {
    if (fs.existsSync(SEO_DATA_FILE)) {
      const raw = fs.readFileSync(SEO_DATA_FILE, 'utf-8');
      return JSON.parse(raw);
    }
  } catch (e) {
    console.warn('Could not read seo-config.json, using defaults');
  }
  return JSON.parse(JSON.stringify(DEFAULT_SEO_CONFIG));
}

function saveSeoData(data: Record<string, any>) {
  try {
    const dir = path.dirname(SEO_DATA_FILE);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(SEO_DATA_FILE, JSON.stringify(data, null, 2), 'utf-8');
  } catch (e) {
    console.error('Failed to save seo-config.json:', e);
  }
}

// GET /api/seo/:page — returns SEO config for a page
app.get('/api/seo/:page', (req, res) => {
  const page = req.params.page;
  const data = loadSeoData();
  if (data[page]) {
    res.json(data[page]);
  } else {
    res.status(404).json({ error: `Page "${page}" not found in SEO config` });
  }
});

// GET /api/seo — returns all pages config
app.get('/api/seo', (req, res) => {
  const data = loadSeoData();
  res.json(data);
});

// POST /api/seo/:page — saves SEO config for a page
app.post('/api/seo/:page', (req, res) => {
  const page = req.params.page;
  const update = req.body;

  if (!update || !update.title) {
    return res.status(400).json({ error: 'SEO config payload is required' });
  }

  const data = loadSeoData();
  const existing = data[page] || DEFAULT_SEO_CONFIG[page] || {};

  // Archive current version to history
  const historyEntry = {
    savedAt: new Date().toISOString(),
    title: existing.title,
    description: existing.description,
    keywords: existing.keywords,
    canonical: existing.canonical,
    robots: existing.robots,
  };

  const history = (existing.history || []).slice(-19); // keep last 20
  history.push(historyEntry);

  // Merge update
  data[page] = {
    ...existing,
    ...update,
    pageKey: page,
    publishedAt: new Date().toISOString(),
    history
  };

  saveSeoData(data);

  res.json({
    success: true,
    config: data[page],
    message: `SEO config for "${page}" saved and published successfully`
  });
});

// GET /api/seo/:page/history — returns revision history for a page
app.get('/api/seo/:page/history', (req, res) => {
  const page = req.params.page;
  const data = loadSeoData();
  const history = (data[page]?.history || []).reverse();
  res.json({ page, history });
});

// DELETE /api/seo/:page/history/:index — restore a specific revision
app.post('/api/seo/:page/restore/:index', (req, res) => {
  const page = req.params.page;
  const index = parseInt(req.params.index, 10);
  const data = loadSeoData();

  if (!data[page] || !data[page].history) {
    return res.status(404).json({ error: 'No history found for this page' });
  }

  const revision = data[page].history[index];
  if (!revision) {
    return res.status(404).json({ error: 'Revision not found' });
  }

  // Restore
  data[page] = {
    ...data[page],
    ...revision,
    restoredAt: new Date().toISOString()
  };
  saveSeoData(data);
  res.json({ success: true, config: data[page] });
});

// ────────────────────────────────────────────────────────────────────────────
// 4. System Control Plane API — Unified Audit, Notifications, Permissions & Settings
// ────────────────────────────────────────────────────────────────────────────

const CONTROL_PLANE_FILE = path.join(process.cwd(), 'data', 'control-plane.json');

interface ControlPlaneData {
  auditLogs: any[];
  notifications: any[];
  permissions: any;
  settings: any;
  events: any[];
}

function loadControlPlaneData(): ControlPlaneData {
  try {
    if (fs.existsSync(CONTROL_PLANE_FILE)) {
      const raw = fs.readFileSync(CONTROL_PLANE_FILE, 'utf-8');
      return JSON.parse(raw);
    }
  } catch (e) {
    console.error('Failed to load control-plane.json:', e);
  }
  return { auditLogs: [], notifications: [], permissions: {}, settings: {}, events: [] };
}

function saveControlPlaneData(data: ControlPlaneData) {
  try {
    const dir = path.dirname(CONTROL_PLANE_FILE);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(CONTROL_PLANE_FILE, JSON.stringify(data, null, 2), 'utf-8');
  } catch (e) {
    console.error('Failed to save control-plane.json:', e);
  }
}

// POST /api/system/events — emit event
app.post('/api/system/events', (req, res) => {
  const event = req.body;
  if (!event || !event.event_type) {
    return res.status(400).json({ error: 'Valid workspace event is required' });
  }
  const data = loadControlPlaneData();
  data.events.unshift(event);
  if (data.events.length > 300) data.events.pop();
  saveControlPlaneData(data);
  res.json({ success: true, eventId: event.event_id });
});

// GET /api/system/audit
app.get('/api/system/audit', (req, res) => {
  const data = loadControlPlaneData();
  res.json(data.auditLogs);
});

// POST /api/system/audit
app.post('/api/system/audit', (req, res) => {
  const record = req.body;
  if (!record || !record.audit_id) {
    return res.status(400).json({ error: 'Valid audit record is required' });
  }
  const data = loadControlPlaneData();
  data.auditLogs.unshift(record);
  if (data.auditLogs.length > 500) data.auditLogs.pop();
  saveControlPlaneData(data);
  res.json({ success: true, record });
});

// GET /api/system/notifications
app.get('/api/system/notifications', (req, res) => {
  const data = loadControlPlaneData();
  res.json(data.notifications);
});

// POST /api/system/notifications
app.post('/api/system/notifications', (req, res) => {
  const notif = req.body;
  if (!notif || !notif.notification_id) {
    return res.status(400).json({ error: 'Valid notification record is required' });
  }
  const data = loadControlPlaneData();
  data.notifications.unshift(notif);
  if (data.notifications.length > 300) data.notifications.pop();
  saveControlPlaneData(data);
  res.json({ success: true, notification: notif });
});

// GET /api/system/permissions
app.get('/api/system/permissions', (req, res) => {
  const data = loadControlPlaneData();
  res.json(data.permissions || {});
});

// POST /api/system/permissions
app.post('/api/system/permissions', (req, res) => {
  const perms = req.body;
  const data = loadControlPlaneData();
  data.permissions = perms;
  saveControlPlaneData(data);
  res.json({ success: true, permissions: perms });
});

// GET /api/system/settings
app.get('/api/system/settings', (req, res) => {
  const data = loadControlPlaneData();
  res.json(data.settings || {});
});

// POST /api/system/settings
app.post('/api/system/settings', (req, res) => {
  const update = req.body;
  const data = loadControlPlaneData();
  data.settings = { ...data.settings, ...update };
  saveControlPlaneData(data);
  res.json({ success: true, settings: data.settings });
});

// Configure Vite middleware or production build serving
async function setupVite() {
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
    console.log('Vite development middleware mounted');
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*all', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
    console.log('Production static asset serving mounted');
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server is running on port ${PORT}`);
  });
}

setupVite();
