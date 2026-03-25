import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Plus, Edit2, Trash2, Search, Shield, User } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { Button } from '@/shared/components/ui/Button';
import { Input } from '@/shared/components/ui/Input';
import { Select } from '@/shared/components/ui/Select';
import { Badge } from '@/shared/components/ui/Badge';
import { DataTable, Column } from '@/shared/components/DataTable';
import { Modal, ConfirmModal } from '@/shared/components/ui/Modal';
import { useToastStore } from '@/shared/stores/toastStore';
import { adminApi, AdminUserUpdateRequest } from '@/shared/api/admin';
import type { User as UserType } from '@/shared/types';

const userKeys = {
  all: ['admin', 'users'] as const,
  list: (params: Record<string, unknown>) => [...userKeys.all, 'list', params] as const,
};

function useAdminUsers(params: { page?: number; size?: number } = {}) {
  return useQuery({
    queryKey: userKeys.list(params),
    queryFn: () => adminApi.listUsers(params),
  });
}

function useCreateUser() {
  const qc = useQueryClient();
  const toast = useToastStore();
  return useMutation({
    mutationFn: adminApi.createUser,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: userKeys.all });
      toast.success('User created');
    },
    onError: (err: Error) => toast.error('Failed to create user', err.message),
  });
}

function useUpdateUser() {
  const qc = useQueryClient();
  const toast = useToastStore();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: AdminUserUpdateRequest }) =>
      adminApi.updateUser(id, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: userKeys.all });
      toast.success('User updated');
    },
    onError: (err: Error) => toast.error('Failed to update user', err.message),
  });
}

function useDeleteUser() {
  const qc = useQueryClient();
  const toast = useToastStore();
  return useMutation({
    mutationFn: adminApi.deleteUser,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: userKeys.all });
      toast.success('User deleted');
    },
    onError: (err: Error) => toast.error('Failed to delete user', err.message),
  });
}

// ─── Create User Form ────────────────────────────────────────────────────────

interface CreateFormData {
  email: string;
  password: string;
  role: 'ADMIN' | 'USER';
}

