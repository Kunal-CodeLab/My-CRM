import React, { useState, useEffect } from 'react';
import { teamApi } from '../auth/api-client';
import { useAuthStore } from '../auth/auth-store';
import { TeamMember, OrganizationInvitationItem } from '@crm/shared-types';
import { useToast } from './Toast';
import { ConfirmDialog } from './ConfirmDialog';
import {
  Users,
  UserPlus,
  Shield,
  KeyRound,
  Trash2,
  Mail,
  Copy,
  Check,
  RefreshCw,
  AlertCircle,
  X,
} from 'lucide-react';

export const TeamView: React.FC = () => {
  const toast = useToast();
  const { user, organization } = useAuthStore();
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [invitations, setInvitations] = useState<OrganizationInvitationItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Confirm dialog state
  const [confirmDialog, setConfirmDialog] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    confirmLabel?: string;
    isDanger?: boolean;
    isLoading?: boolean;
    action: () => Promise<void>;
  }>({
    isOpen: false,
    title: '',
    message: '',
    action: async () => {},
  });

  // Invite modal state
  const [inviteModalOpen, setInviteModalOpen] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState<'admin' | 'member' | 'read_only'>('member');
  const [inviting, setInviting] = useState(false);
  const [generatedInvite, setGeneratedInvite] = useState<{ token: string; email: string } | null>(null);
  const [copied, setCopied] = useState(false);

  // Action loading states
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);

  const canManage = organization?.role === 'owner' || organization?.role === 'admin';

  const fetchData = async () => {
    setLoading(true);
    setError(null);
    try {
      const memberList = await teamApi.listMembers();
      setMembers(memberList);

      if (canManage) {
        const invList = await teamApi.listInvitations();
        setInvitations(invList);
      }
    } catch (err: any) {
      setError(err.message || 'Failed to load team members');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [organization?.id]);

  const handleSendInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inviteEmail.trim()) return;

    setInviting(true);
    setError(null);
    try {
      const result = await teamApi.inviteMember({
        email: inviteEmail.trim(),
        role: inviteRole,
      });

      if (result.invitationToken) {
        setGeneratedInvite({
          token: result.invitationToken,
          email: result.email,
        });
      }

      toast.success(`Invitation generated for ${inviteEmail.trim()}`);
      setInviteEmail('');
      await fetchData();
    } catch (err: any) {
      toast.error(err.message || 'Invitation failed');
    } finally {
      setInviting(false);
    }
  };

  const handleCopyLink = () => {
    if (!generatedInvite) return;
    const url = `${window.location.origin}/accept-invite?token=${generatedInvite.token}`;
    navigator.clipboard.writeText(url);
    setCopied(true);
    toast.info('Invitation link copied to clipboard');
    setTimeout(() => setCopied(false), 2500);
  };

  const handleRoleChange = async (membershipId: string, newRole: 'admin' | 'member' | 'read_only') => {
    setActionLoadingId(membershipId);
    try {
      await teamApi.updateMemberRole(membershipId, newRole);
      toast.success(`Role updated successfully to ${newRole}`);
      await fetchData();
    } catch (err: any) {
      toast.error(err.message || 'Failed to update role');
    } finally {
      setActionLoadingId(null);
    }
  };

  const handleRevokeMember = (membershipId: string, memberName: string) => {
    setConfirmDialog({
      isOpen: true,
      title: 'Revoke Team Member Access',
      message: `Are you sure you want to revoke access for ${memberName}? Their active sessions and credentials will be terminated immediately.`,
      confirmLabel: 'Revoke Access',
      isDanger: true,
      action: async () => {
        setActionLoadingId(membershipId);
        try {
          await teamApi.revokeMember(membershipId);
          toast.success(`Access revoked for ${memberName}`);
          await fetchData();
        } catch (err: any) {
          toast.error(err.message || 'Failed to revoke member');
        } finally {
          setActionLoadingId(null);
          setConfirmDialog((prev) => ({ ...prev, isOpen: false }));
        }
      },
    });
  };

  const handleCancelInvite = (invitationId: string) => {
    setConfirmDialog({
      isOpen: true,
      title: 'Cancel Pending Invitation',
      message: 'Are you sure you want to cancel this pending invitation? The invitation token will be permanently invalidated.',
      confirmLabel: 'Cancel Invitation',
      isDanger: true,
      action: async () => {
        try {
          await teamApi.cancelInvitation(invitationId);
          toast.success('Invitation cancelled successfully');
          await fetchData();
        } catch (err: any) {
          toast.error(err.message || 'Failed to cancel invitation');
        } finally {
          setConfirmDialog((prev) => ({ ...prev, isOpen: false }));
        }
      },
    });
  };

  const getRoleBadge = (role: string) => {
    switch (role) {
      case 'owner':
        return (
          <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30 uppercase tracking-wider">
            Owner
          </span>
        );
      case 'admin':
        return (
          <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 uppercase tracking-wider">
            Admin
          </span>
        );
      case 'member':
        return (
          <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-cyan-500/20 text-cyan-300 border border-cyan-500/30 uppercase tracking-wider">
            Sales Rep
          </span>
        );
      case 'read_only':
        return (
          <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-slate-500/20 text-slate-300 border border-slate-500/30 uppercase tracking-wider">
            Read Only
          </span>
        );
      default:
        return (
          <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-slate-700 text-slate-300 uppercase">
            {role}
          </span>
        );
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-800">
        <div>
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            <Users className="w-6 h-6 text-indigo-400" />
            Team &amp; Access Control
          </h2>
          <p className="text-xs text-slate-400 mt-1">
            Manage organization members, assign operational RBAC roles, and invite sales representatives.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={fetchData}
            disabled={loading}
            className="p-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl transition border border-slate-700"
            title="Refresh list"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>

          {canManage && (
            <button
              onClick={() => {
                setGeneratedInvite(null);
                setInviteModalOpen(true);
              }}
              className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold rounded-xl flex items-center gap-2 shadow-md transition cursor-pointer"
            >
              <UserPlus className="w-4 h-4" />
              <span>Invite Member</span>
            </button>
          )}
        </div>
      </div>

      {error && (
        <div className="p-3 bg-rose-950/40 border border-rose-500/30 rounded-xl text-xs text-rose-300 flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Active Members Table */}
      <div className="bg-slate-900/60 border border-slate-800 rounded-xl overflow-hidden">
        <div className="p-4 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Shield className="w-4 h-4 text-emerald-400" />
            <h3 className="text-sm font-bold text-white">Active Organization Members</h3>
          </div>
          <span className="text-xs text-slate-400 font-mono">
            {members.length} {members.length === 1 ? 'member' : 'members'}
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-950/60 text-slate-400 uppercase text-[10px] tracking-wider border-b border-slate-800">
              <tr>
                <th className="py-3 px-4">Member</th>
                <th className="py-3 px-4">Email</th>
                <th className="py-3 px-4">Role</th>
                <th className="py-3 px-4">Joined Date</th>
                {canManage && <th className="py-3 px-4 text-right">Actions</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {members.map((m) => {
                const isSelf = m.userId === user?.id;
                const isOwner = m.role === 'owner';
                const isUpdating = actionLoadingId === m.id;

                return (
                  <tr key={m.id} className="hover:bg-slate-800/30 transition">
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-lg bg-indigo-600/30 border border-indigo-500/30 flex items-center justify-center font-bold text-indigo-300 text-xs">
                          {m.firstName?.[0] || m.email[0].toUpperCase()}
                        </div>
                        <div>
                          <div className="font-semibold text-white flex items-center gap-1.5">
                            <span>{m.firstName} {m.lastName}</span>
                            {isSelf && (
                              <span className="text-[10px] bg-slate-800 text-indigo-300 px-1.5 py-0.2 rounded font-normal">
                                You
                              </span>
                            )}
                          </div>
                          <span className="text-[11px] text-slate-500 font-mono text-[10px]">
                            Session v{m.sessionVersion}
                          </span>
                        </div>
                      </div>
                    </td>

                    <td className="py-3 px-4 text-slate-300 font-mono text-[11px]">
                      {m.email}
                    </td>

                    <td className="py-3 px-4">
                      {canManage && !isOwner && !isSelf ? (
                        <select
                          value={m.role}
                          disabled={isUpdating}
                          onChange={(e) => handleRoleChange(m.id, e.target.value as any)}
                          className="px-2.5 py-1 bg-slate-950 border border-slate-700 rounded-lg text-xs text-white focus:outline-none focus:border-indigo-500 font-medium"
                        >
                          <option value="admin">Admin</option>
                          <option value="member">Sales Rep</option>
                          <option value="read_only">Read Only</option>
                        </select>
                      ) : (
                        getRoleBadge(m.role)
                      )}
                    </td>

                    <td className="py-3 px-4 text-slate-400">
                      {new Date(m.joinedAt).toLocaleDateString()}
                    </td>

                    {canManage && (
                      <td className="py-3 px-4 text-right">
                        {!isOwner && !isSelf ? (
                          <button
                            onClick={() => handleRevokeMember(m.id, `${m.firstName} ${m.lastName}`)}
                            disabled={isUpdating}
                            className="p-1.5 text-slate-400 hover:text-rose-400 hover:bg-rose-950/30 rounded-lg transition"
                            title="Revoke access"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        ) : (
                          <span className="text-[11px] text-slate-600 select-none">&mdash;</span>
                        )}
                      </td>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Pending Invitations Section */}
      {canManage && (
        <div className="bg-slate-900/60 border border-slate-800 rounded-xl overflow-hidden">
          <div className="p-4 border-b border-slate-800 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Mail className="w-4 h-4 text-cyan-400" />
              <h3 className="text-sm font-bold text-white">Pending Team Invitations</h3>
            </div>
            <span className="text-xs text-slate-400 font-mono">
              {invitations.length} pending
            </span>
          </div>

          {invitations.length === 0 ? (
            <div className="p-8 text-center text-slate-500 text-xs">
              No pending invitations. Click &ldquo;Invite Member&rdquo; above to invite a new team member.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-950/60 text-slate-400 uppercase text-[10px] tracking-wider border-b border-slate-800">
                  <tr>
                    <th className="py-3 px-4">Invited Email</th>
                    <th className="py-3 px-4">Assigned Role</th>
                    <th className="py-3 px-4">Status</th>
                    <th className="py-3 px-4">Expires</th>
                    <th className="py-3 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {invitations.map((inv) => (
                    <tr key={inv.id} className="hover:bg-slate-800/30 transition">
                      <td className="py-3 px-4 text-white font-medium">
                        {inv.email}
                      </td>
                      <td className="py-3 px-4">
                        {getRoleBadge(inv.role)}
                      </td>
                      <td className="py-3 px-4">
                        <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-amber-500/20 text-amber-300 border border-amber-500/30 uppercase">
                          Pending
                        </span>
                      </td>
                      <td className="py-3 px-4 text-slate-400">
                        {new Date(inv.expiresAt).toLocaleDateString()}
                      </td>
                      <td className="py-3 px-4 text-right">
                        <button
                          onClick={() => handleCancelInvite(inv.id)}
                          className="px-2.5 py-1 text-slate-400 hover:text-rose-400 hover:bg-rose-950/30 rounded-lg text-xs transition"
                        >
                          Cancel
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Invite Member Modal */}
      {inviteModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            <div className="p-5 border-b border-slate-800 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <UserPlus className="w-5 h-5 text-indigo-400" />
                <h3 className="text-base font-bold text-white">Invite Team Member</h3>
              </div>
              <button
                onClick={() => setInviteModalOpen(false)}
                className="text-slate-400 hover:text-white p-1 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {generatedInvite ? (
              <div className="p-6 space-y-4">
                <div className="p-3 bg-emerald-950/30 border border-emerald-500/30 rounded-xl text-emerald-300 text-xs flex items-center gap-2">
                  <Check className="w-4 h-4 shrink-0" />
                  <span>Invitation link successfully generated for {generatedInvite.email}!</span>
                </div>

                <div className="space-y-1.5">
                  <span className="text-xs text-slate-400 font-medium">Single-Use Token:</span>
                  <div className="p-3 bg-slate-950 rounded-xl border border-slate-800 font-mono text-xs text-indigo-300 break-all select-all">
                    {generatedInvite.token}
                  </div>
                </div>

                <div className="flex items-center gap-3 pt-2">
                  <button
                    onClick={handleCopyLink}
                    className="flex-1 py-2.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-xl text-xs font-semibold flex items-center justify-center gap-2 shadow-md transition"
                  >
                    {copied ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4" />}
                    <span>{copied ? 'Link Copied!' : 'Copy Invitation Link'}</span>
                  </button>
                  <button
                    onClick={() => {
                      setGeneratedInvite(null);
                      setInviteModalOpen(false);
                    }}
                    className="px-4 py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-semibold transition"
                  >
                    Done
                  </button>
                </div>
              </div>
            ) : (
              <form onSubmit={handleSendInvite} className="p-6 space-y-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-slate-300">
                    Email Address
                  </label>
                  <input
                    type="email"
                    required
                    value={inviteEmail}
                    onChange={(e) => setInviteEmail(e.target.value)}
                    placeholder="colleague@company.com"
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-slate-300">
                    Assigned Role
                  </label>
                  <select
                    value={inviteRole}
                    onChange={(e) => setInviteRole(e.target.value as any)}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-xs text-white focus:outline-none focus:border-indigo-500"
                  >
                    <option value="member">Sales Representative (Deals &amp; Contacts)</option>
                    <option value="admin">Administrator (Full operational access)</option>
                    <option value="read_only">Read-Only Viewer (Auditor / Executive)</option>
                  </select>
                </div>

                <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-800">
                  <button
                    type="button"
                    onClick={() => setInviteModalOpen(false)}
                    className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-semibold transition"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={inviting}
                    className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white rounded-xl text-xs font-semibold shadow-md transition flex items-center gap-2"
                  >
                    <KeyRound className="w-3.5 h-3.5" />
                    <span>{inviting ? 'Generating...' : 'Generate Invitation'}</span>
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}

      {/* Confirm Dialog */}
      <ConfirmDialog
        isOpen={confirmDialog.isOpen}
        title={confirmDialog.title}
        message={confirmDialog.message}
        confirmLabel={confirmDialog.confirmLabel}
        isDanger={confirmDialog.isDanger}
        isLoading={confirmDialog.isLoading}
        onConfirm={confirmDialog.action}
        onCancel={() => setConfirmDialog((prev) => ({ ...prev, isOpen: false }))}
      />
    </div>
  );
};
