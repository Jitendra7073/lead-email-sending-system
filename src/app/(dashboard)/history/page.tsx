"use client";

import * as React from "react";
import {
  Search,
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
  MoreHorizontal,
  AlertCircle,
  Pause,
  Play,
  X,
  Send,
  Trash2,
  Loader2,
  Layers,
  Timer,
  Undo2,
  Zap,
  Info,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
} from "@/components/ui/card";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { useState } from "react";
import { cn } from "@/lib/utils";
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
import { BullMqJobsPanel } from "@/components/dashboard/bullmq-jobs-panel";

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

type CountryTimezoneInfo = {
  country_code: string;
  country_name: string;
  default_timezone: string;
  weekend_days: string[];
  business_hours_start: string;
  business_hours_end: string;
};

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
    Record<string, CountryTimezoneInfo>
  >({});
  const [pagination, setPagination] = useState({
    total: 0,
    page: 1,
    limit: 200,
    totalPages: 1,
  });

  // Bulk actions state
  const [bulkActionLoading, setBulkActionLoading] = useState<string | null>(
    null,
  );

  // Global actions state
  const [globalActionLoading, setGlobalActionLoading] = useState<string | null>(null);

  const fetchQueue = React.useCallback(async (page = 1, quiet = false) => {
    if (!quiet) setLoading(true);
    else setRefreshing(true);

    try {
      const statusParam = statusFilter !== "all" ? `&status=${statusFilter}` : "";
      const limit = pagination.limit;
      const offset = (page - 1) * limit;
      const res = await fetch(`/api/queue?limit=${limit}&offset=${offset}${statusParam}`);
      const json = (await res.json()) as {
        success: boolean;
        data?: QueueItem[];
        pagination?: { total: number; totalPages: number };
      };
      if (json.success) {
        setItems(json.data ?? []);
        const pagination = json.pagination;
        if (pagination) {
          setPagination((prev) => ({
            ...prev,
            total: pagination.total,
            page: page,
            totalPages: pagination.totalPages,
          }));
        }
      }
    } catch (err) {
      console.error(err);
    } finally {
      if (!quiet) setLoading(false);
      setRefreshing(false);
    }
  }, [pagination.limit, statusFilter]);

  React.useEffect(() => {
    fetchQueue(1);
  }, [fetchQueue]);

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
        await fetchQueue(pagination.page, true);
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
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : "Action failed");
    } finally {
      setActionLoading(null);
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
        await fetchQueue(pagination.page, true);
        alert(json.message || "Action completed successfully");
      } else {
        alert(json.error || "Action failed");
      }
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : "Action failed");
    } finally {
      setBulkActionLoading(null);
    }
  };

  const handleGlobalAction = async (action: string, confirmMsg: string) => {
    if (!confirm(confirmMsg)) return;
    setGlobalActionLoading(action);
    try {
      const res = await fetch("/api/queue/global-actions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });
      const json = await res.json();
      if (json.success) {
        await fetchQueue(pagination.page, true);
        alert(`${json.message} (${json.affectedCount} emails affected)`);
      } else {
        alert(json.error || "Action failed");
      }
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : "Action failed");
    } finally {
      setGlobalActionLoading(null);
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
          onClick={() => fetchQueue(pagination.page, true)}
          disabled={refreshing}>
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

      <BullMqJobsPanel />

      <div className="space-y-6">
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

        {/* Global Queue Actions */}
        <div className="p-4 bg-muted/30 rounded-xl border space-y-3">
          <div className="flex items-center gap-2">
            <Zap className="h-4 w-4 text-primary" />
            <span className="font-semibold text-sm">Global Queue Actions</span>
            <span className="text-xs text-muted-foreground ml-1">— applied to all emails in queue</span>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            <Button
              variant="outline"
              size="sm"
              className="gap-1.5 h-9 text-xs"
              disabled={!!globalActionLoading}
              onClick={() => handleGlobalAction("pause_all_pending", "Pause ALL pending/scheduled emails in the queue?")}>
              {globalActionLoading === "pause_all_pending" ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Pause className="h-3.5 w-3.5" />
              )}
              Pause All Pending
            </Button>

            <Button
              variant="outline"
              size="sm"
              className="gap-1.5 h-9 text-xs"
              disabled={!!globalActionLoading}
              onClick={() => handleGlobalAction("resume_all_paused", "Resume ALL paused emails in the queue?")}>
              {globalActionLoading === "resume_all_paused" ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Play className="h-3.5 w-3.5" />
              )}
              Resume All Paused
            </Button>

            <Button
              variant="outline"
              size="sm"
              className="gap-1.5 h-9 text-xs"
              disabled={!!globalActionLoading}
              onClick={() => handleGlobalAction("retry_all_failed", "Retry ALL failed emails in the queue?")}>
              {globalActionLoading === "retry_all_failed" ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Undo2 className="h-3.5 w-3.5" />
              )}
              Retry All Failed
            </Button>

            <Button
              variant="outline"
              size="sm"
              className="gap-1.5 h-9 text-xs text-destructive hover:text-destructive"
              disabled={!!globalActionLoading}
              onClick={() => handleGlobalAction("cancel_all_queued", "Cancel ALL queued/pending emails? This cannot be undone.")}>
              {globalActionLoading === "cancel_all_queued" ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <X className="h-3.5 w-3.5" />
              )}
              Cancel All Queued
            </Button>

            <Button
              variant="outline"
              size="sm"
              className="gap-1.5 h-9 text-xs text-amber-600 hover:text-amber-600"
              disabled={!!globalActionLoading}
              onClick={() => handleGlobalAction("delete_all_failed", "Permanently delete ALL failed emails from the queue?")}>
              {globalActionLoading === "delete_all_failed" ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Trash2 className="h-3.5 w-3.5" />
              )}
              Delete All Failed
            </Button>

            <Button
              variant="outline"
              size="sm"
              className="gap-1.5 h-9 text-xs text-amber-600 hover:text-amber-600"
              disabled={!!globalActionLoading}
              onClick={() => handleGlobalAction("delete_all_cancelled", "Permanently delete ALL cancelled emails from the queue?")}>
              {globalActionLoading === "delete_all_cancelled" ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Trash2 className="h-3.5 w-3.5" />
              )}
              Delete All Cancelled
            </Button>
          </div>
        </div>
      </div>
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
                        const json = (await res.json()) as {
                          success: boolean;
                          data?: CountryTimezoneInfo[];
                        };
                        if (json.success) {
                          const timezoneMap: Record<string, CountryTimezoneInfo> = {};
                          (json.data ?? []).forEach((c) => {
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
                className={`p-3 rounded-lg border flex items-center justify-between ${selectedEmail.status === "sent"
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

                  {[
                    "pending",
                    "scheduled",
                    "paused",
                    "queued",
                    "ready_to_send",
                  ].includes(selectedEmail.status) && (
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
    </div >
  );
}

function ContactCard({
  group,
  isExpanded,
  expandedSequences,
  onContactToggle,
  onSequenceToggle,
  onEmailClick,
  onBulkAction,
  bulkActionLoading,
}: {
  group: ContactGroup;
  isExpanded: boolean;
  expandedSequences: Set<string>;
  onContactToggle: () => void;
  onSequenceToggle: (key: string) => void;
  onEmailClick: (email: QueueItem) => void;
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
  icon: React.ComponentType<{ className?: string }>;
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