function CreateUserModal({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const { mutate: createUser, isPending } = useCreateUser();
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<CreateFormData>({ defaultValues: { role: 'USER' } });

  const onSubmit = (data: CreateFormData) => {
    createUser(data, {
      onSuccess: () => {
        reset();
        onClose();
      },
    });
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Create User"
      footer={
        <>
          <Button variant="outline" onClick={onClose} disabled={isPending}>
            Cancel
          </Button>
          <Button
            form="create-user-form"
            type="submit"
            loading={isPending}
          >
            Create User
          </Button>
        </>
      }
    >
      <form id="create-user-form" onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <div>
          <label className="mb-1.5 block text-sm font-medium text-gray-700">
            Email <span className="text-red-500">*</span>
          </label>
          <Input
            type="email"
            placeholder="user@example.com"
            error={errors.email?.message}
            {...register('email', {
              required: 'Email is required',
              pattern: { value: /^[^\s@]+@[^\s@]+\.[^\s@]+$/, message: 'Invalid email' },
            })}
          />
        </div>

        <div>
          <label className="mb-1.5 block text-sm font-medium text-gray-700">
            Password <span className="text-red-500">*</span>
          </label>
          <Input
            type="password"
            placeholder="At least 8 characters"
            error={errors.password?.message}
            {...register('password', {
              required: 'Password is required',
              minLength: { value: 8, message: 'At least 8 characters' },
            })}
          />
        </div>

        <div>
          <label className="mb-1.5 block text-sm font-medium text-gray-700">Role</label>
          <Select {...register('role')}>
            <option value="USER">User</option>
            <option value="ADMIN">Admin</option>
          </Select>
        </div>
      </form>
    </Modal>
  );
}

// ─── Edit User Modal ─────────────────────────────────────────────────────────

interface EditFormData {
  role: 'ADMIN' | 'USER';
  activated: boolean;
}

function EditUserModal({
  user,
  onClose,
}: {
  user: UserType | null;
  onClose: () => void;
}) {
  const { mutate: updateUser, isPending } = useUpdateUser();
  const { register, handleSubmit } = useForm<EditFormData>({
    values: user ? { role: user.role, activated: user.activated } : undefined,
  });

  const onSubmit = (data: EditFormData) => {
    if (!user) return;
    updateUser({ id: user.id, data }, { onSuccess: onClose });
  };

  return (
    <Modal
      open={user !== null}
      onClose={onClose}
      title={`Edit User: ${user?.email}`}
      footer={
        <>
          <Button variant="outline" onClick={onClose} disabled={isPending}>
            Cancel
          </Button>
          <Button form="edit-user-form" type="submit" loading={isPending}>
            Save Changes
          </Button>
        </>
      }
    >
      <form id="edit-user-form" onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <div>
          <label className="mb-1.5 block text-sm font-medium text-gray-700">Role</label>
          <Select {...register('role')}>
            <option value="USER">User</option>
            <option value="ADMIN">Admin</option>
          </Select>
        </div>

        <div className="flex items-center gap-3">
          <input
            id="activated"
            type="checkbox"
            className="rounded border-gray-300"
            {...register('activated')}
          />
          <label htmlFor="activated" className="text-sm font-medium text-gray-700">
            Account Activated
          </label>
        </div>
      </form>
    </Modal>
  );
}

// ─── Main page ───────────────────────────────────────────────────────────────

export function AdminUsersPage() {
  const [page, setPage] = useState(0);
  const [search, setSearch] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const [editTarget, setEditTarget] = useState<UserType | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<UserType | null>(null);

  const { data, isLoading } = useAdminUsers({ page, size: 20 });
  const { mutate: deleteUser, isPending: deleting } = useDeleteUser();

  const filtered = data?.content.filter((u) =>
    search ? u.email.toLowerCase().includes(search.toLowerCase()) : true
  );

  const columns: Column<UserType>[] = [
    {
      key: 'email',
      header: 'Email',
      render: (row) => (
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-gray-100 text-gray-500 text-sm font-medium flex-shrink-0">
            {row.email[0].toUpperCase()}
          </div>
          <div>
            <p className="text-sm font-medium text-gray-900">{row.email}</p>
            <p className="text-xs text-gray-500">{row.id}</p>
          </div>
        </div>
      ),
    },
    {
      key: 'role',
      header: 'Role',
      width: '100px',
      render: (row) => (
        <Badge variant={row.role === 'ADMIN' ? 'purple' : 'gray'}>
          <span className="flex items-center gap-1">
            {row.role === 'ADMIN' ? (
              <Shield className="h-3 w-3" />
            ) : (
              <User className="h-3 w-3" />
            )}
            {row.role}
          </span>
        </Badge>
      ),
    },
    {
      key: 'status',
      header: 'Status',
      width: '100px',
      render: (row) => (
        <Badge variant={row.activated ? 'green' : 'yellow'}>
          {row.activated ? 'Active' : 'Pending'}
        </Badge>
      ),
    },
    {
      key: 'created',
      header: 'Created',
      width: '150px',
      render: (row) => (
        <span className="text-sm text-gray-500">
          {new Date(row.createdAt).toLocaleDateString()}
        </span>
      ),
    },
    {
      key: 'actions',
      header: '',
      width: '100px',
      align: 'right',
      render: (row) => (
        <div
          className="flex items-center justify-end gap-1"
          onClick={(e) => e.stopPropagation()}
        >
          <Button
            variant="ghost"
            size="xs"
            icon={<Edit2 className="h-3.5 w-3.5" />}
            onClick={() => setEditTarget(row)}
            title="Edit user"
          />
          <Button
            variant="ghost"
            size="xs"
            icon={<Trash2 className="h-3.5 w-3.5 text-red-400" />}
            onClick={() => setDeleteTarget(row)}
            title="Delete user"
          />
        </div>
      ),
    },
  ];

  return (
    <div className="p-6 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Users</h1>
          <p className="text-sm text-gray-500">Manage platform users and roles</p>
        </div>
        <Button
          icon={<Plus className="h-4 w-4" />}
          onClick={() => setShowCreate(true)}
        >
          New User
        </Button>
      </div>

      {/* Search */}
      <div className="max-w-xs">
        <Input
          placeholder="Search users..."
          icon={<Search className="h-4 w-4" />}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      {/* Table */}
      <DataTable
        columns={columns}
        data={filtered ?? []}
        loading={isLoading}
        rowKey={(row) => row.id}
        page={page}
        totalPages={data?.totalPages}
        totalElements={data?.totalElements}
        onPageChange={setPage}
        emptyMessage="No users found."
      />

      {/* Modals */}
      <CreateUserModal open={showCreate} onClose={() => setShowCreate(false)} />
      <EditUserModal user={editTarget} onClose={() => setEditTarget(null)} />
      <ConfirmModal
        open={deleteTarget !== null}
        onClose={() => setDeleteTarget(null)}
        onConfirm={() => {
          if (deleteTarget) {
            deleteUser(deleteTarget.id, { onSettled: () => setDeleteTarget(null) });
          }
        }}
        title="Delete User"
        message={`Are you sure you want to delete "${deleteTarget?.email}"? This cannot be undone.`}
        confirmLabel="Delete User"
        loading={deleting}
      />
    </div>
  );
}
