import React, { useState } from 'react';
import {
  Plus,
  Search,
  Star,
  Trash2,
  Inbox,
  Send,
  FileText,
  AlertOctagon,
  Users,
  ChevronLeft,
  ChevronRight,
  Reply,
  Forward,
  RotateCcw,
} from 'lucide-react';
import { useToast } from './Toast';

interface EmailItem {
  id: string;
  sender: string;
  email: string;
  subject: string;
  snippet: string;
  body: string;
  date: string;
  starred: boolean;
  unread: boolean;
  folder: 'General' | 'Users' | 'Drafts' | 'Spam' | 'Trash';
  avatarBg: string;
}

const INITIAL_EMAILS: EmailItem[] = [
  {
    id: 'e1',
    sender: 'Priya Verma',
    email: 'priya@demo.com',
    subject: 'Re: Proposal for Demo Pvt Ltd',
    snippet: 'Thank you for sharing the proposal. Our executive board reviewed the pricing...',
    body: 'Hello Kunal,\n\nThank you for sharing the proposal. Our executive board reviewed the pricing structure and we are excited to move forward with the Enterprise package. Please send over the master service agreement so we can sign it before month end.\n\nBest regards,\nPriya Verma\nDirector of Operations, Demo Pvt Ltd',
    date: 'Today, 10:24 AM',
    starred: true,
    unread: true,
    folder: 'General',
    avatarBg: 'bg-emerald-500',
  },
  {
    id: 'e2',
    sender: 'Amit Joshi',
    email: 'amit@xyz.com',
    subject: 'Project requirements & integrations',
    snippet: 'Can you confirm if your REST API supports real-time webhooks for deals...',
    body: 'Hi team,\n\nWe would like to connect our existing inventory ERP with your CRM pipeline. Can you confirm if your REST API supports real-time webhooks for deals and contacts?\n\nRegards,\nAmit Joshi',
    date: 'Today, 09:50 AM',
    starred: false,
    unread: true,
    folder: 'General',
    avatarBg: 'bg-blue-500',
  },
  {
    id: 'e3',
    sender: 'Neha Gupta',
    email: 'neha@solution.com',
    subject: 'Meeting confirmation - Contract discussion',
    snippet: 'Looking forward to our scheduled sync tomorrow at 11:00 AM...',
    body: 'Hi Kunal,\n\nConfirming our calendar invite for tomorrow at 11:00 AM. Our technical lead Nitin will also join the call.\n\nWarm regards,\nNeha Gupta',
    date: 'Yesterday, 04:12 PM',
    starred: false,
    unread: false,
    folder: 'Users',
    avatarBg: 'bg-purple-500',
  },
  {
    id: 'e4',
    sender: 'Vikas Saini',
    email: 'vikas@build.com',
    subject: 'Quotation Attached - BuildRight Infra',
    snippet: 'Please find the countersigned quotation document for phase 2...',
    body: 'Dear Kunal,\n\nPlease find attached the signed contract and quotation for Phase 2 implementation. Let us know the next steps for onboarding.\n\nThanks,\nVikas Saini',
    date: 'Yesterday, 11:20 AM',
    starred: true,
    unread: false,
    folder: 'General',
    avatarBg: 'bg-amber-500',
  },
  {
    id: 'e5',
    sender: 'Sneha Rathi',
    email: 'sneha@global.com',
    subject: 'Follow up on partnership proposal',
    snippet: 'Following up on our discussion last week regarding channel partner tiers...',
    body: 'Hello,\n\nJust following up on our discussion regarding channel partnership. Are there any updates on commission rates?\n\nBest,\nSneha',
    date: 'Oct 18, 02:15 PM',
    starred: false,
    unread: false,
    folder: 'Users',
    avatarBg: 'bg-rose-500',
  },
  {
    id: 'e6',
    sender: 'Global Services',
    email: 'info@global.com',
    subject: 'Partnership proposal documentation',
    snippet: 'Sharing the requested deck and financial projections for Q4...',
    body: 'Hi Kunal,\n\nAttached is the requested deck and Q4 projections for your review.\n\nThanks,\nGlobal Services Team',
    date: 'Oct 17, 11:45 AM',
    starred: false,
    unread: false,
    folder: 'General',
    avatarBg: 'bg-indigo-500',
  },
  {
    id: 'e7',
    sender: 'Draft: Special Discount Offer',
    email: 'kunal@acme.com',
    subject: 'Special 15% Q4 Early Bird Discount',
    snippet: 'We are pleased to extend an exclusive discount on all annual seat packages...',
    body: 'Dear Client,\n\nWe are pleased to extend an exclusive discount of 15% on our enterprise CRM tier if closed by next Friday.',
    date: 'Draft saved',
    starred: false,
    unread: false,
    folder: 'Drafts',
    avatarBg: 'bg-slate-500',
  },
  {
    id: 'e8',
    sender: 'Phishing Alert / Unknown',
    email: 'rewards@unknown-crypto.xyz',
    subject: 'Claim your $500 gift reward now',
    snippet: 'Click this suspicious link to claim your reward immediately...',
    body: 'Suspicious email detected by spam filter.',
    date: 'Oct 10',
    starred: false,
    unread: false,
    folder: 'Spam',
    avatarBg: 'bg-rose-500',
  },
];

