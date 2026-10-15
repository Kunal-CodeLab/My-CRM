import React, { useState, useEffect } from 'react';
import { crmApi } from '../auth/api-client';
import {
  CheckSquare,
  Plus,
  Phone,
  Calendar,
  Mail,
  CheckCircle2,
  Edit2,
  Trash2,
  ChevronLeft,
  ChevronRight,
  Search,
} from 'lucide-react';
import { useToast } from './Toast';

interface ActivityRow {
  id: string;
  type: 'Call' | 'Meeting' | 'Email' | 'Task';
  subject: string;
  contactCompany: string;
  dateTime: string;
  status: 'Completed' | 'Scheduled' | 'Sent' | 'Pending';
}

const DEFAULT_ACTIVITIES: ActivityRow[] = [
  {
    id: 'act1',
    type: 'Call',
    subject: 'Follow up call',
    contactCompany: 'Rahul Sharma (ABC Traders)',
    dateTime: 'Today, 10:30 AM',
    status: 'Completed',
  },
  {
    id: 'act2',
    type: 'Meeting',
    subject: 'Client meeting',
    contactCompany: 'Priya Verma (Demo Pvt Ltd)',
    dateTime: 'Today, 11:00 AM',
    status: 'Scheduled',
  },
  {
    id: 'act3',
    type: 'Email',
    subject: 'Proposal sent',
    contactCompany: 'Amit Joshi (XYZ Enterprises)',
    dateTime: 'Today, 01:20 PM',
    status: 'Sent',
  },
  {
    id: 'act4',
    type: 'Task',
    subject: 'Send quotation',
    contactCompany: 'Neha Gupta (Solution Tech)',
    dateTime: 'Today, 03:00 PM',
    status: 'Pending',
  },
  {
    id: 'act5',
    type: 'Call',
    subject: 'Demo call',
    contactCompany: 'Vikas Saini (BuildRight Infra)',
    dateTime: 'Tomorrow, 11:00 AM',
    status: 'Scheduled',
  },
  {
    id: 'act6',
    type: 'Meeting',
    subject: 'Office visit',
    contactCompany: 'Sneha Rathi (Global Services)',
    dateTime: 'Tomorrow, 02:00 PM',
    status: 'Pending',
  },
];

