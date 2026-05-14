'use client'

import { useState } from 'react'
import { 
  DollarSign, 
  Receipt,
  AlertTriangle,
  CreditCard,
  Calendar,
  X
} from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'

const invoices = [
  { 
    id: 'INV-2024-001', 
    customer: 'MegaMart Enterprises', 
    orderId: 'ORD-4521',
    amount: 185000, 
    status: 'unpaid', 
    dueDate: '2024-02-15'
  },
  { 
    id: 'INV-2024-002', 
    customer: 'Retail Plus Co.', 
    orderId: 'ORD-4518',
    amount: 92500, 
    status: 'partial', 
    dueDate: '2024-02-10'
  },
  { 
    id: 'INV-2024-003', 
    customer: 'Global Foods Inc', 
    orderId: 'ORD-4512',
    amount: 156000, 
    status: 'paid', 
    dueDate: '2024-02-05'
  },
  { 
    id: 'INV-2024-004', 
    customer: 'EcoStore Pakistan', 
    orderId: 'ORD-4508',
    amount: 78000, 
    status: 'unpaid', 
    dueDate: '2024-02-01'
  },
  { 
    id: 'INV-2024-005', 
    customer: 'City Supermarket', 
    orderId: 'ORD-4502',
    amount: 245000, 
    status: 'paid', 
    dueDate: '2024-01-28'
  },
  { 
    id: 'INV-2024-006', 
    customer: 'Fresh Mart Ltd', 
    orderId: 'ORD-4498',
    amount: 112000, 
    status: 'partial', 
    dueDate: '2024-02-12'
  },
]

const kpiData = [
  { 
    title: 'Total Revenue', 
    value: 'PKR 4,850,000', 
    subtitle: 'This month',
    icon: DollarSign,
    color: 'bg-green-100 text-green-600'
  },
  { 
    title: 'Outstanding Invoices', 
    value: '12', 
    subtitle: 'PKR 1,245,000 pending',
    icon: Receipt,
    color: 'bg-blue-100 text-blue-600'
  },
  { 
    title: 'Collected This Month', 
    value: 'PKR 3,605,000', 
    subtitle: '74% of target',
    icon: CreditCard,
    color: 'bg-emerald-100 text-emerald-600'
  },
  { 
    title: 'Overdue Invoices', 
    value: '4', 
    subtitle: 'Requires immediate action',
    icon: AlertTriangle,
    color: 'bg-red-100 text-red-600',
    isAlert: true
  },
]

