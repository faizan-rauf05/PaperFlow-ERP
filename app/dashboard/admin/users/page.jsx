'use client'

import { useState } from 'react'
import { 
  Plus, 
  Search, 
  Pencil,
  Key,
  ToggleLeft,
  ToggleRight
} from 'lucide-react'
import { Card, CardContent } from '@/components/ui/card'
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

const initialUsers = [
  { id: 1, name: 'Ahmed Khan', email: 'ahmed.khan@paperpro.pk', role: 'admin', status: 'active', lastLogin: '2024-01-15 09:30 AM' },
  { id: 2, name: 'Fatima Malik', email: 'fatima.m@paperpro.pk', role: 'manager', status: 'active', lastLogin: '2024-01-15 08:45 AM' },
  { id: 3, name: 'Hassan Ali', email: 'hassan.ali@paperpro.pk', role: 'worker', status: 'active', lastLogin: '2024-01-15 07:00 AM' },
  { id: 4, name: 'Ayesha Siddiqui', email: 'ayesha.s@paperpro.pk', role: 'sales', status: 'active', lastLogin: '2024-01-14 04:15 PM' },
  { id: 5, name: 'Usman Raza', email: 'usman.r@paperpro.pk', role: 'finance', status: 'inactive', lastLogin: '2024-01-10 02:30 PM' },
  { id: 6, name: 'Zainab Hussain', email: 'zainab.h@paperpro.pk', role: 'worker', status: 'active', lastLogin: '2024-01-15 07:15 AM' },
  { id: 7, name: 'Bilal Ahmed', email: 'bilal.a@paperpro.pk', role: 'manager', status: 'active', lastLogin: '2024-01-15 08:00 AM' },
  { id: 8, name: 'Sara Qureshi', email: 'sara.q@paperpro.pk', role: 'sales', status: 'inactive', lastLogin: '2024-01-08 11:20 AM' },
]

const roleStyles = {
  admin: 'bg-[#1e3a5f] text-white',
  manager: 'bg-blue-500 text-white',
  worker: 'bg-teal-500 text-white',
  sales: 'bg-amber-500 text-white',
  finance: 'bg-purple-500 text-white',
}

const roleLabels = {
  admin: 'Admin',
  manager: 'Manager',
  worker: 'Worker',
  sales: 'Sales',
  finance: 'Finance',
}

