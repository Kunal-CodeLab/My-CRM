import React, { useState, useEffect } from 'react';
import {
  PhoneCall,
  Phone,
  PhoneIncoming,
  PhoneMissed,
  Clock,
  Send,
  CheckCheck,
  ExternalLink,
  Mic,
  MicOff,
  PhoneOff,
  Search,
} from 'lucide-react';
import { useToast } from './Toast';

interface CallItem {
  id: string;
  name: string;
  phone: string;
  duration: string;
  time: string;
  status: 'Answered' | 'Missed';
  type: 'incoming' | 'outgoing' | 'missed';
}

interface ChatContact {
  id: string;
  name: string;
  phone: string;
  lastMessage: string;
  time: string;
  unread: number;
  avatarBg: string;
}

interface Message {
  id: string;
  sender: 'user' | 'contact';
  text: string;
  time: string;
}

const INITIAL_CALLS: CallItem[] = [
  { id: '1', name: 'Rahul Sharma', phone: '+91 98765 43210', duration: '2m 45s', time: 'Today, 10:30 AM', status: 'Answered', type: 'incoming' },
  { id: '2', name: 'Priya Verma', phone: '+91 87654 32109', duration: '5m 12s', time: 'Today, 09:45 AM', status: 'Answered', type: 'outgoing' },
  { id: '3', name: 'Amit Joshi', phone: '+91 99887 76655', duration: '1m 20s', time: 'Yesterday, 04:30 PM', status: 'Missed', type: 'missed' },
  { id: '4', name: 'Neha Gupta', phone: '+91 91234 56789', duration: '3m 10s', time: 'Yesterday, 11:20 AM', status: 'Answered', type: 'incoming' },
  { id: '5', name: 'Vikas Saini', phone: '+91 90909 90909', duration: '4m 25s', time: 'Oct 18, 02:15 PM', status: 'Answered', type: 'outgoing' },
];

const INITIAL_CHATS: ChatContact[] = [
  { id: 'c1', name: 'Priya Verma', phone: '+91 87654 32109', lastMessage: 'Hi, I am interested in your services...', time: '10:24 AM', unread: 2, avatarBg: 'bg-emerald-500' },
  { id: 'c2', name: 'Rahul Sharma', phone: '+91 98765 43210', lastMessage: 'Can you share the proposal?', time: '09:50 AM', unread: 1, avatarBg: 'bg-blue-500' },
  { id: 'c3', name: 'Amit Joshi', phone: '+91 99887 76655', lastMessage: 'Thanks for the details!', time: 'Yesterday', unread: 0, avatarBg: 'bg-amber-500' },
  { id: 'c4', name: 'Sneha Rathi', phone: '+91 87654 12345', lastMessage: "Let's schedule a demo call.", time: 'Yesterday', unread: 0, avatarBg: 'bg-rose-500' },
  { id: 'c5', name: 'Vikas Saini', phone: '+91 90909 90909', lastMessage: 'Perfect, I will get back to you.', time: 'Oct 18', unread: 0, avatarBg: 'bg-purple-500' },
];

