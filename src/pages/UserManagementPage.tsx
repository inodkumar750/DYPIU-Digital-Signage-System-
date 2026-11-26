import React, { useState } from 'react';
import {
  CheckSquare,
  Edit3,
  Eye,
  EyeOff,
  KeyRound,
  Plus,
  Search,
  Shield,
  Trash2,
  UserCheck,
  UserX,
} from 'lucide-react';
import { PageRoute, UserAccount, UserRole, UserStatus } from '../types/signage';
import { StatusBadge } from '../components/ui/StatusBadge';
import { Modal } from '../components/ui/Modal';
import { ALL_ADMIN_MENUS, DEFAULT_MENUS_BY_ROLE, getEffectiveMenus } from '../utils/rbac';

const ROLES: UserRole[] = [
  'Super Administrator',
  'IT Administrator',
  'Content Manager',
  'Monitoring User',
];

interface UserManagementPageProps {
  users: UserAccount[];
  currentUserId?: string;
  onSaveUser: (user: UserAccount) => Promise<{ success: boolean; error?: string }> | void;
  onToggleUserStatus: (id: string) => void;
  onDeleteUser?: (id: string) => void;
}

export const UserManagementPage: React.FC<UserManagementPageProps> = ({
  users,
  currentUserId,
  onSaveUser,
  onToggleUserStatus,
  onDeleteUser,
}) => {
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState<'All' | UserRole>('All');
  const [modalOpen, setModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<UserAccount | null>(null);

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [department, setDepartment] = useState('University IT & Infrastructure');
  const [role, setRole] = useState<UserRole>('Content Manager');
  const [status, setStatus] = useState<UserStatus>('Active');
  const [allowedMenus, setAllowedMenus] = useState<PageRoute[]>(
    DEFAULT_MENUS_BY_ROLE['Content Manager']
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const openAdd = () => {
    setEditingUser(null);
    setName('');
    setEmail('');
    setPassword('');
    setShowPassword(false);
    setDepartment('University IT & Infrastructure');
    setRole('Content Manager');
    setStatus('Active');
    setAllowedMenus([...DEFAULT_MENUS_BY_ROLE['Content Manager']]);
    setError('');
    setModalOpen(true);
  };

  const openEdit = (usr: UserAccount) => {
    setEditingUser(usr);
    setName(usr.name);
    setEmail(usr.email);
    setPassword('');
    setShowPassword(false);
    setDepartment(usr.department);
    setRole(usr.role);
    setStatus(usr.status);
    setAllowedMenus(getEffectiveMenus(usr.role, usr.allowedMenus));
    setError('');
    setModalOpen(true);
  };

  const handleRoleChange = (nextRole: UserRole) => {
    setRole(nextRole);
    // Apply default role menus whenever switching role on a new user (or if admin wants quick preset)
    if (!editingUser) {
      setAllowedMenus([...DEFAULT_MENUS_BY_ROLE[nextRole]]);
    }
  };

  const toggleMenuPermission = (menuId: PageRoute) => {
    setAllowedMenus((prev) =>
      prev.includes(menuId) ? prev.filter((id) => id !== menuId) : [...prev, menuId]
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !email.trim() || !email.includes('@')) {
      setError('Please provide a valid full name and university email address.');
      return;
    }
    if (!editingUser && password.length < 4) {
      setError('Please set a login password (at least 4 characters) for the new user.');
      return;
    }
    if (editingUser && password.trim() && password.length < 4) {
      setError('New password must be at least 4 characters.');
      return;
    }
    if (allowedMenus.length === 0) {
      setError('Select at least 1 allowed menu so the user can access the console.');
      return;
    }

    const saved: UserAccount = {
      id: editingUser ? editingUser.id : `usr-${Date.now().toString().slice(-4)}`,
      name: name.trim(),
      email: email.trim().toLowerCase(),
      department: department.trim() || 'Campus Operations',
      role,
      allowedMenus,
      ...(password.trim() ? { password } : {}),
      status,
      lastLogin: editingUser ? editingUser.lastLogin : 'Pending first login',
      avatarUrl: editingUser?.avatarUrl,
    };

    setSaving(true);
    setError('');
    const result = await onSaveUser(saved);
    setSaving(false);
    if (result && result.success === false) {
      setError(result.error || 'Could not save user account.');
      return;
    }
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
            Create login accounts, set passwords, and control real-time role-based menu access across CampusCast.
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
                <th className="py-3 px-4">Assigned Role & Menus</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4">Last Login</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#F1ECF6] text-xs">
              {filtered.map((usr) => {
                const effectiveMenus = getEffectiveMenus(usr.role, usr.allowedMenus);
                const isSelf = usr.id === currentUserId;
                return (
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
                          <div className="flex items-center gap-1.5">
                            <p className="font-semibold text-[#290044]">{usr.name}</p>
                            {isSelf && (
                              <span className="px-1.5 py-0.5 rounded bg-[#EEE3B0]/70 text-[#290044] text-[10px] font-semibold">
                                You
                              </span>
                            )}
                          </div>
                          <p className="text-[11px] text-[#645573]">{usr.email}</p>
                        </div>
                      </div>
                    </td>
                    <td className="py-3.5 px-4 text-[#645573]">{usr.department}</td>
                    <td className="py-3.5 px-4">
                      <div className="space-y-1">
                        <span className="inline-flex items-center gap-1.5 font-medium text-[#500071]">
                          <Shield className="w-3.5 h-3.5 text-[#8A2A78]" />
                          {usr.role}
                        </span>
                        <div className="flex flex-wrap items-center gap-1">
                          {effectiveMenus.length === ALL_ADMIN_MENUS.length ? (
                            <span className="px-1.5 py-0.5 rounded bg-[#500071]/10 text-[#500071] text-[10px] font-semibold">
                              All {ALL_ADMIN_MENUS.length} menus
                            </span>
                          ) : (
                            <>
                              {effectiveMenus.slice(0, 3).map((mId) => {
                                const def = ALL_ADMIN_MENUS.find((m) => m.id === mId);
                                return (
                                  <span
                                    key={mId}
                                    className="px-1.5 py-0.5 rounded bg-[#FAF8FC] border border-[#E8E2EE] text-[#645573] text-[10px]"
                                  >
                                    {def?.label || mId}
                                  </span>
                                );
                              })}
                              {effectiveMenus.length > 3 && (
                                <span className="text-[10px] font-mono text-[#645573]">
                                  +{effectiveMenus.length - 3} more
                                </span>
                              )}
                            </>
                          )}
                        </div>
                      </div>
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
                          title="Edit user, password & menus"
                          className="p-1.5 rounded-md text-[#500071] hover:bg-[#EEE3B0]/40"
                        >
                          <Edit3 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          disabled={isSelf}
                          onClick={() => onToggleUserStatus(usr.id)}
                          title={
                            isSelf
                              ? 'Cannot suspend active signed-in session'
                              : usr.status === 'Suspended'
                              ? 'Activate user'
                              : 'Suspend user'
                          }
                          className={`p-1.5 rounded-md disabled:opacity-35 ${
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
                        {onDeleteUser && (
                          <button
                            type="button"
                            disabled={isSelf}
                            onClick={() => onDeleteUser(usr.id)}
                            title={isSelf ? 'Cannot delete active signed-in user' : 'Delete user'}
                            className="p-1.5 rounded-md text-rose-600 hover:bg-rose-50 disabled:opacity-35"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add / Edit User Modal */}
      <Modal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editingUser ? 'Edit User, Password & Menu Access' : 'Add Signage User'}
        subtitle="Set university login credentials, role, and permitted navigation menus"
        size="lg"
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

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-[#290044] mb-1">
                {editingUser ? 'Reset Password (optional)' : 'Login Password *'}
              </label>
              <div className="relative">
                <KeyRound className="w-3.5 h-3.5 text-[#645573] absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder={
                    editingUser
                      ? 'Leave blank to keep existing password'
                      : 'Minimum 4 characters'
                  }
                  className="w-full pl-9 pr-9 py-2 text-xs border border-[#E8E2EE] rounded-lg focus:outline-none focus:border-[#8A2A78]"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((s) => !s)}
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[#645573] hover:text-[#290044]"
                >
                  {showPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                </button>
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
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-[#290044] mb-1">Role</label>
              <select
                value={role}
                onChange={(e) => handleRoleChange(e.target.value as UserRole)}
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

          {/* Role-Based Menu Access Checkboxes */}
          <div className="rounded-xl border border-[#E8E2EE] bg-[#FAF8FC] p-3.5 space-y-2.5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-1.5">
                <CheckSquare className="w-3.5 h-3.5 text-[#500071]" />
                <span className="text-xs font-bold text-[#290044]">
                  Role-Based Menu Access ({allowedMenus.length}/{ALL_ADMIN_MENUS.length} selected)
                </span>
              </div>
              <div className="flex items-center gap-2 text-[11px]">
                <button
                  type="button"
                  onClick={() => setAllowedMenus([...DEFAULT_MENUS_BY_ROLE[role]])}
                  className="font-semibold text-[#500071] hover:underline cursor-pointer"
                >
                  Apply {role} defaults
                </button>
                <span className="text-[#D7CEE0]">|</span>
                <button
                  type="button"
                  onClick={() => setAllowedMenus(ALL_ADMIN_MENUS.map((m) => m.id))}
                  className="font-semibold text-[#8A2A78] hover:underline cursor-pointer"
                >
                  Select all
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2">
              {ALL_ADMIN_MENUS.map((menu) => {
                const checked = allowedMenus.includes(menu.id);
                return (
                  <label
                    key={menu.id}
                    className={`flex items-start gap-2 p-2 rounded-lg border cursor-pointer text-xs transition-colors ${
                      checked
                        ? 'bg-white border-[#8A2A78]/60 text-[#290044]'
                        : 'bg-white/60 border-[#E8E2EE] text-[#645573] hover:bg-white'
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => toggleMenuPermission(menu.id)}
                      className="accent-[#500071] w-3.5 h-3.5 mt-0.5 shrink-0"
                    />
                    <div className="min-w-0">
                      <span className="block font-semibold leading-tight truncate">
                        {menu.label}
                      </span>
                      <span className="block text-[10px] text-[#645573] leading-tight truncate">
                        {menu.description}
                      </span>
                    </div>
                  </label>
                );
              })}
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
              disabled={saving}
              className="px-5 py-2 rounded-lg bg-[#500071] text-white text-xs font-semibold hover:bg-[#8A2A78] disabled:opacity-60"
            >
              {saving ? 'Saving...' : editingUser ? 'Save Changes' : 'Create User & Enable Login'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