export default function UsersPage() {
  const [users, setUsers] = useState(initialUsers)
  const [searchQuery, setSearchQuery] = useState('')
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [editingUser, setEditingUser] = useState(null)
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: '',
    role: '',
    status: true
  })

  const filteredUsers = users.filter(user => 
    user.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    user.email.toLowerCase().includes(searchQuery.toLowerCase())
  )

  const openAddModal = () => {
    setEditingUser(null)
    setFormData({ name: '', email: '', password: '', role: '', status: true })
    setIsModalOpen(true)
  }

  const openEditModal = (user) => {
    setEditingUser(user)
    setFormData({
      name: user.name,
      email: user.email,
      password: '',
      role: user.role,
      status: user.status === 'active'
    })
    setIsModalOpen(true)
  }

  const handleSave = () => {
    if (editingUser) {
      setUsers(users.map(u => 
        u.id === editingUser.id 
          ? { ...u, name: formData.name, email: formData.email, role: formData.role, status: formData.status ? 'active' : 'inactive' }
          : u
      ))
    } else {
      const newUser = {
        id: Math.max(...users.map(u => u.id)) + 1,
        name: formData.name,
        email: formData.email,
        role: formData.role,
        status: formData.status ? 'active' : 'inactive',
        lastLogin: 'Never'
      }
      setUsers([...users, newUser])
    }
    setIsModalOpen(false)
  }

  const toggleUserStatus = (userId) => {
    setUsers(users.map(u => 
      u.id === userId 
        ? { ...u, status: u.status === 'active' ? 'inactive' : 'active' }
        : u
    ))
  }

  const handleResetPassword = (user) => {
    alert(`Password reset link sent to ${user.email}`)
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-foreground">User Management</h1>
        <Button onClick={openAddModal} className="bg-[#1e3a5f] hover:bg-[#1e3a5f]/90">
          <Plus className="h-4 w-4 mr-2" />
          Add User
        </Button>
      </div>

      {/* Search Bar */}
      <Card>
        <CardContent className="pt-6">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search by name or email..."
              className="pl-10 max-w-md"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
        </CardContent>
      </Card>

      {/* Users Table */}
      <Card>
        <CardContent className="pt-6">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>Role</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Last Login</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredUsers.map((user) => (
                <TableRow key={user.id}>
                  <TableCell className="font-medium">{user.name}</TableCell>
                  <TableCell className="text-muted-foreground">{user.email}</TableCell>
                  <TableCell>
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${roleStyles[user.role]}`}>
                      {roleLabels[user.role]}
                    </span>
                  </TableCell>
                  <TableCell>
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                      user.status === 'active' 
                        ? 'bg-green-100 text-green-800' 
                        : 'bg-gray-100 text-gray-800'
                    }`}>
                      {user.status === 'active' ? 'Active' : 'Inactive'}
                    </span>
                  </TableCell>
                  <TableCell className="text-muted-foreground text-sm">{user.lastLogin}</TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-1">
                      <Button 
                        variant="ghost" 
                        size="icon" 
                        className="h-8 w-8"
                        onClick={() => openEditModal(user)}
                        title="Edit User"
                      >
                        <Pencil className="h-4 w-4 text-muted-foreground" />
                      </Button>
                      <Button 
                        variant="ghost" 
                        size="icon" 
                        className="h-8 w-8"
                        onClick={() => toggleUserStatus(user.id)}
                        title={user.status === 'active' ? 'Deactivate' : 'Activate'}
                      >
                        {user.status === 'active' ? (
                          <ToggleRight className="h-4 w-4 text-green-600" />
                        ) : (
                          <ToggleLeft className="h-4 w-4 text-gray-400" />
                        )}
                      </Button>
                      <Button 
                        variant="ghost" 
                        size="icon" 
                        className="h-8 w-8"
                        onClick={() => handleResetPassword(user)}
                        title="Reset Password"
                      >
                        <Key className="h-4 w-4 text-muted-foreground" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          
          {filteredUsers.length === 0 && (
            <div className="text-center py-8 text-muted-foreground">
              No users found matching your search.
            </div>
          )}
        </CardContent>
      </Card>

      {/* Add/Edit User Modal */}
      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>{editingUser ? 'Edit User' : 'Add New User'}</DialogTitle>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="name">Full Name</Label>
              <Input 
                id="name" 
                placeholder="Enter full name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="email">Email</Label>
              <Input 
                id="email" 
                type="email" 
                placeholder="email@paperpro.pk"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              />
            </div>
            {!editingUser && (
              <div className="grid gap-2">
                <Label htmlFor="password">Password</Label>
                <Input 
                  id="password" 
                  type="password" 
                  placeholder="Enter password"
                  value={formData.password}
                  onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                />
              </div>
            )}
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
                  <SelectItem value="admin">Admin</SelectItem>
                  <SelectItem value="manager">Manager</SelectItem>
                  <SelectItem value="worker">Worker</SelectItem>
                  <SelectItem value="sales">Sales</SelectItem>
                  <SelectItem value="finance">Finance</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center justify-between">
              <Label htmlFor="status">Status</Label>
              <div className="flex items-center gap-2">
                <span className="text-sm text-muted-foreground">
                  {formData.status ? 'Active' : 'Inactive'}
                </span>
                <Switch 
                  id="status"
                  checked={formData.status}
                  onCheckedChange={(checked) => setFormData({ ...formData, status: checked })}
                />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsModalOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSave} className="bg-[#1e3a5f] hover:bg-[#1e3a5f]/90">
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
