import React, { useState, useEffect } from 'react';
import { crmApi } from '../auth/api-client';
import {
  Plus,
  Search,
  Edit2,
  Trash2,
  Eye,
  ChevronLeft,
  ChevronRight,
  Users,
  Trophy,
} from 'lucide-react';
import { useToast } from './Toast';

interface CompanyRow {
  id: string;
  name: string;
  industry: string;
  phone: string;
  email: string;
  status: 'Active' | 'Inactive';
  logoColor: string;
}

const DEFAULT_COMPANIES: CompanyRow[] = [
  {
    id: 'comp1',
    name: 'ABC Traders',
    industry: 'Retail',
    phone: '+91 98765 43210',
    email: 'info@abctraders.com',
    status: 'Active',
    logoColor: 'bg-emerald-500',
  },
  {
    id: 'comp2',
    name: 'Demo Pvt Ltd',
    industry: 'IT Services',
    phone: '+91 87654 32109',
    email: 'support@demo.com',
    status: 'Active',
    logoColor: 'bg-blue-500',
  },
  {
    id: 'comp3',
    name: 'XYZ Enterprises',
    industry: 'Manufacturing',
    phone: '+91 99887 76655',
    email: 'sales@xyz.com',
    status: 'Active',
    logoColor: 'bg-purple-500',
  },
  {
    id: 'comp4',
    name: 'Solution Tech',
    industry: 'Software',
    phone: '+91 91234 56789',
    email: 'hello@solution.com',
    status: 'Active',
    logoColor: 'bg-indigo-500',
  },
  {
    id: 'comp5',
    name: 'BuildRight Infra',
    industry: 'Real Estate',
    phone: '+91 90909 90909',
    email: 'contact@build.com',
    status: 'Active',
    logoColor: 'bg-amber-500',
  },
  {
    id: 'comp6',
    name: 'Global Services',
    industry: 'Services',
    phone: '+91 87654 12345',
    email: 'info@global.com',
    status: 'Inactive',
    logoColor: 'bg-slate-400',
  },
];

