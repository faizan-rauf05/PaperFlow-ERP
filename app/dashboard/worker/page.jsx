'use client'

import { useState, useEffect } from 'react'
import { 
  LogOut,
  Play,
  Clock,
  Camera,
  ChevronDown,
  Factory
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

// Placeholder data for active stages
const activeStages = [
  {
    id: 1,
    stageName: 'Stage 2 — Printing',
    orderId: 'ORD-0045',
    status: 'pending',
  },
  {
    id: 2,
    stageName: 'Stage 3 — Cutting',
    orderId: 'ORD-0044',
    status: 'in_progress',
  },
]

const wasteReasons = [
  'Damaged material',
  'Machine error',
  'Operator error',
  'Other',
]

const defectTypes = [
  'Printing defect',
  'Cutting defect',
  'Material tear',
  'Size variation',
  'Color mismatch',
  'Other',
]

export default function WorkerMobileDashboard() {
  const [isCheckedIn, setIsCheckedIn] = useState(false)
  const [checkInTime, setCheckInTime] = useState(null)
  const [activeStageId, setActiveStageId] = useState(null)
  const [timerSeconds, setTimerSeconds] = useState(0)
  const [isTimerRunning, setIsTimerRunning] = useState(false)
  
  // Form state
  const [outputQty, setOutputQty] = useState('')
  const [wasteReason, setWasteReason] = useState('')
  const [rejectedQty, setRejectedQty] = useState('')
  const [defectType, setDefectType] = useState('')
  const [notes, setNotes] = useState('')
  const [photoUploaded, setPhotoUploaded] = useState(false)

  // Timer effect
  useEffect(() => {
    let interval = null
    if (isTimerRunning) {
      interval = setInterval(() => {
        setTimerSeconds(seconds => seconds + 1)
      }, 1000)
    }
    return () => clearInterval(interval)
  }, [isTimerRunning])

  const formatTime = (totalSeconds) => {
    const minutes = Math.floor(totalSeconds / 60)
    const seconds = totalSeconds % 60
    return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`
  }

  const handleCheckIn = () => {
    setIsCheckedIn(true)
    setCheckInTime(new Date())
  }

  const handleCheckOut = () => {
    setIsCheckedIn(false)
    setCheckInTime(null)
  }

  const handleStartStage = (stageId) => {
    setActiveStageId(stageId)
    setTimerSeconds(0)
    setIsTimerRunning(true)
    // Reset form
    setOutputQty('')
    setWasteReason('')
    setRejectedQty('')
    setDefectType('')
    setNotes('')
    setPhotoUploaded(false)
  }

  const handleSubmitStage = () => {
    // Handle submission
    setIsTimerRunning(false)
    setActiveStageId(null)
    setTimerSeconds(0)
  }

  const isFormValid = outputQty && wasteReason && rejectedQty && defectType

  const activeStageData = activeStages.find(s => s.id === activeStageId)

  const getStatusBadge = (status) => {
    const styles = {
      pending: 'bg-gray-100 text-gray-700',
      in_progress: 'bg-blue-100 text-blue-700',
      completed: 'bg-green-100 text-green-700',
    }
    const labels = {
      pending: 'Pending',
      in_progress: 'In Progress',
      completed: 'Completed',
    }
    return (
      <span className={`px-2 py-1 text-xs font-medium rounded-full ${styles[status]}`}>
        {labels[status]}
      </span>
    )
  }

  return (
    <div className="min-h-screen bg-muted/30">
      {/* Mobile Container */}
      <div className="max-w-[420px] mx-auto bg-background min-h-screen flex flex-col">
        
        {/* Header */}
        <header className="sticky top-0 z-10 bg-[#1e3a5f] text-white px-4 py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Factory className="h-6 w-6" />
              <span className="font-bold text-lg">PaperPro</span>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-sm text-white/80">Mike Wilson</span>
              <button className="p-2 hover:bg-white/10 rounded-lg transition-colors">
                <LogOut className="h-5 w-5" />
              </button>
            </div>
          </div>
        </header>

        {/* Main Content */}
        <main className="flex-1 p-4 space-y-4">
          
          {/* Active Stage Submission Form */}
          {activeStageId && activeStageData && (
            <Card className="border-[#1e3a5f] border-2">
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-lg">{activeStageData.stageName}</CardTitle>
                  <div className="flex items-center gap-2 bg-[#1e3a5f] text-white px-3 py-1 rounded-lg">
                    <Clock className="h-4 w-4" />
                    <span className="font-mono font-bold">{formatTime(timerSeconds)}</span>
                  </div>
                </div>
                <p className="text-sm text-muted-foreground">Order: {activeStageData.orderId}</p>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Input Quantity (read-only) */}
                <div className="space-y-2">
                  <Label>Input Quantity</Label>
                  <Input value="1,500" readOnly className="bg-muted" />
                </div>

                {/* Output Quantity */}
                <div className="space-y-2">
                  <Label>Output Quantity <span className="text-red-500">*</span></Label>
                  <Input 
                    type="number" 
                    placeholder="Enter output quantity"
                    value={outputQty}
                    onChange={(e) => setOutputQty(e.target.value)}
                  />
                </div>

                {/* Waste Reason */}
                <div className="space-y-2">
                  <Label>Waste Reason <span className="text-red-500">*</span></Label>
                  <Select value={wasteReason} onValueChange={setWasteReason}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select waste reason" />
                    </SelectTrigger>
                    <SelectContent>
                      {wasteReasons.map((reason) => (
                        <SelectItem key={reason} value={reason}>{reason}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* QC - Rejected Quantity */}
                <div className="space-y-2">
                  <Label>QC — Rejected Quantity <span className="text-red-500">*</span></Label>
                  <Input 
                    type="number" 
                    placeholder="Enter rejected quantity"
                    value={rejectedQty}
                    onChange={(e) => setRejectedQty(e.target.value)}
                  />
                </div>

                {/* QC - Defect Type */}
                <div className="space-y-2">
                  <Label>QC — Defect Type <span className="text-red-500">*</span></Label>
                  <Select value={defectType} onValueChange={setDefectType}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select defect type" />
                    </SelectTrigger>
                    <SelectContent>
                      {defectTypes.map((type) => (
                        <SelectItem key={type} value={type}>{type}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Notes */}
                <div className="space-y-2">
                  <Label>Notes (optional)</Label>
                  <Textarea 
                    placeholder="Add any additional notes..."
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    rows={3}
                  />
                </div>

                {/* Photo Upload */}
                <div className="space-y-2">
                  <Label>Photo</Label>
                  <Button 
                    variant="outline" 
                    className="w-full"
                    onClick={() => setPhotoUploaded(true)}
                  >
                    <Camera className="h-4 w-4 mr-2" />
                    {photoUploaded ? 'Photo Uploaded' : 'Upload Photo'}
                  </Button>
                </div>

                {/* Submit Button */}
                <Button 
                  className="w-full bg-[#1e3a5f] hover:bg-[#2d4a6f] text-white"
                  disabled={!isFormValid}
                  onClick={handleSubmitStage}
                >
                  Submit Stage
                </Button>
              </CardContent>
            </Card>
          )}

          {/* My Active Stages */}
          {!activeStageId && (
            <section>
              <h2 className="text-lg font-semibold mb-3">My Active Stages</h2>
              <div className="space-y-3">
                {activeStages.map((stage) => (
                  <Card key={stage.id}>
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between mb-3">
                        <div>
                          <h3 className="font-semibold">{stage.stageName}</h3>
                          <p className="text-sm text-muted-foreground">Order: {stage.orderId}</p>
                        </div>
                        {getStatusBadge(stage.status)}
                      </div>
                      <Button 
                        className="w-full bg-[#1e3a5f] hover:bg-[#2d4a6f] text-white"
                        onClick={() => handleStartStage(stage.id)}
                      >
                        <Play className="h-4 w-4 mr-2" />
                        Start Stage
                      </Button>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </section>
          )}

          {/* Attendance Section */}
          <section className="pt-4">
            <h2 className="text-lg font-semibold mb-3">Attendance</h2>
            <Card>
              <CardContent className="p-4">
                {isCheckedIn ? (
                  <div className="space-y-3">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">Checked in at:</span>
                      <span className="font-medium">
                        {checkInTime?.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                    <Button 
                      className="w-full bg-red-600 hover:bg-red-700 text-white h-14 text-lg"
                      onClick={handleCheckOut}
                    >
                      Check Out
                    </Button>
                  </div>
                ) : (
                  <Button 
                    className="w-full bg-green-600 hover:bg-green-700 text-white h-14 text-lg"
                    onClick={handleCheckIn}
                  >
                    Check In
                  </Button>
                )}
              </CardContent>
            </Card>
          </section>

        </main>
      </div>
    </div>
  )
}
