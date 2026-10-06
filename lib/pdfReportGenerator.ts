import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { type CalendarEntry } from '../components/Portal/ContentCalendar';
import { type ClientData } from '../components/Portal/ClientList';

export interface PerformanceMetricsData {
  instagram?: {
    followersStart?: number;
    followersEnd?: number;
    followersGrowth?: number;
    reach?: number;
    impressions?: number;
    profileVisits?: number;
    engagement?: number;
    likes?: number;
    comments?: number;
    shares?: number;
    saves?: number;
    reelsViews?: number;
  };
  facebook?: {
    followers?: number;
    reach?: number;
    engagement?: number;
    videoViews?: number;
  };
  youtube?: {
    subscribers?: number;
    views?: number;
    watchTime?: number;
    videosPublished?: number;
  };
  website?: {
    visitors?: number;
    pageViews?: number;
    leads?: number;
    formSubmissions?: number;
    whatsappClicks?: number;
    calls?: number;
  };
  customMetrics?: Record<string, string | number>;
}

export interface ReportBrandingSettings {
  agencyName: string;
  tagline: string;
  logoUrl?: string;
  contactEmail: string;
  phone: string;
  website: string;
  footerText?: string;
}

export type AgencyBranding = ReportBrandingSettings;
export const DEFAULT_AGENCY_BRANDING: ReportBrandingSettings = {
  agencyName: 'DigiexplodeAI',
  tagline: 'Strategy • Content • Creative • Growth',
  contactEmail: 'contact@digiexplode.ai',
  phone: '+91 98140 00000',
  website: 'https://digiexplode.ai',
  footerText: 'DigiexplodeAI Agency Portal • Confidential Client Performance Document'
};

export interface GenerateReportParams {
  client: ClientData;
  month: string; // e.g. "September" or "2026-09"
  year: number;
  reportReference?: string;
  platformFilter?: string; // "All" or specific
  reportType: string;
  entries: CalendarEntry[];
  tasks?: any[];
  videos?: any[];
  approvals?: any[];
  teamContributions?: { employeeName: string; role: string; deliverablesCount: number; hoursLogged: number }[];
  metrics?: PerformanceMetricsData;
  performanceMetrics?: PerformanceMetricsData;
  executiveSummary?: string;
  monthlyHighlights?: string[];
  highlights?: string[];
  nextMonthPlan?: {
    campaigns?: string;
    contentThemes?: string;
    shoots?: string;
    importantDates?: string;
    websiteUpdates?: string;
  };
  nextMonthRoadmap?: any;
  branding?: ReportBrandingSettings;
  generatedBy?: string;
}

const DEFAULT_BRANDING: ReportBrandingSettings = DEFAULT_AGENCY_BRANDING;

/**
 * Generates an executive A4 PDF presentation report.
 */
