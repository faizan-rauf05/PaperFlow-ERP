'use client'

import { useState } from 'react'
import { 
  LogOut, 
  MapPin, 
  Camera,
  Clock,
  ChevronDown,
  Plus,
  X,
  FileText
} from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

const recentVisits = [
  { 
    id: 1, 
    customer: 'MegaMart Retail', 
    time: 'Today, 10:30 AM', 
    outcome: 'deal',
    notes: 'Closed bulk order for 50,000 bags'
  },
  { 
    id: 2, 
    customer: 'Green Grocers Ltd', 
    time: 'Today, 9:15 AM', 
    outcome: 'followup',
    notes: 'Interested in eco-friendly line'
  },
  { 
    id: 3, 
    customer: 'Fashion Hub Store', 
    time: 'Yesterday, 4:00 PM', 
    outcome: 'noresponse',
    notes: 'Manager not available'
  },
]

const quotations = [
  {
    id: 'QT-2024-045',
    customer: 'Premium Retailers Co',
    amount: 185000,
    status: 'pending'
  },
  {
    id: 'QT-2024-044',
    customer: 'EcoStore Chain',
    amount: 92500,
    status: 'approved'
  },
]

const customers = [
  { id: 1, name: 'MegaMart Retail' },
  { id: 2, name: 'Green Grocers Ltd' },
  { id: 3, name: 'Fashion Hub Store' },
  { id: 4, name: 'Premium Retailers Co' },
  { id: 5, name: 'EcoStore Chain' },
  { id: 6, name: 'QuickShop Express' },
]

const outcomeColors = {
  deal: 'bg-green-100 text-green-700',
  followup: 'bg-amber-100 text-amber-700',
  noresponse: 'bg-gray-100 text-gray-600',
  other: 'bg-blue-100 text-blue-700'
}

const outcomeLabels = {
  deal: 'Deal',
  followup: 'Follow-up',
  noresponse: 'No Response',
  other: 'Other'
}

const quotationStatusColors = {
  pending: 'bg-amber-100 text-amber-700',
  approved: 'bg-green-100 text-green-700',
  rejected: 'bg-red-100 text-red-700',
  draft: 'bg-gray-100 text-gray-600'
}

