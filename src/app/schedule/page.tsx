"use client"

import * as React from "react"
import { 
  Calendar, 
  Clock, 
  Mail, 
  CheckCircle2, 
  ArrowRight,
  Filter,
  Search
} from "lucide-react"
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from "@/components/ui/table"
import { Button } from "@/components/ui/button"
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card"
import { cn, formatDate } from "@/lib/utils"

interface ScheduledItem {
  id: string
  campaign_name: string
  recipient_email: string
  subject: string
  scheduled_at: string
  status: string
}

export default function SchedulePage() {
  const [items, setItems] = React.useState<ScheduledItem[]>([])
  const [loading, setLoading] = React.useState(true)

  React.useEffect(() => {
    async function fetchUpcoming() {
      try {
        // We fetch pending/queued items as they are the scheduled ones
        const res = await fetch("/api/queue?status=pending&limit=20")
        const json = await res.json()
        if (json.success) setItems(json.data)
      } catch (err) {
        console.error(err)
      } finally {
        setLoading(false)
      }
    }
    fetchUpcoming()
  }, [])

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div className="flex items-center justify-between">
        <div className="space-y-1">
          <h2 className="text-3xl font-bold tracking-tight">Delivery Schedule</h2>
          <p className="text-muted-foreground">Monitor and manage the timeline of your upcoming automated emails.</p>
        </div>
        <Button variant="outline" className="gap-2">
          <Calendar className="h-4 w-4" />
          Calendar View
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
         <Card className="bg-amber-500/5 border-amber-500/20">
            <CardContent className="p-4 flex items-center gap-4">
               <div className="p-2 bg-amber-500/10 text-amber-500 rounded-lg">
                  <Clock className="h-5 w-5" />
               </div>
               <div>
                  <p className="text-[10px] uppercase font-bold text-amber-500/70">Next 24h</p>
                  <p className="text-2xl font-bold">1,204 emails</p>
               </div>
            </CardContent>
         </Card>
         <Card className="bg-blue-500/5 border-blue-500/20">
            <CardContent className="p-4 flex items-center gap-4">
               <div className="p-2 bg-blue-500/10 text-blue-500 rounded-lg">
                  <Calendar className="h-5 w-5" />
               </div>
               <div>
                  <p className="text-[10px] uppercase font-bold text-blue-500/70">This Week</p>
                  <p className="text-2xl font-bold">8,540 emails</p>
               </div>
            </CardContent>
         </Card>
         <Card>
            <CardContent className="p-4 flex items-center gap-4">
               <div className="p-2 bg-muted rounded-lg">
                  <Mail className="h-5 w-5 opacity-40" />
               </div>
               <div>
                  <p className="text-[10px] uppercase font-bold text-muted-foreground">Queue Depth</p>
                  <p className="text-2xl font-bold">42,000+</p>
               </div>
            </CardContent>
         </Card>
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
           <div>
              <CardTitle>Upcoming Deliveries</CardTitle>
              <CardDescription>Chronological list of next scheduled injections.</CardDescription>
           </div>
           <div className="flex gap-2">
              <div className="relative">
                 <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                 <input className="h-9 min-w-[200px] bg-muted/40 border border-input rounded-md pl-9 pr-3 text-sm focus:outline-none focus:ring-1 focus:ring-primary" placeholder="Campaign or email..." />
              </div>
              <Button variant="outline" size="icon"><Filter className="h-4 w-4" /></Button>
           </div>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Execution Time</TableHead>
                <TableHead>Recipient</TableHead>
                <TableHead>Campaign</TableHead>
                <TableHead>Sequence</TableHead>
                <TableHead className="text-right">Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                [...Array(5)].map((_, i) => (
                  <TableRow key={i}>
                    {[...Array(5)].map((_, j) => (
                      <TableCell key={j}><div className="h-8 bg-muted animate-pulse rounded" /></TableCell>
                    ))}
                  </TableRow>
                ))
              ) : items.length === 0 ? (
                <TableRow>
                   <TableCell colSpan={5} className="h-32 text-center text-muted-foreground">
                      No upcoming emails scheduled.
                   </TableCell>
                </TableRow>
              ) : (
                items.map((item) => (
                  <TableRow key={item.id}>
                    <TableCell className="font-mono text-xs">
                       <span className="text-primary font-bold">{formatDate(item.scheduled_at).split(',')[1]}</span>
                       <span className="block text-[10px] text-muted-foreground">{formatDate(item.scheduled_at).split(',')[0]}</span>
                    </TableCell>
                    <TableCell className="font-medium text-xs">{item.recipient_email}</TableCell>
                    <TableCell className="text-muted-foreground text-xs">{item.campaign_name}</TableCell>
                    <TableCell>
                       <span className="px-2 py-0.5 bg-muted rounded text-[10px] font-bold">Step 1</span>
                    </TableCell>
                    <TableCell className="text-right">
                       <Button variant="ghost" size="sm" className="h-8 text-xs gap-1.5 opacity-60 hover:opacity-100">
                          Reschedule <ArrowRight className="h-3 w-3" />
                       </Button>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  )
}
