"use client"

import { useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Input } from "@/components/ui/input"
import { ChevronLeft, ChevronRight, Filter, Download } from "lucide-react"

const roleColors = {
  Admin: "bg-[#1e3a5f] text-white",
  Manager: "bg-blue-500 text-white",
  Worker: "bg-teal-500 text-white",
  Sales: "bg-amber-500 text-white",
  Finance: "bg-purple-500 text-white",
}

const auditLogs = [
  {
    id: 1,
    timestamp: "2024-01-15 14:32:45",
    user: "Ahmed Khan",
    role: "Admin",
    action: "Created",
    module: "Users",
    recordId: "USR-0045",
  },
  {
    id: 2,
    timestamp: "2024-01-15 14:28:12",
    user: "Sara Ali",
    role: "Manager",
    action: "Updated",
    module: "Production Orders",
    recordId: "PO-2024-0089",
  },
  {
    id: 3,
    timestamp: "2024-01-15 14:15:33",
    user: "Bilal Hassan",
    role: "Finance",
    action: "Recorded Payment",
    module: "Invoices",
    recordId: "INV-2024-0156",
  },
  {
    id: 4,
    timestamp: "2024-01-15 13:58:21",
    user: "Fatima Rizvi",
    role: "Sales",
    action: "Created",
    module: "Quotations",
    recordId: "QT-2024-0234",
  },
  {
    id: 5,
    timestamp: "2024-01-15 13:45:09",
    user: "Usman Malik",
    role: "Worker",
    action: "Submitted",
    module: "Stage Output",
    recordId: "STG-0892",
  },
  {
    id: 6,
    timestamp: "2024-01-15 13:30:55",
    user: "Ahmed Khan",
    role: "Admin",
    action: "Deactivated",
    module: "Users",
    recordId: "USR-0032",
  },
  {
    id: 7,
    timestamp: "2024-01-15 13:22:18",
    user: "Sara Ali",
    role: "Manager",
    action: "Approved",
    module: "Work Orders",
    recordId: "WO-2024-0067",
  },
  {
    id: 8,
    timestamp: "2024-01-15 12:58:44",
    user: "Bilal Hassan",
    role: "Finance",
    action: "Generated",
    module: "Reports",
    recordId: "RPT-FIN-0045",
  },
  {
    id: 9,
    timestamp: "2024-01-15 12:45:30",
    user: "Zainab Qureshi",
    role: "Manager",
    action: "Updated",
    module: "Machines",
    recordId: "MCH-003",
  },
  {
    id: 10,
    timestamp: "2024-01-15 12:30:12",
    user: "Ahmed Khan",
    role: "Admin",
    action: "Reset Password",
    module: "Users",
    recordId: "USR-0028",
  },
]

const users = ["All Users", "Ahmed Khan", "Sara Ali", "Bilal Hassan", "Fatima Rizvi", "Usman Malik", "Zainab Qureshi"]
const actionTypes = ["All Actions", "Created", "Updated", "Deleted", "Approved", "Submitted", "Deactivated", "Reset Password", "Recorded Payment", "Generated"]

export default function AuditLogsPage() {
  const [dateFrom, setDateFrom] = useState("")
  const [dateTo, setDateTo] = useState("")
  const [selectedUser, setSelectedUser] = useState("All Users")
  const [selectedAction, setSelectedAction] = useState("All Actions")
  const [currentPage, setCurrentPage] = useState(1)
  const itemsPerPage = 5
  
  const filteredLogs = auditLogs.filter((log) => {
    const userMatch = selectedUser === "All Users" || log.user === selectedUser
    const actionMatch = selectedAction === "All Actions" || log.action === selectedAction
    return userMatch && actionMatch
  })
  
  const totalPages = Math.ceil(filteredLogs.length / itemsPerPage)
  const paginatedLogs = filteredLogs.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  )

  const handleClearFilters = () => {
    setDateFrom("")
    setDateTo("")
    setSelectedUser("All Users")
    setSelectedAction("All Actions")
    setCurrentPage(1)
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-foreground">Audit Log</h1>
        <Button variant="outline" className="gap-2">
          <Download className="h-4 w-4" />
          Export
        </Button>
      </div>

      {/* Filter Bar */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-medium flex items-center gap-2">
            <Filter className="h-4 w-4" />
            Filters
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-4">
            <div className="flex items-center gap-2">
              <label className="text-sm text-muted-foreground whitespace-nowrap">Date From:</label>
              <Input
                type="date"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
                className="w-40"
              />
            </div>
            <div className="flex items-center gap-2">
              <label className="text-sm text-muted-foreground whitespace-nowrap">Date To:</label>
              <Input
                type="date"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
                className="w-40"
              />
            </div>
            <div className="flex items-center gap-2">
              <label className="text-sm text-muted-foreground whitespace-nowrap">User:</label>
              <Select value={selectedUser} onValueChange={setSelectedUser}>
                <SelectTrigger className="w-44">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {users.map((user) => (
                    <SelectItem key={user} value={user}>
                      {user}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center gap-2">
              <label className="text-sm text-muted-foreground whitespace-nowrap">Action:</label>
              <Select value={selectedAction} onValueChange={setSelectedAction}>
                <SelectTrigger className="w-44">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {actionTypes.map((action) => (
                    <SelectItem key={action} value={action}>
                      {action}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Button variant="ghost" onClick={handleClearFilters} className="text-muted-foreground">
              Clear Filters
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Audit Log Table */}
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/50">
                <TableHead className="font-semibold">Timestamp</TableHead>
                <TableHead className="font-semibold">User</TableHead>
                <TableHead className="font-semibold">Role</TableHead>
                <TableHead className="font-semibold">Action</TableHead>
                <TableHead className="font-semibold">Module</TableHead>
                <TableHead className="font-semibold">Record ID</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {paginatedLogs.map((log) => (
                <TableRow key={log.id} className="hover:bg-muted/30">
                  <TableCell className="font-mono text-sm text-muted-foreground">
                    {log.timestamp}
                  </TableCell>
                  <TableCell className="font-medium">{log.user}</TableCell>
                  <TableCell>
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${roleColors[log.role]}`}>
                      {log.role}
                    </span>
                  </TableCell>
                  <TableCell>{log.action}</TableCell>
                  <TableCell>{log.module}</TableCell>
                  <TableCell className="font-mono text-sm">{log.recordId}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Pagination */}
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          Showing {((currentPage - 1) * itemsPerPage) + 1} to {Math.min(currentPage * itemsPerPage, filteredLogs.length)} of {filteredLogs.length} entries
        </p>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
            disabled={currentPage === 1}
          >
            <ChevronLeft className="h-4 w-4" />
            Previous
          </Button>
          <div className="flex items-center gap-1">
            {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => (
              <Button
                key={page}
                variant={currentPage === page ? "default" : "outline"}
                size="sm"
                className={currentPage === page ? "bg-[#1e3a5f] hover:bg-[#1e3a5f]/90" : ""}
                onClick={() => setCurrentPage(page)}
              >
                {page}
              </Button>
            ))}
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
            disabled={currentPage === totalPages}
          >
            Next
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  )
}