export const CallsWhatsAppView: React.FC = () => {
  const toast = useToast();
  const [activeTab, setActiveTab] = useState<'All' | 'Calls' | 'WhatsApp' | 'History'>('All');
  const [calls, setCalls] = useState<CallItem[]>(INITIAL_CALLS);
  const [chats, setChats] = useState<ChatContact[]>(INITIAL_CHATS);
  const [selectedChat, setSelectedChat] = useState<ChatContact>(INITIAL_CHATS[0]);
  const [searchFilter, setSearchFilter] = useState('');

  // Active Call Simulator state
  const [activeCall, setActiveCall] = useState<{ name: string; phone: string; seconds: number; isMuted: boolean } | null>(null);

  const [messages, setMessages] = useState<Record<string, Message[]>>({
    c1: [
      { id: 'm1', sender: 'contact', text: 'Hi Kunal, hope you are doing well!', time: '10:15 AM' },
      { id: 'm2', sender: 'contact', text: 'I am interested in your CRM enterprise services for Demo Pvt Ltd.', time: '10:24 AM' },
      { id: 'm3', sender: 'user', text: 'Hello Priya! Delighted to connect. Let me share our tier options.', time: '10:28 AM' },
    ],
    c2: [
      { id: 'm4', sender: 'contact', text: 'Hi! Can you share the latest pricing proposal?', time: '09:50 AM' },
    ],
  });

  const [inputMsg, setInputMsg] = useState('');
  const [isNewCallModalOpen, setIsNewCallModalOpen] = useState(false);
  const [newCallData, setNewCallData] = useState({ name: '', phone: '', duration: '3m 15s', status: 'Answered' as const });

  // Call timer simulation
  useEffect(() => {
    let timer: NodeJS.Timeout;
    if (activeCall) {
      timer = setInterval(() => {
        setActiveCall((prev) => (prev ? { ...prev, seconds: prev.seconds + 1 } : null));
      }, 1000);
    }
    return () => clearInterval(timer);
  }, [activeCall]);

  const handleStartCall = (name: string, phone: string) => {
    setActiveCall({ name, phone, seconds: 0, isMuted: false });
    toast.info(`Connecting outbound call to ${name}...`);
  };

  const handleEndCall = () => {
    if (!activeCall) return;
    const mins = Math.floor(activeCall.seconds / 60);
    const secs = activeCall.seconds % 60;
    const formattedDuration = `${mins}m ${secs < 10 ? '0' : ''}${secs}s`;

    const newLog: CallItem = {
      id: 'call-' + Date.now(),
      name: activeCall.name,
      phone: activeCall.phone,
      duration: formattedDuration,
      time: 'Just now',
      status: 'Answered',
      type: 'outgoing',
    };

    setCalls([newLog, ...calls]);
    setActiveCall(null);
    toast.success(`Call ended (${formattedDuration}) and logged.`);
  };

  const handleSendMessage = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputMsg.trim()) return;

    const newMsg: Message = {
      id: 'm-' + Date.now(),
      sender: 'user',
      text: inputMsg,
      time: 'Just now',
    };

    setMessages((prev) => ({
      ...prev,
      [selectedChat.id]: [...(prev[selectedChat.id] || []), newMsg],
    }));

    setChats((prev) =>
      prev.map((c) => (c.id === selectedChat.id ? { ...c, lastMessage: inputMsg, unread: 0 } : c))
    );

    setInputMsg('');
    toast.success('WhatsApp message sent!');
  };

  const handleAddCall = (e: React.FormEvent) => {
    e.preventDefault();
    const created: CallItem = {
      id: 'call-' + Date.now(),
      name: newCallData.name,
      phone: newCallData.phone,
      duration: newCallData.duration,
      time: 'Just now',
      status: newCallData.status,
      type: newCallData.status === 'Answered' ? 'outgoing' : 'missed',
    };
    setCalls([created, ...calls]);
    setIsNewCallModalOpen(false);
    setNewCallData({ name: '', phone: '', duration: '3m 15s', status: 'Answered' });
    toast.success(`Logged call with ${created.name}`);
  };

  const activeMessages = messages[selectedChat.id] || [];

  return (
    <div className="space-y-5">
      {/* 1. Header with title & buttons matching screenshot */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-bold text-slate-900 tracking-tight">Calls & WhatsApp</h2>
          <p className="text-xs text-slate-500">
            Make calls, send WhatsApp messages and track conversations.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <a
            href="https://web.whatsapp.com"
            target="_blank"
            rel="noreferrer"
            className="px-3.5 py-2 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 text-xs font-bold rounded-xl border border-emerald-200 transition flex items-center gap-1.5 cursor-pointer"
          >
            <ExternalLink className="w-3.5 h-3.5" />
            <span>Open WhatsApp Web</span>
          </a>

          <button
            onClick={() => setIsNewCallModalOpen(true)}
            className="px-4 py-2 bg-[#10b981] hover:bg-[#059669] text-white text-xs font-bold rounded-xl shadow-xs transition flex items-center gap-1.5 cursor-pointer"
          >
            <PhoneCall className="w-4 h-4" />
            <span>New Call</span>
          </button>
        </div>
      </div>

      {/* 2. Filter Pills */}
      <div className="flex items-center gap-1 bg-white p-2 rounded-2xl border border-slate-200/90 shadow-2xs w-fit">
        {(['All', 'Calls', 'WhatsApp', 'History'] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer ${
              activeTab === tab
                ? 'bg-slate-900 text-white shadow-xs'
                : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            {tab}
          </button>
        ))}
      </div>

      {/* 3. Main Two-Column View: Recent Calls (Left) + WhatsApp Chat (Right) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        {/* Left Column: Recent Calls (5 cols) */}
        {(activeTab === 'All' || activeTab === 'Calls' || activeTab === 'History') && (
          <div className={`${activeTab === 'Calls' || activeTab === 'History' ? 'lg:col-span-12' : 'lg:col-span-5'} bg-white rounded-2xl border border-slate-200/90 p-5 shadow-2xs space-y-4`}>
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-slate-900">Recent Calls</h3>
              <span className="text-xs text-slate-400 font-medium">{calls.length} logged</span>
            </div>

            <div className="space-y-3">
              {calls.map((c) => (
                <div
                  key={c.id}
                  className="p-3 bg-slate-50 hover:bg-slate-100/70 border border-slate-100 rounded-xl transition flex items-center justify-between gap-3"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div
                      className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${
                        c.status === 'Answered'
                          ? 'bg-emerald-100 text-emerald-600'
                          : 'bg-rose-100 text-rose-600'
                      }`}
                    >
                      {c.status === 'Answered' ? (
                        <PhoneIncoming className="w-4 h-4" />
                      ) : (
                        <PhoneMissed className="w-4 h-4" />
                      )}
                    </div>
                    <div className="min-w-0">
                      <p className="text-xs font-bold text-slate-900 truncate">{c.name}</p>
                      <p className="text-[11px] text-slate-500 font-mono truncate">{c.phone}</p>
                      <div className="flex items-center gap-2 text-[10px] text-slate-400 mt-0.5">
                        <Clock className="w-3 h-3" />
                        <span>{c.duration}</span>
                        <span>•</span>
                        <span>{c.time}</span>
                      </div>
                    </div>
                  </div>

                  <div className="text-right shrink-0">
                    <span
                      className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-bold ${
                        c.status === 'Answered'
                          ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                          : 'bg-rose-50 text-rose-700 border border-rose-200'
                      }`}
                    >
                      {c.status}
                    </span>
                    <div className="mt-2">
                      <button
                        onClick={() => handleStartCall(c.name, c.phone)}
                        className="p-1.5 text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 rounded-lg transition cursor-pointer"
                        title="Start phone call"
                      >
                        <Phone className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Right Column: WhatsApp Messages & Interactive Chat (7 cols) */}
        {(activeTab === 'All' || activeTab === 'WhatsApp') && (
          <div className={`${activeTab === 'WhatsApp' ? 'lg:col-span-12' : 'lg:col-span-7'} bg-white rounded-2xl border border-slate-200/90 shadow-2xs flex flex-col md:flex-row overflow-hidden min-h-[460px]`}>
            {/* Conversation List Sidebar */}
            <div className="w-full md:w-5/12 border-r border-slate-200 p-4 space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-bold uppercase tracking-wider text-slate-800">WhatsApp Messages</h3>
                <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-emerald-500 text-white">Live</span>
              </div>

              <div className="relative">
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="Search chats..."
                  value={searchFilter}
                  onChange={(e) => setSearchFilter(e.target.value)}
                  className="w-full pl-8 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div className="space-y-1.5 overflow-y-auto max-h-[380px]">
                {chats
                  .filter((chat) => chat.name.toLowerCase().includes(searchFilter.toLowerCase()) || chat.lastMessage.toLowerCase().includes(searchFilter.toLowerCase()))
                  .map((chat) => {
                  const isSelected = chat.id === selectedChat.id;
                  return (
                    <button
                      key={chat.id}
                      onClick={() => {
                        setSelectedChat(chat);
                        setChats(chats.map(c => c.id === chat.id ? { ...c, unread: 0 } : c));
                      }}
                      className={`w-full text-left p-2.5 rounded-xl transition cursor-pointer flex items-center justify-between gap-2.5 ${
                        isSelected
                          ? 'bg-emerald-50/70 border border-emerald-200'
                          : 'hover:bg-slate-50 border border-transparent'
                      }`}
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div className={`w-8 h-8 rounded-full ${chat.avatarBg} text-white font-bold text-xs flex items-center justify-center shrink-0`}>
                          {chat.name.charAt(0)}
                        </div>
                        <div className="min-w-0">
                          <p className="text-xs font-bold text-slate-900 truncate">{chat.name}</p>
                          <p className="text-[11px] text-slate-500 truncate">{chat.lastMessage}</p>
                        </div>
                      </div>

                      <div className="text-right shrink-0">
                        <span className="text-[9px] text-slate-400 block">{chat.time}</span>
                        {chat.unread > 0 && (
                          <span className="mt-1 inline-flex w-4 h-4 rounded-full bg-emerald-500 text-white font-bold text-[9px] items-center justify-center">
                            {chat.unread}
                          </span>
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Active Chat Conversation View */}
            <div className="w-full md:w-7/12 flex flex-col justify-between bg-slate-50/40">
              {/* Chat Header */}
              <div className="p-3.5 bg-white border-b border-slate-200 flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div className={`w-7 h-7 rounded-full ${selectedChat.avatarBg} text-white font-bold text-xs flex items-center justify-center`}>
                    {selectedChat.name.charAt(0)}
                  </div>
                  <div>
                    <h4 className="text-xs font-bold text-slate-900 leading-tight">{selectedChat.name}</h4>
                    <p className="text-[10px] text-emerald-600 font-medium">WhatsApp Online</p>
                  </div>
                </div>
                <button
                  onClick={() => handleStartCall(selectedChat.name, selectedChat.phone)}
                  className="p-1.5 text-slate-500 hover:text-emerald-600 rounded-lg hover:bg-slate-50 transition cursor-pointer"
                  title="Call via CRM"
                >
                  <Phone className="w-4 h-4" />
                </button>
              </div>

              {/* Messages Thread */}
              <div className="p-4 space-y-3 overflow-y-auto flex-1 max-h-[300px]">
                {activeMessages.map((msg) => (
                  <div
                    key={msg.id}
                    className={`flex flex-col ${msg.sender === 'user' ? 'items-end' : 'items-start'}`}
                  >
                    <div
                      className={`max-w-[80%] rounded-2xl px-3.5 py-2 text-xs shadow-2xs leading-relaxed ${
                        msg.sender === 'user'
                          ? 'bg-emerald-600 text-white rounded-br-none'
                          : 'bg-white text-slate-800 border border-slate-200 rounded-bl-none'
                      }`}
                    >
                      {msg.text}
                    </div>
                    <span className="text-[9px] text-slate-400 mt-1 flex items-center gap-1">
                      {msg.time}
                      {msg.sender === 'user' && <CheckCheck className="w-3 h-3 text-emerald-600" />}
                    </span>
                  </div>
                ))}
              </div>

              {/* Input Bar */}
              <form onSubmit={handleSendMessage} className="p-3 bg-white border-t border-slate-200 flex items-center gap-2">
                <input
                  type="text"
                  placeholder="Type a WhatsApp message..."
                  value={inputMsg}
                  onChange={(e) => setInputMsg(e.target.value)}
                  className="flex-1 px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 focus:outline-none focus:border-emerald-500"
                />
                <button
                  type="submit"
                  className="p-2 bg-[#10b981] hover:bg-[#059669] text-white rounded-xl transition cursor-pointer shadow-xs"
                >
                  <Send className="w-4 h-4" />
                </button>
              </form>
            </div>
          </div>
        )}
      </div>

      {/* Active Phone Call Simulator Widget */}
      {activeCall && (
        <div className="fixed bottom-6 right-6 z-50 bg-slate-900 text-white border border-slate-700 rounded-2xl p-4 shadow-2xl w-80 space-y-3 animate-in slide-in-from-bottom duration-200">
          <div className="flex items-center justify-between">
            <span className="text-[10px] uppercase font-bold tracking-wider text-emerald-400 flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
              Call in Progress
            </span>
            <span className="font-mono text-xs font-bold text-slate-300">
              {Math.floor(activeCall.seconds / 60)}:
              {(activeCall.seconds % 60) < 10 ? '0' : ''}
              {activeCall.seconds % 60}
            </span>
          </div>

          <div>
            <h4 className="text-sm font-bold text-white">{activeCall.name}</h4>
            <p className="text-xs font-mono text-slate-400">{activeCall.phone}</p>
          </div>

          <div className="flex items-center justify-between pt-2">
            <button
              onClick={() => setActiveCall({ ...activeCall, isMuted: !activeCall.isMuted })}
              className={`p-2.5 rounded-xl border transition cursor-pointer ${
                activeCall.isMuted
                  ? 'bg-amber-500/20 border-amber-500/40 text-amber-400'
                  : 'bg-slate-800 border-slate-700 text-slate-300'
              }`}
              title={activeCall.isMuted ? 'Unmute' : 'Mute'}
            >
              {activeCall.isMuted ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
            </button>

            <button
              onClick={handleEndCall}
              className="px-4 py-2 bg-rose-600 hover:bg-rose-500 text-white font-bold rounded-xl text-xs flex items-center gap-2 shadow-lg shadow-rose-600/30 cursor-pointer"
            >
              <PhoneOff className="w-4 h-4" />
              <span>End Call</span>
            </button>
          </div>
        </div>
      )}

      {/* Log Call Modal */}
      {isNewCallModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-white border border-slate-200 rounded-2xl p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-slate-900">Log Phone Call</h3>
              <button
                onClick={() => setIsNewCallModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 text-base font-bold cursor-pointer"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleAddCall} className="space-y-3 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Contact Name</label>
                <input
                  type="text"
                  required
                  placeholder="Rahul Sharma"
                  value={newCallData.name}
                  onChange={(e) => setNewCallData({ ...newCallData, name: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Phone Number</label>
                <input
                  type="text"
                  required
                  placeholder="+91 98765 43210"
                  value={newCallData.phone}
                  onChange={(e) => setNewCallData({ ...newCallData, phone: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Duration</label>
                  <input
                    type="text"
                    placeholder="3m 15s"
                    value={newCallData.duration}
                    onChange={(e) => setNewCallData({ ...newCallData, duration: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:border-emerald-500"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Call Status</label>
                  <select
                    value={newCallData.status}
                    onChange={(e) => setNewCallData({ ...newCallData, status: e.target.value as any })}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:border-emerald-500"
                  >
                    <option value="Answered">Answered</option>
                    <option value="Missed">Missed</option>
                  </select>
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-3">
                <button
                  type="button"
                  onClick={() => setIsNewCallModalOpen(false)}
                  className="px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-[#10b981] hover:bg-[#059669] text-white font-bold rounded-xl shadow-xs cursor-pointer"
                >
                  Log Call
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
