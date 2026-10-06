import React, { useState, useEffect } from 'react';
import { 
  doc, 
  setDoc, 
  updateDoc, 
  collection, 
  addDoc, 
  onSnapshot, 
  query, 
  where, 
  orderBy 
} from 'firebase/firestore';
import { db, auth, handleFirestoreError, OperationType } from '../../lib/firebase';
import { useAuth } from '../../context/AuthContext';
import { 
  X, 
  ExternalLink, 
  Calendar, 
  CheckCircle2, 
  MessageSquare, 
  AlertTriangle, 
  Send, 
  Clock, 
  Tag, 
  Link as LinkIcon, 
  FileText, 
  Layers, 
  Check,
  Video,
  Instagram,
  User,
  AlertCircle
} from 'lucide-react';
import { 
  persistNewCalendarEntry, 
  persistUpdateCalendarEntry, 
  type CalendarEntry 
} from '../../lib/calendarStorage';
import { type ClientData } from './ClientList';
import { ClientSelect } from './ClientSelect';
import { persistNewTask, persistUpdateTask } from '../../lib/taskStorage';

import { 
  getCachedEmployees, 
  subscribeToCanonicalEmployees, 
  type MasterEmployee 
} from '../../lib/employeeMaster';
import { PopoverDatePicker } from './PopoverDatePicker';

interface CalendarModalProps {
  isOpen: boolean;
  onClose: () => void;
  entry: CalendarEntry | null;
  targetDate: string | null;
  clients: ClientData[];
}

interface CommentData {
  commentId: string;
  contentId: string;
  clientId: string;
  userId: string;
  userName?: string;
  userRole: string;
  comment: string;
  createdAt: string;
}

const AVAILABLE_PLATFORMS = [
  'Instagram',
  'Facebook',
  'YouTube',
  'LinkedIn',
  'Website',
  'Google Business Profile',
  'X',
  'Other'
] as const;

const WORK_TYPES = [
  'Static Post',
  'Reel',
  'Carousel',
  'Story',
  'YouTube Short',
  'Video',
  'GMB Post',
  'Website Work',
  'Other'
] as const;

const STATUS_LIST = [
  'Idea',
  'Planned',
  'In Design',
  'Sent for Approval',
  'Changes Required',
  'Approved',
  'Scheduled',
  'Posted',
  'Cancelled',
  'On Hold'
] as const;