export default function SalesDashboard() {
  const [showVisitForm, setShowVisitForm] = useState(false)
  const [location, setLocation] = useState(null)
  const [isCapturingLocation, setIsCapturingLocation] = useState(false)
  const [photoUploaded, setPhotoUploaded] = useState(false)
  const [formData, setFormData] = useState({
    customer: '',
    outcome: '',
    notes: ''
  })

  const handleCaptureLocation = () => {
    setIsCapturingLocation(true)
    // Simulate location capture
    setTimeout(() => {
      setLocation({
        lat: '31.5204',
        lng: '74.3587'
      })
      setIsCapturingLocation(false)
    }, 1500)
  }

  const handlePhotoUpload = () => {
    setPhotoUploaded(true)
  }

  const handleSubmit = () => {
    // Handle form submission
    setShowVisitForm(false)
    setFormData({ customer: '', outcome: '', notes: '' })
    setLocation(null)
    setPhotoUploaded(false)
  }

  const isFormValid = formData.customer && formData.outcome

  return (
    <div className="min-h-screen bg-muted/30">
      {/* Header */}
      <header className="bg-[#1e3a5f] text-white px-4 py-3 sticky top-0 z-50">
        <div className="max-w-[420px] mx-auto flex items-center justify-between">
          <div>
            <h1 className="font-semibold">Emily Davis</h1>
            <p className="text-xs text-white/70">Sales Representative</p>
          </div>
          <Button 
            variant="ghost" 
            size="icon" 
            className="text-white hover:bg-white/10"
          >
            <LogOut className="h-5 w-5" />
          </Button>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-[420px] mx-auto p-4 space-y-4">
        {/* Log a Visit Button */}
        {!showVisitForm && (
          <Button 
            onClick={() => setShowVisitForm(true)}
            className="w-full bg-[#1e3a5f] hover:bg-[#1e3a5f]/90 py-6 text-base"
          >
            <Plus className="h-5 w-5 mr-2" />
            Log a Visit
          </Button>
        )}

        {/* Log Visit Form */}
        {showVisitForm && (
          <Card className="border-2 border-primary/20">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-lg">Log Visit</CardTitle>
                <Button 
                  variant="ghost" 
                  size="icon"
                  onClick={() => setShowVisitForm(false)}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Customer Selection */}
              <div className="space-y-2">
                <Label>Customer *</Label>
                <Select 
                  value={formData.customer} 
                  onValueChange={(value) => setFormData({...formData, customer: value})}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select customer" />
                  </SelectTrigger>
                  <SelectContent>
                    {customers.map((customer) => (
                      <SelectItem key={customer.id} value={customer.name}>
                        {customer.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Outcome Selection */}
              <div className="space-y-2">
                <Label>Outcome *</Label>
                <Select 
                  value={formData.outcome} 
                  onValueChange={(value) => setFormData({...formData, outcome: value})}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select outcome" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="deal">Deal</SelectItem>
                    <SelectItem value="followup">Follow-up</SelectItem>
                    <SelectItem value="noresponse">No Response</SelectItem>
                    <SelectItem value="other">Other</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Notes */}
              <div className="space-y-2">
                <Label>Notes</Label>
                <Textarea 
                  placeholder="Add visit notes..."
                  value={formData.notes}
                  onChange={(e) => setFormData({...formData, notes: e.target.value})}
                  rows={3}
                />
              </div>

              {/* Location Capture */}
              <div className="space-y-2">
                <Label>Location</Label>
                {location ? (
                  <div className="flex items-center gap-2 p-3 bg-green-50 border border-green-200 rounded-lg">
                    <MapPin className="h-4 w-4 text-green-600" />
                    <span className="text-sm text-green-700">
                      Lat: {location.lat}, Lng: {location.lng}
                    </span>
                  </div>
                ) : (
                  <Button 
                    variant="outline" 
                    className="w-full"
                    onClick={handleCaptureLocation}
                    disabled={isCapturingLocation}
                  >
                    <MapPin className="h-4 w-4 mr-2" />
                    {isCapturingLocation ? 'Capturing...' : 'Capture Location'}
                  </Button>
                )}
              </div>

              {/* Photo Upload */}
              <div className="space-y-2">
                <Label>Photo</Label>
                {photoUploaded ? (
                  <div className="flex items-center gap-2 p-3 bg-green-50 border border-green-200 rounded-lg">
                    <Camera className="h-4 w-4 text-green-600" />
                    <span className="text-sm text-green-700">Photo uploaded</span>
                  </div>
                ) : (
                  <Button 
                    variant="outline" 
                    className="w-full"
                    onClick={handlePhotoUpload}
                  >
                    <Camera className="h-4 w-4 mr-2" />
                    Upload Photo
                  </Button>
                )}
              </div>

              {/* Submit Button */}
              <Button 
                className="w-full bg-[#1e3a5f] hover:bg-[#1e3a5f]/90"
                onClick={handleSubmit}
                disabled={!isFormValid}
              >
                Submit Visit
              </Button>
            </CardContent>
          </Card>
        )}

        {/* Recent Visits */}
        <div className="space-y-3">
          <h2 className="font-semibold text-lg">Recent Visits</h2>
          {recentVisits.map((visit) => (
            <Card key={visit.id}>
              <CardContent className="p-4">
                <div className="flex items-start justify-between mb-2">
                  <h3 className="font-medium">{visit.customer}</h3>
                  <span className={`px-2 py-1 text-xs font-medium rounded-full ${outcomeColors[visit.outcome]}`}>
                    {outcomeLabels[visit.outcome]}
                  </span>
                </div>
                <div className="flex items-center gap-1 text-xs text-muted-foreground mb-2">
                  <Clock className="h-3 w-3" />
                  {visit.time}
                </div>
                <p className="text-sm text-muted-foreground">{visit.notes}</p>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* My Quotations */}
        <div className="space-y-3">
          <h2 className="font-semibold text-lg">My Quotations</h2>
          {quotations.map((quote) => (
            <Card key={quote.id}>
              <CardContent className="p-4">
                <div className="flex items-start justify-between mb-2">
                  <div>
                    <p className="text-xs text-muted-foreground">{quote.id}</p>
                    <h3 className="font-medium">{quote.customer}</h3>
                  </div>
                  <span className={`px-2 py-1 text-xs font-medium rounded-full capitalize ${quotationStatusColors[quote.status]}`}>
                    {quote.status}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-lg font-semibold text-primary">
                    PKR {quote.amount.toLocaleString()}
                  </span>
                  <Button variant="ghost" size="sm">
                    <FileText className="h-4 w-4 mr-1" />
                    View
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </main>
    </div>
  )
}
