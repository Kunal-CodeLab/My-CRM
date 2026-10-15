import React, { useState } from 'react';
import {
  Plus,
  ChevronLeft,
  ChevronRight,
  Clock,
  Users,
  Video,
} from 'lucide-react';
import { useToast } from './Toast';

interface CalendarEvent {
  id: string;
  day: number;
  monthIndex: number; // 9 = Oct, 10 = Nov, etc.
  title: string;
  time: string;
  type: string;
  color: string;
  attendees: string;
  hour: number; // 24hr format for week/day views, e.g. 10, 14
}

const MONTH_NAMES = [
  'January 2025', 'February 2025', 'March 2025', 'April 2025',
  'May 2025', 'June 2025', 'July 2025', 'August 2025',
  'September 2025', 'October 2025', 'November 2025', 'December 2025'
];

const INITIAL_EVENTS: CalendarEvent[] = [
  { id: 'e1', day: 2, monthIndex: 9, title: 'Team Meeting', time: '10:00 AM', type: 'internal', color: 'bg-emerald-100 text-emerald-800 border-emerald-200', attendees: 'Kunal, Nitin, Priya', hour: 10 },
  { id: 'e2', day: 4, monthIndex: 9, title: 'Client Call', time: '02:00 PM', type: 'call', color: 'bg-blue-100 text-blue-800 border-blue-200', attendees: 'Rahul Sharma (ABC Traders)', hour: 14 },
  { id: 'e3', day: 7, monthIndex: 9, title: 'Demo Call', time: '11:00 AM', type: 'meeting', color: 'bg-purple-100 text-purple-800 border-purple-200', attendees: 'Amit Joshi (XYZ)', hour: 11 },
  { id: 'e4', day: 9, monthIndex: 9, title: 'Follow Up', time: '04:00 PM', type: 'task', color: 'bg-amber-100 text-amber-800 border-amber-200', attendees: 'Neha Gupta', hour: 16 },
  { id: 'e5', day: 14, monthIndex: 9, title: 'Site Visit', time: '10:30 AM', type: 'meeting', color: 'bg-teal-100 text-teal-800 border-teal-200', attendees: 'Vikas Saini (BuildRight)', hour: 10 },
  { id: 'e6', day: 18, monthIndex: 9, title: 'Proposal Review', time: '01:00 PM', type: 'internal', color: 'bg-indigo-100 text-indigo-800 border-indigo-200', attendees: 'Sales Team', hour: 13 },
  { id: 'e7', day: 23, monthIndex: 9, title: 'Product Demo', time: '02:00 PM', type: 'demo', color: 'bg-cyan-100 text-cyan-800 border-cyan-200', attendees: 'Global Services', hour: 14 },
  { id: 'e8', day: 26, monthIndex: 9, title: 'Client Meeting', time: '03:30 PM', type: 'meeting', color: 'bg-violet-100 text-violet-800 border-violet-200', attendees: 'Matrix Solutions', hour: 15 },
  { id: 'e9', day: 30, monthIndex: 9, title: 'Follow Up Call', time: '02:30 PM', type: 'call', color: 'bg-rose-100 text-rose-800 border-rose-200', attendees: 'Sneha Rathi', hour: 14 },
];