function StatusBadge({ status }) {
  const styles = {
    unpaid: 'bg-red-100 text-red-700 border-red-200',
    partial: 'bg-amber-100 text-amber-700 border-amber-200',
    paid: 'bg-green-100 text-green-700 border-green-200',
  }

  const labels = {
    unpaid: 'Unpaid',
    partial: 'Partial',
    paid: 'Paid',
  }

  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${styles[status]}`}>
      {labels[status]}
    </span>
  )
}

export default function FinanceDashboard() {
  const [paymentModalOpen, setPaymentModalOpen] = useState(false)
  const [selectedInvoice, setSelectedInvoice] = useState(null)
  const [paymentData, setPaymentData] = useState({
    amount: '',
    method: '',
    bankReference: '',
    date: ''
  })

  const handleRecordPayment = (invoice) => {
    setSelectedInvoice(invoice)
    setPaymentData({
      amount: '',
      method: '',
      bankReference: '',
      date: new Date().toISOString().split('T')[0]
    })
    setPaymentModalOpen(true)
  }

  const handleSavePayment = () => {
    // Simulate saving payment
    console.log('Recording payment:', { invoice: selectedInvoice, ...paymentData })
    setPaymentModalOpen(false)
    setSelectedInvoice(null)
  }

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div>
        <h1 className="text-2xl font-bold text-foreground">Finance Dashboard</h1>
        <p className="text-muted-foreground">Financial overview and invoice management</p>
      </div>

      {/* KPI Cards */}
      <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
        {kpiData.map((kpi) => (
          <Card key={kpi.title} className={kpi.isAlert ? 'border-red-200' : ''}>
            <CardContent className="pt-6">
              <div className="flex items-start justify-between">
                <div className="space-y-1">
                  <p className="text-sm text-muted-foreground">{kpi.title}</p>
                  <p className={`text-2xl font-bold ${kpi.isAlert ? 'text-red-600' : ''}`}>
                    {kpi.value}
                  </p>
                  <p className="text-xs text-muted-foreground">{kpi.subtitle}</p>
                </div>
                <div className={`h-10 w-10 rounded-lg flex items-center justify-center ${kpi.color}`}>
                  <kpi.icon className="h-5 w-5" />
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Invoices Table */}
      <Card>
        <CardHeader className="pb-4">
          <CardTitle className="text-lg">Invoices</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b bg-muted/50">
                  <th className="text-left p-3 font-medium text-sm">Invoice No</th>
                  <th className="text-left p-3 font-medium text-sm">Customer</th>
                  <th className="text-left p-3 font-medium text-sm">Order ID</th>
                  <th className="text-right p-3 font-medium text-sm">Amount</th>
                  <th className="text-center p-3 font-medium text-sm">Status</th>
                  <th className="text-left p-3 font-medium text-sm">Due Date</th>
                  <th className="text-center p-3 font-medium text-sm">Actions</th>
                </tr>
              </thead>
              <tbody>
                {invoices.map((invoice) => (
                  <tr key={invoice.id} className="border-b last:border-0 hover:bg-muted/30">
                    <td className="p-3">
                      <span className="font-medium text-sm">{invoice.id}</span>
                    </td>
                    <td className="p-3">
                      <span className="text-sm">{invoice.customer}</span>
                    </td>
                    <td className="p-3">
                      <span className="text-sm text-muted-foreground">{invoice.orderId}</span>
                    </td>
                    <td className="p-3 text-right">
                      <span className="font-medium text-sm">PKR {invoice.amount.toLocaleString()}</span>
                    </td>
                    <td className="p-3 text-center">
                      <StatusBadge status={invoice.status} />
                    </td>
                    <td className="p-3">
                      <span className="text-sm">{invoice.dueDate}</span>
                    </td>
                    <td className="p-3 text-center">
                      {invoice.status !== 'paid' && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleRecordPayment(invoice)}
                          className="text-xs"
                        >
                          <CreditCard className="h-3 w-3 mr-1" />
                          Record Payment
                        </Button>
                      )}
                      {invoice.status === 'paid' && (
                        <span className="text-xs text-muted-foreground">Completed</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Record Payment Modal */}
      <Dialog open={paymentModalOpen} onOpenChange={setPaymentModalOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Record Payment</DialogTitle>
          </DialogHeader>
          
          {selectedInvoice && (
            <div className="space-y-4 pt-4">
              {/* Invoice Number - Read Only */}
              <div className="space-y-2">
                <Label htmlFor="invoiceNo">Invoice Number</Label>
                <Input
                  id="invoiceNo"
                  value={selectedInvoice.id}
                  disabled
                  className="bg-muted"
                />
              </div>

              {/* Customer Info */}
              <div className="p-3 bg-muted/50 rounded-lg">
                <p className="text-sm text-muted-foreground">Customer</p>
                <p className="font-medium">{selectedInvoice.customer}</p>
                <p className="text-sm text-muted-foreground mt-1">
                  Outstanding: PKR {selectedInvoice.amount.toLocaleString()}
                </p>
              </div>

              {/* Amount */}
              <div className="space-y-2">
                <Label htmlFor="amount">Amount (PKR)</Label>
                <Input
                  id="amount"
                  type="number"
                  placeholder="Enter payment amount"
                  value={paymentData.amount}
                  onChange={(e) => setPaymentData({ ...paymentData, amount: e.target.value })}
                />
              </div>

              {/* Payment Method */}
              <div className="space-y-2">
                <Label htmlFor="method">Payment Method</Label>
                <Select
                  value={paymentData.method}
                  onValueChange={(value) => setPaymentData({ ...paymentData, method: value })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select payment method" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="cash">Cash</SelectItem>
                    <SelectItem value="bank_transfer">Bank Transfer</SelectItem>
                    <SelectItem value="cheque">Cheque</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Bank Reference */}
              <div className="space-y-2">
                <Label htmlFor="bankRef">Bank Reference / Cheque No</Label>
                <Input
                  id="bankRef"
                  placeholder="Enter reference number"
                  value={paymentData.bankReference}
                  onChange={(e) => setPaymentData({ ...paymentData, bankReference: e.target.value })}
                />
              </div>

              {/* Date */}
              <div className="space-y-2">
                <Label htmlFor="date">Payment Date</Label>
                <div className="relative">
                  <Input
                    id="date"
                    type="date"
                    value={paymentData.date}
                    onChange={(e) => setPaymentData({ ...paymentData, date: e.target.value })}
                  />
                  <Calendar className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
                </div>
              </div>

              {/* Actions */}
              <div className="flex gap-3 pt-4">
                <Button
                  variant="outline"
                  className="flex-1"
                  onClick={() => setPaymentModalOpen(false)}
                >
                  Cancel
                </Button>
                <Button
                  className="flex-1 bg-[#1e3a5f] hover:bg-[#1e3a5f]/90"
                  onClick={handleSavePayment}
                  disabled={!paymentData.amount || !paymentData.method || !paymentData.date}
                >
                  Save Payment
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