export const CalendarModal: React.FC<CalendarModalProps> = ({ 
  isOpen, 
  onClose, 
  entry, 
  targetDate, 
  clients 
}) => {
  const { profile } = useAuth();
  const isClient = profile?.role === 'client';

  // 1. Core Field States
  const [clientId, setClientId] = useState('');
  const [date, setDate] = useState('');
  const [time, setTime] = useState('12:00');
  const [selectedPlatforms, setSelectedPlatforms] = useState<string[]>(['Instagram']);
  const [contentType, setContentType] = useState<string>('Static Post');
  const [topic, setTopic] = useState('');
  const [caption, setCaption] = useState('');
  const [hashtags, setHashtags] = useState('');
  const [designBrief, setDesignBrief] = useState('');
  const [creativeLink, setCreativeLink] = useState('');
  const [videoLink, setVideoLink] = useState('');
  const [canvaLink, setCanvaLink] = useState('');
  const [driveLink, setDriveLink] = useState('');
  const [status, setStatus] = useState<string>('Planned');
  const [clientApprovalStatus, setClientApprovalStatus] = useState<'Pending' | 'Approved' | 'Changes Required'>('Pending');
  const [clientFeedback, setClientFeedback] = useState('');
  const [internalNotes, setInternalNotes] = useState('');

  // 2. Real-time Comment Streams
  const [comments, setComments] = useState<CommentData[]>([]);
  const [newCommentText, setNewCommentText] = useState('');

  // 3. Employees & Assignee states
  const [employees, setEmployees] = useState<MasterEmployee[]>(() => getCachedEmployees());
  const [assigneeId, setAssigneeId] = useState('');
  const [uploaderId, setUploaderId] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [modalFeedback, setModalFeedback] = useState<string | null>(null);

  useEffect(() => {
    const unsub = subscribeToCanonicalEmployees((canonicalList) => {
      setEmployees(canonicalList);
    });
    return () => unsub();
  }, []);

  useEffect(() => {
    if (entry) {
      setClientId(entry.clientId || '');
      setDate(entry.date || new Date().toISOString().split('T')[0]);
      setTime(entry.time || '12:00');
      
      const platformsArr = (entry as any).platforms || (entry.platform ? [entry.platform] : ['Instagram']);
      setSelectedPlatforms(platformsArr);

      setContentType(entry.contentType || 'Static Post');
      setTopic(entry.topic || '');
      setCaption(entry.caption || '');
      setHashtags(entry.hashtags || '');
      setDesignBrief(entry.designBrief || '');
      setCreativeLink(entry.creativeLink || '');
      setVideoLink(entry.videoLink || '');
      setCanvaLink(entry.canvaLink || '');
      setDriveLink(entry.driveLink || '');
      setStatus(entry.status || 'Planned');
      setClientApprovalStatus(entry.clientApprovalStatus || 'Pending');
      setClientFeedback(entry.clientFeedback || '');
      setInternalNotes(entry.internalNotes || '');
      setAssigneeId(entry.assigneeId || '');
      setUploaderId(entry.uploaderId || '');

      // Load comments for this content item
      const commentsRef = collection(db, 'comments');
      const q = query(commentsRef, where('contentId', '==', entry.contentId), orderBy('createdAt', 'asc'));
      const unsubscribeComments = onSnapshot(q, (snapshot) => {
        const commentList: CommentData[] = [];
        snapshot.forEach((docSnap) => {
          commentList.push({ commentId: docSnap.id, ...docSnap.data() } as CommentData);
        });
        setComments(commentList);
      }, (error) => {
        console.warn("Comments indexing note:", error);
      });

      return () => unsubscribeComments();
    } else {
      // Default Add Mode fields
      setClientId(clients[0]?.clientId || '');
      setDate(targetDate || new Date().toISOString().split('T')[0]);
      setTime('12:00');
      setSelectedPlatforms(['Instagram']);
      setContentType('Static Post');
      setTopic('');
      setCaption('');
      setHashtags('');
      setDesignBrief('');
      setCreativeLink('');
      setVideoLink('');
      setCanvaLink('');
      setDriveLink('');
      setStatus('Planned');
      setClientApprovalStatus('Pending');
      setClientFeedback('');
      setInternalNotes('');
      setComments([]);
      setAssigneeId('');
      setUploaderId('');
    }
  }, [entry, targetDate, clients]);

  const togglePlatform = (p: string) => {
    let next: string[];
    if (selectedPlatforms.includes(p)) {
      if (selectedPlatforms.length === 1) return; // Keep at least one
      next = selectedPlatforms.filter(item => item !== p);
    } else {
      next = [...selectedPlatforms, p];
    }
    setSelectedPlatforms(next);
  };

  const handlePostComment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCommentText.trim() || !entry) return;

    const currentClientId = isClient ? profile.clientId : entry.clientId;
    const commentId = "comment_" + Math.random().toString(36).substring(2, 9);
    
    const commentPayload: CommentData = {
      commentId,
      contentId: entry.contentId,
      clientId: currentClientId || '',
      userId: profile?.userId || 'unknown',
      userName: profile?.name || 'User',
      userRole: profile?.role || 'client',
      comment: newCommentText.trim(),
      createdAt: new Date().toISOString()
    };

    try {
      await setDoc(doc(db, 'comments', commentId), commentPayload);
      setNewCommentText('');
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, `comments/${commentId}`);
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isClient && !entry) return;

    if (!isClient && !clientId) {
      setModalFeedback("Please select a target Client Brand.");
      return;
    }
    if (!topic.trim()) {
      setModalFeedback("Please enter a deliverable topic or title.");
      return;
    }
    if (!date) {
      setModalFeedback("Please select a scheduled date.");
      return;
    }
    if (!isClient && !assigneeId) {
      setModalFeedback("Please select a Maker (Assignee) to assign this deliverable.");
      return;
    }

    setIsSubmitting(true);
    setModalFeedback(null);

    const targetId = entry ? entry.contentId : "post_" + Math.random().toString(36).substring(2, 9);
    const selectedClientObj = clients.find(c => c.clientId === clientId);
    const targetClientName = isClient ? (profile.name || 'Brand') : (selectedClientObj?.clientName || 'General');
    const targetClientId = isClient ? (profile.clientId || 'none') : clientId;

    const dateObj = new Date(date);
    const monthStr = `${dateObj.getFullYear()}-${String(dateObj.getMonth() + 1).padStart(2, '0')}`;
    const primaryPlatform = selectedPlatforms[0] || 'Instagram';
    const taskId = entry?.taskId || `task_${targetId}`;
    const nowIso = new Date().toISOString();

    try {
      if (isClient) {
        const entryRef = doc(db, 'contentCalendar', targetId);
        
        let postStatus = status;
        if (clientApprovalStatus === 'Approved') {
          postStatus = 'Approved';
        } else if (clientApprovalStatus === 'Changes Required') {
          postStatus = 'Changes Required';
        }

        await updateDoc(entryRef, {
          clientApprovalStatus,
          clientFeedback,
          status: postStatus,
          updatedBy: profile?.name || 'Client User',
          updatedAt: nowIso
        });

        // Sync task status
        try {
          await persistUpdateTask(taskId, {
            status: clientApprovalStatus === 'Approved' ? 'Done' : 'In Review',
            internalNotes: `Client feedback: ${clientFeedback}`
          });
        } catch (taskErr) {
          console.warn("Task sync warning:", taskErr);
        }

      } else {
        const assignedEmployee = employees.find(emp => emp.employeeId === assigneeId);
        const assignedUploader = employees.find(emp => emp.employeeId === uploaderId);
        const isActuallyPosted = status === 'Posted';

        const creativePayload: CalendarEntry = {
          contentId: targetId,
          clientId: targetClientId,
          clientName: targetClientName,
          date,
          time: time || '12:00',
          month: monthStr,
          year: dateObj.getFullYear(),
          platform: primaryPlatform as any,
          contentType: contentType as any,
          topic: topic.trim(),
          caption: caption.trim(),
          hashtags: hashtags.trim(),
          designBrief,
          creativeLink,
          videoLink,
          canvaLink,
          driveLink,
          status: status as any,
          postedStatus: isActuallyPosted ? 'Posted' : 'Not Posted',
          clientApprovalStatus,
          clientFeedback,
          internalNotes,
          assigneeId,
          assigneeName: assignedEmployee ? assignedEmployee.name : 'Unassigned',
          uploaderId,
          uploaderName: assignedUploader ? assignedUploader.name : 'Unassigned',
          taskId,
          createdBy: entry ? entry.createdBy : (profile?.name || 'Admin'),
          createdByUid: profile?.userId || auth.currentUser?.uid || 'admin',
          updatedBy: profile?.name || profile?.email || 'Admin',
          createdAt: entry ? entry.createdAt : nowIso,
          updatedAt: nowIso
        };

        if (entry) {
          await persistUpdateCalendarEntry(targetId, creativePayload, profile);
        } else {
          await persistNewCalendarEntry(creativePayload, profile);
        }

        // SYNC VIDEO TRACKER IF REEL OR VIDEO
        if (contentType === 'Reel' || contentType === 'Video' || contentType === 'YouTube Short') {
          try {
            const videoId = `vid_${targetId}`;
            await setDoc(doc(db, 'videoTracker', videoId), {
              id: videoId,
              clientName: targetClientName,
              videoCount: 1,
              shotDate: date,
              status: status === 'Posted' ? 'Edited' : (status === 'In Design' ? 'Shot' : 'Pending'),
              editorName: assignedEmployee ? assignedEmployee.name : '',
              shotTakenBy: profile?.name || 'Producer',
              editorAssigned: assignedEmployee ? assignedEmployee.name : '',
              notes: `Linked to calendar topic: ${topic.trim()}`,
              createdAt: entry ? (entry.createdAt || nowIso) : nowIso
            }, { merge: true });
          } catch (e) {
            // Non fatal
          }
        }
      }

      onClose();
    } catch (err: any) {
      console.error("Error saving deliverable:", err);
      handleFirestoreError(err, OperationType.WRITE, `contentCalendar/${targetId}`);
      setModalFeedback("Failed to save deliverable: " + (err?.message || "Unknown error"));
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-3xl max-w-4xl w-full p-6 shadow-2xl overflow-hidden max-h-[92vh] flex flex-col md:flex-row gap-6">
        
        {/* Left Side: Planning fields */}
        <div className="flex-1 overflow-y-auto space-y-4 pr-1 custom-scrollbar">
          <div className="flex justify-between items-start">
            <div>
              <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                {entry ? 'Inspect / Modify Deliverable' : 'Draft New Calendar Asset'}
              </span>
              <h3 className="text-xl font-black text-slate-900 dark:text-white mt-0.5">
                {isClient ? topic : (entry ? 'Update Content Item' : 'Plan New Content Item')}
              </h3>
            </div>
            <button 
              onClick={onClose}
              className="md:hidden p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {modalFeedback && (
            <div className="p-3 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/60 rounded-xl text-xs font-bold text-rose-700 dark:text-rose-300 flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-rose-500 shrink-0" />
              <span>{modalFeedback}</span>
            </div>
          )}

          <form onSubmit={handleSave} className="space-y-4">
            {/* Topic title */}
            <div className="space-y-1">
              <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Topic / Title *</label>
              <input 
                type="text" 
                value={topic}
                onChange={(e) => setTopic(e.target.value)}
                disabled={isClient}
                placeholder="e.g. 5 Signs You Need customized marketing plans..."
                className="w-full text-xs bg-slate-50 dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-2.5 outline-none font-medium text-slate-900 dark:text-slate-100"
                required
              />
            </div>

            {/* Client Picker with Search */}
            {!isClient && (
              <div className="space-y-1">
                <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Target Client Brand *</label>
                <ClientSelect
                  clients={clients}
                  selectedClientId={clientId}
                  onSelectClient={(id) => setClientId(id)}
                  placeholder="Select client brand..."
                />
              </div>
            )}

            {/* Deliverable Type */}
            <div className="space-y-1">
              <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                Work Type / Format *
              </label>
              <select
                value={contentType}
                onChange={(e) => setContentType(e.target.value)}
                disabled={isClient}
                className="w-full text-xs bg-slate-50 dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-2.5 font-bold outline-none text-slate-800 dark:text-slate-200"
              >
                {WORK_TYPES.map(wt => (
                  <option key={wt} value={wt}>{wt}</option>
                ))}
              </select>
            </div>

            {/* Multi-Platform Selection */}
            {!isClient && (
              <div className="space-y-1.5">
                <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                  Publishing Platforms
                </label>
                <div className="flex flex-wrap gap-1.5">
                  {AVAILABLE_PLATFORMS.map(p => {
                    const isSelected = selectedPlatforms.includes(p);
                    return (
                      <button
                        key={p}
                        type="button"
                        onClick={() => togglePlatform(p)}
                        className={`px-3 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all flex items-center gap-1.5 border ${
                          isSelected
                            ? 'bg-blue-600 text-white border-transparent shadow-xs'
                            : 'bg-slate-50 dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-400 hover:border-slate-300'
                        }`}
                      >
                        {isSelected && <Check className="w-3 h-3" />}
                        {p}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Scheduled Date & Time */}
            <div className="grid grid-cols-2 gap-3 items-end">
              <PopoverDatePicker
                label="Scheduled Date"
                selectedDate={date}
                onChange={(newDate) => setDate(newDate)}
                disabled={isClient}
                required
              />

              <div className="space-y-1">
                <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Time</label>
                <input 
                  type="time" 
                  value={time}
                  onChange={(e) => setTime(e.target.value)}
                  disabled={isClient}
                  className="w-full h-9 sm:h-9.5 text-xs bg-slate-50 dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 px-3 font-bold outline-none text-slate-800 dark:text-slate-200"
                />
              </div>
            </div>

            {/* Assignee & Uploader */}
            {!isClient && (
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Assign Maker</label>
                  <select 
                    value={assigneeId}
                    onChange={(e) => setAssigneeId(e.target.value)}
                    className="w-full text-xs bg-slate-50 dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-2.5 font-bold outline-none text-slate-800 dark:text-slate-200"
                  >
                    <option value="">-- Unassigned --</option>
                    {employees.map(emp => (
                      <option key={emp.employeeId} value={emp.employeeId}>{emp.name} ({emp.role})</option>
                    ))}
                  </select>
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Assign Uploader</label>
                  <select 
                    value={uploaderId}
                    onChange={(e) => setUploaderId(e.target.value)}
                    className="w-full text-xs bg-slate-50 dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-2.5 font-bold outline-none text-slate-800 dark:text-slate-200"
                  >
                    <option value="">-- Unassigned --</option>
                    {employees.map(emp => (
                      <option key={emp.employeeId} value={emp.employeeId}>{emp.name} ({emp.role})</option>
                    ))}
                  </select>
                </div>
              </div>
            )}

            {/* Caption editor */}
            <div className="space-y-1">
              <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Captions & Copy</label>
              <textarea 
                value={caption}
                onChange={(e) => setCaption(e.target.value)}
                disabled={isClient}
                rows={3}
                placeholder="Write caption details, engaging openers, hashtags, and calls to action..."
                className="w-full text-xs bg-slate-50 dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-2.5 outline-none font-medium leading-relaxed text-slate-900 dark:text-slate-100"
              />
            </div>

            {/* Hashtags */}
            <div className="space-y-1">
              <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Hashtags</label>
              <input 
                type="text" 
                value={hashtags}
                onChange={(e) => setHashtags(e.target.value)}
                disabled={isClient}
                placeholder="#marketing #branding #digitalagency..."
                className="w-full text-xs bg-slate-50 dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-2.5 outline-none font-medium text-slate-900 dark:text-slate-100"
              />
            </div>

            {/* Links */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Canva / Creative Link</label>
                <div className="flex items-center gap-1.5">
                  <input 
                    type="text" 
                    value={creativeLink}
                    onChange={(e) => setCreativeLink(e.target.value)}
                    disabled={isClient}
                    placeholder="https://canva.com/design/..."
                    className="w-full text-xs bg-slate-50 dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-2 outline-none font-medium"
                  />
                  {creativeLink && (
                    <a href={creativeLink} target="_blank" rel="noopener noreferrer" className="p-2 bg-purple-500/10 hover:bg-purple-500/20 rounded-xl text-purple-600"><ExternalLink className="w-3.5 h-3.5" /></a>
                  )}
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Drive / Raw Video Link</label>
                <div className="flex items-center gap-1.5">
                  <input 
                    type="text" 
                    value={driveLink}
                    onChange={(e) => setDriveLink(e.target.value)}
                    disabled={isClient}
                    placeholder="https://drive.google.com/..."
                    className="w-full text-xs bg-slate-50 dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-2 outline-none font-medium"
                  />
                  {driveLink && (
                    <a href={driveLink} target="_blank" rel="noopener noreferrer" className="p-2 bg-blue-500/10 hover:bg-blue-500/20 rounded-xl text-blue-600"><ExternalLink className="w-3.5 h-3.5" /></a>
                  )}
                </div>
              </div>
            </div>
            
            {/* Status & Approvals */}
            <div className="grid grid-cols-2 gap-3 border-t border-slate-100 dark:border-slate-800 pt-3">
              <div className="space-y-1">
                <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Production Status</label>
                <select 
                  value={status}
                  onChange={(e) => setStatus(e.target.value)}
                  disabled={isClient}
                  className="w-full text-xs bg-slate-50 dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-2.5 font-bold outline-none text-slate-800 dark:text-slate-200"
                >
                  {STATUS_LIST.map(st => (
                    <option key={st} value={st}>{st}</option>
                  ))}
                </select>
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Client Approval</label>
                <select 
                  value={clientApprovalStatus}
                  onChange={(e) => setClientApprovalStatus(e.target.value as any)}
                  className="w-full text-xs bg-slate-50 dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-2.5 font-black outline-none text-purple-600 dark:text-purple-400"
                >
                  <option value="Pending">🕒 Pending Review</option>
                  <option value="Approved">✅ Approved</option>
                  <option value="Changes Required">❌ Changes Required</option>
                </select>
              </div>
            </div>

            {/* Client Feedback */}
            <div className="space-y-1">
              <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Client Feedback / Instructions</label>
              <textarea 
                value={clientFeedback}
                onChange={(e) => setClientFeedback(e.target.value)}
                rows={2}
                placeholder="Add changes requested or approval notes..."
                className="w-full text-xs bg-slate-50 dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 p-2 outline-none font-medium text-slate-900 dark:text-slate-100"
              />
            </div>

            <div className="flex gap-2 justify-end pt-3 border-t border-slate-100 dark:border-slate-800">
              <button 
                type="button" 
                onClick={onClose}
                className="py-2 px-4 border border-slate-200 dark:border-slate-800 rounded-xl text-xs font-bold text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800"
              >
                Close
              </button>
              <button 
                type="submit" 
                disabled={isSubmitting}
                className="py-2.5 px-6 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-extrabold rounded-xl text-xs shadow-sm hover:shadow-md transition-all"
              >
                {isSubmitting ? 'Saving...' : (isClient ? 'Submit Feedback' : 'Save Deliverable')}
              </button>
            </div>
          </form>
        </div>

        {/* Right Side: Real-time Comments Thread */}
        {entry && (
          <div className="w-full md:w-80 border-t md:border-t-0 md:border-l border-slate-150 dark:border-slate-800 pt-4 md:pt-0 md:pl-5 flex flex-col justify-between max-h-[80vh]">
            <div className="space-y-3 flex-grow overflow-hidden flex flex-col">
              <div className="flex items-center gap-2">
                <MessageSquare className="w-4 h-4 text-purple-600" />
                <h4 className="text-xs font-black uppercase tracking-wider text-slate-700 dark:text-slate-300">Activity Discussion</h4>
              </div>

              {/* Chat list */}
              <div className="flex-grow overflow-y-auto space-y-2.5 pr-1 text-xs custom-scrollbar">
                {comments.length === 0 ? (
                  <p className="text-slate-400 italic text-[11px] text-center py-6">No chat discussion yet. Leave an adjustment note below!</p>
                ) : (
                  comments.map((c) => {
                    const isMe = c.userId === profile?.userId;
                    return (
                      <div key={c.commentId} className={`flex flex-col ${isMe ? 'items-end' : 'items-start'}`}>
                        <span className="text-[8px] font-bold text-slate-400 uppercase mb-0.5">
                          {isMe ? 'You' : (c.userName || (c.userRole === 'client' ? 'Client' : 'Team'))}
                        </span>
                        <div className={`p-2.5 rounded-2xl max-w-[90%] leading-relaxed ${
                          isMe 
                            ? 'bg-purple-600 text-white rounded-tr-none' 
                            : 'bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-800 dark:text-slate-200 rounded-tl-none'
                        }`}>
                          <p className="font-medium whitespace-pre-wrap text-[11px]">{c.comment}</p>
                        </div>
                        <span className="text-[8px] text-slate-400 mt-0.5">{new Date(c.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                      </div>
                    );
                  })
                )}
              </div>
            </div>

            {/* Comment Form */}
            <form onSubmit={handlePostComment} className="flex gap-2 border-t border-slate-100 dark:border-slate-800 pt-3 mt-2">
              <input 
                type="text" 
                placeholder="Discuss deliverable or copy..."
                value={newCommentText}
                onChange={(e) => setNewCommentText(e.target.value)}
                className="w-full text-xs border border-slate-200 dark:border-slate-800 rounded-xl bg-slate-50 dark:bg-slate-900 px-3 py-2 outline-none focus:border-purple-600 text-slate-900 dark:text-slate-100"
              />
              <button 
                type="submit" 
                className="p-2.5 bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition-all shrink-0"
              >
                <Send className="w-3.5 h-3.5" />
              </button>
            </form>
          </div>
        )}
      </div>
    </div>
  );
};
