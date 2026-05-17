'use client'

import { useCallback, useEffect, useState } from 'react'
import {
  Plus,
  Search,
  Pencil,
  Key,
  ToggleLeft,
  ToggleRight,
  Loader2,
  Copy,
  Check,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import api, { getApiErrorMessage } from '@/lib/api/client'
import { ROLE_BADGE_CLASS, ROLE_OPTIONS, getRoleLabel } from '@/lib/user-constants'
import { formatDate } from '@/lib/utils'
import { cn } from '@/lib/utils'

const emptyForm = { name: '', email: '', role: 'WORKER', isActive: true }

export default function UsersPage() {
  const [users, setUsers] = useState([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [error, setError] = useState('')
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [editingUser, setEditingUser] = useState(null)
  const [formData, setFormData] = useState(emptyForm)
  const [saving, setSaving] = useState(false)
  const [inviteLink, setInviteLink] = useState(null)
  const [copied, setCopied] = useState(false)

  const fetchUsers = useCallback(async (search = '') => {
    setLoading(true)
    setError('')
    try {
      const params = search ? { search } : {}
      const { data } = await api.get('/users', { params })
      setUsers(data.users || [])
    } catch (err) {
      setError(getApiErrorMessage(err, 'Failed to load users'))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchUsers()
  }, [fetchUsers])

  useEffect(() => {
    const timer = setTimeout(() => {
      fetchUsers(searchQuery.trim())
    }, 300)
    return () => clearTimeout(timer)
  }, [searchQuery, fetchUsers])

  const openAddModal = () => {
    setEditingUser(null)
    setFormData(emptyForm)
    setInviteLink(null)
    setIsModalOpen(true)
  }

  const openEditModal = (user) => {
    setEditingUser(user)
    setFormData({
      name: user.name,
      email: user.email,
      role: user.role,
      isActive: user.isActive,
    })
    setInviteLink(null)
    setIsModalOpen(true)
  }

  const handleSave = async () => {
    setSaving(true)
    setError('')
    try {
      if (editingUser) {
        const { data } = await api.put(`/users/${editingUser.id}`, {
          name: formData.name,
          role: formData.role,
          isActive: formData.isActive,
        })
        setUsers((prev) =>
          prev.map((u) => (u.id === editingUser.id ? data.user : u)),
        )
        setIsModalOpen(false)
      } else {
        const { data } = await api.post('/users', {
          name: formData.name,
          email: formData.email,
          role: formData.role,
        })
        setUsers((prev) => [data.user, ...prev])
        setInviteLink(data.inviteLink || null)
      }
      await fetchUsers(searchQuery.trim())
    } catch (err) {
      setError(getApiErrorMessage(err, 'Failed to save user'))
    } finally {
      setSaving(false)
    }
  }

  const toggleUserStatus = async (user) => {
    try {
      const { data } = await api.put(`/users/${user.id}`, {
        isActive: !user.isActive,
      })
      setUsers((prev) => prev.map((u) => (u.id === user.id ? data.user : u)))
    } catch (err) {
      setError(getApiErrorMessage(err, 'Failed to update user status'))
    }
  }

  const handleResetPassword = async (user) => {
    try {
      const { data } = await api.post(`/users/${user.id}/reset-password`)
      setInviteLink(data.resetLink || null)
      setEditingUser(user)
      setIsModalOpen(true)
    } catch (err) {
      setError(getApiErrorMessage(err, 'Failed to send reset link'))
    }
  }

  const copyInviteLink = async () => {
    if (!inviteLink) return
    await navigator.clipboard.writeText(inviteLink)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">User Management</h1>
          <p className="text-sm text-muted-foreground">
            Manage factory accounts and access roles
          </p>
        </div>
        <Button onClick={openAddModal}>
          <Plus className="mr-2 h-4 w-4" />
          Add User
        </Button>
      </div>

      {error && (
        <div className="rounded-lg border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {error}
        </div>
      )}

      <div className="dashboard-panel p-4 sm:p-6">
        <div className="relative max-w-md">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search by name or email..."
            className="auth-input pl-10"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
      </div>

      <div className="dashboard-panel overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center gap-2 py-16 text-muted-foreground">
            <Loader2 className="h-5 w-5 animate-spin" />
            Loading users...
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Role</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Created</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {users.map((user) => (
                <TableRow key={user.id}>
                  <TableCell className="font-medium">{user.name}</TableCell>
                  <TableCell className="text-muted-foreground">{user.email}</TableCell>
                  <TableCell>
                    <span
                      className={cn(
                        'inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium',
                        ROLE_BADGE_CLASS[user.role] || 'bg-muted text-foreground',
                      )}
                    >
                      {getRoleLabel(user.role)}
                    </span>
                  </TableCell>
                  <TableCell>
                    <span
                      className={cn(
                        'inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium',
                        user.isActive
                          ? 'bg-primary/15 text-primary'
                          : 'bg-muted text-muted-foreground',
                      )}
                    >
                      {user.isActive ? 'Active' : 'Inactive'}
                    </span>
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {formatDate(user.createdAt)}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        onClick={() => openEditModal(user)}
                        title="Edit user"
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        onClick={() => toggleUserStatus(user)}
                        title={user.isActive ? 'Deactivate' : 'Activate'}
                      >
                        {user.isActive ? (
                          <ToggleRight className="h-4 w-4 text-primary" />
                        ) : (
                          <ToggleLeft className="h-4 w-4 text-muted-foreground" />
                        )}
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        onClick={() => handleResetPassword(user)}
                        title="Reset password"
                      >
                        <Key className="h-4 w-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}

        {!loading && users.length === 0 && (
          <p className="py-12 text-center text-sm text-muted-foreground">
            No users found.
          </p>
        )}
      </div>

      <Dialog
        open={isModalOpen}
        onOpenChange={(open) => {
          setIsModalOpen(open)
          if (!open) {
            setInviteLink(null)
            setCopied(false)
          }
        }}
      >
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>
              {inviteLink && !editingUser
                ? 'User created'
                : editingUser
                  ? 'Edit user'
                  : 'Add new user'}
            </DialogTitle>
            {inviteLink && (
              <DialogDescription>
                Share this invite link so they can set their password (expires in 48 hours).
              </DialogDescription>
            )}
          </DialogHeader>

          {inviteLink ? (
            <div className="space-y-3 py-2">
              <div className="flex gap-2">
                <Input readOnly value={inviteLink} className="text-xs" />
                <Button type="button" variant="outline" size="icon" onClick={copyInviteLink}>
                  {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                </Button>
              </div>
              <DialogFooter>
                <Button onClick={() => setIsModalOpen(false)}>Done</Button>
              </DialogFooter>
            </div>
          ) : (
            <>
              <div className="grid gap-4 py-2">
                <div className="grid gap-2">
                  <Label htmlFor="name">Full name</Label>
                  <Input
                    id="name"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    type="email"
                    disabled={Boolean(editingUser)}
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="role">Role</Label>
                  <Select
                    value={formData.role}
                    onValueChange={(value) => setFormData({ ...formData, role: value })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select role" />
                    </SelectTrigger>
                    <SelectContent>
                      {ROLE_OPTIONS.map((role) => (
                        <SelectItem key={role.value} value={role.value}>
                          {role.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                {editingUser && (
                  <div className="flex items-center justify-between">
                    <Label htmlFor="status">Active</Label>
                    <Switch
                      id="status"
                      checked={formData.isActive}
                      onCheckedChange={(checked) =>
                        setFormData({ ...formData, isActive: checked })
                      }
                    />
                  </div>
                )}
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setIsModalOpen(false)}>
                  Cancel
                </Button>
                <Button onClick={handleSave} disabled={saving}>
                  {saving ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Saving...
                    </>
                  ) : (
                    'Save'
                  )}
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
