"use client";

import * as React from "react";
import {
  Search,
  Filter,
  RefreshCw,
  Mail,
  CheckCircle2,
  XCircle,
  Clock,
  ChevronDown,
  ChevronUp,
  ChevronRight,
  Calendar,
  FileText,
  Users,
  TrendingUp,
  Circle,
  MoreHorizontal,
  AlertCircle,
  AlertTriangle,
  Pause,
  Play,
  X,
  Send,
  Trash2,
  Loader2,
  Globe,
  BarChart3,
  Layers,
  Timer,
  Undo2,
  Zap,
  Info,
  StopCircle,
  Settings,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from "@/components/ui/card";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { useState, useEffect } from "react";
import { cn, formatDate } from "@/lib/utils";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";

interface QueueItem {
  id: string;
  campaign_id: string;
  campaign_name?: string;
  sender_id?: string;
  recipient_email: string;
  recipient_name: string | null;
  subject: string;
  html_content?: string;
  status:
    | "queued"
    | "sending"
    | "sent"
    | "failed"
    | "cancelled"
    | "pending"
    | "scheduled"
    | "ready_to_send"
    | "paused";
  attempts: number;
  error_message: string | null;
  sent_at: string | null;
  scheduled_at: string | null;
  adjusted_scheduled_at?: string | null;
  country_code: string;
  tag: string | null;
  created_at: string;
  updated_at: string;
  sequence_position?: number;
  contact_id?: string;
  template_id?: string;
  source?: string;
}

interface SequenceEmail {
  position: number;
  subject: string;
  status: QueueItem["status"];
  scheduled_at: string | null;
  sent_at: string | null;
  queue_id: string;
  template_id?: string;
}

interface ContactGroup {
  email: string;
  name: string | null;
  emails: QueueItem[];
  stats: {
    total: number;
    sent: number;
    failed: number;
    queued: number;
    sending: number;
  };
  campaigns: string[];
  sequences: Map<string, SequenceEmail[]>; // campaign_id -> sequence emails
}

type StatusFilter =
  | "all"
  | "sent"
  | "failed"
  | "cancelled"
  | "queued"
  | "sending"
  | "pending";

export default function HistoryPage() {
  const [items, setItems] = React.useState<QueueItem[]>([]);
  const [contactGroups, setContactGroups] = React.useState<ContactGroup[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [refreshing, setRefreshing] = React.useState(false);
  const [statusFilter, setStatusFilter] = React.useState<StatusFilter>("all");
  const [searchQuery, setSearchQuery] = React.useState("");
  const [expandedContacts, setExpandedContacts] = React.useState<Set<string>>(
    new Set(),
  );
  const [expandedSequences, setExpandedSequences] = React.useState<Set<string>>(
    new Set(),
  );
  const [selectedEmail, setSelectedEmail] = React.useState<QueueItem | null>(
    null,
  );
  const [modalOpen, setModalOpen] = React.useState(false);
  const [actionLoading, setActionLoading] = React.useState<string | null>(null);
  const [countryTimezones, setCountryTimezones] = React.useState<
    Record<string, any>
  >({});
  const [pagination, setPagination] = useState({
    total: 0,
    page: 1,
    limit: 200,
    totalPages: 1,
  });

  // Batch processor state
  const [processorState, setProcessorState] = useState<{
    running: boolean;
    paused: boolean;
    stopped: boolean;
    currentBatch: number;
    emailsSentInBatch: number;
    totalProcessed: number;
    totalSent: number;
    totalFailed: number;
    startTime: string | null;
    lastActivity: string | null;
  }>({
    running: false,
    paused: false,
    stopped: false,
    currentBatch: 0,
    emailsSentInBatch: 0,
    totalProcessed: 0,
    totalSent: 0,
    totalFailed: 0,
    startTime: null,
    lastActivity: null,
  });
  const [processorLoading, setProcessorLoading] = useState(false);

  // Queue mode state
  const [queueMode, setQueueMode] = useState<"auto" | "manual">("manual");
  const [queueModeLoading, setQueueModeLoading] = useState(false);
  const [queueInterval] = useState(5); // Fixed at 5 minutes
  const [nextProcessTime, setNextProcessTime] = useState<Date | null>(null);
  const [countdown, setCountdown] = useState<string>("");

  // Bulk actions state
  const [bulkActionLoading, setBulkActionLoading] = useState<string | null>(
    null,
  );

  const fetchQueue = async (page = 1, quiet = false) => {
    if (!quiet) setLoading(true);
    else setRefreshing(true);

    try {
      const statusParam = statusFilter !== "all" ? `&status=${statusFilter}` : "";
      const limit = pagination.limit;
      const offset = (page - 1) * limit;
      const res = await fetch(`/api/queue?limit=${limit}&offset=${offset}${statusParam}`);
      const json = await res.json();
      if (json.success) {
        setItems(json.data);
        if (json.pagination) {
          setPagination({
            ...pagination,
            total: json.pagination.total,
            page: page,
            totalPages: json.pagination.totalPages,
          });
        }
      }
    } catch (err) {
      console.error(err);
    } finally {
      if (!quiet) setLoading(false);
      setRefreshing(false);
    }
  };

  React.useEffect(() => {
    fetchQueue(1);
  }, [statusFilter]);

  // Fetch queue mode setting
  const fetchQueueMode = async () => {
    try {
      const res = await fetch("/api/settings");
      const json = await res.json();
      if (json.success) {
        if (json.settings.queue_mode) {
          setQueueMode(json.settings.queue_mode.value);
        }
        // Calculate next process time from last process time
        if (json.settings.last_queue_process) {
          const lastProcess = new Date(json.settings.last_queue_process.value);
          const nextTime = new Date(
            lastProcess.getTime() + queueInterval * 60 * 1000,
          );

          // Only use this if the next time is in the future
          // If it's in the past, calculate from now
          if (nextTime.getTime() > Date.now()) {
            setNextProcessTime(nextTime);
          }
        }
      }
    } catch (err) {
      console.error("Failed to fetch queue mode:", err);
    }
  };

  React.useEffect(() => {
    fetchQueueMode();
  }, []);

  const handleQueueModeToggle = async () => {
    setQueueModeLoading(true);
    try {
      const newMode = queueMode === "auto" ? "manual" : "auto";
      const res = await fetch("/api/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ key: "queue_mode", value: newMode }),
      });
      const json = await res.json();
      if (json.success) {
        setQueueMode(newMode);
        // Reset next process time when switching to auto
        if (newMode === "auto") {
          // Try to use last process time, or calculate from now
          const lastProcess = json.settings?.last_queue_process?.value;
          if (lastProcess) {
            const lastTime = new Date(lastProcess);
            const nextTime = new Date(
              lastTime.getTime() + queueInterval * 60 * 1000,
            );
            if (nextTime.getTime() > Date.now()) {
              setNextProcessTime(nextTime);
            } else {
              setNextProcessTime(
                new Date(Date.now() + queueInterval * 60 * 1000),
              );
            }
          } else {
            setNextProcessTime(
              new Date(Date.now() + queueInterval * 60 * 1000),
            );
          }
        } else {
          setNextProcessTime(null);
          setCountdown("");
        }
      } else {
        alert("Failed to update queue mode");
      }
    } catch (err) {
      console.error("Failed to toggle queue mode:", err);
      alert("Failed to update queue mode");
    } finally {
      setQueueModeLoading(false);
    }
  };

  // Countdown timer effect
  React.useEffect(() => {
    if (queueMode !== "auto" || !nextProcessTime) {
      setCountdown("");
      return;
    }

    const updateCountdown = () => {
      const now = new Date().getTime();
      const distance = nextProcessTime.getTime() - now;

      if (distance < 0) {
        // Time's up - show "Processing..." and wait for next cycle
        // Don't reset - let the worker update last_queue_process
        // Then we'll recalculate on next settings fetch
        setCountdown("Processing...");
        // Refresh settings to get updated last_queue_process
        fetchQueueMode();
        return;
      }

      const minutes = Math.floor((distance % (1000 * 60 * 60)) / (1000 * 60));
      const seconds = Math.floor((distance % (1000 * 60)) / 1000);
      setCountdown(`${minutes}m ${seconds}s`);
    };

    updateCountdown();
    const interval = setInterval(updateCountdown, 1000);

    return () => clearInterval(interval);
  }, [queueMode, nextProcessTime, queueInterval]);

  // Initialize next process time when switching to auto mode
  React.useEffect(() => {
    if (queueMode === "auto" && !nextProcessTime) {
      setNextProcessTime(new Date(Date.now() + queueInterval * 60 * 1000));
    }
  }, [queueMode]);

  // Periodically refresh settings when in auto mode to keep countdown accurate
  React.useEffect(() => {
    if (queueMode !== "auto") return;

    // Refresh settings every 10 seconds to get updated last_queue_process
    const interval = setInterval(() => {
      fetchQueueMode();
    }, 10000);

    return () => clearInterval(interval);
  }, [queueMode]);

  // Poll processor status every 2 seconds when running
  React.useEffect(() => {
    if (!processorState.running) return;

    const interval = setInterval(async () => {
      try {
        const res = await fetch("/api/queue/batch-processor?action=status");
        const json = await res.json();
        if (json.success) {
          setProcessorState(json.state);
        }
      } catch (err) {
        console.error("Failed to fetch processor status:", err);
      }
    }, 2000);

    return () => clearInterval(interval);
  }, [processorState.running]);

  // Group items by contact and sequence
  React.useEffect(() => {
    if (items.length === 0) {
      setContactGroups([]);
      return;
    }

    // Filter out log items (historical records) - only show queue items
    const queueItems = items.filter(item => item.source !== 'log');

    const grouped = new Map<string, QueueItem[]>();

    for (const item of queueItems) {
      const email = item.recipient_email.toLowerCase();
      if (!grouped.has(email)) {
        grouped.set(email, []);
      }
      grouped.get(email)!.push(item);
    }

    const groups: ContactGroup[] = [];

    for (const [email, emailItems] of grouped) {
      // Filter by search query
      if (searchQuery && !email.includes(searchQuery.toLowerCase())) {
        const hasMatch = emailItems.some(
          (item) =>
            item.subject?.toLowerCase().includes(searchQuery.toLowerCase()) ||
            item.campaign_name
              ?.toLowerCase()
              .includes(searchQuery.toLowerCase()),
        );
        if (!hasMatch) continue;
      }

      const stats = {
        total: emailItems.length,
        sent: emailItems.filter((i) => i.status === "sent").length,
        failed: emailItems.filter((i) => i.status === "failed").length,
        queued: emailItems.filter((i) =>
          ["queued", "pending", "scheduled", "ready_to_send"].includes(
            i.status,
          ),
        ).length,
        sending: emailItems.filter((i) => i.status === "sending").length,
      };

      const campaigns = [
        ...new Set(emailItems.map((i) => i.campaign_name || i.campaign_id)),
      ];

      // Group by campaign (sequence)
      const sequences = new Map<string, SequenceEmail[]>();
      const itemsByCampaign = new Map<string, QueueItem[]>();

      for (const item of emailItems) {
        const campaignId = item.campaign_id || "uncategorized";
        if (!itemsByCampaign.has(campaignId)) {
          itemsByCampaign.set(campaignId, []);
        }
        itemsByCampaign.get(campaignId)!.push(item);
      }

      for (const [campaignId, campaignItems] of itemsByCampaign) {
        const sequenceEmails: SequenceEmail[] = campaignItems
          .sort(
            (a, b) => (a.sequence_position || 0) - (b.sequence_position || 0),
          )
          .map((item) => ({
            position: item.sequence_position || 0,
            subject: item.subject,
            status: item.status,
            scheduled_at: item.scheduled_at, // Use scheduled_at directly - it has the correct future time
            sent_at: item.sent_at,
            queue_id: item.id,
            template_id: item.template_id,
          }));

        sequences.set(campaignId, sequenceEmails);
      }

      groups.push({
        email,
        name: emailItems[0].recipient_name,
        emails: emailItems.sort(
          (a, b) =>
            new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
        ),
        stats,
        campaigns,
        sequences,
      });
    }

    // Sort groups by most recent activity
    groups.sort((a, b) => {
      const aLatest = new Date(a.emails[0].created_at).getTime();
      const bLatest = new Date(b.emails[0].created_at).getTime();
      return bLatest - aLatest;
    });

    setContactGroups(groups);
  }, [items, searchQuery]);

  const toggleContactExpanded = (email: string) => {
    setExpandedContacts((prev) => {
      const next = new Set(prev);
      if (next.has(email)) {
        next.delete(email);
      } else {
        next.add(email);
      }
      return next;
    });
  };

  const toggleSequenceExpanded = (key: string) => {
    setExpandedSequences((prev) => {
      const next = new Set(prev);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
  };

  const getStats = () => {
    return {
      total: items.length,
      sent: items.filter((i) => i.status === "sent").length,
      failed: items.filter((i) => i.status === "failed").length,
      queued: items.filter((i) =>
        ["queued", "pending", "scheduled", "ready_to_send"].includes(i.status),
      ).length,
      sending: items.filter((i) => i.status === "sending").length,
      contacts: contactGroups.length,
    };
  };

  const stats = getStats();

  const formatScheduleDate = (dateStr: string | null) => {
    if (!dateStr) return null;
    const date = new Date(dateStr);
    const now = new Date();
    const isPast = date < now;

    return {
      full: date.toLocaleString(),
      short: formatDate(dateStr),
      relative: isPast
        ? `was ${formatDate(dateStr)}`
        : date.toDateString() === now.toDateString()
          ? `today at ${date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`
          : date.getDate() - now.getDate() === 1
            ? `tomorrow at ${date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`
            : `in ${Math.ceil((date.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))} days`,
    };
  };

  const handleEmailAction = async (action: string, emailId: string) => {
    setActionLoading(action);
    try {
      let url = "";
      let method = "POST";

      switch (action) {
        case "pause":
          url = `/api/queue/${emailId}/pause`;
          break;
        case "resume":
          url = `/api/queue/${emailId}/resume`;
          break;
        case "send_now":
          url = `/api/queue/${emailId}/send-now`;
          break;
        case "cancel":
          url = `/api/queue/${emailId}/cancel`;
          break;
        case "delete":
          method = "DELETE";
          url = `/api/queue/${emailId}`;
          break;
      }

      const options: RequestInit = {
        method,
        headers: { "Content-Type": "application/json" },
      };

      const res = await fetch(url, options);
      const json = await res.json();

      if (json.success) {
        // Refresh queue data and close modal if deleted
        await fetchQueue(true);
        if (action === "delete") {
          setModalOpen(false);
          setSelectedEmail(null);
        } else {
          // Update selected email with new data
          setSelectedEmail(json.data || selectedEmail);
        }
      } else {
        alert(json.error || "Action failed");
      }
    } catch (err: any) {
      alert(err.message || "Action failed");
    } finally {
      setActionLoading(null);
    }
  };

  const handleProcessorAction = async (
    action: "start" | "stop" | "pause" | "resume" | "cancel-all",
  ) => {
    setProcessorLoading(true);
    try {
      const res = await fetch(`/api/queue/batch-processor?action=${action}`);
      const json = await res.json();

      if (json.success) {
        // Refresh processor status
        if (action === "start") {
          // Give it a moment to start
          await new Promise((resolve) => setTimeout(resolve, 500));
          const statusRes = await fetch(
            "/api/queue/batch-processor?action=status",
          );
          const statusJson = await statusRes.json();
          if (statusJson.success) {
            setProcessorState(statusJson.state);
          }
        } else {
          // Update local state immediately for stop/pause/resume
          if (action === "stop") {
            setProcessorState((prev) => ({
              ...prev,
              running: false,
              stopped: true,
            }));
          } else if (action === "pause") {
            setProcessorState((prev) => ({ ...prev, paused: true }));
          } else if (action === "resume") {
            setProcessorState((prev) => ({ ...prev, paused: false }));
          }
        }

        // Refresh queue to see updated statuses
        await fetchQueue(true);
        alert(json.message || "Action completed");
      } else {
        alert(json.error || "Action failed");
      }
    } catch (err: any) {
      alert(err.message || "Action failed");
    } finally {
      setProcessorLoading(false);
    }
  };

  const handleBulkAction = async (action: string, recipientEmail: string) => {
    setBulkActionLoading(recipientEmail);
    try {
      const confirmMessages = {
        delete_all: `Delete ALL emails for ${recipientEmail}? This cannot be undone.`,
        stop_all: `Stop all pending emails for ${recipientEmail}?`,
        cancel_all: `Cancel all queued emails for ${recipientEmail}?`,
        delete_sent: `Delete all sent emails for ${recipientEmail}?`,
        delete_failed: `Delete all failed emails for ${recipientEmail}?`,
      };

      if (!confirm(confirmMessages[action as keyof typeof confirmMessages])) {
        return;
      }

      const res = await fetch("/api/queue/bulk-actions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, recipientEmail }),
      });

      const json = await res.json();

      if (json.success) {
        await fetchQueue(true);
        alert(json.message || "Action completed successfully");
      } else {
        alert(json.error || "Action failed");
      }
    } catch (err: any) {
      alert(err.message || "Action failed");
    } finally {
      setBulkActionLoading(null);
    }
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div className="flex items-center justify-between">
        <div className="space-y-1">
          <h2 className="text-3xl font-bold tracking-tight">Email History</h2>
          <p className="text-muted-foreground">
            View all email sending history grouped by contact and sequence
          </p>
        </div>
        <Button
          variant="outline"
          className="gap-2"
          <RefreshCw className={cn("h-4 w-4", refreshing && "animate-spin")} />
          Refresh
        </Button>
      </div>

      {/* Stats Summary */}
      <div className="grid grid-cols-2 md:grid-cols-6 gap-4">
        <StatCard
          title="Contacts"
          value={stats.contacts}
          color="bg-gray-500/10 text-gray-500 border-gray-500/20"
          icon={Users}
        />
        <StatCard
          title="Total Emails"
          value={stats.total}
          color="bg-blue-500/10 text-blue-500 border-blue-500/20"
          icon={Mail}
        />
        <StatCard
          title="Sent"
          value={stats.sent}
          color="bg-emerald-500/10 text-emerald-500 border-emerald-500/20"
          icon={CheckCircle2}
        />
        <StatCard
          title="Failed"
          value={stats.failed}
          color="bg-destructive/10 text-destructive border-destructive/20"
          icon={XCircle}
        />
        <StatCard
          title="Queued"
          value={stats.queued}
          color="bg-amber-500/10 text-amber-500 border-amber-500/20"
          icon={Clock}
        />
        <StatCard
          title="Sending"
          value={stats.sending}
          color="bg-purple-500/10 text-purple-500 border-purple-500/20"
          icon={TrendingUp}
        />
      </div>

      {/* Queue Control Panel */}
      <Card className="border-primary/20">
        <CardHeader className="bg-gradient-to-r from-primary/5 to-primary/10  px-6 rounded">
          <div className="flex items-start justify-between">
            <div className="space-y-1">
              <CardTitle className="flex items-center gap-2 text-xl">
                <Send className="h-5 w-5 text-primary" />
                Queue Control Panel
              </CardTitle>
              <CardDescription className="text-sm">
                Automated batch processing with intelligent scheduling
              </CardDescription>
            </div>
            {processorState.running && (
              <Badge
                variant={processorState.paused ? "outline" : "default"}
                className="gap-1.5">
                <div
                  className={cn(
                    "h-2 w-2 rounded-full",
                    processorState.paused
                      ? "bg-amber-500"
                      : "bg-green-500 animate-pulse",
                  )}
                />
                <span className="font-medium">
                  {processorState.paused ? "Paused" : "Running"}
                </span>
              </Badge>
            )}
          </div>
        </CardHeader>
        <CardContent className="pt-6">
          <div className="space-y-6">
            {/* Top Row: Mode & Controls */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {/* Queue Mode Card */}
              <div className="p-4 bg-muted/30 rounded-xl border space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Globe className="h-4 w-4 text-primary" />
                    <span className="font-semibold text-sm">
                      Processing Mode
                    </span>
                  </div>
                  <Badge
                    variant={queueMode === "auto" ? "default" : "secondary"}
                    className="text-xs">
                    {queueMode === "auto" ? "Automatic" : "Manual"}
                  </Badge>
                </div>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  {queueMode === "auto"
                    ? 'Auto-processes emails every 5 minutes'
                    : 'Manual: Click "Start Queue" to begin processing'}
                </p>
                {queueMode === "auto" && countdown && (
                  <div className="flex items-center gap-2 px-3 py-2 bg-primary/5 rounded-lg border border-primary/10">
                    <Clock className="h-3.5 w-3.5 text-primary" />
                    <span className="text-xs font-medium text-primary">
                      Next batch: {countdown}
                    </span>
                  </div>
                )}
                <div className="flex items-center gap-2 pt-2">
                  <Button
                    onClick={handleQueueModeToggle}
                    disabled={queueModeLoading}
                    variant={queueMode === "auto" ? "default" : "outline"}
                    size="sm"
                    className={cn(
                      "gap-1.5 text-xs h-8 w-full",
                      queueMode === "auto"
                        ? "bg-green-600 hover:bg-green-700"
                        : "",
                    )}>
                    {queueModeLoading ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : queueMode === "auto" ? (
                      <>
                        <CheckCircle2 className="h-3.5 w-3.5" />
                        Switch to Manual
                      </>
                    ) : (
                      <>
                        <Zap className="h-3.5 w-3.5" />
                        Switch to Auto
                      </>
                    )}
                  </Button>
                </div>
              </div>

              {/* Control Actions Card */}
              <div className="p-4 bg-muted/30 rounded-xl border space-y-3">
                <div className="flex items-center gap-2">
                  <Settings className="h-4 w-4 text-primary" />
                  <span className="font-semibold text-sm">Queue Controls</span>
                </div>

                {queueMode === 'auto' ? (
                  // Auto mode info
                  <div className="px-3 py-3 bg-primary/5 rounded-lg border border-primary/10">
                    <div className="flex items-start gap-2">
                      <CheckCircle2 className="h-4 w-4 text-primary mt-0.5 shrink-0" />
                      <div className="flex-1">
                        <p className="text-xs font-medium text-primary">
                          Auto Mode Active
                        </p>
                        <p className="text-xs text-muted-foreground mt-1">
                          Emails are processed automatically every {queueInterval} minutes via cron job.
                          <br />
                          No manual intervention needed.
                        </p>
                      </div>
                    </div>
                  </div>
                ) : (
                  // Manual mode controls
                  <div className="grid grid-cols-2 gap-2">
                    {!processorState.running || processorState.stopped ? (
                      <Button
                        onClick={() => handleProcessorAction("start")}
                        disabled={processorLoading}
                        className="col-span-2 gap-2 bg-green-600 hover:bg-green-700 h-10">
                        {processorLoading ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <>
                            <Play className="h-4 w-4" />
                            Start Queue for Today
                          </>
                        )}
                      </Button>
                    ) : (
                      <>
                        <Button
                          onClick={() => handleProcessorAction("pause")}
                          disabled={processorLoading || processorState.paused}
                          variant="outline"
                          className="gap-1.5 h-9 text-xs">
                          {processorLoading ? (
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          ) : (
                            <>
                              <Pause className="h-3.5 w-3.5" />
                              Pause
                            </>
                          )}
                        </Button>
                        <Button
                          onClick={() => handleProcessorAction("resume")}
                          disabled={processorLoading || !processorState.paused}
                          variant="outline"
                          className="gap-1.5 h-9 text-xs">
                          {processorLoading ? (
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          ) : (
                            <>
                              <Play className="h-3.5 w-3.5" />
                              Resume
                            </>
                          )}
                        </Button>
                        <Button
                          onClick={() => handleProcessorAction("stop")}
                          disabled={processorLoading}
                          variant="outline"
                          className="gap-1.5 h-9 text-xs text-destructive hover:text-destructive">
                          {processorLoading ? (
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          ) : (
                            <>
                              <StopCircle className="h-3.5 w-3.5" />
                              Stop
                            </>
                          )}
                        </Button>
                        <Button
                          onClick={() => {
                            if (
                              confirm(
                                "Are you sure you want to cancel ALL queued emails for today? This cannot be undone.",
                              )
                            ) {
                              handleProcessorAction("cancel-all");
                            }
                          }}
                          disabled={processorLoading}
                          variant="outline"
                          className="gap-1.5 h-9 text-xs text-destructive hover:text-destructive">
                          {processorLoading ? (
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          ) : (
                            <>
                              <Trash2 className="h-3.5 w-3.5" />
                              Cancel All
                            </>
                          )}
                        </Button>
                      </>
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* Live Stats - Always Visible */}
            <div className="p-4 bg-muted/30 rounded-xl border">
              <div className="flex items-center gap-2 mb-3">
                <BarChart3 className="h-4 w-4 text-primary" />
                <span className="font-semibold text-sm">
                  Processing Statistics
                </span>
              </div>
              {processorState.running ? (
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3">
                  <div className="text-center p-3 bg-background rounded-lg">
                    <p className="text-[10px] text-muted-foreground uppercase tracking-wide font-medium">
                      Status
                    </p>
                    <div className="flex items-center justify-center gap-1.5 mt-1">
                      <div
                        className={cn(
                          "h-2 w-2 rounded-full",
                          processorState.paused
                            ? "bg-amber-500"
                            : "bg-green-500",
                          !processorState.paused && "animate-pulse",
                        )}
                      />
                      <p className="text-sm font-bold">
                        {processorState.paused ? "Paused" : "Active"}
                      </p>
                    </div>
                  </div>
                  <div className="text-center p-3 bg-background rounded-lg">
                    <p className="text-[10px] text-muted-foreground uppercase tracking-wide font-medium">
                      Batch
                    </p>
                    <p className="text-lg font-bold text-primary mt-1">
                      {processorState.currentBatch}
                    </p>
                  </div>
                  <div className="text-center p-3 bg-background rounded-lg">
                    <p className="text-[10px] text-muted-foreground uppercase tracking-wide font-medium">
                      Processed
                    </p>
                    <p className="text-lg font-bold mt-1">
                      {processorState.totalProcessed}
                    </p>
                  </div>
                  <div className="text-center p-3 bg-background rounded-lg">
                    <p className="text-[10px] text-muted-foreground uppercase tracking-wide font-medium">
                      Sent
                    </p>
                    <p className="text-lg font-bold text-green-600 mt-1">
                      {processorState.totalSent}
                    </p>
                  </div>
                  <div className="text-center p-3 bg-background rounded-lg">
                    <p className="text-[10px] text-muted-foreground uppercase tracking-wide font-medium">
                      Failed
                    </p>
                    <p className="text-lg font-bold text-destructive mt-1">
                      {processorState.totalFailed}
                    </p>
                  </div>
                </div>
              ) : (
                <div className="text-center py-6 text-muted-foreground">
                  <Clock className="h-8 w-8 mx-auto mb-2 opacity-50" />
                  <p className="text-sm font-medium">Queue not running</p>
                  <p className="text-xs">
                    Start the queue to see live statistics
                  </p>
                </div>
              )}
            </div>

            {/* Processing Rules - Collapsible */}
            <Collapsible>
              <CollapsibleTrigger className="flex items-center gap-2 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors w-full">
                <Info className="h-4 w-4" />
                <span>View Processing Rules</span>
                <ChevronDown className="h-4 w-4 ml-auto" />
              </CollapsibleTrigger>
              <CollapsibleContent className="mt-3">
                <div className="p-4 bg-muted/30 rounded-xl border space-y-2">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div className="flex items-start gap-2">
                      <Calendar className="h-4 w-4 text-primary mt-0.5 shrink-0" />
                      <div>
                        <p className="text-xs font-semibold">Schedule Scope</p>
                        <p className="text-xs text-muted-foreground">
                          Only processes emails scheduled for today
                        </p>
                      </div>
                    </div>
                    <div className="flex items-start gap-2">
                      <Layers className="h-4 w-4 text-primary mt-0.5 shrink-0" />
                      <div>
                        <p className="text-xs font-semibold">
                          Batch Processing
                        </p>
                        <p className="text-xs text-muted-foreground">
                          Sends 5 emails per batch with 1-minute delays
                        </p>
                      </div>
                    </div>
                    <div className="flex items-start gap-2">
                      <Timer className="h-4 w-4 text-primary mt-0.5 shrink-0" />
                      <div>
                        <p className="text-xs font-semibold">Break Interval</p>
                        <p className="text-xs text-muted-foreground">
                          5-minute pause after each batch
                        </p>
                      </div>
                    </div>
                    <div className="flex items-start gap-2">
                      <RefreshCw className="h-4 w-4 text-primary mt-0.5 shrink-0" />
                      <div>
                        <p className="text-xs font-semibold">Sender Rotation</p>
                        <p className="text-xs text-muted-foreground">
                          Round-robin assignment with daily limits
                        </p>
                      </div>
                    </div>
                    <div className="flex items-start gap-2">
                      <Undo2 className="h-4 w-4 text-primary mt-0.5 shrink-0" />
                      <div>
                        <p className="text-xs font-semibold">Retry Logic</p>
                        <p className="text-xs text-muted-foreground">
                          Auto-retries failed emails up to 3 times
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
              </CollapsibleContent>
            </Collapsible>
          </div>
        </CardContent>
      </Card>

      {/* Filters */}
      <Card>
        <CardHeader>
          <div className="flex flex-col md:flex-row md:items-center gap-4 justify-between border-b pb-4 -mx-6 px-6">
            <div className="relative w-full max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <input
                className="w-full bg-muted/40 border border-input rounded-lg pl-10 pr-4 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary"
                placeholder="Search contact email or campaign..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              <FilterButton
                active={statusFilter === "all"}
                onClick={() => setStatusFilter("all")}>
                All
              </FilterButton>
              <FilterButton
                active={statusFilter === "sent"}
                onClick={() => setStatusFilter("sent")}>
                Sent
              </FilterButton>
              <FilterButton
                active={statusFilter === "failed"}
                onClick={() => setStatusFilter("failed")}>
                Failed
              </FilterButton>
              <FilterButton
                active={statusFilter === "queued"}
                onClick={() => setStatusFilter("queued")}>
                Queued
              </FilterButton>
              <FilterButton
                active={statusFilter === "sending"}
                onClick={() => setStatusFilter("sending")}>
                Sending
              </FilterButton>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {loading ? (
            <div className="p-8 space-y-4">
              {[...Array(5)].map((_, i) => (
                <div
                  key={i}
                  className="h-24 bg-muted animate-pulse rounded-lg"
                />
              ))}
            </div>
          ) : contactGroups.length === 0 ? (
            <div className="p-16 text-center">
              <div className="flex flex-col items-center gap-2 opacity-40">
                <Mail className="h-12 w-12" />
                <p className="font-medium text-lg">No emails found</p>
              </div>
            </div>
          ) : (
            <div className="divide-y">
              {contactGroups.map((group) => (
                <ContactCard
                  key={group.email}
                  group={group}
                  isExpanded={expandedContacts.has(group.email)}
                  expandedSequences={expandedSequences}
                  onContactToggle={() => toggleContactExpanded(group.email)}
                  onSequenceToggle={(key) => toggleSequenceExpanded(key)}
                  onEmailClick={async (email) => {
                    setSelectedEmail(email);
                    // Fetch country timezones if not already loaded
                    if (Object.keys(countryTimezones).length === 0) {
                      try {
                        const res = await fetch("/api/countries");
                        const json = await res.json();
                        if (json.success) {
                          const timezoneMap: Record<string, any> = {};
                          json.data.forEach((c: any) => {
                            timezoneMap[c.country_code] = c;
                          });
                          setCountryTimezones(timezoneMap);
                        }
                      } catch (err) {
                        console.error("Failed to load timezones:", err);
                      }
                    }
                    setModalOpen(true);
                  }}
                  formatScheduleDate={formatScheduleDate}
                  onBulkAction={handleBulkAction}
                  bulkActionLoading={bulkActionLoading}
                />
              ))}
            </div>
          )}

          {/* Pagination */}
          {pagination.totalPages > 1 && (
            <div className="flex items-center justify-between p-4 border-t gap-2 bg-muted/5">
              <div className="text-xs text-muted-foreground hidden sm:block">
                Showing <span className="font-medium">{items.length}</span> of{" "}
                <span className="font-medium">{pagination.total}</span> records
              </div>
              <div className="flex items-center gap-1 sm:gap-2 mx-auto sm:mx-0">
                <Button
                  variant="outline"
                  size="sm"
                  className="h-8 gap-1"
                  disabled={pagination.page <= 1}
                  onClick={() => fetchQueue(pagination.page - 1)}>
                  <ChevronUp className="h-4 w-4 -rotate-90" />
                  <span className="hidden xs:inline">Prev</span>
                </Button>

                <div className="flex items-center gap-1 mx-1">
                  {Array.from(
                    { length: Math.min(5, pagination.totalPages) },
                    (_, i) => {
                      let pageNum: number;
                      if (pagination.totalPages <= 5) {
                        pageNum = i + 1;
                      } else if (pagination.page <= 3) {
                        pageNum = i + 1;
                      } else if (pagination.page >= pagination.totalPages - 2) {
                        pageNum = pagination.totalPages - 4 + i;
                      } else {
                        pageNum = pagination.page - 2 + i;
                      }

                      return (
                        <Button
                          key={pageNum}
                          variant={
                            pagination.page === pageNum ? "default" : "outline"
                          }
                          size="icon"
                          className="h-8 w-8 text-xs font-medium"
                          onClick={() => fetchQueue(pageNum)}>
                          {pageNum}
                        </Button>
                      );
                    },
                  )}
                </div>

                <Button
                  variant="outline"
                  size="sm"
                  className="h-8 gap-1"
                  disabled={pagination.page >= pagination.totalPages}
                  onClick={() => fetchQueue(pagination.page + 1)}>
                  <span className="hidden xs:inline">Next</span>
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Email Details Modal */}
      <Dialog open={modalOpen} onOpenChange={setModalOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-xl">Email Details</DialogTitle>
            <DialogDescription>Quick overview and actions</DialogDescription>
          </DialogHeader>
          {selectedEmail && (
            <div className="space-y-4">
              {/* Status Banner - Compact */}
              <div
                className={`p-3 rounded-lg border flex items-center justify-between ${
                  selectedEmail.status === "sent"
                    ? "bg-emerald-500/10 border-emerald-500/20"
                    : selectedEmail.status === "failed"
                      ? "bg-destructive/10 border-destructive/20"
                      : selectedEmail.status === "paused"
                        ? "bg-amber-500/10 border-amber-500/20"
                        : "bg-blue-500/10 border-blue-500/20"
                }`}>
                <div className="flex items-center gap-2">
                  {selectedEmail.status === "sent" && (
                    <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                  )}
                  {selectedEmail.status === "failed" && (
                    <XCircle className="h-4 w-4 text-destructive" />
                  )}
                  {selectedEmail.status === "paused" && (
                    <Pause className="h-4 w-4 text-amber-500" />
                  )}
                  {["pending", "scheduled", "queued", "ready_to_send"].includes(
                    selectedEmail.status,
                  ) && <Clock className="h-4 w-4 text-blue-500" />}
                  {selectedEmail.status === "sending" && (
                    <Loader2 className="h-4 w-4 text-purple-500 animate-spin" />
                  )}
                  <span className="font-medium text-sm capitalize">
                    {selectedEmail.status === "ready_to_send"
                      ? "Ready to Send"
                      : selectedEmail.status.replace(/_/g, " ")}
                  </span>
                </div>
                <QueueStatusBadge status={selectedEmail.status} />
              </div>

              {/* Key Info Grid */}
              <div className="grid grid-cols-2 gap-3">
                {/* Recipient */}
                <div className="p-3 bg-muted/30 rounded-lg border">
                  <div className="flex items-center gap-2 text-muted-foreground text-xs mb-1">
                    <Mail className="h-3 w-3" />
                    <span>To</span>
                  </div>
                  {selectedEmail.recipient_name ? (
                    <>
                      <p className="text-sm font-medium truncate">
                        {selectedEmail.recipient_name}
                      </p>
                      <p className="text-xs text-muted-foreground truncate">
                        {selectedEmail.recipient_email}
                      </p>
                    </>
                  ) : (
                    <p className="text-sm font-medium truncate">
                      {selectedEmail.recipient_email}
                    </p>
                  )}
                </div>

                {/* Subject */}
                <div className="p-3 bg-muted/30 rounded-lg border">
                  <div className="flex items-center gap-2 text-muted-foreground text-xs mb-1">
                    <FileText className="h-3 w-3" />
                    <span>Subject</span>
                  </div>
                  <p
                    className="text-sm font-medium truncate"
                    title={selectedEmail.subject}>
                    {selectedEmail.subject || "No subject"}
                  </p>
                </div>

                {/* Campaign */}
                <div className="p-3 bg-muted/30 rounded-lg border">
                  <div className="flex items-center gap-2 text-muted-foreground text-xs mb-1">
                    <TrendingUp className="h-3 w-3" />
                    <span>Campaign</span>
                  </div>
                  <p className="text-sm font-medium truncate">
                    {selectedEmail.campaign_name || selectedEmail.campaign_id}
                  </p>
                  {selectedEmail.sequence_position && (
                    <p className="text-xs text-muted-foreground">
                      Step {selectedEmail.sequence_position}
                    </p>
                  )}
                </div>

                {/* Status & Date */}
                <div className="p-3 bg-muted/30 rounded-lg border">
                  <div className="flex items-center gap-2 text-muted-foreground text-xs mb-1">
                    <Calendar className="h-3 w-3" />
                    <span>
                      {selectedEmail.status === "sent"
                        ? "Sent"
                        : selectedEmail.scheduled_at
                          ? "Scheduled"
                          : "Status"}
                    </span>
                  </div>
                  <p className="text-sm font-medium">
                    {selectedEmail.sent_at
                      ? new Date(selectedEmail.sent_at).toLocaleDateString()
                      : selectedEmail.scheduled_at
                        ? new Date(
                            selectedEmail.scheduled_at,
                          ).toLocaleDateString()
                        : "Pending"}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {selectedEmail.sent_at
                      ? new Date(selectedEmail.sent_at).toLocaleTimeString([], {
                          hour: "2-digit",
                          minute: "2-digit",
                        })
                      : selectedEmail.scheduled_at
                        ? new Date(
                            selectedEmail.scheduled_at,
                          ).toLocaleTimeString([], {
                            hour: "2-digit",
                            minute: "2-digit",
                          })
                        : "-"}
                  </p>
                </div>

                {/* Attempts */}
                <div className="p-3 bg-muted/30 rounded-lg border">
                  <div className="flex items-center gap-2 text-muted-foreground text-xs mb-1">
                    <RefreshCw className="h-3 w-3" />
                    <span>Attempts</span>
                  </div>
                  <p className="text-sm font-medium">
                    {selectedEmail.attempts} / 3
                  </p>
                  {selectedEmail.attempts > 0 && (
                    <p className="text-xs text-muted-foreground">
                      {selectedEmail.status === "failed" ? "Failed" : "Retried"}
                    </p>
                  )}
                </div>

                {/* Queue ID */}
                <div className="p-3 bg-muted/30 rounded-lg border">
                  <div className="flex items-center gap-2 text-muted-foreground text-xs mb-1">
                    <AlertCircle className="h-3 w-3" />
                    <span>Queue ID</span>
                  </div>
                  <p className="text-xs font-mono text-muted-foreground truncate">
                    {selectedEmail.id}
                  </p>
                </div>
              </div>

              {/* Error Message - Compact */}
              {selectedEmail.error_message && (
                <div className="p-3 bg-destructive/10 border border-destructive/20 rounded-lg">
                  <div className="flex items-start gap-2">
                    <XCircle className="h-4 w-4 text-destructive shrink-0 mt-0.5" />
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-semibold text-destructive mb-1">
                        Error
                      </p>
                      <p className="text-sm text-destructive">
                        {selectedEmail.error_message}
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {/* Historical Record Notice */}
              {selectedEmail.source === 'log' && (
                <div className="p-3 bg-muted/50 border border-muted rounded-lg">
                  <div className="flex items-start gap-2">
                    <Info className="h-4 w-4 text-muted-foreground shrink-0 mt-0.5" />
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-semibold text-muted-foreground mb-1">
                        Historical Record
                      </p>
                      <p className="text-sm text-muted-foreground">
                        This is a permanent historical record of a sent email. It cannot be modified or deleted.
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {/* Action Buttons - Only for queue items (not log items) */}
              {selectedEmail.source !== 'log' && (
                <div className="flex flex-wrap gap-2 pt-2">
                  {["pending", "scheduled"].includes(selectedEmail.status) && (
                  <Button
                    variant="outline"
                    size="sm"
                    className="gap-2"
                    onClick={() => handleEmailAction("pause", selectedEmail.id)}
                    disabled={actionLoading === "pause"}>
                    {actionLoading === "pause" ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Pause className="h-4 w-4" />
                    )}
                    Pause
                  </Button>
                )}

                {selectedEmail.status === "paused" && (
                  <Button
                    variant="outline"
                    size="sm"
                    className="gap-2"
                    onClick={() =>
                      handleEmailAction("resume", selectedEmail.id)
                    }
                    disabled={actionLoading === "resume"}>
                    {actionLoading === "resume" ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Play className="h-4 w-4" />
                    )}
                    Resume
                  </Button>
                )}

                {[
                  "pending",
                  "scheduled",
                  "paused",
                  "queued",
                  "ready_to_send",
                ].includes(selectedEmail.status) &&
                  !["sent", "failed"].includes(selectedEmail.status) && (
                    <Button
                      variant="default"
                      size="sm"
                      className="gap-2"
                      onClick={() =>
                        handleEmailAction("send_now", selectedEmail.id)
                      }
                      disabled={actionLoading === "send_now"}>
                      {actionLoading === "send_now" ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Send className="h-4 w-4" />
                      )}
                      Send Now
                    </Button>
                  )}

                {["pending", "scheduled", "queued", "ready_to_send"].includes(
                  selectedEmail.status,
                ) && (
                  <Button
                    variant="outline"
                    size="sm"
                    className="gap-2"
                    onClick={() => {
                      if (confirm("Cancel this email?")) {
                        handleEmailAction("cancel", selectedEmail.id);
                      }
                    }}
                    disabled={actionLoading === "cancel"}>
                    {actionLoading === "cancel" ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <X className="h-4 w-4" />
                    )}
                    Cancel
                  </Button>
                )}

                {selectedEmail.status !== "sending" && (
                  <Button
                    variant="outline"
                    size="sm"
                    className="gap-2 text-destructive hover:text-destructive ml-auto"
                    onClick={() => {
                      if (confirm("Permanently delete this email?")) {
                        handleEmailAction("delete", selectedEmail.id);
                      }
                    }}
                    disabled={actionLoading === "delete"}>
                    {actionLoading === "delete" ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Trash2 className="h-4 w-4" />
                    )}
                    Delete
                  </Button>
                )}
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function ContactCard({
  group,
  isExpanded,
  expandedSequences,
  onContactToggle,
  onSequenceToggle,
  onEmailClick,
  formatScheduleDate,
  onBulkAction,
  bulkActionLoading,
}: {
  group: ContactGroup;
  isExpanded: boolean;
  expandedSequences: Set<string>;
  onContactToggle: () => void;
  onSequenceToggle: (key: string) => void;
  onEmailClick: (email: QueueItem) => void;
  formatScheduleDate: (
    date: string | null,
  ) => null | { full: string; short: string; relative: string };
  onBulkAction: (action: string, recipientEmail: string) => void;
  bulkActionLoading: string | null;
}) {
  return (
    <div className="hover:bg-muted/30 transition-colors">
      <div
        className="p-4 cursor-pointer flex items-center justify-between gap-4"
        onClick={onContactToggle}>
        <div className="flex items-center gap-4 flex-1 min-w-0">
          <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
            <span className="text-sm font-semibold text-primary">
              {group.email.charAt(0).toUpperCase()}
            </span>
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <p className="font-medium truncate">{group.email}</p>
              {group.name && (
                <span className="text-xs text-muted-foreground">
                  ({group.name})
                </span>
              )}
            </div>
            <div className="flex items-center gap-3 mt-1 flex-wrap">
              <span className="text-xs text-muted-foreground">
                {group.stats.total} email{group.stats.total !== 1 ? "s" : ""}
              </span>
              <span className="text-xs text-emerald-500">
                {group.stats.sent} sent
              </span>
              {group.stats.queued > 0 && (
                <span className="text-xs text-amber-500">
                  {group.stats.queued} queued
                </span>
              )}
              {group.stats.failed > 0 && (
                <span className="text-xs text-destructive">
                  {group.stats.failed} failed
                </span>
              )}
              <span className="text-xs text-muted-foreground">
                {group.campaigns.length} sequence
                {group.campaigns.length !== 1 ? "s" : ""}
              </span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3 shrink-0">
          <SequenceProgressIndicator
            sent={group.stats.sent}
            total={group.stats.total}
          />

          {/* Bulk Actions Dropdown */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="shrink-0"
                onClick={(e) => e.stopPropagation()}>
                {bulkActionLoading === group.email ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <MoreHorizontal className="h-4 w-4" />
                )}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent
              align="end"
              onClick={(e) => e.stopPropagation()}>
              <DropdownMenuItem
                onClick={() => onBulkAction("cancel_all", group.email)}
                disabled={bulkActionLoading === group.email}>
                <X className="h-4 w-4 mr-2" />
                Cancel All Queued
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => onBulkAction("stop_all", group.email)}
                disabled={bulkActionLoading === group.email}>
                <Pause className="h-4 w-4 mr-2" />
                Stop All Pending
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onClick={() => onBulkAction("delete_sent", group.email)}
                disabled={bulkActionLoading === group.email}
                className="text-amber-600">
                <Trash2 className="h-4 w-4 mr-2" />
                Delete Sent Emails
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => onBulkAction("delete_failed", group.email)}
                disabled={bulkActionLoading === group.email}
                className="text-amber-600">
                <Trash2 className="h-4 w-4 mr-2" />
                Delete Failed Emails
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onClick={() => onBulkAction("delete_all", group.email)}
                disabled={bulkActionLoading === group.email}
                className="text-destructive">
                <Trash2 className="h-4 w-4 mr-2" />
                Delete ALL Emails
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          <Button
            variant="ghost"
            size="icon"
            className="shrink-0"
            onClick={(e) => {
              e.stopPropagation();
              onContactToggle();
            }}>
            {isExpanded ? (
              <ChevronUp className="h-4 w-4" />
            ) : (
              <ChevronDown className="h-4 w-4" />
            )}
          </Button>
        </div>
      </div>

      {/* Expanded Sequences */}
      {isExpanded && (
        <div className="border-t bg-muted/20 p-4 space-y-3">
          {Array.from(group.sequences.entries()).map(
            ([campaignId, sequenceEmails]) => {
              const seqKey = `${group.email}-${campaignId}`;
              const isSeqExpanded = expandedSequences.has(seqKey);
              const sentCount = sequenceEmails.filter(
                (e) => e.status === "sent",
              ).length;
              const totalCount = sequenceEmails.length;
              const campaignName =
                group.campaigns.find((c) => c && c.startsWith(campaignId)) ||
                campaignId;

              return (
                <div
                  key={campaignId}
                  className="border rounded-lg bg-background overflow-hidden">
                  <div
                    className="p-3 cursor-pointer hover:bg-muted/50 flex items-center justify-between"
                    onClick={() => onSequenceToggle(seqKey)}>
                    <div className="flex items-center gap-3">
                      <TrendingUp className="h-4 w-4 text-primary" />
                      <span className="font-medium text-sm">
                        {campaignName}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        {sentCount}/{totalCount} emails sent
                      </span>
                    </div>
                    <Button variant="ghost" size="icon" className="h-6 w-6">
                      {isSeqExpanded ? (
                        <ChevronUp className="h-3 w-3" />
                      ) : (
                        <ChevronDown className="h-3 w-3" />
                      )}
                    </Button>
                  </div>

                  {isSeqExpanded && (
                    <div className="border-t p-3 space-y-2">
                      {/* Timeline */}
                      <div className="relative">
                        {/* Vertical line */}
                        <div className="absolute left-2.75 top-2 bottom-2 w-0.5 bg-border" />

                        {sequenceEmails.map((email, idx) => {
                          const schedule = formatScheduleDate(
                            email.scheduled_at,
                          );
                          const isLast = idx === sequenceEmails.length - 1;

                          return (
                            <div
                              key={email.queue_id}
                              className="relative flex gap-3 pb-3 last:pb-0">
                              {/* Status dot on timeline */}
                              <div className="relative z-10 flex flex-col items-center">
                                <StatusDot status={email.status} />
                                {!isLast && (
                                  <div className="w-0.5 h-full bg-border min-h-6" />
                                )}
                              </div>

                              {/* Email card */}
                              <div
                                className="flex-1 min-w-0 p-3 rounded-lg border hover:bg-muted/50 cursor-pointer transition-colors"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  // Find full email item
                                  const fullItem = group.emails.find(
                                    (item) => item.id === email.queue_id,
                                  );
                                  if (fullItem) onEmailClick(fullItem);
                                }}>
                                <div className="flex items-start justify-between gap-2">
                                  <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-2">
                                      <span className="text-xs font-medium text-muted-foreground">
                                        Email {email.position}
                                      </span>
                                      <QueueStatusBadge status={email.status} />
                                    </div>
                                    <p className="text-sm font-medium truncate mt-1">
                                      {email.subject}
                                    </p>
                                    {email.status !== "sent" &&
                                      email.status !== "failed" &&
                                      email.scheduled_at && (
                                        <p className="text-xs text-muted-foreground mt-1">
                                          {new Date(email.scheduled_at).toLocaleString()}
                                        </p>
                                      )}
                                  </div>
                                  {email.status !== "sent" &&
                                    email.status !== "failed" &&
                                    email.scheduled_at && (
                                      <div className="text-right shrink-0">
                                        <p className="text-xs text-muted-foreground">
                                          Scheduled
                                        </p>
                                        <p className="text-sm font-medium">
                                          {new Date(email.scheduled_at).toLocaleDateString()}
                                        </p>
                                        <p className="text-xs text-muted-foreground">
                                          {new Date(email.scheduled_at).toLocaleTimeString([], {
                                            hour: "2-digit",
                                            minute: "2-digit",
                                          })}
                                        </p>
                                      </div>
                                    )}
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              );
            },
          )}
        </div>
      )}
    </div>
  );
}

function StatusDot({ status }: { status: QueueItem["status"] }) {
  const s = status.toLowerCase();
  if (s === "sent")
    return (
      <div className="h-6 w-6 rounded-full bg-emerald-500 flex items-center justify-center">
        <CheckCircle2 className="h-3 w-3 text-white" />
      </div>
    );
  if (s === "failed")
    return (
      <div className="h-6 w-6 rounded-full bg-destructive flex items-center justify-center">
        <XCircle className="h-3 w-3 text-white" />
      </div>
    );
  if (s === "paused")
    return (
      <div className="h-6 w-6 rounded-full bg-amber-500 flex items-center justify-center">
        <Pause className="h-3 w-3 text-white" />
      </div>
    );
  return (
    <div className="h-6 w-6 rounded-full bg-blue-500 flex items-center justify-center">
      <Clock className="h-3 w-3 text-white" />
    </div>
  );
}

function SequenceProgressIndicator({
  sent,
  total,
}: {
  sent: number;
  total: number;
}) {
  const percent = total > 0 ? Math.round((sent / total) * 100) : 0;

  return (
    <div className="hidden sm:block w-24">
      <div className="h-2 bg-muted rounded-full overflow-hidden">
        <div
          className="h-full bg-primary transition-all"
          style={{ width: `${percent}%` }}
        />
      </div>
      <p className="text-xs text-muted-foreground mt-1 text-center">
        {sent}/{total}
      </p>
    </div>
  );
}

function StatCard({
  title,
  value,
  color,
  icon: Icon,
}: {
  title: string;
  value: number;
  color: string;
  icon: any;
}) {
  return (
    <Card className={cn(color)}>
      <CardContent className="p-4">
        <div className="flex items-center gap-2">
          <Icon className="h-4 w-4" />
          <div>
            <p className="text-xs font-medium uppercase opacity-70">{title}</p>
            <p className="text-xl font-bold">{value}</p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function FilterButton({
  children,
  active,
  onClick,
}: {
  children: React.ReactNode;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <Button
      variant={active ? "default" : "outline"}
      size="sm"
      onClick={onClick}
      className="h-8">
      {children}
    </Button>
  );
}

function QueueStatusBadge({ status }: { status: string }) {
  const s = status.toLowerCase();
  if (s === "sent")
    return (
      <span className="bg-emerald-500/10 text-emerald-500 border border-emerald-500/20 px-2 py-0.5 rounded-full text-xs font-semibold">
        Sent
      </span>
    );
  if (s === "failed")
    return (
      <span className="bg-destructive/10 text-destructive border border-destructive/20 px-2 py-0.5 rounded-full text-xs font-semibold">
        Failed
      </span>
    );
  if (s === "cancelled")
    return (
      <span className="bg-muted text-muted-foreground border px-2 py-0.5 rounded-full text-xs font-semibold">
        Cancelled
      </span>
    );
  if (s === "paused")
    return (
      <span className="bg-amber-500/10 text-amber-500 border border-amber-500/20 px-2 py-0.5 rounded-full text-xs font-semibold">
        Paused
      </span>
    );
  if (
    s === "pending" ||
    s === "queued" ||
    s === "scheduled" ||
    s === "ready_to_send"
  )
    return (
      <span className="bg-blue-500/10 text-blue-500 border border-blue-500/20 px-2 py-0.5 rounded-full text-xs font-semibold">
        Queued
      </span>
    );
  if (s === "sending")
    return (
      <span className="bg-purple-500/10 text-purple-500 border border-purple-500/20 px-2 py-0.5 rounded-full text-xs font-semibold">
        Sending
      </span>
    );
  return (
    <span className="bg-muted text-muted-foreground border px-2 py-0.5 rounded-full text-xs font-semibold uppercase">
      {status}
    </span>
  );
}

function ScheduleDetailRow({
  scheduledAt,
  countryCode,
  countryTimezones,
}: {
  scheduledAt: string;
  countryCode?: string;
  countryTimezones: Record<string, any>;
}) {
  const scheduledDate = new Date(scheduledAt);
  const now = new Date();
  const countryInfo = countryCode
    ? countryTimezones[countryCode.toUpperCase()]
    : null;

  // Get local time in recipient's timezone
  const localTime = countryInfo
    ? scheduledDate.toLocaleString("en-US", {
        timeZone: countryInfo.default_timezone,
        weekday: "short",
        month: "short",
        day: "numeric",
        hour: "numeric",
        minute: "2-digit",
      })
    : null;

  // Check if weekend
  const dayName = countryInfo
    ? new Date(
        scheduledDate.toLocaleString("en-US", {
          timeZone: countryInfo.default_timezone,
        }),
      ).toLocaleString("en-US", { weekday: "long" })
    : null;
  const isWeekend =
    countryInfo && dayName && countryInfo.weekend_days.includes(dayName);

  // Check business hours
  let isWithinHours = false;
  if (countryInfo) {
    const [startHours] = countryInfo.business_hours_start
      .split(":")
      .map(Number);
    const [endHours] = countryInfo.business_hours_end.split(":").map(Number);
    const countryDate = new Date(
      scheduledDate.toLocaleString("en-US", {
        timeZone: countryInfo.default_timezone,
      }),
    );
    const currentHour = countryDate.getHours();
    isWithinHours = currentHour >= startHours && currentHour < endHours;
  }

  // Calculate countdown
  const diffMs = scheduledDate.getTime() - now.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  const diffHours = Math.floor(
    (diffMs % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60),
  );
  const diffMins = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));

  const countdown =
    diffDays > 0
      ? `${diffDays}d ${diffHours}h ${diffMins}m`
      : diffHours > 0
        ? `${diffHours}h ${diffMins}m`
        : `${diffMins}m`;

  return (
    <div className="space-y-2 p-4 bg-muted/30 rounded-lg border">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <Calendar className="h-4 w-4 text-primary" />
          <span className="text-sm font-medium">When This Email Will Send</span>
        </div>
        <div className="flex items-center gap-2">
          {isWeekend ? (
            <span className="text-xs bg-amber-500/10 text-amber-600 px-2 py-0.5 rounded flex items-center gap-1">
              <AlertTriangle className="h-3 w-3" />
              Weekend
            </span>
          ) : isWithinHours ? (
            <span className="text-xs bg-emerald-500/10 text-emerald-600 px-2 py-0.5 rounded flex items-center gap-1">
              <CheckCircle2 className="h-3 w-3" />
              Business Hours
            </span>
          ) : (
            <span className="text-xs bg-amber-500/10 text-amber-600 px-2 py-0.5 rounded flex items-center gap-1">
              <AlertCircle className="h-3 w-3" />
              Outside Hours
            </span>
          )}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 text-xs">
        <div>
          <p className="text-muted-foreground mb-1">Your Time Zone</p>
          <p className="font-medium text-sm">
            {scheduledDate.toLocaleDateString() === now.toLocaleDateString()
              ? `Today, ${scheduledDate.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`
              : scheduledDate.toLocaleDateString([], {
                  weekday: "short",
                  month: "short",
                  day: "numeric",
                })}
          </p>
          <p className="text-muted-foreground">
            {scheduledDate.toLocaleTimeString([], {
              hour: "2-digit",
              minute: "2-digit",
            })}
          </p>
        </div>

        {localTime && countryInfo && (
          <div>
            <p className="text-muted-foreground mb-1">
              Recipient's Local Time ({countryInfo.country_name})
            </p>
            <p className="font-medium text-sm">{localTime}</p>
            <p className="text-muted-foreground">
              {dayName && (
                <span className={isWeekend ? "text-amber-600" : ""}>
                  {dayName}
                </span>
              )}
            </p>
          </div>
        )}
      </div>

      <div className="pt-2 border-t mt-2">
        <div className="flex items-center justify-between text-xs">
          <span className="text-muted-foreground">Time until send:</span>
          <span className="font-mono font-medium">
            {diffMs > 0 ? countdown : "Sending now..."}
          </span>
        </div>
      </div>
    </div>
  );
}

function DetailRow({
  icon: Icon,
  label,
  value,
  className,
}: {
  icon: any;
  label: string;
  value: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex items-start gap-3", className)}>
      <Icon className="h-4 w-4 text-muted-foreground mt-0.5" />
      <div className="flex-1">
        <p className="text-xs text-muted-foreground mb-1">{label}</p>
        <p className="text-sm font-medium">{value}</p>
      </div>
    </div>
  );
}

function User({ className }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}>
      <path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2" />
      <circle cx="12" cy="7" r="4" />
    </svg>
  );
}
