import React, { useState, useEffect, useRef } from 'react';
import {
  collection,
  onSnapshot,
  doc,
  setDoc
} from 'firebase/firestore';
import { db, auth, handleFirestoreError, OperationType } from '../../lib/firebase';
import { useAuth } from '../../context/AuthContext';
import {
  Sparkles,
  Mic,
  MicOff,
  Plus,
  Layers,
  CheckSquare,
  X,
  Calendar,
  Clock,
  UserCheck,
  AlertCircle,
  Trash2,
  Bookmark,
  HelpCircle,
  TrendingUp,
  Sliders,
  Check,
  AlertTriangle,
  FileText,
  Video,
  Instagram,
  Send,
  Loader2,
  CheckCircle2,
  ListPlus,
  Compass,
  Zap,
  RotateCcw,
  Square,
  Globe,
  Radio
} from 'lucide-react';
import { type ClientData } from './ClientList';
import { type Employee } from './AttendanceView';
import { ClientSelect } from './ClientSelect';
import { DEFAULT_CLIENTS_MASTER } from '../../lib/clientMaster';
import {
  subscribeToCanonicalEmployees,
  getCachedEmployees,
  ensureCentralEmployeesSeeded,
  type MasterEmployee
} from '../../lib/employeeMaster';
import {
  persistNewCalendarEntry,
  DEFAULT_CALENDAR_SEEDS,
  type CalendarEntry
} from '../../lib/calendarStorage';
import { PopoverDatePicker } from './PopoverDatePicker';
import { SmartContentRoutines } from './SmartContentRoutines';

export interface QuickWorkEntryProps {
  onTaskCreated?: () => void;
  selectedClientId?: string | null;
}

export interface ParsedWorkTask {
  id: string;
  title: string;
  category: string;
  format: string;
  platforms: string[];
  quantity: number;
  priority: 'Low' | 'Medium' | 'High' | 'Urgent';
  assigneeId: string;
  assigneeName: string;
  startDate: string;
  dueDate: string;
  publishDate: string;
  estimatedHours: number;
  instructions: string;
  status: string;
  isRecurring: boolean;
  recurrenceRule: string;
  confidence: number;
  inferredFields: string[];
  subtasks: Array<{
    title: string;
    checked: boolean;
    assigneeId: string;
    assigneeName: string;
    dueDate: string;
  }>;
}

const TEMPLATE_PRESETS = [
  {
    id: 'tpl_medical_reels',
    name: 'Healthcare & Medical Reel Set (4 Reels)',
    description: 'Patient case study, procedure FAQ, myth-buster, and doctor advice reels.',
    format: 'Reel',
    category: 'Video Production',
    platforms: ['Instagram', 'YouTube'],
    count: 4,
    defaultPriority: 'High' as const,
  },
  {
    id: 'tpl_brand_growth',
    name: 'Brand Growth Pack (6 Posts + 2 Carousels)',
    description: 'High-converting graphics, testimonial slides, and promotional carousels.',
    format: 'Static Post',
    category: 'Social Media',
    platforms: ['Instagram', 'Facebook', 'LinkedIn'],
    count: 8,
    defaultPriority: 'Medium' as const,
  },
  {
    id: 'tpl_weekly_routine',
    name: 'Weekly Social Cadence (3 Posts + 1 Reel)',
    description: 'Mon/Wed/Fri educational posts plus a Sunday highlight reel.',
    format: 'Static Post',
    category: 'Social Media',
    platforms: ['Instagram', 'Facebook'],
    count: 4,
    defaultPriority: 'Medium' as const,
  }
];