export const ActivitiesView: React.FC = () => {
  const toast = useToast();
  const [activitiesList, setActivitiesList] = useState<ActivityRow[]>(DEFAULT_ACTIVITIES);
  const [activeTab, setActiveTab] = useState<'All' | 'Calls' | 'Meetings' | 'Emails' | 'Tasks'>('All');
  const [searchQuery, setSearchQuery] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingActivity, setEditingActivity] = useState<ActivityRow | null>(null);

  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 6;

  const [formData, setFormData] = useState({
    type: 'Call' as 'Call' | 'Meeting' | 'Email' | 'Task',
    subject: '',
    contactCompany: '',
    dateTime: 'Today, 04:00 PM',
    status: 'Scheduled' as 'Completed' | 'Scheduled' | 'Sent' | 'Pending',
  });

  const loadBackendActivities = async () => {
    try {
      const res = await crmApi.listActivities();
      const items = Array.isArray(res) ? res : (res as any)?.data || [];
      if (items.length > 0) {
        const mapped: ActivityRow[] = items.map((act: any) => ({
          id: act.id,
          type: (act.type.charAt(0).toUpperCase() + act.type.slice(1).toLowerCase()) as any,
          subject: act.subject,
          contactCompany: 'Acme Partner',
          dateTime: act.dueDate ? new Date(act.dueDate).toLocaleDateString() : 'Today, 12:00 PM',
          status: act.completed ? 'Completed' : 'Scheduled',
        }));
        setActivitiesList([...mapped, ...DEFAULT_ACTIVITIES.filter(d => !mapped.some(m => m.subject === d.subject))]);
      }
    } catch {
      // Keep rich demo default state
    }
  };

  useEffect(() => {
    loadBackendActivities();
  }, []);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const created = await crmApi.createActivity({
        type: formData.type.toUpperCase() as any,
        subject: formData.subject,
        dueDate: new Date().toISOString(),
      });

      const newRow: ActivityRow = {
        id: created.id,
        type: formData.type,
        subject: formData.subject,
        contactCompany: formData.contactCompany || 'General Activity',
        dateTime: formData.dateTime,
        status: formData.status,
      };

      setActivitiesList([newRow, ...activitiesList]);
      setIsModalOpen(false);
      setFormData({
        type: 'Call',
        subject: '',
        contactCompany: '',
        dateTime: 'Today, 04:00 PM',
        status: 'Scheduled',
      });
      toast.success(`Activity "${newRow.subject}" created!`);
    } catch {
      const newRow: ActivityRow = {
        id: 'act-' + Date.now(),
        type: formData.type,
        subject: formData.subject,
        contactCompany: formData.contactCompany || 'General Activity',
        dateTime: formData.dateTime,
        status: formData.status,
      };
      setActivitiesList([newRow, ...activitiesList]);
      setIsModalOpen(false);
      toast.success(`Activity "${newRow.subject}" created!`);
    }
  };

  const handleSaveEdit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingActivity) return;
    setActivitiesList(activitiesList.map(a => a.id === editingActivity.id ? editingActivity : a));
    setEditingActivity(null);
    toast.success(`Activity "${editingActivity.subject}" updated!`);
  };

  const handleToggleComplete = (id: string) => {
    setActivitiesList((prev) =>
      prev.map((a) => {
        if (a.id === id) {
          const newStatus = a.status === 'Completed' ? 'Pending' : 'Completed';
          toast.success(`Activity marked as ${newStatus}`);
          return { ...a, status: newStatus };
        }
        return a;
      })
    );
  };

  const handleDelete = (id: string, subject: string) => {
    setActivitiesList(activitiesList.filter((a) => a.id !== id));
    toast.success(`Activity "${subject}" deleted.`);
  };

  const filteredActivities = activitiesList.filter((a) => {
    const matchesSearch =
      a.subject.toLowerCase().includes(searchQuery.toLowerCase()) ||
      a.contactCompany.toLowerCase().includes(searchQuery.toLowerCase());

    if (!matchesSearch) return false;
    if (activeTab === 'All') return true;
    if (activeTab === 'Calls') return a.type === 'Call';
    if (activeTab === 'Meetings') return a.type === 'Meeting';
    if (activeTab === 'Emails') return a.type === 'Email';
    if (activeTab === 'Tasks') return a.type === 'Task';
    return true;
  });

  const totalPages = Math.max(1, Math.ceil(filteredActivities.length / pageSize));
  const paginatedActivities = filteredActivities.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  return (
    <div className="space-y-5">
      {/* 1. Header with title & Add Activity button */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-bold text-slate-900 tracking-tight">Activities</h2>
          <p className="text-xs text-slate-500">
            Track your tasks, meetings and follow-ups.
          </p>
        </div>

        <button
          onClick={() => setIsModalOpen(true)}
          className="px-4 py-2 bg-[#10b981] hover:bg-[#059669] text-white text-xs font-bold rounded-xl shadow-xs transition flex items-center gap-1.5 cursor-pointer self-start sm:self-auto"
        >
          <Plus className="w-4 h-4" />
          <span>Add Activity</span>
        </button>
      </div>

      {/* 2. Search & Tab Filter Bar */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-white p-3 rounded-2xl border border-slate-200/90 shadow-2xs">
        <div className="relative w-full sm:w-80">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
          <input
            type="text"
            placeholder="Search activities..."
            value={searchQuery}
            onChange={(e) => {
              setSearchQuery(e.target.value);
              setCurrentPage(1);
            }}
            className="w-full pl-9 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:border-emerald-500"
          />
        </div>

        <div className="flex items-center gap-1 w-full sm:w-auto overflow-x-auto">
          {(['All', 'Calls', 'Meetings', 'Emails', 'Tasks'] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => {
                setActiveTab(tab);
                setCurrentPage(1);
              }}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition cursor-pointer shrink-0 ${
                activeTab === tab
                  ? 'bg-slate-900 text-white shadow-xs'
                  : 'text-slate-600 hover:bg-slate-100'
              }`}
            >
              {tab}
            </button>
          ))}
        </div>
      </div>

      {/* 3. Table */}
      <div className="bg-white border border-slate-200/90 rounded-2xl overflow-hidden shadow-2xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50/80 text-slate-500 font-bold border-b border-slate-200">
              <tr>
                <th className="py-3.5 px-4">Type</th>
                <th className="py-3.5 px-4">Subject</th>
                <th className="py-3.5 px-4">Contact / Company</th>
                <th className="py-3.5 px-4">Date & Time</th>
                <th className="py-3.5 px-4">Status</th>
                <th className="py-3.5 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-700">
              {paginatedActivities.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-slate-400">
                    No activities found matching your criteria.
                  </td>
                </tr>
              ) : (
                paginatedActivities.map((a) => {
                  let Icon = CheckSquare;
                  let iconBg = 'bg-amber-100 text-amber-700';

                  if (a.type === 'Call') {
                    Icon = Phone;
                    iconBg = 'bg-emerald-100 text-emerald-700';
                  } else if (a.type === 'Meeting') {
                    Icon = Calendar;
                    iconBg = 'bg-blue-100 text-blue-700';
                  } else if (a.type === 'Email') {
                    Icon = Mail;
                    iconBg = 'bg-purple-100 text-purple-700';
                  }

                  return (
                    <tr key={a.id} className="hover:bg-slate-50/70 transition">
                      {/* Type icon & label */}
                      <td className="py-3.5 px-4">
                        <div className="flex items-center gap-2">
                          <div className={`p-1.5 rounded-lg ${iconBg}`}>
                            <Icon className="w-3.5 h-3.5" />
                          </div>
                          <span className="font-semibold text-slate-800">{a.type}</span>
                        </div>
                      </td>

                      {/* Subject */}
                      <td className="py-3.5 px-4 font-bold text-slate-900">
                        {a.subject}
                      </td>

                      {/* Contact / Company */}
                      <td className="py-3.5 px-4 font-medium text-slate-700">
                        {a.contactCompany}
                      </td>

                      {/* Date & Time */}
                      <td className="py-3.5 px-4 font-mono text-slate-600">
                        {a.dateTime}
                      </td>

                      {/* Status */}
                      <td className="py-3.5 px-4">
                        <span
                          className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold ${
                            a.status === 'Completed'
                              ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                              : a.status === 'Scheduled'
                              ? 'bg-blue-50 text-blue-700 border border-blue-200'
                              : a.status === 'Sent'
                              ? 'bg-purple-50 text-purple-700 border border-purple-200'
                              : 'bg-amber-50 text-amber-700 border border-amber-200'
                          }`}
                        >
                          <span className="w-1.5 h-1.5 rounded-full bg-current" />
                          {a.status}
                        </span>
                      </td>

                      {/* Actions */}
                      <td className="py-3.5 px-4 text-right">
                        <div className="flex items-center justify-end gap-1.5 text-slate-400">
                          <button
                            onClick={() => handleToggleComplete(a.id)}
                            className="p-1.5 hover:text-emerald-600 hover:bg-emerald-50 rounded-lg transition cursor-pointer"
                            title="Toggle Completed"
                          >
                            <CheckCircle2 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => setEditingActivity({ ...a })}
                            className="p-1.5 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition cursor-pointer"
                            title="Edit Activity"
                          >
                            <Edit2 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => handleDelete(a.id, a.subject)}
                            className="p-1.5 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition cursor-pointer"
                            title="Delete Activity"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Working Table Pagination Footer */}
        <div className="px-5 py-3.5 bg-slate-50/60 border-t border-slate-200 flex items-center justify-between text-xs text-slate-500">
          <div>
            Showing {filteredActivities.length === 0 ? 0 : (currentPage - 1) * pageSize + 1}-
            {Math.min(currentPage * pageSize, filteredActivities.length)} of {filteredActivities.length} activities
          </div>
          <div className="flex items-center gap-1.5">
            <button
              onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
              disabled={currentPage <= 1}
              className="p-1.5 rounded-lg border border-slate-200 text-slate-600 hover:bg-white disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
            >
              <ChevronLeft className="w-3.5 h-3.5" />
            </button>
            {Array.from({ length: totalPages }).map((_, i) => (
              <button
                key={i}
                onClick={() => setCurrentPage(i + 1)}
                className={`w-7 h-7 rounded-lg font-bold text-xs flex items-center justify-center cursor-pointer transition ${
                  currentPage === i + 1
                    ? 'bg-emerald-500 text-white shadow-xs'
                    : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'
                }`}
              >
                {i + 1}
              </button>
            ))}
            <button
              onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
              disabled={currentPage >= totalPages}
              className="p-1.5 rounded-lg border border-slate-200 text-slate-600 hover:bg-white disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
            >
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>

      {/* Edit Activity Modal */}
      {editingActivity && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-white border border-slate-200 rounded-2xl p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-slate-900">Edit Activity Details</h3>
              <button
                onClick={() => setEditingActivity(null)}
                className="text-slate-400 hover:text-slate-600 text-base font-bold cursor-pointer"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveEdit} className="space-y-3 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Activity Type</label>
                <select
                  value={editingActivity.type}
                  onChange={(e) => setEditingActivity({ ...editingActivity, type: e.target.value as any })}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:border-emerald-500"
                >
                  <option value="Call">Call</option>
                  <option value="Meeting">Meeting</option>
                  <option value="Email">Email</option>
                  <option value="Task">Task</option>
                </select>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Subject</label>
                <input
                  type="text"
                  required
                  value={editingActivity.subject}
                  onChange={(e) => setEditingActivity({ ...editingActivity, subject: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Contact / Company</label>
                <input
                  type="text"
                  required
                  value={editingActivity.contactCompany}
                  onChange={(e) => setEditingActivity({ ...editingActivity, contactCompany: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Date & Time</label>
                  <input
                    type="text"
                    required
                    value={editingActivity.dateTime}
                    onChange={(e) => setEditingActivity({ ...editingActivity, dateTime: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:border-emerald-500"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Status</label>
                  <select
                    value={editingActivity.status}
                    onChange={(e) => setEditingActivity({ ...editingActivity, status: e.target.value as any })}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:border-emerald-500"
                  >
                    <option value="Scheduled">Scheduled</option>
                    <option value="Pending">Pending</option>
                    <option value="Completed">Completed</option>
                    <option value="Sent">Sent</option>
                  </select>
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-3">
                <button
                  type="button"
                  onClick={() => setEditingActivity(null)}
                  className="px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-[#10b981] hover:bg-[#059669] text-white font-bold rounded-xl shadow-xs cursor-pointer"
                >
                  Save Changes
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Add Activity Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-white border border-slate-200 rounded-2xl p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-slate-900">Add New Activity</h3>
              <button
                onClick={() => setIsModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 text-base font-bold cursor-pointer"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCreate} className="space-y-3 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Activity Type</label>
                <select
                  value={formData.type}
                  onChange={(e) => setFormData({ ...formData, type: e.target.value as any })}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:border-emerald-500"
                >
                  <option value="Call">Call</option>
                  <option value="Meeting">Meeting</option>
                  <option value="Email">Email</option>
                  <option value="Task">Task</option>
                </select>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Subject</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Follow up with client regarding proposal"
                  value={formData.subject}
                  onChange={(e) => setFormData({ ...formData, subject: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Contact / Company</label>
                <input
                  type="text"
                  placeholder="e.g. Rahul Sharma (ABC Traders)"
                  value={formData.contactCompany}
                  onChange={(e) => setFormData({ ...formData, contactCompany: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Date & Time</label>
                  <input
                    type="text"
                    placeholder="Today, 04:00 PM"
                    value={formData.dateTime}
                    onChange={(e) => setFormData({ ...formData, dateTime: e.target.value })}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:border-emerald-500"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Status</label>
                  <select
                    value={formData.status}
                    onChange={(e) => setFormData({ ...formData, status: e.target.value as any })}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:border-emerald-500"
                  >
                    <option value="Scheduled">Scheduled</option>
                    <option value="Pending">Pending</option>
                    <option value="Completed">Completed</option>
                    <option value="Sent">Sent</option>
                  </select>
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-3">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-xl cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-[#10b981] hover:bg-[#059669] text-white font-bold rounded-xl shadow-xs cursor-pointer"
                >
                  Save Activity
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