export const AccountsView: React.FC = () => {
  const toast = useToast();
  const [companiesList, setCompaniesList] = useState<CompanyRow[]>(DEFAULT_COMPANIES);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState<'All' | 'Active' | 'Inactive'>('All');
  const [isModalOpen, setIsModalOpen] = useState(false);

  // View & Edit Modals state
  const [viewingCompany, setViewingCompany] = useState<CompanyRow | null>(null);
  const [editingCompany, setEditingCompany] = useState<CompanyRow | null>(null);

  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 6;

  const [formData, setFormData] = useState({
    name: '',
    industry: 'Software',
    phone: '',
    email: '',
    status: 'Active' as 'Active' | 'Inactive',
  });

  const loadBackendAccounts = async () => {
    try {
      const res = await crmApi.listAccounts();
      if (res.data && res.data.length > 0) {
        const mapped: CompanyRow[] = (res.data as any[]).map((acc: any, i: number) => ({
          id: acc.id,
          name: acc.name,
          industry: (acc as any).industry || 'Enterprise',
          phone: (acc as any).phone || '+91 98765 00000',
          email: `contact@${acc.name.toLowerCase().replace(/[^a-z0-9]/g, '')}.com`,
          status: 'Active',
          logoColor: ['bg-emerald-500', 'bg-blue-500', 'bg-purple-500', 'bg-amber-500'][i % 4],
        }));
        setCompaniesList([...mapped, ...DEFAULT_COMPANIES.filter(d => !mapped.some(m => m.name === d.name))]);
      }
    } catch {
      // Keep rich mock default state
    }
  };

  useEffect(() => {
    loadBackendAccounts();
  }, []);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const created = await crmApi.createAccount({
        name: formData.name,
      });

      const newRow: CompanyRow = {
        id: created.id,
        name: formData.name,
        industry: formData.industry,
        phone: formData.phone || '+91 98765 43210',
        email: formData.email || `info@${formData.name.toLowerCase().replace(/\s+/g, '')}.com`,
        status: formData.status,
        logoColor: 'bg-emerald-500',
      };

      setCompaniesList([newRow, ...companiesList]);
      setIsModalOpen(false);
      setFormData({ name: '', industry: 'Software', phone: '', email: '', status: 'Active' });
      toast.success(`Company ${newRow.name} registered successfully!`);
    } catch {
      const newRow: CompanyRow = {
        id: 'comp-' + Date.now(),
        name: formData.name,
        industry: formData.industry,
        phone: formData.phone || '+91 98765 43210',
        email: formData.email,
        status: formData.status,
        logoColor: 'bg-emerald-500',
      };
      setCompaniesList([newRow, ...companiesList]);
      setIsModalOpen(false);
      toast.success(`Company ${newRow.name} registered!`);
    }
  };

  const handleSaveEdit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingCompany) return;
    setCompaniesList(companiesList.map(c => c.id === editingCompany.id ? editingCompany : c));
    setEditingCompany(null);
    toast.success(`Company ${editingCompany.name} updated!`);
  };

  const handleDelete = (id: string, name: string) => {
    setCompaniesList(companiesList.filter((c) => c.id !== id));
    toast.success(`Company ${name} deleted.`);
  };

  const filteredCompanies = companiesList.filter((c) => {
    const matchesSearch =
      c.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      c.industry.toLowerCase().includes(searchQuery.toLowerCase()) ||
      c.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
      c.phone.includes(searchQuery);

    if (!matchesSearch) return false;
    if (activeTab === 'All') return true;
    return c.status === activeTab;
  });

  const totalPages = Math.max(1, Math.ceil(filteredCompanies.length / pageSize));
  const paginatedCompanies = filteredCompanies.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  return (
    <div className="space-y-5">
      {/* 1. Header with title & Add Company button */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-bold text-slate-900 tracking-tight">Companies</h2>
          <p className="text-xs text-slate-500">
            Track and manage your business accounts.
          </p>
        </div>

        <button
          onClick={() => setIsModalOpen(true)}
          className="px-4 py-2 bg-[#10b981] hover:bg-[#059669] text-white text-xs font-bold rounded-xl shadow-xs transition flex items-center gap-1.5 cursor-pointer self-start sm:self-auto"
        >
          <Plus className="w-4 h-4" />
          <span>Add Company</span>
        </button>
      </div>

      {/* 2. Search & Tab Filter Bar */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-white p-3 rounded-2xl border border-slate-200/90 shadow-2xs">
        <div className="relative w-full sm:w-80">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
          <input
            type="text"
            placeholder="Search companies..."
            value={searchQuery}
            onChange={(e) => {
              setSearchQuery(e.target.value);
              setCurrentPage(1);
            }}
            className="w-full pl-9 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:border-emerald-500"
          />
        </div>

        <div className="flex items-center gap-1 w-full sm:w-auto overflow-x-auto">
          {(['All', 'Active', 'Inactive'] as const).map((tab) => (
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
                <th className="py-3.5 px-4">Company Name</th>
                <th className="py-3.5 px-4">Industry</th>
                <th className="py-3.5 px-4">Phone</th>
                <th className="py-3.5 px-4">Email</th>
                <th className="py-3.5 px-4">Status</th>
                <th className="py-3.5 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-700">
              {paginatedCompanies.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-slate-400">
                    No companies found matching your criteria.
                  </td>
                </tr>
              ) : (
                paginatedCompanies.map((c) => (
                  <tr key={c.id} className="hover:bg-slate-50/70 transition">
                    {/* Name & Logo */}
                    <td className="py-3.5 px-4">
                      <div
                        onClick={() => setViewingCompany(c)}
                        className="flex items-center gap-2.5 cursor-pointer group"
                      >
                        <div
                          className={`w-8 h-8 rounded-xl ${c.logoColor} text-white font-bold text-xs flex items-center justify-center shrink-0 shadow-2xs group-hover:scale-105 transition`}
                        >
                          {c.name.charAt(0)}
                        </div>
                        <span className="font-bold text-slate-900 group-hover:text-emerald-600 transition">
                          {c.name}
                        </span>
                      </div>
                    </td>

                    {/* Industry */}
                    <td className="py-3.5 px-4 text-slate-600 font-medium">
                      {c.industry}
                    </td>

                    {/* Phone */}
                    <td className="py-3.5 px-4 font-mono text-slate-600">
                      {c.phone}
                    </td>

                    {/* Email */}
                    <td className="py-3.5 px-4 font-mono text-slate-600">
                      {c.email}
                    </td>

                    {/* Status Badge */}
                    <td className="py-3.5 px-4">
                      <span
                        className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold ${
                          c.status === 'Active'
                            ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                            : 'bg-slate-100 text-slate-600 border border-slate-200'
                        }`}
                      >
                        <span className="w-1.5 h-1.5 rounded-full bg-current" />
                        {c.status}
                      </span>
                    </td>

                    {/* Actions */}
                    <td className="py-3.5 px-4 text-right">
                      <div className="flex items-center justify-end gap-1.5 text-slate-400">
                        <button
                          onClick={() => setViewingCompany(c)}
                          className="p-1.5 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition cursor-pointer"
                          title="View Company Details"
                        >
                          <Eye className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => setEditingCompany({ ...c })}
                          className="p-1.5 hover:text-emerald-600 hover:bg-emerald-50 rounded-lg transition cursor-pointer"
                          title="Edit Company"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => handleDelete(c.id, c.name)}
                          className="p-1.5 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition cursor-pointer"
                          title="Delete Company"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Working Table Pagination Footer */}
        <div className="px-5 py-3.5 bg-slate-50/60 border-t border-slate-200 flex items-center justify-between text-xs text-slate-500">
          <div>
            Showing {filteredCompanies.length === 0 ? 0 : (currentPage - 1) * pageSize + 1}-
            {Math.min(currentPage * pageSize, filteredCompanies.length)} of {filteredCompanies.length} companies
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

      {/* View Company Details Modal */}
      {viewingCompany && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in">
          <div className="w-full max-w-lg bg-white border border-slate-200 rounded-2xl p-6 shadow-2xl space-y-5">
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-3">
                <div className={`w-12 h-12 rounded-2xl ${viewingCompany.logoColor} text-white font-bold text-lg flex items-center justify-center shadow-xs`}>
                  {viewingCompany.name.charAt(0)}
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900">{viewingCompany.name}</h3>
                  <p className="text-xs text-slate-500">{viewingCompany.industry} Industry</p>
                </div>
              </div>
              <button
                onClick={() => setViewingCompany(null)}
                className="text-slate-400 hover:text-slate-600 text-lg font-bold cursor-pointer"
              >
                ✕
              </button>
            </div>

            <div className="grid grid-cols-2 gap-3 text-xs">
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-100">
                <span className="text-[11px] text-slate-400 block">Phone</span>
                <span className="font-mono font-bold text-slate-800 mt-0.5 block">{viewingCompany.phone}</span>
              </div>
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-100">
                <span className="text-[11px] text-slate-400 block">Email</span>
                <span className="font-mono font-bold text-slate-800 mt-0.5 block truncate">{viewingCompany.email}</span>
              </div>
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-100">
                <span className="text-[11px] text-slate-400 block">Status</span>
                <span className="font-bold text-emerald-700 mt-0.5 block">{viewingCompany.status} Account</span>
              </div>
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-100">
                <span className="text-[11px] text-slate-400 block">Key Rep</span>
                <span className="font-bold text-slate-800 mt-0.5 block">Kunal Choudhary</span>
              </div>
            </div>

            {/* Associated Contacts */}
            <div className="border-t border-slate-100 pt-3">
              <p className="text-[11px] uppercase font-bold text-slate-400 mb-2">Key Decision Makers</p>
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-100 flex items-center justify-between text-xs">
                <div className="flex items-center gap-2">
                  <Users className="w-4 h-4 text-blue-600" />
                  <div>
                    <p className="font-bold text-slate-800">Primary Account Contact</p>
                    <p className="text-[10px] text-slate-400">Executive Director</p>
                  </div>
                </div>
                <button
                  onClick={() => toast.info(`Connecting with account manager...`)}
                  className="px-2.5 py-1 bg-white border border-slate-200 rounded-lg text-slate-700 font-bold hover:bg-slate-50 text-[11px]"
                >
                  Contact
                </button>
              </div>
            </div>

            {/* Active Deals preview */}
            <div className="border-t border-slate-100 pt-3">
              <p className="text-[11px] uppercase font-bold text-slate-400 mb-2">Active Deal Value</p>
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-100 flex items-center justify-between text-xs">
                <div className="flex items-center gap-2">
                  <Trophy className="w-4 h-4 text-emerald-600" />
                  <div>
                    <p className="font-bold text-slate-800">Growth Tier Subscription</p>
                    <p className="text-[10px] text-slate-400">Negotiation Stage</p>
                  </div>
                </div>
                <span className="font-mono font-bold text-emerald-600">₹8,50,000</span>
              </div>
            </div>

            <div className="flex justify-end pt-2">
              <button
                onClick={() => setViewingCompany(null)}
                className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white font-bold rounded-xl text-xs transition cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Company Modal */}
      {editingCompany && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-white border border-slate-200 rounded-2xl p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-slate-900">Edit Company Information</h3>
              <button
                onClick={() => setEditingCompany(null)}
                className="text-slate-400 hover:text-slate-600 text-base font-bold cursor-pointer"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveEdit} className="space-y-3 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Company Name</label>
                <input
                  type="text"
                  required
                  value={editingCompany.name}
                  onChange={(e) => setEditingCompany({ ...editingCompany, name: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Industry</label>
                <select
                  value={editingCompany.industry}
                  onChange={(e) => setEditingCompany({ ...editingCompany, industry: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:border-emerald-500"
                >
                  <option value="Software">Software</option>
                  <option value="Retail">Retail</option>
                  <option value="IT Services">IT Services</option>
                  <option value="Manufacturing">Manufacturing</option>
                  <option value="Real Estate">Real Estate</option>
                  <option value="Services">Services</option>
                </select>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Phone Number</label>
                <input
                  type="text"
                  required
                  value={editingCompany.phone}
                  onChange={(e) => setEditingCompany({ ...editingCompany, phone: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Company Email</label>
                <input
                  type="email"
                  required
                  value={editingCompany.email}
                  onChange={(e) => setEditingCompany({ ...editingCompany, email: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Account Status</label>
                <select
                  value={editingCompany.status}
                  onChange={(e) => setEditingCompany({ ...editingCompany, status: e.target.value as any })}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:border-emerald-500"
                >
                  <option value="Active">Active</option>
                  <option value="Inactive">Inactive</option>
                </select>
              </div>

              <div className="flex items-center justify-end gap-2 pt-3">
                <button
                  type="button"
                  onClick={() => setEditingCompany(null)}
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

      {/* Add Company Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-white border border-slate-200 rounded-2xl p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-slate-900">Add New Company</h3>
              <button
                onClick={() => setIsModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 text-base font-bold cursor-pointer"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCreate} className="space-y-3 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Company Name</label>
                <input
                  type="text"
                  required
                  placeholder="Acme Corp"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Industry</label>
                <select
                  value={formData.industry}
                  onChange={(e) => setFormData({ ...formData, industry: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:border-emerald-500"
                >
                  <option value="Software">Software</option>
                  <option value="Retail">Retail</option>
                  <option value="IT Services">IT Services</option>
                  <option value="Manufacturing">Manufacturing</option>
                  <option value="Real Estate">Real Estate</option>
                  <option value="Healthcare">Healthcare</option>
                  <option value="Finance">Finance</option>
                </select>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Phone Number</label>
                <input
                  type="text"
                  placeholder="+91 98765 43210"
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:border-emerald-500"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Company Email</label>
                <input
                  type="email"
                  placeholder="info@acme.com"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:border-emerald-500"
                />
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
                  Save Company
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