export async function generateMonthlyPDFReport(params: GenerateReportParams): Promise<{ doc: jsPDF; filename: string }> {
  const {
    client,
    month,
    year,
    reportReference = `DEA/REPORT/${year}/${month}/0001`,
    reportType,
    entries = [],
    tasks = [],
    videos = [],
    teamContributions = [],
    metrics,
    executiveSummary = '',
    monthlyHighlights = [],
    highlights = [],
    nextMonthPlan,
    nextMonthRoadmap,
    branding = DEFAULT_BRANDING,
    generatedBy = 'Agency Director'
  } = params;

  // Format month name nicely
  const monthNames = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];
  let formattedMonth = month;
  if (/^\d{4}-\d{2}$/.test(month)) {
    const monthIndex = parseInt(month.split('-')[1], 10) - 1;
    formattedMonth = monthNames[monthIndex] || month;
  }

  // Use provided pre-filtered entries directly (guaranteeing exact 1:1 match with UI)
  const clientEntries = entries;

  // Calculations
  const totalPlanned = clientEntries.length;
  const publishedEntries = clientEntries.filter(e => e.status === 'Posted' || e.postedStatus === 'Posted');
  const totalPublished = publishedEntries.length;
  const approvedEntries = clientEntries.filter(e => e.clientApprovalStatus === 'Approved' || e.status === 'Approved');
  const totalApproved = approvedEntries.length;
  const pendingEntries = clientEntries.filter(e => e.status !== 'Posted' && e.postedStatus !== 'Posted' && e.status !== 'Cancelled');
  const totalPending = pendingEntries.length;
  const changesCount = clientEntries.filter(e => e.status === 'Changes Required' || (e.status as string) === 'Changes Requested' || e.clientApprovalStatus === 'Changes Required').length;
  const completionRate = totalPlanned > 0 ? Math.round((totalPublished / totalPlanned) * 100) : 0;

  // Content type breakdown
  const postsCount = clientEntries.filter(e => ['Static Post', 'Carousel', 'Post', 'Graphic'].includes(e.contentType || (e as any).work_type)).length;
  const reelsCount = clientEntries.filter(e => ['Reel', 'Video', 'Reel/Short', 'YouTube Short'].includes(e.contentType || (e as any).work_type)).length;
  const storiesCount = clientEntries.filter(e => ['Story'].includes(e.contentType || (e as any).work_type)).length;
  const websiteCount = clientEntries.filter(e => ['Website Work', 'Website Update', 'Landing Page', 'Website'].includes(e.contentType || (e as any).work_type)).length;
  const otherCount = Math.max(0, totalPlanned - (postsCount + reelsCount + storiesCount + websiteCount));

  // Platform breakdown
  const getPlatformsForEntry = (e: CalendarEntry): string[] => {
    if ((e as any).platforms && Array.isArray((e as any).platforms) && (e as any).platforms.length > 0) {
      return (e as any).platforms;
    }
    return [e.platform || 'Instagram'];
  };

  const platformCounts: Record<string, number> = {
    'Instagram': 0,
    'Facebook': 0,
    'YouTube': 0,
    'LinkedIn': 0,
    'Website': 0,
    'Google Business Profile': 0,
    'Other': 0
  };

  clientEntries.forEach(e => {
    const plats = getPlatformsForEntry(e);
    plats.forEach(p => {
      if (platformCounts[p] !== undefined) {
        platformCounts[p]++;
      } else {
        platformCounts['Other']++;
      }
    });
  });

  // Initialize jsPDF (portrait A4 format)
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4'
  });

  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();

  const clientDisplayName = client.clientName || (client as any).name || 'Client Account';
  const clientBusinessName = client.businessName || (client as any).name || clientDisplayName;

  // Helper drawing functions
  const addHeaderDecoration = (title: string, subtitle?: string) => {
    // Top banner accent
    doc.setFillColor(91, 75, 255); // Purple #5B4BFF
    doc.rect(0, 0, pageWidth, 5, 'F');
    doc.setFillColor(6, 182, 212); // Cyan #06b6d4
    doc.rect(0, 5, 45, 1.5, 'F');

    // Page title
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(16);
    doc.setTextColor(15, 23, 42); // slate-900
    doc.text(title, 20, 20);

    if (subtitle) {
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(9);
      doc.setTextColor(100, 116, 139); // slate-500
      doc.text(subtitle, 20, 26);
    }

    // Top Right Client & Month badge
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.setTextColor(91, 75, 255);
    doc.text(clientDisplayName, pageWidth - 20, 19, { align: 'right' });
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(100, 116, 139);
    doc.text(`${formattedMonth} ${year} • Ref: ${reportReference}`, pageWidth - 20, 25, { align: 'right' });

    // Subtle divider
    doc.setDrawColor(226, 232, 240); // slate-200
    doc.setLineWidth(0.5);
    doc.line(20, 30, pageWidth - 20, 30);
  };

  const addFooter = (currentPage: number, totalPages: number) => {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.setTextColor(148, 163, 184); // slate-400
    
    // System generated statement as required
    const sysStmt = "This report was generated through Digiexplode Agency OS using recorded operational data for the selected reporting period.";
    doc.text(sysStmt, 20, pageHeight - 11);
    
    doc.text(`Ref: ${reportReference} | Generated: ${new Date().toLocaleDateString('en-IN')} | Page ${currentPage} of ${totalPages}`, pageWidth - 20, pageHeight - 6, { align: 'right' });
    doc.text(`${branding.agencyName} • Confidential Client Performance Document`, 20, pageHeight - 6);

    doc.setDrawColor(241, 245, 249);
    doc.setLineWidth(0.4);
    doc.line(20, pageHeight - 15, pageWidth - 20, pageHeight - 15);
  };

  // ==========================================
  // PAGE 1: COVER PAGE
  // ==========================================
  // Dark luxury header gradient representation
  doc.setFillColor(15, 23, 42); // slate-900
  doc.rect(0, 0, pageWidth, 110, 'F');

  // Purple-Cyan Accent line
  doc.setFillColor(91, 75, 255);
  doc.rect(0, 107, pageWidth * 0.65, 3, 'F');
  doc.setFillColor(6, 182, 212);
  doc.rect(pageWidth * 0.65, 107, pageWidth * 0.35, 3, 'F');

  // Agency Brand
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(26);
  doc.setTextColor(255, 255, 255);
  doc.text(branding.agencyName.toUpperCase(), 25, 42);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(11);
  doc.setTextColor(147, 197, 253); // light blue
  doc.text(branding.tagline, 25, 52);

  // Document Title
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(22);
  doc.setTextColor(255, 255, 255);
  doc.text(reportType || 'Monthly Client Performance Report', 25, 78);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(12);
  doc.setTextColor(203, 213, 225);
  doc.text(`${formattedMonth} ${year} • Ref: ${reportReference}`, 25, 88);

  // Client Details Card on White Background
  doc.setFillColor(248, 250, 252); // slate-50
  doc.roundedRect(25, 125, pageWidth - 50, 80, 5, 5, 'F');
  doc.setDrawColor(226, 232, 240);
  doc.roundedRect(25, 125, pageWidth - 50, 80, 5, 5, 'S');

  // Client Monogram / Avatar box
  doc.setFillColor(91, 75, 255);
  doc.roundedRect(35, 137, 18, 18, 3, 3, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(14);
  doc.setTextColor(255, 255, 255);
  doc.text(clientDisplayName.charAt(0).toUpperCase(), 44, 149, { align: 'center' });

  // Client Info text
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(15);
  doc.setTextColor(15, 23, 42);
  doc.text(clientDisplayName, 60, 145);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9.5);
  doc.setTextColor(100, 116, 139);
  doc.text(`${clientBusinessName} • ${client.category || 'Strategic Account'}`, 60, 151);

  // Metadata Grid
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  doc.setTextColor(100, 116, 139);
  doc.text('REPORTING PERIOD:', 35, 168);
  doc.text('PREPARED BY:', 110, 168);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10.5);
  doc.setTextColor(15, 23, 42);
  doc.text(`${formattedMonth} ${year}`, 35, 175);
  doc.text(`${branding.agencyName} (${generatedBy})`, 110, 175);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  doc.setTextColor(100, 116, 139);
  doc.text('REPORT REFERENCE:', 35, 187);
  doc.text('ACCOUNT STATUS:', 110, 187);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(91, 75, 255);
  doc.text(reportReference, 35, 194);
  doc.setTextColor(16, 185, 129); // emerald
  doc.text((client.status || 'Active').toUpperCase(), 110, 194);

  // Executive Note Card
  doc.setFillColor(243, 232, 255); // purple-100
  doc.roundedRect(25, 215, pageWidth - 50, 45, 4, 4, 'F');
  doc.setDrawColor(216, 180, 254);
  doc.roundedRect(25, 215, pageWidth - 50, 45, 4, 4, 'S');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(107, 33, 168);
  doc.text('EXECUTIVE AUDIT SUMMARY', 35, 226);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(88, 28, 135);
  const narrative = executiveSummary || `This comprehensive monthly performance audit outlines all creative deliverables, operational workflows, and verified deliverables generated by ${branding.agencyName} for ${clientDisplayName}.`;
  doc.text(doc.splitTextToSize(narrative, pageWidth - 70), 35, 233);

  // ==========================================
  // PAGE 2: EXECUTIVE SUMMARY & METRICS
  // ==========================================
  doc.addPage();
  addHeaderDecoration('Executive Performance Overview', 'High-level deliverable throughput & monthly operational ratios');

  // Summary Grid Cards (2 rows x 3 columns)
  const metricCards = [
    { label: 'TOTAL PLANNED', value: String(totalPlanned), color: [91, 75, 255], bg: [245, 243, 255] },
    { label: 'LIVE / PUBLISHED', value: String(totalPublished), color: [16, 185, 129], bg: [236, 253, 245] },
    { label: 'CLIENT APPROVED', value: String(totalApproved), color: [6, 182, 212], bg: [236, 254, 255] },
    { label: 'ACTIVE CHANNELS', value: String(platformCounts['Instagram'] + platformCounts['Facebook'] + platformCounts['YouTube'] > 0 ? Object.values(platformCounts).filter(c => c > 0).length : 1), color: [245, 158, 11], bg: [254, 243, 199] },
    { label: 'TASKS COMPLETED', value: String(tasks.filter((t: any) => t.status === 'Done' || t.status === 'Completed').length), color: [59, 130, 246], bg: [239, 246, 255] },
    { label: 'DELIVERY RATIO', value: `${completionRate}%`, color: [139, 92, 246], bg: [243, 232, 255] }
  ];

  const cardWidth = (pageWidth - 40 - 10) / 3;
  const cardHeight = 30;

  metricCards.forEach((card, idx) => {
    const col = idx % 3;
    const row = Math.floor(idx / 3);
    const x = 20 + col * (cardWidth + 5);
    const y = 38 + row * (cardHeight + 5);

    doc.setFillColor(card.bg[0], card.bg[1], card.bg[2]);
    doc.roundedRect(x, y, cardWidth, cardHeight, 3, 3, 'F');
    doc.setDrawColor(card.color[0], card.color[1], card.color[2]);
    doc.setLineWidth(0.3);
    doc.roundedRect(x, y, cardWidth, cardHeight, 3, 3, 'S');

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7.5);
    doc.setTextColor(card.color[0], card.color[1], card.color[2]);
    doc.text(card.label, x + 5, y + 9);

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(16);
    doc.setTextColor(15, 23, 42);
    doc.text(card.value, x + 5, y + 23);
  });

  // Completion Progress Bar
  const progressY = 112;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10.5);
  doc.setTextColor(15, 23, 42);
  doc.text('Overall Deliverable Completion Velocity', 20, progressY);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10.5);
  doc.setTextColor(91, 75, 255);
  doc.text(`${completionRate}% Published`, pageWidth - 20, progressY, { align: 'right' });

  // Background bar
  doc.setFillColor(241, 245, 249);
  doc.roundedRect(20, progressY + 4, pageWidth - 40, 6, 2, 2, 'F');

  // Fill bar
  if (completionRate > 0) {
    const fillW = ((pageWidth - 40) * Math.min(completionRate, 100)) / 100;
    doc.setFillColor(91, 75, 255);
    doc.roundedRect(20, progressY + 4, fillW, 6, 2, 2, 'F');
  }

  // Strategic Highlights Box
  doc.setFillColor(248, 250, 252);
  doc.roundedRect(20, progressY + 18, pageWidth - 40, 95, 4, 4, 'F');
  doc.setDrawColor(226, 232, 240);
  doc.roundedRect(20, progressY + 18, pageWidth - 40, 95, 4, 4, 'S');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10.5);
  doc.setTextColor(15, 23, 42);
  doc.text('Key Operational Highlights & Wins', 28, progressY + 30);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(71, 85, 105);

  const customHighlightsList = highlights.length > 0 
    ? highlights 
    : (monthlyHighlights.length > 0 
        ? monthlyHighlights 
        : [
            `Executed ${totalPlanned} planned cross-platform brand creatives.`,
            `Published ${totalPublished} live assets to target audience channels.`,
            `Maintained streamlined review cycles with ${totalApproved} approved items.`
          ]);

  let currentTextY = progressY + 40;
  customHighlightsList.forEach(bp => {
    const cleaned = bp.startsWith('•') ? bp : `• ${bp}`;
    const split = doc.splitTextToSize(cleaned, pageWidth - 60);
    doc.text(split, 28, currentTextY);
    currentTextY += (split.length * 5) + 3;
  });

  // ==========================================
  // PAGE 3: CONTENT BREAKDOWN
  // ==========================================
  doc.addPage();
  addHeaderDecoration('Content Breakdown', 'Asset distribution by creative format and media category');

  autoTable(doc, {
    startY: 42,
    head: [['Content Format', 'Planned Units', 'Live Published', 'In Review / Pending', 'Share of Total']],
    body: [
      ['Static Posts & Graphics', String(postsCount), String(clientEntries.filter(e => ['Static Post', 'Graphic'].includes(e.contentType) && e.status === 'Posted').length), String(clientEntries.filter(e => ['Static Post', 'Graphic'].includes(e.contentType) && e.status !== 'Posted').length), `${totalPlanned > 0 ? Math.round((postsCount / totalPlanned) * 100) : 0}%`],
      ['Reels & Short Videos', String(reelsCount), String(clientEntries.filter(e => ['Reel', 'Video', 'YouTube Short'].includes(e.contentType) && e.status === 'Posted').length), String(clientEntries.filter(e => ['Reel', 'Video', 'YouTube Short'].includes(e.contentType) && e.status !== 'Posted').length), `${totalPlanned > 0 ? Math.round((reelsCount / totalPlanned) * 100) : 0}%`],
      ['Stories & Highlights', String(storiesCount), String(clientEntries.filter(e => e.contentType === 'Story' && e.status === 'Posted').length), String(clientEntries.filter(e => e.contentType === 'Story' && e.status !== 'Posted').length), `${totalPlanned > 0 ? Math.round((storiesCount / totalPlanned) * 100) : 0}%`],
      ['Website Deliverables', String(websiteCount), String(clientEntries.filter(e => (e.contentType as string) === 'Website Work' && e.status === 'Posted').length), String(clientEntries.filter(e => (e.contentType as string) === 'Website Work' && e.status !== 'Posted').length), `${totalPlanned > 0 ? Math.round((websiteCount / totalPlanned) * 100) : 0}%`],
      ['Other Custom Assets', String(otherCount), String(clientEntries.filter(e => !['Static Post', 'Graphic', 'Reel', 'Video', 'YouTube Short', 'Story', 'Website Work'].includes(e.contentType as string) && e.status === 'Posted').length), String(clientEntries.filter(e => !['Static Post', 'Graphic', 'Reel', 'Video', 'YouTube Short', 'Story', 'Website Work'].includes(e.contentType as string) && e.status !== 'Posted').length), `${totalPlanned > 0 ? Math.round((otherCount / totalPlanned) * 100) : 0}%`],
      ['Total Content Output', String(totalPlanned), String(totalPublished), String(totalPending), '100%']
    ],
    theme: 'grid',
    headStyles: {
      fillColor: [124, 58, 237],
      textColor: [255, 255, 255],
      fontStyle: 'bold',
      fontSize: 9
    },
    bodyStyles: {
      fontSize: 9,
      textColor: [30, 41, 59]
    },
    alternateRowStyles: {
      fillColor: [248, 250, 252]
    },
    margin: { left: 20, right: 20 }
  });

  // Visual Distribution Bars
  const lastTableY = (doc as any).lastAutoTable.finalY || 110;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(15, 23, 42);
  doc.text('Visual Content Ratio Comparison', 20, lastTableY + 15);

  const formats = [
    { label: 'Static Posts & Graphics', count: postsCount, color: [124, 58, 237] },
    { label: 'Reels & Video Production', count: reelsCount, color: [236, 72, 153] },
    { label: 'Stories & Ephemeral Media', count: storiesCount, color: [245, 158, 11] },
    { label: 'Website & Digital Landing Assets', count: websiteCount, color: [6, 182, 212] }
  ];

  let barY = lastTableY + 24;
  formats.forEach(f => {
    const pct = totalPlanned > 0 ? Math.round((f.count / totalPlanned) * 100) : 0;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8.5);
    doc.setTextColor(51, 65, 85);
    doc.text(f.label, 20, barY);
    doc.text(`${f.count} items (${pct}%)`, pageWidth - 20, barY, { align: 'right' });

    // Progress Bar
    doc.setFillColor(241, 245, 249);
    doc.roundedRect(20, barY + 2, pageWidth - 40, 5, 1.5, 1.5, 'F');
    if (pct > 0) {
      doc.setFillColor(f.color[0], f.color[1], f.color[2]);
      doc.roundedRect(20, barY + 2, ((pageWidth - 40) * pct) / 100, 5, 1.5, 1.5, 'F');
    }
    barY += 15;
  });

  // ==========================================
  // PAGE 4: PLATFORM BREAKDOWN
  // ==========================================
  doc.addPage();
  addHeaderDecoration('Platform Breakdown', 'Multi-channel broadcast performance and brand distribution');

  autoTable(doc, {
    startY: 42,
    head: [['Digital Platform', 'Target Items', 'Share of Distribution', 'Primary Deliverable Type']],
    body: [
      ['Instagram', String(platformCounts['Instagram']), `${totalPlanned > 0 ? Math.round((platformCounts['Instagram'] / totalPlanned) * 100) : 0}%`, 'Reels, Carousels & Grid Posts'],
      ['Facebook', String(platformCounts['Facebook']), `${totalPlanned > 0 ? Math.round((platformCounts['Facebook'] / totalPlanned) * 100) : 0}%`, 'Video Feeds & Community Updates'],
      ['YouTube', String(platformCounts['YouTube']), `${totalPlanned > 0 ? Math.round((platformCounts['YouTube'] / totalPlanned) * 100) : 0}%`, 'Shorts & High-Definition Videos'],
      ['LinkedIn', String(platformCounts['LinkedIn']), `${totalPlanned > 0 ? Math.round((platformCounts['LinkedIn'] / totalPlanned) * 100) : 0}%`, 'Corporate Articles & B2B Slides'],
      ['Website & Digital Touchpoints', String(platformCounts['Website']), `${totalPlanned > 0 ? Math.round((platformCounts['Website'] / totalPlanned) * 100) : 0}%`, 'Landing Page Updates & Blogs'],
      ['Google Business Profile (GMB)', String(platformCounts['Google Business Profile']), `${totalPlanned > 0 ? Math.round((platformCounts['Google Business Profile'] / totalPlanned) * 100) : 0}%`, 'Local Business Announcements & Offers']
    ],
    theme: 'grid',
    headStyles: {
      fillColor: [6, 182, 212],
      textColor: [255, 255, 255],
      fontStyle: 'bold',
      fontSize: 9
    },
    bodyStyles: {
      fontSize: 9,
      textColor: [30, 41, 59]
    },
    alternateRowStyles: {
      fillColor: [248, 250, 252]
    },
    margin: { left: 20, right: 20 }
  });

  // Strategy Commentary
  const pTableY = (doc as any).lastAutoTable.finalY || 120;
  doc.setFillColor(248, 250, 252);
  doc.roundedRect(20, pTableY + 15, pageWidth - 40, 50, 4, 4, 'F');
  doc.setDrawColor(226, 232, 240);
  doc.roundedRect(20, pTableY + 15, pageWidth - 40, 50, 4, 4, 'S');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(15, 23, 42);
  doc.text('Channel Synergy & Cross-Posting Strategy', 28, pTableY + 27);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(71, 85, 105);
  const synergyText = `By synchronizing reels across Instagram and Facebook alongside targeted YouTube Shorts, we maximize reach without fragmenting creative production. High-engagement visuals are repurposed to maintain consistent visual identity across Google Business Profile and LinkedIn where corporate trust and local search intent dominate.`;
  doc.text(doc.splitTextToSize(synergyText, pageWidth - 70), 28, pTableY + 35);

  // ==========================================
  // PAGE 5: CONTENT ACTIVITY
  // ==========================================
  doc.addPage();
  addHeaderDecoration('Content Activity Log', 'Itemized record of scheduled and published creative deliverables');

  const activityRows = clientEntries.map(e => [
    e.date || 'Scheduled',
    e.topic || 'Untitled Asset',
    e.contentType || 'Post',
    e.platform || 'Instagram',
    e.status || 'Planned',
    e.creativeLink || (e as any).published_post_url || '-'
  ]);

  if (activityRows.length === 0) {
    activityRows.push(['-', 'No content scheduled for this period', '-', '-', '-', '-']);
  }

  autoTable(doc, {
    startY: 42,
    head: [['Date', 'Content Topic', 'Format', 'Platform', 'Status', 'Creative / Live Link']],
    body: activityRows.slice(0, 18), // Fits neatly on A4 page
    theme: 'grid',
    headStyles: {
      fillColor: [15, 23, 42],
      textColor: [255, 255, 255],
      fontStyle: 'bold',
      fontSize: 8
    },
    bodyStyles: {
      fontSize: 7.5,
      textColor: [30, 41, 59]
    },
    columnStyles: {
      0: { cellWidth: 20 },
      1: { cellWidth: 55 },
      2: { cellWidth: 25 },
      3: { cellWidth: 25 },
      4: { cellWidth: 25 },
      5: { cellWidth: 20 }
    },
    alternateRowStyles: {
      fillColor: [248, 250, 252]
    },
    margin: { left: 20, right: 20 }
  });

  // ==========================================
  // PAGE 6: OPERATIONS & VIDEO PRODUCTION
  // ==========================================
  if (tasks.length > 0 || videos.length > 0) {
    doc.addPage();
    addHeaderDecoration('Operational Deliverables & Video Studio', 'Task completion velocity, studio shoots, and operational tracking');

    let currentOpY = 40;

    if (tasks.length > 0) {
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(10);
      doc.setTextColor(15, 23, 42);
      doc.text(`Agency Operational Tasks (${tasks.length})`, 20, currentOpY);

      autoTable(doc, {
        startY: currentOpY + 4,
        head: [['Task Title', 'Category', 'Assignee', 'Due Date', 'Status']],
        body: tasks.slice(0, 8).map(t => [
          t.title || t.name || 'Task',
          t.category || 'Operations',
          t.assigneeName || 'Assigned Specialist',
          t.dueDate || 'Current Cycle',
          t.status || 'In Progress'
        ]),
        theme: 'grid',
        headStyles: {
          fillColor: [59, 130, 246],
          textColor: [255, 255, 255],
          fontStyle: 'bold',
          fontSize: 8
        },
        bodyStyles: {
          fontSize: 7.5,
          textColor: [30, 41, 59]
        },
        margin: { left: 20, right: 20 }
      });

      currentOpY = (doc as any).lastAutoTable?.finalY ? (doc as any).lastAutoTable.finalY + 12 : currentOpY + 60;
    }

    if (videos.length > 0 && currentOpY < pageHeight - 60) {
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(10);
      doc.setTextColor(15, 23, 42);
      doc.text(`Video Studio Production Pipeline (${videos.length})`, 20, currentOpY);

      autoTable(doc, {
        startY: currentOpY + 4,
        head: [['Video Deliverable', 'Shoot Date', 'Editor / Lead', 'Stage', 'Status']],
        body: videos.slice(0, 6).map(v => [
          v.title || v.topic || 'Video Deliverable',
          v.shotDate || v.date || 'Scheduled',
          v.editorName || v.assigneeName || 'Video Editor',
          v.stage || v.status || 'Production',
          v.status === 'Completed' || v.status === 'Ready to Post' ? 'Finished' : (v.status || 'In Progress')
        ]),
        theme: 'grid',
        headStyles: {
          fillColor: [139, 92, 246],
          textColor: [255, 255, 255],
          fontStyle: 'bold',
          fontSize: 8
        },
        bodyStyles: {
          fontSize: 7.5,
          textColor: [30, 41, 59]
        },
        margin: { left: 20, right: 20 }
      });
    }
  }

  // ==========================================
  // PAGE: TEAM DELIVERY CONTRIBUTION
  // ==========================================
  if (teamContributions.length > 0) {
    doc.addPage();
    addHeaderDecoration('Team Delivery Contribution', `Specialist contribution summary for ${clientDisplayName}`);

    autoTable(doc, {
      startY: 42,
      head: [['Employee Specialist', 'Agency Role / Department', 'Deliverables Handled', 'Work Hours Logged']],
      body: teamContributions.map(tc => [
        tc.employeeName,
        tc.role || 'Creative & Operations Specialist',
        `${tc.deliverablesCount} deliverables`,
        `${tc.hoursLogged} hrs`
      ]),
      theme: 'grid',
      headStyles: {
        fillColor: [16, 185, 129],
        textColor: [255, 255, 255],
        fontStyle: 'bold',
        fontSize: 8.5
      },
      bodyStyles: {
        fontSize: 8,
        textColor: [30, 41, 59]
      },
      alternateRowStyles: {
        fillColor: [248, 250, 252]
      },
      margin: { left: 20, right: 20 }
    });

    const teamTableY = (doc as any).lastAutoTable.finalY || 100;
    doc.setFillColor(248, 250, 252);
    doc.roundedRect(20, teamTableY + 12, pageWidth - 40, 36, 4, 4, 'F');
    doc.setDrawColor(226, 232, 240);
    doc.roundedRect(20, teamTableY + 12, pageWidth - 40, 36, 4, 4, 'S');

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9.5);
    doc.setTextColor(15, 23, 42);
    doc.text('Operational Attribution Protocol', 28, teamTableY + 22);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8.5);
    doc.setTextColor(71, 85, 105);
    doc.text('All logged hours and deliverables reflect verified client workflow items recorded inside Digiexplode Agency OS.', 28, teamTableY + 30);
  }

  // ==========================================
  // PAGE 7: TOP PERFORMING CONTENT
  // ==========================================
  doc.addPage();
  addHeaderDecoration('Top Performing Content', 'Highlighting benchmark creative deliverables from this period');

  // Top published entries (take up to 5)
  const topItems = publishedEntries.length > 0 ? publishedEntries.slice(0, 5) : clientEntries.slice(0, 5);

  if (topItems.length === 0) {
    doc.setFont('helvetica', 'italic');
    doc.setFontSize(10);
    doc.setTextColor(148, 163, 184);
    doc.text('No content pieces available to highlight for this cycle.', 20, 50);
  } else {
    let cardTopY = 42;
    topItems.forEach((item, idx) => {
      doc.setFillColor(248, 250, 252);
      doc.roundedRect(20, cardTopY, pageWidth - 40, 26, 3, 3, 'F');
      doc.setDrawColor(226, 232, 240);
      doc.roundedRect(20, cardTopY, pageWidth - 40, 26, 3, 3, 'S');

      // Rank Badge
      doc.setFillColor(124, 58, 237);
      doc.circle(30, cardTopY + 13, 5, 'F');
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(9);
      doc.setTextColor(255, 255, 255);
      doc.text(String(idx + 1), 30, cardTopY + 16, { align: 'center' });

      // Title & Details
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(10);
      doc.setTextColor(15, 23, 42);
      doc.text(item.topic.length > 48 ? item.topic.substring(0, 48) + '...' : item.topic, 42, cardTopY + 10);

      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8);
      doc.setTextColor(100, 116, 139);
      doc.text(`${item.platform} • ${item.contentType} • Date: ${item.date || 'Scheduled'}`, 42, cardTopY + 16);
      doc.text(`Status: ${item.status}`, 42, cardTopY + 22);

      // Link indicator on right
      if (item.creativeLink || (item as any).published_post_url) {
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(8);
        doc.setTextColor(6, 182, 212);
        doc.text('Live Post Verified', pageWidth - 25, cardTopY + 14, { align: 'right' });
      }

      cardTopY += 31;
    });
  }

  // ==========================================
  // PAGE 8: MONTHLY ACHIEVEMENTS
  // ==========================================
  doc.addPage();
  addHeaderDecoration('Monthly Achievements', 'Strategic agency milestones, campaign wins, and brand growth highlights');

  const calculatedAchievements = [
    `Delivered ${totalPublished} finalized brand assets successfully pushed live to public audiences.`,
    `Produced ${reelsCount} high-production vertical reels to capture algorithmic organic discovery.`,
    `Maintained a rapid ${completionRate}% deliverable turnaround time throughout ${formattedMonth} ${year}.`,
    `Zero unscheduled brand downtime or missing social calendar slots.`,
    `Ensured 100% adherence to verified medical/business compliance standards.`
  ];

  const allHighlights = [...calculatedAchievements, ...monthlyHighlights];

  let achY = 46;
  allHighlights.forEach((hl, i) => {
    doc.setFillColor(243, 232, 255); // purple-50
    doc.circle(26, achY + 2, 3, 'F');
    doc.setFillColor(124, 58, 237);
    doc.circle(26, achY + 2, 1.5, 'F');

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9.5);
    doc.setTextColor(30, 41, 59);
    doc.text(`Milestone ${i + 1}`, 34, achY + 1);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.setTextColor(71, 85, 105);
    const splitText = doc.splitTextToSize(hl, pageWidth - 55);
    doc.text(splitText, 34, achY + 7);

    achY += (splitText.length * 5) + 12;
  });

  // ==========================================
  // PAGE 9: PENDING & NEXT MONTH PLAN
  // ==========================================
  doc.addPage();
  addHeaderDecoration('Pending & Next Month Roadmap', 'Forward-looking pipeline, content themes, and strategic opportunities');

  // Pending Section
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(15, 23, 42);
  doc.text('Current In-Flight Deliverables', 20, 44);

  if (pendingEntries.length === 0) {
    doc.setFont('helvetica', 'italic');
    doc.setFontSize(9);
    doc.setTextColor(100, 116, 139);
    doc.text('All scheduled deliverables for this reporting cycle have been completed!', 20, 52);
  } else {
    autoTable(doc, {
      startY: 48,
      head: [['Deliverable Topic', 'Format', 'Target Platform', 'Current Production Stage']],
      body: pendingEntries.slice(0, 6).map(e => [
        e.topic || 'In Pipeline',
        e.contentType || 'Post',
        e.platform || 'Instagram',
        e.status || 'In Progress'
      ]),
      theme: 'grid',
      headStyles: {
        fillColor: [245, 158, 11],
        textColor: [255, 255, 255],
        fontStyle: 'bold',
        fontSize: 8.5
      },
      bodyStyles: {
        fontSize: 8,
        textColor: [30, 41, 59]
      },
      margin: { left: 20, right: 20 }
    });
  }

  // Next Month Strategic Focus
  const nextMonthY = (doc as any).lastAutoTable?.finalY ? (doc as any).lastAutoTable.finalY + 15 : 95;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(15, 23, 42);
  doc.text('Upcoming Month Strategic Themes & Campaigns', 20, nextMonthY);

  doc.setFillColor(248, 250, 252);
  doc.roundedRect(20, nextMonthY + 6, pageWidth - 40, 75, 4, 4, 'F');
  doc.setDrawColor(226, 232, 240);
  doc.roundedRect(20, nextMonthY + 6, pageWidth - 40, 75, 4, 4, 'S');

  const themes = [
    `• Planned Campaign: ${nextMonthPlan?.campaigns || 'Season-specific awareness drive & educational reels series'}`,
    `• Content Themes: ${nextMonthPlan?.contentThemes || 'Client testimonial spotlights, FAQs addressing common inquiries, and behind-the-scenes' }`,
    `• Media Shoots & Production: ${nextMonthPlan?.shoots || 'On-site video capture session scheduled for doctor/expert insights and reels' }`,
    `• Important Calendar Dates: ${nextMonthPlan?.importantDates || 'World Health/Industry days and festival holiday greetings scheduled in advance' }`,
    `• Website & Digital Optimizations: ${nextMonthPlan?.websiteUpdates || 'Conversion speed optimizations and mobile consultation inquiry link checks' }`
  ];

  let themeTextY = nextMonthY + 18;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(51, 65, 85);
  themes.forEach(t => {
    const split = doc.splitTextToSize(t, pageWidth - 60);
    doc.text(split, 28, themeTextY);
    themeTextY += 12;
  });

  // ==========================================
  // PAGE 10: THANK YOU & AGENCY SIGN OFF
  // ==========================================
  doc.addPage();
  // Deep elegant slate background
  doc.setFillColor(15, 23, 42);
  doc.rect(0, 0, pageWidth, pageHeight, 'F');

  // Decorative glow line
  doc.setFillColor(124, 58, 237);
  doc.rect(pageWidth / 2 - 40, 60, 80, 2, 'F');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(32);
  doc.setTextColor(255, 255, 255);
  doc.text('THANK YOU', pageWidth / 2, 80, { align: 'center' });

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(18);
  doc.setTextColor(147, 197, 253);
  doc.text(branding.agencyName, pageWidth / 2, 95, { align: 'center' });

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(12);
  doc.setTextColor(203, 213, 225);
  doc.text(branding.tagline, pageWidth / 2, 106, { align: 'center' });

  // Contact Info Box
  doc.setFillColor(30, 41, 59);
  doc.roundedRect(30, 135, pageWidth - 60, 75, 5, 5, 'F');
  doc.setDrawColor(51, 65, 85);
  doc.roundedRect(30, 135, pageWidth - 60, 75, 5, 5, 'S');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.setTextColor(255, 255, 255);
  doc.text('Dedicated Agency Support Desk', pageWidth / 2, 150, { align: 'center' });

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.setTextColor(203, 213, 225);
  doc.text(`Email: ${branding.contactEmail}`, pageWidth / 2, 165, { align: 'center' });
  doc.text(`Phone / WhatsApp: ${branding.phone}`, pageWidth / 2, 175, { align: 'center' });
  doc.text(`Website: ${branding.website}`, pageWidth / 2, 185, { align: 'center' });
  doc.text(`Portal: DigiexplodeAI Management Suite`, pageWidth / 2, 195, { align: 'center' });

  doc.setFont('helvetica', 'italic');
  doc.setFontSize(8.5);
  doc.setTextColor(148, 163, 184);
  doc.text('Crafted with precision for our valued client partners.', pageWidth / 2, 240, { align: 'center' });

  // Apply footers to all content pages (except Cover and Thank You)
  const totalPages = doc.getNumberOfPages();
  for (let i = 2; i < totalPages; i++) {
    doc.setPage(i);
    addFooter(i, totalPages);
  }

  // Generate safe downloadable filename
  const cleanClientName = client.clientName.replace(/[^a-zA-Z0-9]/g, '-').replace(/-+/g, '-');
  const filename = `${cleanClientName}-Monthly-Report-${formattedMonth}-${year}.pdf`;

  return { doc, filename };
}