export const QuickWorkEntry: React.FC<QuickWorkEntryProps> = ({ onTaskCreated, selectedClientId }) => {
  const { profile } = useAuth();

  // Database States
  const [clients, setClients] = useState<ClientData[]>(DEFAULT_CLIENTS_MASTER);
  const [employees, setEmployees] = useState<MasterEmployee[]>(() => getCachedEmployees());
  const [calendarEntries, setCalendarEntries] = useState<CalendarEntry[]>(DEFAULT_CALENDAR_SEEDS);
  const [employeeLoadError, setEmployeeLoadError] = useState(false);

  // Tab Mode: 'easy' (Manual Plan Entry - Default) | 'ai' (AI Command Hub) | 'templates' (Routine Templates)
  const [activeTab, setActiveTab] = useState<'easy' | 'ai' | 'templates'>('easy');

  // Inline feedback state (replaces native alert)
  const [formFeedback, setFormFeedback] = useState<{ message: string; type: 'success' | 'error' | 'warning' } | null>(null);

  // Manual Easy Planner States
  const [easyClientId, setEasyClientId] = useState<string>(selectedClientId || '');
  const [easyTitle, setEasyTitle] = useState('');
  const [easyFormat, setEasyFormat] = useState('Static Post');
  const [easyPlatform, setEasyPlatform] = useState('Instagram');
  const [easyAssigneeId, setEasyAssigneeId] = useState('');
  const [easyUploaderId, setEasyUploaderId] = useState('');
  const [easyDueDate, setEasyDueDate] = useState(new Date().toISOString().split('T')[0]);
  const [easyTime, setEasyTime] = useState('12:00');
  const [easyPriority, setEasyPriority] = useState<'Low' | 'Medium' | 'High' | 'Urgent'>('Medium');
  const [easyStatus, setEasyStatus] = useState('Planned');
  const [easyCaption, setEasyCaption] = useState('');
  const [isSubmittingEasyForm, setIsSubmittingEasyForm] = useState(false);

  // AI Command Hub States
  const [instructionText, setInstructionText] = useState('');
  const [isAiProcessing, setIsAiProcessing] = useState(false);
  const [aiErrorNotice, setAiErrorNotice] = useState<string | null>(null);

  // Audio Recording & Speech-to-Text State Machine
  // States: 'idle' | 'requesting_permission' | 'listening' | 'processing_audio' | 'transcribing' | 'ready' | 'error'
  type AudioState = 'idle' | 'requesting_permission' | 'listening' | 'processing_audio' | 'transcribing' | 'ready' | 'error';
  const [audioState, setAudioState] = useState<AudioState>('idle');
  const [audioErrorMessage, setAudioErrorMessage] = useState<string | null>(null);
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const [selectedLanguage, setSelectedLanguage] = useState<'auto' | 'en-IN' | 'hi-IN'>('auto');

  const recognitionRef = useRef<any>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const timerIntervalRef = useRef<any>(null);
  const interimSpeechRef = useRef<string>('');

  // Review Drawer States
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [drawerClientId, setDrawerClientId] = useState('');
  const [drawerClientName, setDrawerClientName] = useState('');
  const [drawerProjectName, setDrawerProjectName] = useState('General Campaign');
  const [reviewTasks, setReviewTasks] = useState<ParsedWorkTask[]>([]);
  const [clarificationQuestion, setClarificationQuestion] = useState('');
  const [isSavingDrawer, setIsSavingDrawer] = useState(false);

  // Synchronize client selection if prop changes
  useEffect(() => {
    if (selectedClientId) {
      setEasyClientId(selectedClientId);
    }
  }, [selectedClientId]);

  // Load clients and canonical employees
  useEffect(() => {
    const unsubClients = onSnapshot(collection(db, 'clients'), (snap) => {
      const list: ClientData[] = [];
      snap.forEach(d => list.push({ clientId: d.id, ...d.data() } as ClientData));
      if (list.length > 0) setClients(list);
    });

    const unsubEmployees = subscribeToCanonicalEmployees(
      (empList) => {
        setEmployees(empList);
        setEmployeeLoadError(false);
      },
      (err) => {
        console.warn("Employee listener issue, using cached fallback:", err);
        setEmployeeLoadError(true);
      }
    );

    return () => {
      unsubClients();
      unsubEmployees();
      cleanupAudioSession();
    };
  }, []);

  // Cleanup helper for all audio streams and timers
  const cleanupAudioSession = () => {
    if (timerIntervalRef.current) {
      clearInterval(timerIntervalRef.current);
      timerIntervalRef.current = null;
    }
    if (mediaStreamRef.current) {
      try {
        mediaStreamRef.current.getTracks().forEach(track => {
          track.stop();
        });
      } catch (e) {
        console.warn("Error stopping audio tracks:", e);
      }
      mediaStreamRef.current = null;
    }
    if (recognitionRef.current) {
      try {
        recognitionRef.current.abort();
      } catch (e) { }
      recognitionRef.current = null;
    }
    mediaRecorderRef.current = null;
    audioChunksRef.current = [];
  };

  // ──────────────────────────────────────────────────────────────────────────
  // AUDIO RECORDING & SPEECH-TO-TEXT IMPLEMENTATION
  // ──────────────────────────────────────────────────────────────────────────
  const startRecording = async () => {
    cleanupAudioSession();
    setAudioErrorMessage(null);
    setAiErrorNotice(null);
    setAudioState('requesting_permission');
    setRecordingSeconds(0);
    interimSpeechRef.current = '';

    // Verify browser mediaDevices support
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      setAudioState('error');
      setAudioErrorMessage("Microphone capture is not supported in this browser environment. Please type your instruction.");
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true
        }
      });
      mediaStreamRef.current = stream;

      // Start duration timer
      setAudioState('listening');
      const startTime = Date.now();
      timerIntervalRef.current = setInterval(() => {
        setRecordingSeconds(Math.floor((Date.now() - startTime) / 1000));
      }, 500);

      // 1. Initialize MediaRecorder for backup audio transcription
      try {
        const mimeType = MediaRecorder.isTypeSupported('audio/webm')
          ? 'audio/webm'
          : MediaRecorder.isTypeSupported('audio/mp4')
            ? 'audio/mp4'
            : '';
        const recorder = mimeType ? new MediaRecorder(stream, { mimeType }) : new MediaRecorder(stream);
        audioChunksRef.current = [];
        recorder.ondataavailable = (e) => {
          if (e.data && e.data.size > 0) {
            audioChunksRef.current.push(e.data);
          }
        };
        recorder.start(250);
        mediaRecorderRef.current = recorder;
      } catch (recorderErr) {
        console.warn("MediaRecorder init notice:", recorderErr);
      }

      // 2. Initialize Web Speech API for real-time speech recognition
      const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
      const initialBaseText = instructionText.trim();

      if (SpeechRecognition) {
        const recognition = new SpeechRecognition();
        recognition.continuous = true;
        recognition.interimResults = true;

        // Auto: defaults to Hindi/English dual support (hi-IN handles Hindi & Hinglish, en-IN handles Indian English & Hinglish)
        if (selectedLanguage === 'hi-IN') {
          recognition.lang = 'hi-IN';
        } else if (selectedLanguage === 'en-IN') {
          recognition.lang = 'en-IN';
        } else {
          recognition.lang = 'hi-IN'; // Default to hi-IN which has strong Hindi & Hinglish recognition
        }

        recognition.onresult = (event: any) => {
          let fullText = '';
          for (let i = 0; i < event.results.length; ++i) {
            fullText += event.results[i][0].transcript + ' ';
          }
          const spokenClean = fullText.trim();
          interimSpeechRef.current = spokenClean;

          if (spokenClean) {
            setInstructionText(initialBaseText ? `${initialBaseText} ${spokenClean}` : spokenClean);
          }
        };

        recognition.onerror = (event: any) => {
          console.warn("Speech recognition event:", event.error);
          if (event.error === 'not-allowed') {
            setAudioState('error');
            setAudioErrorMessage("Microphone access is blocked. Allow microphone permission in your browser and try again.");
          }
        };

        recognition.onend = () => {
          // Keep recording until user clicks Stop Recording
        };

        try {
          recognition.start();
          recognitionRef.current = recognition;
        } catch (e) {
          console.warn("SpeechRecognition start notice:", e);
        }
      }

    } catch (err: any) {
      console.error("Microphone access error:", err);
      cleanupAudioSession();
      setAudioState('error');
      if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
        setAudioErrorMessage("Microphone access is blocked. Allow microphone permission in your browser and try again.");
      } else if (err.name === 'NotFoundError' || err.name === 'DevicesNotFoundError') {
        setAudioErrorMessage("No microphone was detected. Please connect a microphone or type your instructions.");
      } else {
        setAudioErrorMessage("Could not start microphone recording. " + (err.message || "Please check browser permissions."));
      }
    }
  };

  const stopRecording = async () => {
    if (audioState !== 'listening' && audioState !== 'requesting_permission') {
      return;
    }

    setAudioState('transcribing');
    if (timerIntervalRef.current) {
      clearInterval(timerIntervalRef.current);
      timerIntervalRef.current = null;
    }

    // Stop Web Speech API
    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop();
      } catch (e) { }
    }

    // Capture final Speech API transcript
    const finalSpeechText = interimSpeechRef.current.trim();

    // Stop MediaRecorder if running
    let audioBlob: Blob | null = null;
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      await new Promise<void>((resolve) => {
        if (!mediaRecorderRef.current) return resolve();
        mediaRecorderRef.current.onstop = () => {
          if (audioChunksRef.current.length > 0) {
            audioBlob = new Blob(audioChunksRef.current, { type: audioChunksRef.current[0].type || 'audio/webm' });
          }
          resolve();
        };
        try {
          mediaRecorderRef.current.stop();
        } catch (e) {
          resolve();
        }
      });
    }

    // Stop all microphone stream tracks immediately
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach(track => track.stop());
      mediaStreamRef.current = null;
    }

    // Process transcribed result
    try {
      if (finalSpeechText || instructionText.trim()) {
        // Successfully transcribed via real-time Web Speech API
        if (finalSpeechText && !instructionText.includes(finalSpeechText)) {
          setInstructionText(prev => {
            const trimmed = prev.trim();
            return trimmed ? `${trimmed} ${finalSpeechText}` : finalSpeechText;
          });
        }
        setAudioState('ready');
        setAudioErrorMessage(null);
      } else if (audioBlob && (audioBlob as Blob).size > 1000) {
        // Attempt server-side transcription if audio blob exists
        try {
          const reader = new FileReader();
          const base64Promise = new Promise<string>((resolve, reject) => {
            reader.onloadend = () => {
              const base64 = (reader.result as string).split(',')[1];
              resolve(base64);
            };
            reader.onerror = reject;
          });
          reader.readAsDataURL(audioBlob);
          const base64Audio = await base64Promise;

          const res = await fetch('/api/gemini/transcribe', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              audioBase64: base64Audio,
              mimeType: (audioBlob as Blob).type || 'audio/webm',
              language: selectedLanguage
            })
          });

          if (res.ok) {
            const data = await res.json();
            const serverText = (data.transcript || data.text || '').trim();
            if (serverText) {
              setInstructionText(prev => {
                const trimmed = prev.trim();
                return trimmed ? `${trimmed} ${serverText}` : serverText;
              });
              setAudioState('ready');
              setAudioErrorMessage(null);
              return;
            }
          }
          throw new Error("No transcription received from audio.");
        } catch (serverTranscribeErr) {
          console.warn("Server transcription notice:", serverTranscribeErr);
          setAudioState('error');
          setAudioErrorMessage("We couldn't transcribe that recording. Please speak clearly into your microphone or type your instruction.");
        }
      } else {
        setAudioState('error');
        setAudioErrorMessage("We couldn't transcribe that recording. Nothing was heard. Please speak clearly into your microphone or type your instructions.");
      }
    } catch (e: any) {
      setAudioState('error');
      setAudioErrorMessage("We couldn't transcribe that recording. " + (e?.message || ""));
    } finally {
      cleanupAudioSession();
    }
  };

  const cancelRecording = () => {
    cleanupAudioSession();
    setAudioState('idle');
    setAudioErrorMessage(null);
  };

  const showInlineFeedback = (message: string, type: 'success' | 'error' | 'warning' = 'success') => {
    setFormFeedback({ message, type });
    setTimeout(() => {
      setFormFeedback(null);
    }, 5000);
  };

  // Date shortcut helper
  const setQuickDate = (offsetDays: number) => {
    const d = new Date();
    d.setDate(d.getDate() + offsetDays);
    setEasyDueDate(d.toISOString().split('T')[0]);
  };

  const setNextMonday = () => {
    const d = new Date();
    const day = d.getDay();
    const diff = (8 - day) % 7 || 7;
    d.setDate(d.getDate() + diff);
    setEasyDueDate(d.toISOString().split('T')[0]);
  };

  // Active assignable employees
  const activeEmployees = employees.filter(emp => emp.status !== 'Inactive');

  // ──────────────────────────────────────────────────────────────────────────
  // 1. MANUAL PLAN ENTRY SUBMISSION
  // ──────────────────────────────────────────────────────────────────────────
  const handleSaveEasyForm = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormFeedback(null);

    if (!easyClientId) {
      showInlineFeedback("Please select a target Client Brand.", "warning");
      return;
    }
    if (!easyTitle.trim()) {
      showInlineFeedback("Please enter a Content Topic or Title.", "warning");
      return;
    }
    if (!easyFormat) {
      showInlineFeedback("Please select a Deliverable Format.", "warning");
      return;
    }
    if (!easyPlatform) {
      showInlineFeedback("Please select a Publishing Platform.", "warning");
      return;
    }
    if (!easyDueDate) {
      showInlineFeedback("Please pick a Due Date.", "warning");
      return;
    }
    if (!easyAssigneeId) {
      showInlineFeedback("Please assign a Maker (Assignee) to this deliverable before submitting.", "warning");
      return;
    }

    const selectedClient = clients.find(c => c.clientId === easyClientId);
    const targetClientName = selectedClient?.clientName || 'General';

    try {
      setIsSubmittingEasyForm(true);

      const contentId = "post_" + Math.random().toString(36).substring(2, 9);
      const taskId = `task_${contentId}`;
      const nowIso = new Date().toISOString();

      const assignedEmployee = employees.find(emp => emp.employeeId === easyAssigneeId || emp.id === easyAssigneeId);
      const assignedUploader = employees.find(emp => emp.employeeId === easyUploaderId || emp.id === easyUploaderId);

      const dateObj = new Date(easyDueDate);
      const monthStr = `${dateObj.getFullYear()}-${String(dateObj.getMonth() + 1).padStart(2, '0')}`;

      const calendarPayload: CalendarEntry = {
        contentId,
        clientId: easyClientId,
        clientName: targetClientName,
        date: easyDueDate,
        time: easyTime || '12:00',
        month: monthStr,
        year: dateObj.getFullYear(),
        platform: easyPlatform as any,
        contentType: easyFormat as any,
        topic: easyTitle.trim(),
        caption: easyCaption.trim(),
        hashtags: '',
        status: easyStatus as any,
        postedStatus: easyStatus === 'Posted' ? 'Posted' : 'Not Posted',
        clientApprovalStatus: 'Pending',
        assigneeId: easyAssigneeId || '',
        assigneeName: assignedEmployee ? assignedEmployee.name : 'Unassigned',
        uploaderId: easyUploaderId || '',
        uploaderName: assignedUploader ? assignedUploader.name : 'Unassigned',
        taskId,
        createdBy: profile?.name || profile?.email || 'Super Admin',
        createdByUid: profile?.userId || auth.currentUser?.uid || 'admin',
        updatedBy: profile?.name || profile?.email || 'Super Admin',
        createdAt: nowIso,
        updatedAt: nowIso
      };

      await persistNewCalendarEntry(calendarPayload, profile);

      // Reset form
      setEasyTitle('');
      setEasyCaption('');
      showInlineFeedback(`Planned "${easyTitle.trim()}" for ${targetClientName} on ${easyDueDate}!`, "success");

      if (onTaskCreated) onTaskCreated();

    } catch (err: any) {
      console.error("Error saving content item:", err);
      showInlineFeedback("Content item could not be saved. " + (err?.message || "Please retry."), "error");
    } finally {
      setIsSubmittingEasyForm(false);
    }
  };

  // ──────────────────────────────────────────────────────────────────────────
  // 2. AI COMMAND MODE & NATURAL PARSER
  // ──────────────────────────────────────────────────────────────────────────
  const handleAIAutofill = async (customInstruction?: string) => {
    const textToRun = (customInstruction || instructionText).trim();
    if (!textToRun) {
      setAiErrorNotice("Describe what you want to plan first.");
      return;
    }

    setIsAiProcessing(true);
    setAiErrorNotice(null);

    try {
      const payloadClients = clients.map(c => ({
        clientId: c.clientId,
        clientName: c.clientName,
        businessName: c.businessName,
        category: c.category
      }));

      const payloadEmployees = employees.map(e => ({
        employeeId: e.employeeId || e.id,
        name: e.name,
        role: e.role
      }));

      const response = await fetch('/api/gemini/parse', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          instruction: textToRun,
          clients: payloadClients,
          employees: payloadEmployees,
          currentDate: new Date().toISOString()
        })
      });

      if (!response.ok) {
        throw new Error(`Server returned status ${response.status}`);
      }

      const parsed = await response.json();

      if (parsed.error && !parsed.fallback) {
        throw new Error(parsed.error);
      }

      // Match client or fallback
      const matchedClient = clients.find(c => c.clientId === parsed.clientId || (parsed.clientName && c.clientName.toLowerCase().includes(parsed.clientName.toLowerCase())));

      setDrawerClientId(matchedClient?.clientId || parsed.clientId || '');
      setDrawerClientName(matchedClient?.clientName || parsed.clientName || '');
      setDrawerProjectName(parsed.projectName || 'Social Campaign');
      setClarificationQuestion(parsed.clarificationQuestion || '');

      const parsedTasksList = parsed.tasks && parsed.tasks.length > 0
        ? parsed.tasks
        : [{
          title: textToRun,
          category: 'Social Media',
          format: 'Static Post',
          platforms: ['Instagram'],
          quantity: 1,
          priority: 'Medium',
          assigneeId: '',
          dueDate: new Date(Date.now() + 86400000 * 2).toISOString().split('T')[0],
          instructions: textToRun,
          status: 'Planned'
        }];

      const mapped: ParsedWorkTask[] = parsedTasksList.map((t: any, idx: number) => {
        let assigneeId = t.assigneeId || '';
        let assigneeName = '';
        if (assigneeId) {
          const emp = employees.find(e => e.employeeId === assigneeId || e.id === assigneeId);
          if (emp) assigneeName = emp.name;
        }

        const isVideo = ['reel', 'video', 'youtube short'].includes((t.format || '').toLowerCase());
        const defaultSubtaskTitles = isVideo
          ? ['Topic & Hook research', 'Script outline', 'Video editing & motion graphics', 'Client review', 'Publishing']
          : ['Topic research', 'Graphic design & copy', 'Client review', 'Publishing'];

        const taskDueDate = t.dueDate || new Date(Date.now() + 86400000 * (idx + 1)).toISOString().split('T')[0];

        return {
          id: 'temp_' + Math.random().toString(36).substring(2, 9),
          title: t.title || 'Untitled Post',
          category: t.category || (isVideo ? 'Video Production' : 'Social Media'),
          format: t.format || (isVideo ? 'Reel' : 'Static Post'),
          platforms: t.platforms && t.platforms.length > 0 ? t.platforms : ['Instagram'],
          quantity: t.quantity || 1,
          priority: (t.priority ? (t.priority.charAt(0).toUpperCase() + t.priority.slice(1).toLowerCase()) : 'Medium') as any,
          assigneeId,
          assigneeName,
          startDate: t.startDate || new Date().toISOString().split('T')[0],
          dueDate: taskDueDate,
          publishDate: t.publishDate || taskDueDate,
          estimatedHours: t.estimatedHours || 2,
          instructions: t.instructions || textToRun,
          status: t.status || 'Planned',
          isRecurring: !!t.isRecurring,
          recurrenceRule: t.recurrenceRule || '',
          confidence: t.confidence || 0.85,
          inferredFields: t.inferredFields || [],
          subtasks: defaultSubtaskTitles.map(st => ({
            title: st,
            checked: true,
            assigneeId,
            assigneeName,
            dueDate: taskDueDate
          }))
        };
      });

      setReviewTasks(mapped);
      setIsDrawerOpen(true);

    } catch (err: any) {
      console.warn('AI Parser notice:', err);
      // Safe non-blocking fallback into Review Drawer
      setAiErrorNotice("AI could not fully interpret this request. Your draft is safe — review the fields manually.");
      handleFallbackDrawer(textToRun);
    } finally {
      setIsAiProcessing(false);
    }
  };

  const handleFallbackDrawer = (fallbackText: string) => {
    setDrawerClientId(easyClientId || clients[0]?.clientId || '');
    setDrawerClientName(clients.find(c => c.clientId === (easyClientId || clients[0]?.clientId))?.clientName || 'General');
    setDrawerProjectName('Social Campaign');
    setClarificationQuestion('');

    setReviewTasks([{
      id: 'temp_' + Math.random().toString(36).substring(2, 9),
      title: fallbackText || 'New Scheduled Content Item',
      category: 'Social Media',
      format: 'Static Post',
      platforms: ['Instagram'],
      quantity: 1,
      priority: 'Medium',
      assigneeId: '',
      assigneeName: '',
      startDate: new Date().toISOString().split('T')[0],
      dueDate: new Date(Date.now() + 86400000 * 2).toISOString().split('T')[0],
      publishDate: new Date(Date.now() + 86400000 * 2).toISOString().split('T')[0],
      estimatedHours: 2,
      instructions: fallbackText,
      status: 'Planned',
      isRecurring: false,
      recurrenceRule: '',
      confidence: 1.0,
      inferredFields: [],
      subtasks: [
        { title: 'Visual creation & copy', checked: true, assigneeId: '', assigneeName: '', dueDate: new Date().toISOString().split('T')[0] },
        { title: 'Client approval', checked: true, assigneeId: '', assigneeName: '', dueDate: new Date().toISOString().split('T')[0] },
        { title: 'Publishing', checked: true, assigneeId: '', assigneeName: '', dueDate: new Date().toISOString().split('T')[0] }
      ]
    }]);
    setIsDrawerOpen(true);
  };

  // Load preset template
  const handleLoadTemplate = (tpl: typeof TEMPLATE_PRESETS[0]) => {
    const targetClient = clients.find(c => c.clientId === easyClientId) || clients[0];
    setDrawerClientId(targetClient?.clientId || '');
    setDrawerClientName(targetClient?.clientName || 'General');
    setDrawerProjectName(tpl.name);

    const generatedTasks: ParsedWorkTask[] = [];
    const baseDate = new Date();

    for (let i = 0; i < tpl.count; i++) {
      const taskDate = new Date(baseDate);
      taskDate.setDate(taskDate.getDate() + (i * 3) + 1);
      const dateStr = taskDate.toISOString().split('T')[0];

      generatedTasks.push({
        id: 'temp_' + Math.random().toString(36).substring(2, 9),
        title: `${tpl.name} - Item #${i + 1}`,
        category: tpl.category,
        format: tpl.format,
        platforms: tpl.platforms,
        quantity: 1,
        priority: tpl.defaultPriority,
        assigneeId: '',
        assigneeName: 'Unassigned',
        startDate: new Date().toISOString().split('T')[0],
        dueDate: dateStr,
        publishDate: dateStr,
        estimatedHours: 2,
        instructions: `Campaign: ${tpl.name}. ${tpl.description}`,
        status: 'Planned',
        isRecurring: false,
        recurrenceRule: '',
        confidence: 1.0,
        inferredFields: [],
        subtasks: [
          { title: 'Content brief & assets', checked: true, assigneeId: '', assigneeName: '', dueDate: dateStr },
          { title: 'Design & editing', checked: true, assigneeId: '', assigneeName: '', dueDate: dateStr },
          { title: 'Client review', checked: true, assigneeId: '', assigneeName: '', dueDate: dateStr }
        ]
      });
    }

    setReviewTasks(generatedTasks);
    setIsDrawerOpen(true);
  };

  // ──────────────────────────────────────────────────────────────────────────
  // 3. REVIEW & ASSIGN DRAWER CONFIRMATION
  // ──────────────────────────────────────────────────────────────────────────
  const handleConfirmReviewDrawer = async (isDraftOnly = false) => {
    if (!drawerClientId) {
      showInlineFeedback("Please pick a Client brand before confirming.", "warning");
      return;
    }

    setIsSavingDrawer(true);

    try {
      const clientObj = clients.find(c => c.clientId === drawerClientId);
      const finalClientName = clientObj?.clientName || drawerClientName || 'General';
      const nowIso = new Date().toISOString();

      for (const task of reviewTasks) {
        const contentId = "post_" + Math.random().toString(36).substring(2, 9);
        const taskId = `task_${contentId}`;
        const isVideo = ['reel', 'video', 'youtube short'].includes((task.format || '').toLowerCase());
        const primaryPlatform = task.platforms[0] || 'Instagram';

        const dateObj = new Date(task.dueDate);
        const monthStr = `${dateObj.getFullYear()}-${String(dateObj.getMonth() + 1).padStart(2, '0')}`;

        // 1. Persist contentCalendar, task, and video tracker canonical entry
        const calData: CalendarEntry = {
          contentId,
          clientId: drawerClientId,
          clientName: finalClientName,
          date: task.dueDate,
          time: '12:00',
          month: monthStr,
          year: dateObj.getFullYear(),
          platform: primaryPlatform as any,
          platforms: task.platforms,
          contentType: task.format as any,
          topic: task.title,
          caption: task.instructions,
          hashtags: '',
          status: (isDraftOnly ? 'Idea' : 'Planned') as any,
          postedStatus: 'Not Posted',
          clientApprovalStatus: 'Pending',
          assigneeId: task.assigneeId || '',
          assigneeName: task.assigneeName || 'Unassigned',
          taskId,
          createdBy: profile?.name || profile?.email || 'Super Admin',
          createdByUid: profile?.userId || auth.currentUser?.uid || 'admin',
          updatedBy: profile?.name || profile?.email || 'Super Admin',
          createdAt: nowIso,
          updatedAt: nowIso
        };

        await persistNewCalendarEntry(calData, profile);
      }

      setIsDrawerOpen(false);
      setInstructionText('');
      showInlineFeedback(`Successfully scheduled ${reviewTasks.length} items for ${finalClientName}!`, "success");

      if (onTaskCreated) onTaskCreated();

    } catch (err: any) {
      console.error("Error saving from Review Drawer:", err);
      if (err?.code === 'permission-denied' || err?.message?.toLowerCase().includes('permission')) {
        showInlineFeedback("You do not have permission to create content items. Please verify your admin session.", "error");
      } else {
        showInlineFeedback("Failed to save reviewed items: " + (err?.message || "Unknown error"), "error");
      }
    } finally {
      setIsSavingDrawer(false);
    }
  };

  return (
    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-5 shadow-xs space-y-4">

      {/* Inline Feedback Banner */}
      {formFeedback && (
        <div className={`p-3 rounded-2xl flex items-center justify-between text-xs font-bold transition-all ${formFeedback.type === 'error'
            ? 'bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-900/60'
            : formFeedback.type === 'warning'
              ? 'bg-amber-50 dark:bg-amber-950/40 text-amber-800 dark:text-amber-300 border border-amber-200 dark:border-amber-900/60'
              : 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-900/60'
          }`}>
          <div className="flex items-center gap-2">
            {formFeedback.type === 'error' ? <AlertTriangle className="w-4 h-4 text-rose-500" /> : <CheckCircle2 className="w-4 h-4 text-emerald-500" />}
            <span>{formFeedback.message}</span>
          </div>
          <button onClick={() => setFormFeedback(null)} className="p-1 hover:opacity-75"><X className="w-3.5 h-3.5" /></button>
        </div>
      )}

      {/* Top Tab Mode Switcher */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 pb-3 border-b border-slate-100 dark:border-slate-800">
        <div className="flex items-center gap-1.5 p-1 bg-slate-100 dark:bg-slate-950 rounded-2xl border border-slate-200 dark:border-slate-800 text-xs font-black">
          <button
            type="button"
            onClick={() => setActiveTab('easy')}
            className={`flex items-center gap-1.5 py-1.5 px-3.5 rounded-xl transition-all ${activeTab === 'easy'
                ? 'bg-white dark:bg-slate-900 text-blue-600 dark:text-blue-400 shadow-xs'
                : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'
              }`}
          >
            <Sliders className="w-3.5 h-3.5" /> Plan Entry
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('ai')}
            className={`flex items-center gap-1.5 py-1.5 px-3.5 rounded-xl transition-all ${activeTab === 'ai'
                ? 'bg-white dark:bg-slate-900 text-purple-600 dark:text-purple-400 shadow-xs'
                : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'
              }`}
          >
            <Sparkles className="w-3.5 h-3.5" /> AI Command Hub
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('templates')}
            className={`flex items-center gap-1.5 py-1.5 px-3.5 rounded-xl transition-all ${activeTab === 'templates'
                ? 'bg-white dark:bg-slate-900 text-emerald-600 dark:text-emerald-400 shadow-xs'
                : 'text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200'
              }`}
          >
            <Bookmark className="w-3.5 h-3.5" /> Smart Content Routines
          </button>
        </div>

        <span className="text-[11px] font-bold text-slate-400">
          {activeTab === 'easy' && 'Reliable manual planner with direct task synchronization'}
          {activeTab === 'ai' && 'Convert natural language requests into structured deliverables'}
          {activeTab === 'templates' && 'Workflow-aware delivery routines adapted to client package, industry and capacity'}
        </span>
      </div>

      {/* ─────────────────────────────────────────────────────────────────── */}
      {/* TAB 1: MANUAL PLAN ENTRY (EASY PLANNER)                            */}
      {/* ─────────────────────────────────────────────────────────────────── */}
      {activeTab === 'easy' && (
        <form onSubmit={handleSaveEasyForm} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-3">
            {/* Client Select */}
            <div className="space-y-1">
              <label className="text-[10px] font-black uppercase tracking-wider text-slate-400">Client Brand *</label>
              <ClientSelect
                clients={clients}
                selectedClientId={easyClientId}
                onSelectClient={(id) => setEasyClientId(id)}
                placeholder="Select Client..."
              />
            </div>

            {/* Title / Topic */}
            <div className="space-y-1 md:col-span-2">
              <label className="text-[10px] font-black uppercase tracking-wider text-slate-400">Content Topic / Title *</label>
              <input
                type="text"
                value={easyTitle}
                onChange={(e) => setEasyTitle(e.target.value)}
                placeholder="e.g. 5 Signs of Herniated Disc, Monsoon Hydration Reel..."
                className="w-full text-xs font-medium bg-slate-50/60 dark:bg-slate-950/40 border border-slate-200 dark:border-slate-800 p-2 rounded-xl outline-none text-slate-900 dark:text-slate-100"
                required
              />
            </div>

            {/* Format */}
            <div className="space-y-1">
              <label className="text-[10px] font-black uppercase tracking-wider text-slate-400">Deliverable Format *</label>
              <select
                value={easyFormat}
                onChange={(e) => setEasyFormat(e.target.value)}
                className="w-full text-xs font-bold bg-slate-50/60 dark:bg-slate-950/40 border border-slate-200 dark:border-slate-800 p-2 rounded-xl outline-none text-slate-800 dark:text-slate-200"
                required
              >
                <option value="Static Post">Static Post</option>
                <option value="Reel">Instagram Reel</option>
                <option value="Carousel">Carousel Slides</option>
                <option value="Story">Story</option>
                <option value="YouTube Short">YouTube Short</option>
                <option value="Video">Video Production</option>
                <option value="GMB Post">Google Business Post</option>
                <option value="Website Work">Website Work</option>
                <option value="Other">Other</option>
              </select>
            </div>

            {/* Platform */}
            <div className="space-y-1">
              <label className="text-[10px] font-black uppercase tracking-wider text-slate-400">Publish Platform *</label>
              <select
                value={easyPlatform}
                onChange={(e) => setEasyPlatform(e.target.value)}
                className="w-full text-xs font-bold bg-slate-50/60 dark:bg-slate-950/40 border border-slate-200 dark:border-slate-800 p-2 rounded-xl outline-none text-slate-800 dark:text-slate-200"
                required
              >
                <option value="Instagram">Instagram</option>
                <option value="Facebook">Facebook</option>
                <option value="YouTube">YouTube</option>
                <option value="LinkedIn">LinkedIn</option>
                <option value="Google Business Profile">Google Business Profile</option>
                <option value="Website">Website</option>
                <option value="X">X (Twitter)</option>
                <option value="Other">Other</option>
              </select>
            </div>

            {/* Scheduled Date Popover */}
            <PopoverDatePicker
              label="Due Date"
              selectedDate={easyDueDate}
              onChange={(newDateStr) => setEasyDueDate(newDateStr)}
              required
            />

            {/* Assignee Maker */}
            <div className="space-y-1">
              <label className="text-[10px] font-black uppercase tracking-wider text-slate-400">Maker (Assignee) *</label>
              <select
                value={easyAssigneeId}
                onChange={(e) => setEasyAssigneeId(e.target.value)}
                className="w-full text-xs font-bold bg-slate-50/60 dark:bg-slate-950/40 border border-slate-200 dark:border-slate-800 p-2 rounded-xl outline-none text-slate-800 dark:text-slate-200"
                required
              >
                <option value="">-- Select Maker (Assignee) * --</option>
                {activeEmployees.map(emp => (
                  <option key={emp.employeeId || emp.id} value={emp.employeeId || emp.id}>
                    {emp.name} ({emp.role})
                  </option>
                ))}
              </select>
            </div>

            {/* Status & Priority */}
            <div className="space-y-1">
              <label className="text-[10px] font-black uppercase tracking-wider text-slate-400">Status *</label>
              <select
                value={easyStatus}
                onChange={(e) => setEasyStatus(e.target.value)}
                className="w-full text-xs font-bold bg-slate-50/60 dark:bg-slate-950/40 border border-slate-200 dark:border-slate-800 p-2 rounded-xl outline-none text-slate-800 dark:text-slate-200"
                required
              >
                <option value="Planned">Planned</option>
                <option value="In Design">In Design</option>
                <option value="Sent for Approval">Sent for Approval</option>
                <option value="Approved">Approved</option>
                <option value="Scheduled">Scheduled</option>
                <option value="Posted">Posted</option>
                <option value="Idea">Idea</option>
              </select>
            </div>
          </div>

          {/* Caption / Copy */}
          <div className="space-y-1">
            <label className="text-[10px] font-black uppercase tracking-wider text-slate-400">Caption & Work Notes (Optional)</label>
            <input
              type="text"
              value={easyCaption}
              onChange={(e) => setEasyCaption(e.target.value)}
              placeholder="Caption details, hashtags, hook notes or design instructions..."
              className="w-full text-xs font-medium bg-slate-50/60 dark:bg-slate-950/40 border border-slate-200 dark:border-slate-800 p-2 rounded-xl outline-none text-slate-900 dark:text-slate-100"
            />
          </div>

          <div className="flex justify-end pt-1">
            <button
              type="submit"
              disabled={isSubmittingEasyForm}
              className="py-2.5 px-6 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-extrabold rounded-xl text-xs shadow-sm hover:shadow-md transition-all inline-flex items-center gap-2"
            >
              {isSubmittingEasyForm ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-3.5 h-3.5" />}
              <span>Plan & Schedule Item</span>
            </button>
          </div>
        </form>
      )}

      {/* ─────────────────────────────────────────────────────────────────── */}
      {/* TAB 2: AI COMMAND HUB                                              */}
      {/* ─────────────────────────────────────────────────────────────────── */}
      {activeTab === 'ai' && (
        <div className="space-y-3">
          {/* Microphone & System Error Notice */}
          {audioErrorMessage && (
            <div className="p-3 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/60 rounded-2xl text-xs font-bold text-rose-900 dark:text-rose-200 flex items-center justify-between gap-2 animate-fade-in">
              <div className="flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
                <span>{audioErrorMessage}</span>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <button
                  type="button"
                  onClick={startRecording}
                  className="px-2.5 py-1 bg-rose-600 hover:bg-rose-700 text-white rounded-lg text-[11px] font-bold transition-all shadow-xs"
                >
                  Retry Microphone
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setAudioErrorMessage(null);
                    setAudioState('idle');
                  }}
                  className="px-2.5 py-1 bg-white dark:bg-slate-900 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-800 rounded-lg text-[11px] font-bold transition-all"
                >
                  Type Instead
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setAudioErrorMessage(null);
                    setAudioState('idle');
                  }}
                  className="p-1 text-rose-400 hover:text-rose-600"
                  title="Dismiss"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          )}

          {/* AI Parser Error / Warning Notice */}
          {aiErrorNotice && !audioErrorMessage && (
            <div className="p-3 bg-purple-50 dark:bg-purple-950/40 border border-purple-200 dark:border-purple-900/60 rounded-2xl text-xs font-bold text-purple-900 dark:text-purple-200 flex items-center justify-between gap-2 animate-fade-in">
              <div className="flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-purple-600 shrink-0" />
                <span>{aiErrorNotice}</span>
              </div>
              <button
                type="button"
                onClick={() => setAiErrorNotice(null)}
                className="p-1 text-purple-400 hover:text-purple-600"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          )}

          {/* Active Audio State Indicators */}
          {audioState === 'requesting_permission' && (
            <div className="p-3 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900/60 rounded-2xl text-xs font-bold text-amber-900 dark:text-amber-200 flex items-center gap-2">
              <Loader2 className="w-4 h-4 text-amber-600 animate-spin shrink-0" />
              <span>Requesting microphone permission from your browser...</span>
            </div>
          )}

          {audioState === 'listening' && (
            <div className="p-3.5 bg-red-50/80 dark:bg-red-950/40 border border-red-200 dark:border-red-900/60 rounded-2xl flex items-center justify-between gap-3 animate-fade-in shadow-xs">
              <div className="flex items-center gap-3">
                <span className="relative flex h-3.5 w-3.5">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-3.5 w-3.5 bg-red-600"></span>
                </span>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-black text-red-900 dark:text-red-200">Listening...</span>
                  <span className="text-xs font-mono font-bold bg-white/80 dark:bg-black/40 px-2 py-0.5 rounded text-red-700 dark:text-red-300 border border-red-200 dark:border-red-900">
                    {String(Math.floor(recordingSeconds / 60)).padStart(2, '0')}:{String(recordingSeconds % 60).padStart(2, '0')}
                  </span>
                </div>
                <div className="hidden sm:flex items-center gap-1 text-[11px] font-bold text-red-700/80 dark:text-red-300/80">
                  <Radio className="w-3 h-3 text-red-500 animate-pulse" />
                  <span>Speak Hindi, English or Hinglish instruction</span>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={stopRecording}
                  className="py-1.5 px-3.5 bg-red-600 hover:bg-red-700 text-white rounded-xl text-xs font-black shadow-sm transition-all flex items-center gap-1.5"
                >
                  <Square className="w-3 h-3 fill-current" />
                  <span>Stop Recording</span>
                </button>
                <button
                  type="button"
                  onClick={cancelRecording}
                  className="py-1.5 px-2.5 bg-white dark:bg-slate-900 hover:bg-slate-100 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 rounded-xl text-xs font-bold transition-all"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}

          {audioState === 'transcribing' && (
            <div className="p-3.5 bg-purple-50 dark:bg-purple-950/40 border border-purple-200 dark:border-purple-900/60 rounded-2xl flex items-center gap-2.5 text-xs font-bold text-purple-900 dark:text-purple-200">
              <Loader2 className="w-4 h-4 text-purple-600 animate-spin shrink-0" />
              <span>Transcribing your speech to text...</span>
            </div>
          )}

          {/* Unified AI Command Textarea */}
          <div className="relative">
            <textarea
              value={instructionText}
              onChange={(e) => {
                setInstructionText(e.target.value);
                if (aiErrorNotice) setAiErrorNotice(null);
                if (audioErrorMessage) setAudioErrorMessage(null);
              }}
              placeholder="Type or speak natural language instructions in Hindi, English or Hinglish (e.g., 'Dr Puneet ke liye next week 4 diabetes reels plan karo' or 'Create 3 carousels for Gangotri this month')..."
              rows={3}
              className="w-full text-xs font-medium bg-slate-50/60 dark:bg-slate-950/40 border border-purple-200 dark:border-purple-900/40 rounded-2xl p-3.5 pr-28 outline-none focus:ring-2 focus:ring-purple-500/20 text-slate-900 dark:text-slate-100 leading-relaxed placeholder-slate-400"
            />

            <div className="absolute right-3 bottom-3 flex items-center gap-1.5">
              {audioState === 'listening' ? (
                <button
                  type="button"
                  onClick={stopRecording}
                  className="p-2 rounded-xl border bg-red-600 text-white border-red-700 animate-pulse shadow-sm"
                  title="Stop recording"
                >
                  <Square className="w-3.5 h-3.5 fill-current" />
                </button>
              ) : (
                <button
                  type="button"
                  onClick={startRecording}
                  disabled={audioState === 'requesting_permission' || audioState === 'transcribing' || isAiProcessing}
                  className="p-2 rounded-xl border bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:text-purple-600 dark:hover:text-purple-400 hover:bg-slate-50 dark:hover:bg-slate-700 transition-all shadow-xs"
                  title="Record speech instruction"
                >
                  <Mic className="w-3.5 h-3.5" />
                </button>
              )}

              <button
                type="button"
                onClick={() => handleAIAutofill()}
                disabled={isAiProcessing || audioState === 'listening' || audioState === 'transcribing'}
                className="py-2 px-3.5 bg-purple-600 hover:bg-purple-700 disabled:opacity-50 text-white rounded-xl text-xs font-extrabold shadow-sm transition-all inline-flex items-center gap-1.5"
              >
                {isAiProcessing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
                <span>{isAiProcessing ? 'Parsing...' : 'Parse'}</span>
              </button>
            </div>
          </div>

          {/* Controls bar: Language Selector & Fast Prompt Examples */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pt-0.5">
            {/* Language hint selector */}
            <div className="flex items-center gap-1.5 text-[11px] font-bold text-slate-400">
              <Globe className="w-3.5 h-3.5 text-slate-400" />
              <span>Voice Language:</span>
              <div className="inline-flex rounded-lg p-0.5 bg-slate-100 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-[10px] font-black">
                <button
                  type="button"
                  onClick={() => setSelectedLanguage('auto')}
                  className={`px-2 py-0.5 rounded-md transition-all ${selectedLanguage === 'auto'
                      ? 'bg-white dark:bg-slate-800 text-purple-600 dark:text-purple-400 shadow-xs'
                      : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
                    }`}
                >
                  Auto / Hinglish
                </button>
                <button
                  type="button"
                  onClick={() => setSelectedLanguage('en-IN')}
                  className={`px-2 py-0.5 rounded-md transition-all ${selectedLanguage === 'en-IN'
                      ? 'bg-white dark:bg-slate-800 text-purple-600 dark:text-purple-400 shadow-xs'
                      : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
                    }`}
                >
                  English
                </button>
                <button
                  type="button"
                  onClick={() => setSelectedLanguage('hi-IN')}
                  className={`px-2 py-0.5 rounded-md transition-all ${selectedLanguage === 'hi-IN'
                      ? 'bg-white dark:bg-slate-800 text-purple-600 dark:text-purple-400 shadow-xs'
                      : 'text-slate-500 hover:text-slate-800 dark:hover:text-slate-200'
                    }`}
                >
                  Hindi
                </button>
              </div>
            </div>

            {/* Prompt quick examples */}
            <div className="flex items-center flex-wrap gap-1.5 text-[10px] font-bold text-slate-400">
              <span>Examples:</span>
              <button
                type="button"
                onClick={() => {
                  const q = "Dr Puneet ke liye next week 4 diabetes reels plan karo";
                  setInstructionText(q);
                  handleAIAutofill(q);
                }}
                className="px-2.5 py-1 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 hover:border-purple-300 text-slate-600 dark:text-slate-300 transition-all"
              >
                "4 Reels for Dr Puneet"
              </button>
              <button
                type="button"
                onClick={() => {
                  const q = "Create 3 carousels for Gangotri this month";
                  setInstructionText(q);
                  handleAIAutofill(q);
                }}
                className="px-2.5 py-1 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 hover:border-purple-300 text-slate-600 dark:text-slate-300 transition-all"
              >
                "3 Carousels for Gangotri"
              </button>
              <button
                type="button"
                onClick={() => {
                  const q = "Plan 5 Instagram posts for Dr Akash next week";
                  setInstructionText(q);
                  handleAIAutofill(q);
                }}
                className="px-2.5 py-1 rounded-lg border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 hover:border-purple-300 text-slate-600 dark:text-slate-300 transition-all"
              >
                "5 Posts for Dr Akash"
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ─────────────────────────────────────────────────────────────────── */}
      {/* TAB 3: ROUTINE PRESETS                                              */}
      {/* ─────────────────────────────────────────────────────────────────── */}
      {activeTab === 'templates' && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {TEMPLATE_PRESETS.map(tpl => (
            <div
              key={tpl.id}
              className="p-4 rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-950/30 hover:border-emerald-500/40 transition-all flex flex-col justify-between space-y-3"
            >
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-black uppercase text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40 px-2 py-0.5 rounded">
                    {tpl.count} Deliverables
                  </span>
                  <span className="text-[9px] font-bold text-slate-400">{tpl.category}</span>
                </div>
                <h4 className="text-xs font-black text-slate-900 dark:text-white">{tpl.name}</h4>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed font-medium">{tpl.description}</p>
              </div>

              <button
                type="button"
                onClick={() => handleLoadTemplate(tpl)}
                className="py-1.5 px-3 w-full bg-white dark:bg-slate-800 hover:bg-emerald-50 dark:hover:bg-emerald-950/30 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:text-emerald-600 rounded-xl text-xs font-bold transition-all inline-flex items-center justify-center gap-1.5"
              >
                <ListPlus className="w-3.5 h-3.5" /> Load Into Review & Assign
              </button>
            </div>
          ))}
        </div>
      )}

      {/* ─────────────────────────────────────────────────────────────────── */}
      {/* REVIEW & ASSIGN DRAWER                                              */}
      {/* ─────────────────────────────────────────────────────────────────── */}
      {isDrawerOpen && (
        <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-3xl max-w-4xl w-full p-6 shadow-2xl space-y-5 max-h-[90vh] flex flex-col">

            {/* Drawer Header */}
            <div className="flex justify-between items-start pb-3 border-b border-slate-100 dark:border-slate-800">
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-lg font-black text-slate-900 dark:text-white">Review & Assign Deliverables</h3>
                  <span className="text-[10px] font-black uppercase px-2 py-0.5 bg-purple-50 dark:bg-purple-950/40 text-purple-600 dark:text-purple-400 rounded-lg">
                    {reviewTasks.length} {reviewTasks.length === 1 ? 'Item' : 'Items'}
                  </span>
                </div>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  Inspect structured output, adjust assignments, and confirm before saving to calendar and task streams.
                </p>
              </div>
              <button onClick={() => setIsDrawerOpen(false)} className="p-1.5 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl">
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Target Client selection inside drawer */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 bg-slate-50 dark:bg-slate-900/50 p-3.5 rounded-2xl border border-slate-200 dark:border-slate-800">
              <div className="space-y-1">
                <label className="text-[10px] font-black uppercase tracking-wider text-slate-400">Target Client Account *</label>
                <ClientSelect
                  clients={clients}
                  selectedClientId={drawerClientId}
                  onSelectClient={(id) => {
                    setDrawerClientId(id);
                    const c = clients.find(cl => cl.clientId === id);
                    if (c) setDrawerClientName(c.clientName);
                  }}
                  placeholder="Select Client..."
                />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-black uppercase tracking-wider text-slate-400">Campaign / Project Name</label>
                <input
                  type="text"
                  value={drawerProjectName}
                  onChange={(e) => setDrawerProjectName(e.target.value)}
                  className="w-full text-xs font-medium bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-2 rounded-xl outline-none"
                  placeholder="Campaign name..."
                />
              </div>
            </div>

            {/* Review Tasks List */}
            <div className="overflow-y-auto flex-grow space-y-3 pr-1 custom-scrollbar">
              {reviewTasks.map((task, idx) => (
                <div
                  key={task.id}
                  className="p-4 rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/30 space-y-3"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-black text-purple-600 dark:text-purple-400 uppercase tracking-widest">
                      Item #{idx + 1}
                    </span>
                    <button
                      type="button"
                      onClick={() => {
                        setReviewTasks(reviewTasks.filter(t => t.id !== task.id));
                      }}
                      className="text-slate-400 hover:text-rose-500 p-1"
                      title="Remove item"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
                    {/* Title */}
                    <div className="sm:col-span-2 space-y-1">
                      <label className="text-[9px] font-black uppercase text-slate-400">Title / Topic *</label>
                      <input
                        type="text"
                        value={task.title}
                        onChange={(e) => {
                          const updated = [...reviewTasks];
                          updated[idx].title = e.target.value;
                          setReviewTasks(updated);
                        }}
                        className="w-full text-xs font-bold bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-2 rounded-xl outline-none"
                      />
                    </div>

                    {/* Format */}
                    <div className="space-y-1">
                      <label className="text-[9px] font-black uppercase text-slate-400">Format</label>
                      <select
                        value={task.format}
                        onChange={(e) => {
                          const updated = [...reviewTasks];
                          updated[idx].format = e.target.value;
                          setReviewTasks(updated);
                        }}
                        className="w-full text-xs font-bold bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-2 rounded-xl outline-none"
                      >
                        <option value="Static Post">Static Post</option>
                        <option value="Reel">Reel</option>
                        <option value="Carousel">Carousel</option>
                        <option value="Story">Story</option>
                        <option value="YouTube Short">YouTube Short</option>
                        <option value="Video">Video</option>
                      </select>
                    </div>

                    {/* Due Date */}
                    <div className="space-y-1">
                      <label className="text-[9px] font-black uppercase text-slate-400">Scheduled Date *</label>
                      <input
                        type="date"
                        value={task.dueDate}
                        onChange={(e) => {
                          const updated = [...reviewTasks];
                          updated[idx].dueDate = e.target.value;
                          setReviewTasks(updated);
                        }}
                        className="w-full text-xs font-bold bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-2 rounded-xl outline-none"
                      />
                    </div>

                    {/* Assignee */}
                    <div className="space-y-1">
                      <label className="text-[9px] font-black uppercase text-slate-400">Assign Maker</label>
                      <select
                        value={task.assigneeId}
                        onChange={(e) => {
                          const updated = [...reviewTasks];
                          const emp = employees.find(em => em.employeeId === e.target.value || em.id === e.target.value);
                          updated[idx].assigneeId = e.target.value;
                          updated[idx].assigneeName = emp ? emp.name : 'Unassigned';
                          setReviewTasks(updated);
                        }}
                        className="w-full text-xs font-medium bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-2 rounded-xl outline-none"
                      >
                        <option value="">-- Unassigned --</option>
                        {activeEmployees.map(emp => (
                          <option key={emp.employeeId || emp.id} value={emp.employeeId || emp.id}>
                            {emp.name} ({emp.role})
                          </option>
                        ))}
                      </select>
                    </div>

                    {/* Priority */}
                    <div className="space-y-1">
                      <label className="text-[9px] font-black uppercase text-slate-400">Priority</label>
                      <select
                        value={task.priority}
                        onChange={(e) => {
                          const updated = [...reviewTasks];
                          updated[idx].priority = e.target.value as any;
                          setReviewTasks(updated);
                        }}
                        className="w-full text-xs font-bold bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-2 rounded-xl outline-none"
                      >
                        <option value="Low">Low</option>
                        <option value="Medium">Medium</option>
                        <option value="High">High</option>
                        <option value="Urgent">Urgent</option>
                      </select>
                    </div>

                    {/* Platform */}
                    <div className="sm:col-span-2 space-y-1">
                      <label className="text-[9px] font-black uppercase text-slate-400">Platforms</label>
                      <input
                        type="text"
                        value={task.platforms.join(', ')}
                        onChange={(e) => {
                          const updated = [...reviewTasks];
                          updated[idx].platforms = e.target.value.split(',').map(p => p.trim()).filter(Boolean);
                          setReviewTasks(updated);
                        }}
                        placeholder="Instagram, Facebook..."
                        className="w-full text-xs font-medium bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-2 rounded-xl outline-none"
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Actions footer */}
            <div className="flex flex-col sm:flex-row justify-between items-center gap-3 pt-3 border-t border-slate-100 dark:border-slate-800">
              <button
                type="button"
                onClick={() => {
                  setReviewTasks([...reviewTasks, {
                    id: 'temp_' + Math.random().toString(36).substring(2, 9),
                    title: 'New Content Item',
                    category: 'Social Media',
                    format: 'Static Post',
                    platforms: ['Instagram'],
                    quantity: 1,
                    priority: 'Medium',
                    assigneeId: '',
                    assigneeName: 'Unassigned',
                    startDate: new Date().toISOString().split('T')[0],
                    dueDate: new Date(Date.now() + 86400000).toISOString().split('T')[0],
                    publishDate: new Date(Date.now() + 86400000).toISOString().split('T')[0],
                    estimatedHours: 2,
                    instructions: '',
                    status: 'Planned',
                    isRecurring: false,
                    recurrenceRule: '',
                    confidence: 1.0,
                    inferredFields: [],
                    subtasks: []
                  }]);
                }}
                className="text-xs font-bold text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-1"
              >
                <Plus className="w-3.5 h-3.5" /> Add Another Item
              </button>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setIsDrawerOpen(false)}
                  className="py-2 px-4 rounded-xl border border-slate-200 dark:border-slate-800 text-xs font-bold text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-900"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => handleConfirmReviewDrawer(true)}
                  disabled={isSavingDrawer || reviewTasks.length === 0}
                  className="py-2 px-4 rounded-xl border border-purple-200 dark:border-purple-800/60 hover:bg-purple-50 dark:hover:bg-purple-950/30 text-purple-700 dark:text-purple-300 text-xs font-bold transition-all"
                >
                  Save as Draft Ideas
                </button>
                <button
                  type="button"
                  onClick={() => handleConfirmReviewDrawer(false)}
                  disabled={isSavingDrawer || reviewTasks.length === 0}
                  className="py-2.5 px-6 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-extrabold rounded-xl text-xs shadow-sm hover:shadow-md transition-all inline-flex items-center gap-2"
                >
                  {isSavingDrawer ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
                  <span>Confirm & Schedule {reviewTasks.length} Deliverables</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