export const CalendarView: React.FC = () => {
  const toast = useToast();
  const [monthIndex, setMonthIndex] = useState(9); // 9 = October
  const [viewMode, setViewMode] = useState<'Month' | 'Week' | 'Day'>('Month');
  const [events, setEvents] = useState<CalendarEvent[]>(INITIAL_EVENTS);
  const [selectedEvent, setSelectedEvent] = useState<CalendarEvent | null>(null);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isRescheduling, setIsRescheduling] = useState(false);

  const [newEvent, setNewEvent] = useState({
    day: 15,
    title: '',
    time: '11:00 AM',
    attendees: '',
    hour: 11,
  });

  const handlePrevMonth = () => {
    setMonthIndex((prev) => (prev > 0 ? prev - 1 : 11));
  };

  const handleNextMonth = () => {
    setMonthIndex((prev) => (prev < 11 ? prev + 1 : 0));
  };

  const handleAddEvent = (e: React.FormEvent) => {
    e.preventDefault();
    const created: CalendarEvent = {
      id: 'e-' + Date.now(),
      day: Number(newEvent.day),
      monthIndex,
      title: newEvent.title,
      time: newEvent.time,
      type: 'meeting',
      color: 'bg-emerald-100 text-emerald-800 border-emerald-200',
      attendees: newEvent.attendees || 'Kunal Choudhary',
      hour: newEvent.hour,
    };
    setEvents([...events, created]);
    setIsAddModalOpen(false);
    setNewEvent({ day: 15, title: '', time: '11:00 AM', attendees: '', hour: 11 });
    toast.success(`Event "${created.title}" scheduled!`);
  };

  const handleSaveReschedule = (newDay: number, newTime: string) => {
    if (!selectedEvent) return;
    setEvents(events.map(ev => ev.id === selectedEvent.id ? { ...ev, day: newDay, time: newTime } : ev));
    setSelectedEvent({ ...selectedEvent, day: newDay, time: newTime });
    setIsRescheduling(false);
    toast.success('Event rescheduled successfully!');
  };

  const daysOfWeek = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const totalDays = 31;
  const prevMonthPadding = [28, 29, 30];

  const calendarCells = [];
  for (let i = 0; i < prevMonthPadding.length; i++) {
    calendarCells.push({ day: prevMonthPadding[i], isCurrentMonth: false });
  }
  for (let d = 1; d <= totalDays; d++) {
    calendarCells.push({ day: d, isCurrentMonth: true });
  }
  const remainingCells = 35 - calendarCells.length;
  for (let d = 1; d <= remainingCells; d++) {
    calendarCells.push({ day: d, isCurrentMonth: false });
  }

  const currentMonthEvents = events.filter(e => e.monthIndex === monthIndex);

  return (
    <div className="space-y-5">
      {/* 1. Header with title & Add Event button */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-bold text-slate-900 tracking-tight">Calendar</h2>
          <p className="text-xs text-slate-500">
            View and manage your schedule.
          </p>
        </div>

        <button
          onClick={() => setIsAddModalOpen(true)}
          className="px-4 py-2 bg-[#10b981] hover:bg-[#059669] text-white text-xs font-bold rounded-xl shadow-xs transition flex items-center gap-1.5 cursor-pointer self-start sm:self-auto"
        >
          <Plus className="w-4 h-4" />
          <span>Add Event</span>
        </button>
      </div>

      {/* 2. Top Navigation Toolbar matching screenshot */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-white p-3 rounded-2xl border border-slate-200/90 shadow-2xs">
        <div className="flex items-center gap-2">
          <button
            onClick={() => {
              setMonthIndex(9); // October
              toast.info('Returned to Today');
            }}
            className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 rounded-xl text-xs font-bold text-slate-700 transition cursor-pointer"
          >
            Today
          </button>
          <div className="flex items-center border border-slate-200 rounded-xl overflow-hidden bg-white">
            <button
              onClick={handlePrevMonth}
              className="p-1.5 hover:bg-slate-100 text-slate-600 cursor-pointer"
              title="Previous Month"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button
              onClick={handleNextMonth}
              className="p-1.5 hover:bg-slate-100 text-slate-600 cursor-pointer"
              title="Next Month"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
          <span className="text-sm font-bold text-slate-900 ml-2">{MONTH_NAMES[monthIndex]}</span>
        </div>

        {/* View Mode Toggles */}
        <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl">
          {(['Month', 'Week', 'Day'] as const).map((mode) => (
            <button
              key={mode}
              onClick={() => setViewMode(mode)}
              className={`px-3 py-1 rounded-lg text-xs font-bold transition cursor-pointer ${
                viewMode === mode
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              {mode}
            </button>
          ))}
        </div>
      </div>

      {/* 3. Calendar View Switcher: Month / Week / Day */}
      {viewMode === 'Month' ? (
        /* Monthly Calendar Grid */
        <div className="bg-white border border-slate-200/90 rounded-2xl overflow-hidden shadow-2xs">
          {/* Days of week header */}
          <div className="grid grid-cols-7 border-b border-slate-200 bg-slate-50/70 text-center py-2.5 text-xs font-bold text-slate-600 uppercase tracking-wider">
            {daysOfWeek.map((day) => (
              <div key={day}>{day}</div>
            ))}
          </div>

          {/* Grid Cells */}
          <div className="grid grid-cols-7 divide-x divide-y divide-slate-100">
            {calendarCells.map((cell, idx) => {
              const dayEvents = cell.isCurrentMonth
                ? currentMonthEvents.filter((e) => e.day === cell.day)
                : [];

              return (
                <div
                  key={idx}
                  className={`min-h-[105px] p-2 transition ${
                    cell.isCurrentMonth ? 'bg-white hover:bg-slate-50/40' : 'bg-slate-50/30 text-slate-400'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span
                      className={`text-xs font-bold ${
                        cell.isCurrentMonth ? 'text-slate-800' : 'text-slate-400'
                      } ${cell.isCurrentMonth && cell.day === 15 ? 'w-5 h-5 rounded-full bg-emerald-500 text-white flex items-center justify-center' : ''}`}
                    >
                      {cell.day}
                    </span>
                  </div>

                  {/* Render Event Badges */}
                  <div className="mt-1 space-y-1">
                    {dayEvents.map((evt) => (
                      <button
                        key={evt.id}
                        onClick={() => setSelectedEvent(evt)}
                        className={`w-full text-left p-1 rounded-lg border text-[10px] font-semibold leading-tight truncate transition cursor-pointer block ${evt.color} hover:brightness-95`}
                      >
                        <div className="truncate font-bold">{evt.title}</div>
                        <div className="text-[9px] opacity-80">{evt.time}</div>
                      </button>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ) : viewMode === 'Week' ? (
        /* Weekly View Grid */
        <div className="bg-white border border-slate-200/90 rounded-2xl overflow-hidden shadow-2xs p-4 space-y-3">
          <div className="grid grid-cols-7 gap-2 border-b border-slate-100 pb-3 text-center">
            {['Mon 13', 'Tue 14', 'Wed 15 (Today)', 'Thu 16', 'Fri 17', 'Sat 18', 'Sun 19'].map((col, i) => (
              <div key={i} className={`p-2 rounded-xl text-xs font-bold ${i === 2 ? 'bg-emerald-500 text-white shadow-xs' : 'bg-slate-50 text-slate-700'}`}>
                {col}
              </div>
            ))}
          </div>

          <div className="grid grid-cols-7 gap-2 min-h-[340px]">
            {/* Displaying events scheduled in current active week */}
            {['13', '14', '15', '16', '17', '18', '19'].map((dayStr, i) => {
              const dayNum = parseInt(dayStr);
              const dayEvts = currentMonthEvents.filter(e => e.day === dayNum);
              return (
                <div key={i} className="bg-slate-50/50 rounded-xl p-2 border border-slate-100 space-y-2">
                  {dayEvts.length === 0 ? (
                    <span className="text-[10px] text-slate-400 block text-center pt-8">No events</span>
                  ) : (
                    dayEvts.map(evt => (
                      <div
                        key={evt.id}
                        onClick={() => setSelectedEvent(evt)}
                        className={`p-2 rounded-lg border text-xs cursor-pointer shadow-2xs ${evt.color}`}
                      >
                        <p className="font-bold text-[11px] leading-tight">{evt.title}</p>
                        <p className="text-[10px] opacity-80 mt-0.5">{evt.time}</p>
                        <p className="text-[9px] text-slate-500 mt-1 truncate">{evt.attendees}</p>
                      </div>
                    ))
                  )}
                </div>
              );
            })}
          </div>
        </div>
      ) : (
        /* Day View Agenda */
        <div className="bg-white border border-slate-200/90 rounded-2xl overflow-hidden shadow-2xs p-6 space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <h3 className="text-sm font-bold text-slate-900">Today's Schedule — October 15, 2025</h3>
            <span className="text-xs font-bold text-emerald-600 bg-emerald-50 px-2.5 py-1 rounded-full border border-emerald-200">
              3 Confirmed Sessions
            </span>
          </div>

          <div className="space-y-3 divide-y divide-slate-100 text-xs">
            {[
              { time: '10:00 AM', title: 'Executive Sales Pipeline Sync', attendees: 'Kunal, Nitin, Product Reps', type: 'internal' },
              { time: '11:00 AM', title: 'Product Demo - Matrix Solutions', attendees: 'Rahul Sharma, kunal@acme.com', type: 'meeting' },
              { time: '02:30 PM', title: 'Contract Proposal Review', attendees: 'Vikas Saini (BuildRight Infra)', type: 'call' },
              { time: '04:00 PM', title: 'Weekly CRM Revenue Round-up', attendees: 'Sales Management', type: 'internal' },
            ].map((slot, i) => (
              <div key={i} className="pt-3 flex items-start gap-4">
                <div className="w-20 font-mono font-bold text-slate-500 shrink-0">{slot.time}</div>
                <div className="flex-1 p-3 bg-slate-50 hover:bg-emerald-50/50 rounded-xl border border-slate-100 transition cursor-pointer">
                  <p className="font-bold text-slate-900 text-xs">{slot.title}</p>
                  <p className="text-[11px] text-slate-500 mt-0.5">Attendees: {slot.attendees}</p>
                </div>
                <button
                  onClick={() => toast.success(`Joining session at ${slot.time}...`)}
                  className="px-3 py-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 font-bold rounded-xl border border-emerald-200 text-xs"
                >
                  Join
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Event Details Drawer/Modal with Working Reschedule */}
      {selectedEvent && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="w-full max-w-sm bg-white border border-slate-200 rounded-2xl p-5 shadow-2xl space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
                Scheduled Event
              </span>
              <button
                onClick={() => {
                  setSelectedEvent(null);
                  setIsRescheduling(false);
                }}
                className="text-slate-400 hover:text-slate-600 font-bold cursor-pointer"
              >
                ✕
              </button>
            </div>

            <div>
              <h3 className="text-base font-bold text-slate-900">{selectedEvent.title}</h3>
              <div className="flex items-center gap-1.5 text-xs text-slate-500 mt-1">
                <Clock className="w-3.5 h-3.5 text-slate-400" />
                <span>October {selectedEvent.day}, 2025 at {selectedEvent.time}</span>
              </div>
            </div>

            <div className="space-y-2 text-xs bg-slate-50 p-3 rounded-xl border border-slate-100">
              <div className="flex items-center gap-2 text-slate-700">
                <Users className="w-4 h-4 text-slate-400" />
                <span><strong>Attendees:</strong> {selectedEvent.attendees}</span>
              </div>
              <div className="flex items-center gap-2 text-slate-700">
                <Video className="w-4 h-4 text-emerald-600" />
                <span>Google Meet / Zoom Room</span>
              </div>
            </div>

            {/* Reschedule inline form */}
            {isRescheduling ? (
              <div className="p-3 bg-emerald-50/70 border border-emerald-200 rounded-xl space-y-2 text-xs">
                <span className="font-bold text-emerald-900 block">Choose New Date &amp; Time</span>
                <div className="grid grid-cols-2 gap-2">
                  <input
                    type="number"
                    min="1"
                    max="31"
                    defaultValue={selectedEvent.day}
                    id="resched-day"
                    className="px-2 py-1 bg-white border border-slate-200 rounded-lg text-xs"
                  />
                  <input
                    type="text"
                    defaultValue={selectedEvent.time}
                    id="resched-time"
                    className="px-2 py-1 bg-white border border-slate-200 rounded-lg text-xs"
                  />
                </div>
                <div className="flex justify-end gap-1.5 pt-1">
                  <button
                    onClick={() => setIsRescheduling(false)}
                    className="px-2.5 py-1 bg-slate-200 text-slate-700 rounded-lg text-xs font-bold"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={() => {
                      const d = parseInt((document.getElementById('resched-day') as HTMLInputElement).value);
                      const t = (document.getElementById('resched-time') as HTMLInputElement).value;
                      handleSaveReschedule(d, t);
                    }}
                    className="px-2.5 py-1 bg-[#10b981] text-white rounded-lg text-xs font-bold"
                  >
                    Save
                  </button>
                </div>
              </div>
            ) : (
              <div className="flex items-center gap-2 pt-2">
                <button
                  onClick={() => {
                    toast.success('Joining video conference room...');
                    setSelectedEvent(null);
                  }}
                  className="flex-1 py-2 bg-[#10b981] hover:bg-[#059669] text-white font-bold rounded-xl text-xs transition cursor-pointer"
                >
                  Join Meeting
                </button>
                <button
                  onClick={() => setIsRescheduling(true)}
                  className="px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl text-xs transition cursor-pointer"
                >
                  Reschedule
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Add Event Modal */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-white border border-slate-200 rounded-2xl p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-slate-900">Schedule Calendar Event</h3>
              <button
                onClick={() => setIsAddModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 text-base font-bold cursor-pointer"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleAddEvent} className="space-y-3 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Event Title</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Contract Discussion with Client"
                  value={newEvent.title}
                  onChange={(e) => setNewEvent({ ...newEvent, title: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Day of Month</label>
                  <input
                    type="number"
                    min="1"
                    max="31"
                    required
                    value={newEvent.day}
                    onChange={(e) => setNewEvent({ ...newEvent, day: Number(e.target.value) })}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:border-emerald-500"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Time</label>
                  <input
                    type="text"
                    required
                    placeholder="11:00 AM"
                    value={newEvent.time}
                    onChange={(e) => setNewEvent({ ...newEvent, time: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:border-emerald-500"
                  />
                </div>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Attendees / Contact</label>
                <input
                  type="text"
                  placeholder="e.g. Rahul Sharma, Kunal"
                  value={newEvent.attendees}
                  onChange={(e) => setNewEvent({ ...newEvent, attendees: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-3">
                <button
                  type="button"
                  onClick={() => setIsAddModalOpen(false)}
                  className="px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-[#10b981] hover:bg-[#059669] text-white font-bold rounded-xl shadow-xs cursor-pointer"
                >
                  Schedule Event
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
