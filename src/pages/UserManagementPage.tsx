import React, { useState } from 'react';
import { Edit3, Plus, Search, Shield, UserCheck, UserX } from 'lucide-react';
import { UserAccount, UserRole, UserStatus } from '../types/signage';
import { StatusBadge } from '../components/ui/StatusBadge';
import { Modal } from '../components/ui/Modal';

const ROLES: UserRole[] = [
  'Super Administrator',
  'IT Administrator',
  'Content Manager',
  'Monitoring User',
];

interface UserManagementPageProps {
  users: UserAccount[];
  onSaveUser: (user: UserAccount) => void;
  onToggleUserStatus: (id: string) => void;
}

export const UserManagementPage: React.FC<UserManagementPageProps> = ({
  users,
  onSaveUser,
  onToggleUserStatus,
}) => {
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState<'All' | UserRole>('All');
  const [modalOpen, setModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<UserAccount | null>(null);

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [department, setDepartment] = useState('University IT & Infrastructure');
  const [role, setRole] = useState<UserRole>('Content Manager');
  const [status, setStatus] = useState<UserStatus>('Active');
  const [error, setError] = useState('');

  const openAdd = () => {
    setEditingUser(null);
    setName('');
    setEmail('');
    setDepartment('University IT & Infrastructure');
    setRole('Content Manager');
    setStatus('Active');
    setError('');
    setModalOpen(true);
  };

  const openEdit = (usr: UserAccount) => {
    setEditingUser(usr);
    setName(usr.name);
    setEmail(usr.email);
    setDepartment(usr.department);
    setRole(usr.role);
    setStatus(usr.status);
    setError('');
    setModalOpen(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !email.trim() || !email.includes('@')) {
      setError('Please provide a valid full name and university email address.');
      return;
    }
    const saved: UserAccount = {
      id: editingUser ? editingUser.id : `usr-${Date.now().toString().slice(-4)}`,
      name: name.trim(),
      email: email.trim().toLowerCase(),
      department: department.trim() || 'Campus Operations',
      role,
      status,
      lastLogin: editingUser ? editingUser.lastLogin : 'Pending first login',
      avatarUrl: editingUser?.avatarUrl,
    };
    onSaveUser(saved);
    setModalOpen(false);
  };

  const filtered = users.filter((u) => {
    const q = search.trim().toLowerCase();
    const matchesSearch =
      !q ||
      u.name.toLowerCase().includes(q) ||
      u.email.toLowerCase().includes(q) ||
      u.department.toLowerCase().includes(q);
    const matchesRole = roleFilter === 'All' || u.role === roleFilter;
    return matchesSearch && matchesRole;
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="space-y-1">
          <h2 className="type-section-title text-[#290044]">
            Administrator and role directory
          </h2>
          <p className="type-support text-[#645573]">
            Manage university staff access roles (ready for future Keycloak SSO integration).
          </p>
        </div>

        <button
          type="button"
          onClick={openAdd}
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg bg-[#500071] text-white type-button hover:bg-[#8A2A78] transition-colors whitespace-nowrap"
        >
          <Plus className="w-4 h-4" />
          Add administrator
        </button>
      </div>

      {/* Filters */}
      <div className="bg-white border border-[#E8E2EE] rounded-xl p-4 flex flex-col lg:flex-row lg:items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-1.5">
          {(['All', ...ROLES] as const).map((r) => (
            <button
              key={r}
              type="button"
              onClick={() => setRoleFilter(r)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors whitespace-nowrap ${
                roleFilter === r
                  ? 'bg-[#EEE3B0] text-[#290044] font-semibold'
                  : 'text-[#645573] hover:bg-[#FAF8FC] hover:text-[#290044]'
              }`}
            >
              {r}
            </button>
          ))}
        </div>

        <div className="relative w-full lg:w-72">
          <Search className="w-4 h-4 text-[#6E607D] absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search name, email, department..."
            className="w-full pl-9 pr-3 py-2 text-xs bg-[#FAF8FC] border border-[#E8E2EE] rounded-lg focus:outline-none focus:border-[#8A2A78] focus:bg-white"
          />
        </div>
      </div>

      {/* Users Table */}
      <div className="bg-white border border-[#E8E2EE] rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-[#E8E2EE] bg-[#FAF8FC] text-[11px] font-semibold text-[#645573]">
                <th className="py-3 px-4">User</th>
                <th className="py-3 px-4">Department</th>
                <th className="py-3 px-4">Assigned Role</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4">Last Login</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#F1ECF6] text-xs">
              {filtered.map((usr) => (
                <tr key={usr.id} className="hover:bg-[#FAF8FC] transition-colors">
                  <td className="py-3.5 px-4">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-lg bg-[#500071] text-[#EEE3B0] font-bold text-xs flex items-center justify-center shrink-0">
                        {usr.name
                          .split(' ')
                          .map((n) => n[0])
                          .slice(0, 2)
                          .join('')}
                      </div>
                      <div>
                        <p className="font-semibold text-[#290044]">{usr.name}</p>
                        <p className="text-[11px] text-[#645573]">{usr.email}</p>
                      </div>
                    </div>
                  </td>
                  <td className="py-3.5 px-4 text-[#645573]">{usr.department}</td>
                  <td className="py-3.5 px-4">
                    <span className="inline-flex items-center gap-1.5 font-medium text-[#500071]">
                      <Shield className="w-3.5 h-3.5 text-[#8A2A78]" />
                      {usr.role}
                    </span>
                  </td>
                  <td className="py-3.5 px-4">
                    <StatusBadge status={usr.status} />
                  </td>
                  <td className="py-3.5 px-4 font-mono tabular-nums text-[#645573] whitespace-nowrap">
                    {usr.lastLogin}
                  </td>
                  <td className="py-3.5 px-4 text-right whitespace-nowrap">
                    <div className="inline-flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => openEdit(usr)}
                        title="Edit user & role"
                        className="p-1.5 rounded-md text-[#500071] hover:bg-[#EEE3B0]/40"
                      >
                        <Edit3 className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => onToggleUserStatus(usr.id)}
                        title={usr.status === 'Suspended' ? 'Activate user' : 'Suspend user'}
                        className={`p-1.5 rounded-md ${
                          usr.status === 'Suspended'
                            ? 'text-emerald-700 hover:bg-emerald-50'
                            : 'text-rose-600 hover:bg-rose-50'
                        }`}
                      >
                        {usr.status === 'Suspended' ? (
                          <UserCheck className="w-3.5 h-3.5" />
                        ) : (
                          <UserX className="w-3.5 h-3.5" />
                        )}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add / Edit User Modal */}
      <Modal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editingUser ? 'Edit User & Role Permissions' : 'Add Signage User'}
        subtitle="Configure university administrator profile and RBAC role"
        size="md"
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-[#290044] mb-1">
                Full Name *
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g., Kavita Joshi"
                className="w-full px-3 py-2 text-xs border border-[#E8E2EE] rounded-lg focus:outline-none focus:border-[#8A2A78]"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-[#290044] mb-1">
                University Email *
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="name@dypiu.ac.in"
                className="w-full px-3 py-2 text-xs border border-[#E8E2EE] rounded-lg focus:outline-none focus:border-[#8A2A78]"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-[#290044] mb-1">
              Department
            </label>
            <input
              type="text"
              value={department}
              onChange={(e) => setDepartment(e.target.value)}
              className="w-full px-3 py-2 text-xs border border-[#E8E2EE] rounded-lg focus:outline-none focus:border-[#8A2A78]"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-[#290044] mb-1">Role</label>
              <select
                value={role}
                onChange={(e) => setRole(e.target.value as UserRole)}
                className="w-full px-3 py-2 text-xs border border-[#E8E2EE] rounded-lg focus:outline-none focus:border-[#8A2A78]"
              >
                {ROLES.map((r) => (
                  <option key={r} value={r}>
                    {r}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-[#290044] mb-1">
                Account Status
              </label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value as UserStatus)}
                className="w-full px-3 py-2 text-xs border border-[#E8E2EE] rounded-lg focus:outline-none focus:border-[#8A2A78]"
              >
                <option value="Active">Active</option>
                <option value="Invited">Invited</option>
                <option value="Suspended">Suspended</option>
              </select>
            </div>
          </div>

          {error && <p className="text-xs font-medium text-rose-700">{error}</p>}

          <div className="flex justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={() => setModalOpen(false)}
              className="px-4 py-2 rounded-lg border border-[#E8E2EE] text-xs font-semibold text-[#290044]"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-5 py-2 rounded-lg bg-[#500071] text-white text-xs font-semibold hover:bg-[#8A2A78]"
            >
              {editingUser ? 'Save Changes' : 'Create User'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