export const EmailInboxView: React.FC = () => {
  const toast = useToast();
  const [emails, setEmails] = useState<EmailItem[]>(INITIAL_EMAILS);
  const [selectedEmail, setSelectedEmail] = useState<EmailItem | null>(null);
  const [activeFolder, setActiveFolder] = useState<'General' | 'Users' | 'Drafts' | 'Starred' | 'Spam' | 'Trash'>('General');
  const [searchQuery, setSearchQuery] = useState('');
  const [isComposeOpen, setIsComposeOpen] = useState(false);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  const [composeData, setComposeData] = useState({ to: '', subject: '', body: '' });

  const handleSendCompose = (e: React.FormEvent) => {
    e.preventDefault();
    const created: EmailItem = {
      id: 'e-' + Date.now(),
      sender: 'Kunal Choudhary',
      email: composeData.to,
      subject: composeData.subject,
      snippet: composeData.body.slice(0, 70) + '...',
      body: composeData.body,
      date: 'Just now',
      starred: false,
      unread: false,
      folder: 'General',
      avatarBg: 'bg-emerald-500',
    };
    setEmails([created, ...emails]);
    setIsComposeOpen(false);
    setComposeData({ to: '', subject: '', body: '' });
    toast.success(`Email sent to ${created.email}!`);
  };

  const toggleStar = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setEmails(emails.map(em => em.id === id ? { ...em, starred: !em.starred } : em));
  };

  const handleMoveToTrash = (id: string) => {
    setEmails(emails.map(em => em.id === id ? { ...em, folder: 'Trash' } : em));
    if (selectedEmail?.id === id) setSelectedEmail(null);
    toast.success('Moved to Trash.');
  };

  const handleRestoreFromTrash = (id: string) => {
    setEmails(emails.map(em => em.id === id ? { ...em, folder: 'General' } : em));
    if (selectedEmail?.id === id) setSelectedEmail(null);
    toast.success('Restored to General inbox.');
  };

  const handleReply = (email: EmailItem) => {
    setComposeData({
      to: email.email,
      subject: email.subject.startsWith('Re:') ? email.subject : `Re: ${email.subject}`,
      body: `\n\n--- On ${email.date}, ${email.sender} wrote:\n${email.body}`,
    });
    setIsComposeOpen(true);
  };

  const handleForward = (email: EmailItem) => {
    setComposeData({
      to: '',
      subject: email.subject.startsWith('Fwd:') ? email.subject : `Fwd: ${email.subject}`,
      body: `\n\n--- Forwarded Message ---\nFrom: ${email.sender} <${email.email}>\nDate: ${email.date}\nSubject: ${email.subject}\n\n${email.body}`,
    });
    setIsComposeOpen(true);
  };

  const toggleSelectId = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setSelectedIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  };

  const handleBulkTrash = () => {
    setEmails(emails.map(em => selectedIds.includes(em.id) ? { ...em, folder: 'Trash' } : em));
    setSelectedIds([]);
    toast.success(`Moved ${selectedIds.length} emails to Trash.`);
  };

  const filteredEmails = emails.filter((em) => {
    const matchesSearch =
      em.sender.toLowerCase().includes(searchQuery.toLowerCase()) ||
      em.subject.toLowerCase().includes(searchQuery.toLowerCase()) ||
      em.snippet.toLowerCase().includes(searchQuery.toLowerCase());

    if (!matchesSearch) return false;

    if (activeFolder === 'Starred') {
      return em.starred && em.folder !== 'Trash';
    }
    return em.folder === activeFolder;
  });

  const countForFolder = (f: 'General' | 'Users' | 'Drafts' | 'Spam' | 'Trash') => {
    return emails.filter(e => e.folder === f).length;
  };

  return (
    <div className="space-y-5">
      {/* 1. Header with title & Compose button */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-bold text-slate-900 tracking-tight">Email</h2>
          <p className="text-xs text-slate-500">
            Manage and track your emails in one place.
          </p>
        </div>

        <button
          onClick={() => {
            setComposeData({ to: '', subject: '', body: '' });
            setIsComposeOpen(true);
          }}
          className="px-4 py-2 bg-[#10b981] hover:bg-[#059669] text-white text-xs font-bold rounded-xl shadow-xs transition flex items-center gap-1.5 cursor-pointer self-start sm:self-auto"
        >
          <Plus className="w-4 h-4" />
          <span>Compose</span>
        </button>
      </div>

      {/* 2. Main Layout: Folder Panel (Left) + Email List/Reader (Right) */}
      <div className="grid grid-cols-1 md:grid-cols-12 gap-5">
        {/* Left Folder Nav (3 cols) */}
        <div className="md:col-span-3 bg-white rounded-2xl border border-slate-200/90 p-4 shadow-2xs space-y-2">
          <button
            onClick={() => { setActiveFolder('General'); setSelectedEmail(null); }}
            className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-bold transition cursor-pointer ${
              activeFolder === 'General'
                ? 'bg-emerald-50 text-emerald-800 border border-emerald-200 shadow-2xs'
                : 'text-slate-600 hover:bg-slate-50'
            }`}
          >
            <div className="flex items-center gap-2.5">
              <Inbox className="w-4 h-4 text-emerald-600" />
              <span>General</span>
            </div>
            <span className="text-[10px] bg-emerald-100 text-emerald-800 px-1.5 py-0.5 rounded-full font-mono">
              {countForFolder('General')}
            </span>
          </button>

          <button
            onClick={() => { setActiveFolder('Users'); setSelectedEmail(null); }}
            className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-bold transition cursor-pointer ${
              activeFolder === 'Users'
                ? 'bg-emerald-50 text-emerald-800 border border-emerald-200 shadow-2xs'
                : 'text-slate-600 hover:bg-slate-50'
            }`}
          >
            <div className="flex items-center gap-2.5">
              <Users className="w-4 h-4 text-blue-500" />
              <span>Users</span>
            </div>
            <span className="text-[10px] bg-slate-200 text-slate-700 px-1.5 py-0.5 rounded-full font-mono">
              {countForFolder('Users')}
            </span>
          </button>

          <button
            onClick={() => { setActiveFolder('Drafts'); setSelectedEmail(null); }}
            className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-bold transition cursor-pointer ${
              activeFolder === 'Drafts' ? 'bg-emerald-50 text-emerald-800 border border-emerald-200 shadow-2xs' : 'text-slate-600 hover:bg-slate-50'
            }`}
          >
            <div className="flex items-center gap-2.5">
              <FileText className="w-4 h-4 text-amber-500" />
              <span>Drafts</span>
            </div>
            <span className="text-[10px] bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded-full font-mono">
              {countForFolder('Drafts')}
            </span>
          </button>

          <button
            onClick={() => { setActiveFolder('Starred'); setSelectedEmail(null); }}
            className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-bold transition cursor-pointer ${
              activeFolder === 'Starred' ? 'bg-emerald-50 text-emerald-800 border border-emerald-200 shadow-2xs' : 'text-slate-600 hover:bg-slate-50'
            }`}
          >
            <div className="flex items-center gap-2.5">
              <Star className="w-4 h-4 text-yellow-500 fill-yellow-500" />
              <span>Starred</span>
            </div>
            <span className="text-[10px] bg-yellow-100 text-yellow-800 px-1.5 py-0.5 rounded-full font-mono">
              {emails.filter(e => e.starred && e.folder !== 'Trash').length}
            </span>
          </button>

          <button
            onClick={() => { setActiveFolder('Spam'); setSelectedEmail(null); }}
            className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-bold transition cursor-pointer ${
              activeFolder === 'Spam' ? 'bg-emerald-50 text-emerald-800 border border-emerald-200 shadow-2xs' : 'text-slate-600 hover:bg-slate-50'
            }`}
          >
            <div className="flex items-center gap-2.5">
              <AlertOctagon className="w-4 h-4 text-rose-500" />
              <span>Spam</span>
            </div>
            <span className="text-[10px] bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded-full font-mono">
              {countForFolder('Spam')}
            </span>
          </button>

          <button
            onClick={() => { setActiveFolder('Trash'); setSelectedEmail(null); }}
            className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-bold transition cursor-pointer ${
              activeFolder === 'Trash' ? 'bg-emerald-50 text-emerald-800 border border-emerald-200 shadow-2xs' : 'text-slate-600 hover:bg-slate-50'
            }`}
          >
            <div className="flex items-center gap-2.5">
              <Trash2 className="w-4 h-4 text-slate-400" />
              <span>Trash</span>
            </div>
            <span className="text-[10px] bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded-full font-mono">
              {countForFolder('Trash')}
            </span>
          </button>
        </div>

        {/* Center/Right Email List or Detail View (9 cols) */}
        <div className="md:col-span-9 bg-white rounded-2xl border border-slate-200/90 shadow-2xs overflow-hidden flex flex-col min-h-[460px]">
          {selectedEmail ? (
            /* Reading Pane View */
            <div className="p-6 space-y-4">
              <div className="flex items-center justify-between border-b border-slate-100 pb-4">
                <button
                  onClick={() => setSelectedEmail(null)}
                  className="flex items-center gap-1.5 text-xs font-bold text-slate-600 hover:text-slate-900 cursor-pointer"
                >
                  <ChevronLeft className="w-4 h-4" />
                  <span>Back to {activeFolder}</span>
                </button>
                <div className="flex items-center gap-2">
                  {selectedEmail.folder === 'Trash' ? (
                    <button
                      onClick={() => handleRestoreFromTrash(selectedEmail.id)}
                      className="px-2.5 py-1 text-emerald-700 bg-emerald-50 hover:bg-emerald-100 rounded-lg text-xs font-bold flex items-center gap-1 cursor-pointer"
                    >
                      <RotateCcw className="w-3.5 h-3.5" />
                      <span>Restore</span>
                    </button>
                  ) : (
                    <button
                      onClick={() => handleMoveToTrash(selectedEmail.id)}
                      className="p-1.5 text-slate-400 hover:text-rose-600 rounded-lg hover:bg-rose-50 cursor-pointer transition"
                      title="Move to Trash"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </div>

              <div>
                <h3 className="text-base font-bold text-slate-900">{selectedEmail.subject}</h3>
                <div className="flex items-center justify-between text-xs text-slate-500 mt-2">
                  <div className="flex items-center gap-2">
                    <div className={`w-7 h-7 rounded-full ${selectedEmail.avatarBg} text-white font-bold text-xs flex items-center justify-center`}>
                      {selectedEmail.sender.charAt(0)}
                    </div>
                    <div>
                      <span className="font-bold text-slate-900">{selectedEmail.sender}</span>
                      <span className="text-slate-400 ml-1.5">&lt;{selectedEmail.email}&gt;</span>
                    </div>
                  </div>
                  <span className="font-mono text-[11px]">{selectedEmail.date}</span>
                </div>
              </div>

              <div className="p-4 bg-slate-50 rounded-xl border border-slate-100 text-xs text-slate-800 whitespace-pre-wrap leading-relaxed">
                {selectedEmail.body}
              </div>

              <div className="flex items-center gap-2 pt-2">
                <button
                  onClick={() => handleReply(selectedEmail)}
                  className="px-3.5 py-2 bg-[#10b981] hover:bg-[#059669] text-white font-bold rounded-xl text-xs flex items-center gap-1.5 cursor-pointer shadow-xs transition"
                >
                  <Reply className="w-3.5 h-3.5" />
                  <span>Reply</span>
                </button>
                <button
                  onClick={() => handleForward(selectedEmail)}
                  className="px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl text-xs flex items-center gap-1.5 cursor-pointer transition"
                >
                  <Forward className="w-3.5 h-3.5" />
                  <span>Forward</span>
                </button>
              </div>
            </div>
          ) : (
            /* Email List Table */
            <>
              {/* Search Bar & Multi-Select Action Bar */}
              <div className="p-3.5 border-b border-slate-200/90 flex items-center justify-between gap-3">
                <div className="relative w-full max-w-sm">
                  <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                  <input
                    type="text"
                    placeholder="Search emails..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full pl-9 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:border-emerald-500"
                  />
                </div>

                {selectedIds.length > 0 && (
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-slate-600 font-semibold">{selectedIds.length} selected</span>
                    <button
                      onClick={handleBulkTrash}
                      className="px-2.5 py-1 bg-rose-50 text-rose-600 hover:bg-rose-100 rounded-lg text-xs font-bold flex items-center gap-1 cursor-pointer"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                      <span>Delete</span>
                    </button>
                  </div>
                )}
              </div>

              {/* Table of Emails */}
              <div className="divide-y divide-slate-100 text-xs flex-1">
                {filteredEmails.length === 0 ? (
                  <div className="p-12 text-center text-slate-400">
                    No emails in {activeFolder}.
                  </div>
                ) : (
                  filteredEmails.map((em) => (
                    <div
                      key={em.id}
                      onClick={() => setSelectedEmail(em)}
                      className={`p-3.5 flex items-center justify-between gap-3 hover:bg-slate-50/80 transition cursor-pointer ${
                        em.unread ? 'bg-slate-50/40 font-bold text-slate-900' : 'text-slate-700'
                      }`}
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <input
                          type="checkbox"
                          checked={selectedIds.includes(em.id)}
                          onClick={(e) => toggleSelectId(em.id, e)}
                          className="rounded border-slate-300 text-emerald-600 focus:ring-emerald-500 cursor-pointer"
                        />

                        <button
                          onClick={(e) => toggleStar(em.id, e)}
                          className={`text-slate-300 hover:text-yellow-400 cursor-pointer ${em.starred ? 'text-yellow-400' : ''}`}
                        >
                          <Star className="w-4 h-4 fill-current" />
                        </button>

                        <div className="flex items-center gap-2 min-w-[130px]">
                          <div className={`w-6 h-6 rounded-full ${em.avatarBg} text-white font-bold text-[10px] flex items-center justify-center shrink-0`}>
                            {em.sender.charAt(0)}
                          </div>
                          <span className="truncate">{em.sender}</span>
                        </div>

                        <div className="min-w-0 flex items-center gap-1.5">
                          <span className="truncate text-slate-900 font-semibold">{em.subject}</span>
                          <span className="text-slate-400 font-normal truncate hidden sm:inline">
                            — {em.snippet}
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center gap-3 shrink-0">
                        <span className="font-mono text-[11px] text-slate-400">{em.date}</span>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleMoveToTrash(em.id);
                          }}
                          className="p-1 text-slate-300 hover:text-rose-600 rounded transition cursor-pointer"
                          title="Trash"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>

              {/* Pagination Footer */}
              <div className="mt-auto px-5 py-3 bg-slate-50/60 border-t border-slate-200 flex items-center justify-between text-xs text-slate-500">
                <div>Showing 1-{filteredEmails.length} of {filteredEmails.length} emails</div>
                <div className="flex items-center gap-1.5">
                  <button className="p-1 rounded-lg border border-slate-200 text-slate-400 disabled:opacity-50" disabled>
                    <ChevronLeft className="w-3.5 h-3.5" />
                  </button>
                  <span className="w-6 h-6 rounded-lg bg-emerald-500 text-white font-bold text-xs flex items-center justify-center">
                    1
                  </span>
                  <button className="p-1 rounded-lg border border-slate-200 text-slate-600 hover:bg-white">
                    <ChevronRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Compose Email Modal */}
      {isComposeOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="w-full max-w-lg bg-white border border-slate-200 rounded-2xl p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-slate-900">Compose New Email</h3>
              <button
                onClick={() => setIsComposeOpen(false)}
                className="text-slate-400 hover:text-slate-600 font-bold cursor-pointer"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSendCompose} className="space-y-3 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">To</label>
                <input
                  type="email"
                  required
                  placeholder="recipient@example.com"
                  value={composeData.to}
                  onChange={(e) => setComposeData({ ...composeData, to: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Subject</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Acme CRM Proposal & Follow up"
                  value={composeData.subject}
                  onChange={(e) => setComposeData({ ...composeData, subject: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Message Body</label>
                <textarea
                  rows={6}
                  required
                  placeholder="Write your email message..."
                  value={composeData.body}
                  onChange={(e) => setComposeData({ ...composeData, body: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:border-emerald-500 font-sans"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-3">
                <button
                  type="button"
                  onClick={() => setIsComposeOpen(false)}
                  className="px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-[#10b981] hover:bg-[#059669] text-white font-bold rounded-xl shadow-xs flex items-center gap-1.5 cursor-pointer"
                >
                  <Send className="w-3.5 h-3.5" />
                  <span>Send Email</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
