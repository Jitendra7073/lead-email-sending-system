"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  RefreshCw, Mail, Reply, Clock, User, Filter, X, Trash2,
  Send, Check, Search, MessageSquare, RotateCcw,
} from "lucide-react";
import { format } from "date-fns";

// ─── Types ────────────────────────────────────────────────────────────────────

interface EmailReply {
  id: string; queue_id: string; message_id: string; reply_message_id: string;
  from_email: string; from_name: string; subject: string; body: string;
  received_at: string; processed: boolean; thread_id?: string;
  in_reply_to: string; is_reply: boolean; recipient_email: string; original_subject: string;
}

interface SentEmail {
  id: string; message_id: string; recipient_email: string; recipient_name: string;
  subject: string; sent_at: string; html_content: string;
  campaign_id: string | null; campaign_name: string | null;
  sender_id: string | null; sender_name: string | null; sender_email: string | null;
  reply_count: number;
}

interface Campaign { id: string; name: string; }
interface Sender { id: string; name: string; email: string; }
interface RecipientOption { email: string; emailCount: number; }

interface SentFilters {
  startDate: string; endDate: string; recipientEmail: string;
  campaignId: string; senderId: string; subject: string; hasReplies: string;
}

const EMPTY_SENT_FILTERS: SentFilters = {
  startDate: "", endDate: "", recipientEmail: "",
  campaignId: "", senderId: "", subject: "", hasReplies: "",
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

const fmt = (d: string) => format(new Date(d), "MMM dd, yyyy HH:mm");
const preview = (t: string, max = 100) => t.length > max ? t.slice(0, max) + "…" : t;
const activeFilterCount = (f: SentFilters) =>
  Object.values(f).filter(Boolean).length;

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function EmailRepliesPage() {
  const [activeTab, setActiveTab] = useState<"replies" | "sent">("replies");

  // Replies
  const [replies, setReplies] = useState<EmailReply[]>([]);
  const [selectedReply, setSelectedReply] = useState<EmailReply | null>(null);
  const [repliesLoading, setRepliesLoading] = useState(true);

  // Sent
  const [sentEmails, setSentEmails] = useState<SentEmail[]>([]);
  const [selectedSent, setSelectedSent] = useState<SentEmail | null>(null);
  const [sentLoading, setSentLoading] = useState(false);
  const [sentTotal, setSentTotal] = useState(0);

  // Sent filters
  const [sentFilters, setSentFilters] = useState<SentFilters>(EMPTY_SENT_FILTERS);
  const [showSentFilters, setShowSentFilters] = useState(false);
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [senders, setSenders] = useState<Sender[]>([]);
  const [recipients, setRecipients] = useState<RecipientOption[]>([]);
  const [recipientSearch, setRecipientSearch] = useState("");
  const [showRecipientDrop, setShowRecipientDrop] = useState(false);
  const recipientRef = useRef<HTMLDivElement>(null);

  // Check replies
  const [isChecking, setIsChecking] = useState(false);
  const [checkMsg, setCheckMsg] = useState("");

  // ── Setters ──────────────────────────────────────────────────────────────────

  const setSF = (key: keyof SentFilters, val: string) =>
    setSentFilters((prev) => ({ ...prev, [key]: val }));

  // ── Fetchers ─────────────────────────────────────────────────────────────────

  const fetchReplies = useCallback(async () => {
    setRepliesLoading(true);
    try {
      const res = await fetch("/api/email-replies?limit=100");
      const json = await res.json();
      if (json.success) {
        setReplies(
          Array.from(new Map(json.data.map((r: EmailReply) => [r.id, r])).values()) as EmailReply[]
        );
      }
    } finally { setRepliesLoading(false); }
  }, []);

  const fetchSentEmails = useCallback(async (filters: SentFilters) => {
    setSentLoading(true);
    try {
      const p = new URLSearchParams({ limit: "100" });
      if (filters.startDate) p.set("startDate", filters.startDate);
      if (filters.endDate) p.set("endDate", filters.endDate);
      if (filters.recipientEmail) p.set("recipientEmail", filters.recipientEmail);
      if (filters.campaignId) p.set("campaignId", filters.campaignId);
      if (filters.senderId) p.set("senderId", filters.senderId);
      if (filters.subject) p.set("subject", filters.subject);
      if (filters.hasReplies) p.set("hasReplies", filters.hasReplies);
      const res = await fetch(`/api/email-replies/sent-emails?${p}`);
      const json = await res.json();
      if (json.success) { setSentEmails(json.data); setSentTotal(json.total); }
    } finally { setSentLoading(false); }
  }, []);

  const fetchMeta = useCallback(async () => {
    const [cRes, sRes, rRes] = await Promise.all([
      fetch("/api/campaigns"),
      fetch("/api/senders"),
      fetch("/api/email-replies/recipients"),
    ]);
    const [cJson, sJson, rJson] = await Promise.all([cRes.json(), sRes.json(), rRes.json()]);
    if (cJson.success) setCampaigns(cJson.data);
    if (sJson.success) setSenders(sJson.data);
    if (rJson.success) setRecipients(rJson.recipients);
  }, []);

  // ── Check for new replies ─────────────────────────────────────────────────────

  const checkForNewReplies = async () => {
    setIsChecking(true);
    setCheckMsg("Checking inbox for replies…");
    try {
      const res = await fetch("/api/email-replies/check-replies", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ force: true }),
      });
      const json = await res.json();
      if (json.success && json.details) {
        const { newRepliesProcessed, unreadRepliesFound } = json.details;
        setCheckMsg(`Done — scanned ${unreadRepliesFound} messages, saved ${newRepliesProcessed} new replies.`);
        fetchReplies();
      } else {
        setCheckMsg(json.error || "Check failed.");
      }
    } catch (e: any) {
      setCheckMsg(e.message || "Check failed.");
    } finally {
      setIsChecking(false);
      setTimeout(() => setCheckMsg(""), 5000);
    }
  };

  // ── Delete reply ──────────────────────────────────────────────────────────────

  const deleteReply = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    if (!confirm("Delete this reply?")) return;
    const res = await fetch(`/api/email-replies/${id}`, { method: "DELETE" });
    const json = await res.json();
    if (json.success) {
      setReplies((p) => p.filter((r) => r.id !== id));
      if (selectedReply?.id === id) setSelectedReply(null);
    }
  };

  // ── Effects ───────────────────────────────────────────────────────────────────

  useEffect(() => {
    fetchReplies();
    fetchMeta();
    const iv = setInterval(fetchReplies, 30_000);
    return () => clearInterval(iv);
  }, [fetchReplies, fetchMeta]);

  useEffect(() => {
    if (activeTab === "sent") fetchSentEmails(sentFilters);
  }, [activeTab]); // eslint-disable-line react-hooks/exhaustive-deps

  // Close recipient dropdown on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (recipientRef.current && !recipientRef.current.contains(e.target as Node))
        setShowRecipientDrop(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const applyFilters = () => fetchSentEmails(sentFilters);
  const clearFilters = () => {
    setSentFilters(EMPTY_SENT_FILTERS);
    fetchSentEmails(EMPTY_SENT_FILTERS);
  };

  const filterCount = activeFilterCount(sentFilters);

  // ── Render ────────────────────────────────────────────────────────────────────

  return (
    <div className="container mx-auto py-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Email Replies</h1>
          <p className="text-muted-foreground">Monitor responses to your sent emails</p>
        </div>
        <div className="flex gap-2">
          <Button onClick={checkForNewReplies} disabled={isChecking}
            className="bg-blue-600 hover:bg-blue-700 text-white">
            <Mail className={`h-4 w-4 mr-2 ${isChecking ? "animate-pulse" : ""}`} />
            {isChecking ? "Checking…" : "Check for New Replies"}
          </Button>
          <Button variant="outline"
            onClick={() => activeTab === "replies" ? fetchReplies() : fetchSentEmails(sentFilters)}
            disabled={repliesLoading || sentLoading}>
            <RefreshCw className={`h-4 w-4 mr-2 ${(repliesLoading || sentLoading) ? "animate-spin" : ""}`} />
            Refresh
          </Button>
        </div>
      </div>

      {checkMsg && (
        <div className="mb-4 px-4 py-2 rounded-md bg-blue-50 border border-blue-200 text-sm text-blue-800">
          {checkMsg}
        </div>
      )}

      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as "replies" | "sent")}>
        <TabsList className="mb-6">
          <TabsTrigger value="replies" className="flex items-center gap-2">
            <Reply className="h-4 w-4" /> Replies
            {replies.length > 0 && <Badge variant="secondary" className="ml-1 text-xs">{replies.length}</Badge>}
          </TabsTrigger>
          <TabsTrigger value="sent" className="flex items-center gap-2">
            <Send className="h-4 w-4" /> Sent
            {sentTotal > 0 && <Badge variant="secondary" className="ml-1 text-xs">{sentTotal}</Badge>}
          </TabsTrigger>
        </TabsList>

        {/* ── REPLIES TAB ── */}
        <TabsContent value="replies">
          {repliesLoading ? <LoadingState label="Loading replies…" /> :
            replies.length === 0 ? (
              <EmptyState icon={<Reply className="h-12 w-12 text-muted-foreground" />}
                title="No replies yet" desc="Click 'Check for New Replies' to scan your inbox." />
            ) : (
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className="lg:col-span-2">
                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <Reply className="h-5 w-5" /> Replies ({replies.length})
                      </CardTitle>
                      <CardDescription>Responses received from your contacts</CardDescription>
                    </CardHeader>
                    <CardContent>
                      <ScrollArea className="h-[600px] pr-4">
                        <div className="space-y-3">
                          {replies.map((reply) => (
                            <div key={reply.id}
                              className={`p-4 border rounded-lg cursor-pointer transition-colors hover:bg-muted/50 ${selectedReply?.id === reply.id ? "border-primary bg-primary/5" : ""}`}
                              onClick={() => setSelectedReply(reply)}>
                              <div className="flex items-start justify-between mb-2">
                                <div className="flex items-center gap-2">
                                  <div className="bg-blue-100 p-1.5 rounded-full">
                                    <User className="h-4 w-4 text-blue-600" />
                                  </div>
                                  <div>
                                    <p className="font-semibold text-sm">{reply.from_name || "Unknown"}</p>
                                    <Badge variant="secondary" className="text-[10px] h-4 px-1 font-normal">{reply.from_email}</Badge>
                                  </div>
                                </div>
                                <div className="flex flex-col items-end gap-1">
                                  <span className="text-[10px] text-muted-foreground flex items-center gap-1">
                                    <Clock className="h-3 w-3" />{fmt(reply.received_at)}
                                  </span>
                                  <div className="flex gap-1">
                                    <a href={`https://mail.google.com/mail/?view=cm&fs=1&to=${reply.from_email}`}
                                      target="_blank" rel="noopener noreferrer"
                                      className="h-7 w-7 inline-flex items-center justify-center text-blue-600 hover:text-white hover:bg-blue-600 rounded-full transition-colors"
                                      onClick={(e) => e.stopPropagation()}>
                                      <Reply className="h-3.5 w-3.5" />
                                    </a>
                                    <Button variant="ghost" size="icon"
                                      className="h-7 w-7 text-destructive hover:text-white hover:bg-destructive rounded-full"
                                      onClick={(e) => deleteReply(e, reply.id)}>
                                      <Trash2 className="h-3.5 w-3.5" />
                                    </Button>
                                  </div>
                                </div>
                              </div>
                              <p className="text-xs text-muted-foreground italic border-l-2 border-muted pl-2 mb-2 line-clamp-2">
                                "{preview(reply.body)}"
                              </p>
                              <div className="flex items-center justify-between">
                                <Badge variant={reply.processed ? "default" : "secondary"} className="text-[10px] h-4">
                                  {reply.processed ? "Processed" : "Unread"}
                                </Badge>
                                <span className="text-[10px] text-blue-600 font-medium truncate max-w-[180px]">
                                  Re: {reply.original_subject}
                                </span>
                              </div>
                            </div>
                          ))}
                        </div>
                      </ScrollArea>
                    </CardContent>
                  </Card>
                </div>
                <div className="lg:col-span-1">
                  {selectedReply ? (
                    <Card>
                      <CardHeader>
                        <CardTitle className="flex items-center gap-2"><Mail className="h-5 w-5" /> Reply Details</CardTitle>
                        <CardDescription>From {selectedReply.from_name || selectedReply.from_email}</CardDescription>
                      </CardHeader>
                      <CardContent className="space-y-4">
                        <div>
                          <p className="text-xs font-medium text-muted-foreground mb-1">Subject</p>
                          <p className="text-sm">{selectedReply.subject}</p>
                        </div>
                        <Separator />
                        <div>
                          <p className="text-xs font-medium text-muted-foreground mb-1">Received</p>
                          <p className="text-sm">{fmt(selectedReply.received_at)}</p>
                        </div>
                        <div>
                          <p className="text-xs font-medium text-muted-foreground mb-1">Original subject</p>
                          <p className="text-sm text-muted-foreground">{selectedReply.original_subject}</p>
                        </div>
                        <Separator />
                        <div>
                          <p className="text-xs font-medium text-muted-foreground mb-2">Message</p>
                          <ScrollArea className="h-[280px]">
                            <p className="text-sm whitespace-pre-wrap text-muted-foreground">
                              {selectedReply.body || "No body content"}
                            </p>
                          </ScrollArea>
                        </div>
                      </CardContent>
                    </Card>
                  ) : (
                    <Card>
                      <CardContent className="flex items-center justify-center h-[400px]">
                        <div className="text-center text-muted-foreground">
                          <Reply className="h-10 w-10 mx-auto mb-3" />
                          <p>Select a reply to view details</p>
                        </div>
                      </CardContent>
                    </Card>
                  )}
                </div>
              </div>
            )}
        </TabsContent>

        {/* ── SENT TAB ── */}
        <TabsContent value="sent">

          {/* ── Filter toolbar ── */}
          <div className="flex items-center gap-2 mb-4 flex-wrap">
            {/* Toggle button */}
            <Button
              variant="outline" size="sm"
              onClick={() => setShowSentFilters((v) => !v)}
              className={`h-8 gap-1.5 ${showSentFilters ? "bg-muted border-muted-foreground/40" : ""}`}>
              <Filter className="h-3.5 w-3.5" />
              Filters
              {filterCount > 0 && (
                <Badge className="h-4 min-w-4 px-1 text-[10px] bg-blue-600 rounded-full">{filterCount}</Badge>
              )}
            </Button>

            {/* Active filter chips */}
            {sentFilters.startDate && (
              <Badge variant="secondary" className="h-7 gap-1 pr-1 font-normal">
                After: {format(new Date(sentFilters.startDate), "MMM d, yy")}
                <button onClick={() => setSF("startDate", "")} className="ml-0.5 hover:text-destructive"><X className="h-3 w-3" /></button>
              </Badge>
            )}
            {sentFilters.endDate && (
              <Badge variant="secondary" className="h-7 gap-1 pr-1 font-normal">
                Before: {format(new Date(sentFilters.endDate), "MMM d, yy")}
                <button onClick={() => setSF("endDate", "")} className="ml-0.5 hover:text-destructive"><X className="h-3 w-3" /></button>
              </Badge>
            )}
            {sentFilters.subject && (
              <Badge variant="secondary" className="h-7 gap-1 pr-1 font-normal">
                Subject: "{sentFilters.subject}"
                <button onClick={() => setSF("subject", "")} className="ml-0.5 hover:text-destructive"><X className="h-3 w-3" /></button>
              </Badge>
            )}
            {sentFilters.recipientEmail && (
              <Badge variant="secondary" className="h-7 gap-1 pr-1 font-normal">
                To: {sentFilters.recipientEmail}
                <button onClick={() => setSF("recipientEmail", "")} className="ml-0.5 hover:text-destructive"><X className="h-3 w-3" /></button>
              </Badge>
            )}
            {sentFilters.campaignId && (
              <Badge variant="secondary" className="h-7 gap-1 pr-1 font-normal">
                Campaign: {campaigns.find((c) => c.id === sentFilters.campaignId)?.name ?? sentFilters.campaignId}
                <button onClick={() => setSF("campaignId", "")} className="ml-0.5 hover:text-destructive"><X className="h-3 w-3" /></button>
              </Badge>
            )}
            {sentFilters.senderId && (
              <Badge variant="secondary" className="h-7 gap-1 pr-1 font-normal">
                Sender: {senders.find((s) => s.id === sentFilters.senderId)?.name ?? sentFilters.senderId}
                <button onClick={() => setSF("senderId", "")} className="ml-0.5 hover:text-destructive"><X className="h-3 w-3" /></button>
              </Badge>
            )}
            {sentFilters.hasReplies && (
              <Badge variant="secondary" className="h-7 gap-1 pr-1 font-normal">
                {sentFilters.hasReplies === "true" ? "Has replies" : "No replies"}
                <button onClick={() => setSF("hasReplies", "")} className="ml-0.5 hover:text-destructive"><X className="h-3 w-3" /></button>
              </Badge>
            )}

            {/* Right-side actions */}
            <div className="ml-auto flex items-center gap-2">
              {filterCount > 0 && (
                <Button variant="ghost" size="sm" onClick={clearFilters} className="h-8 text-xs text-muted-foreground">
                  <RotateCcw className="h-3 w-3 mr-1" /> Reset all
                </Button>
              )}
              <Button size="sm" onClick={applyFilters} disabled={sentLoading}
                className="h-8 text-xs bg-blue-600 hover:bg-blue-700 text-white">
                <Search className="h-3 w-3 mr-1" /> Apply
              </Button>
            </div>
          </div>

          {/* ── Collapsible filter fields ── */}
          {showSentFilters && (
            <Card className="mb-5">
              <CardContent className="pt-4">
                {/* Row 1: Date range + Subject search */}
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-4">
                  <div className="space-y-1.5">
                    <Label className="text-xs text-muted-foreground">Sent After</Label>
                    <Input type="datetime-local" value={sentFilters.startDate}
                      onChange={(e) => setSF("startDate", e.target.value)}
                      className="h-9 text-sm" />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs text-muted-foreground">Sent Before</Label>
                    <Input type="datetime-local" value={sentFilters.endDate}
                      onChange={(e) => setSF("endDate", e.target.value)}
                      className="h-9 text-sm" />
                  </div>
                  <div className="space-y-1.5 md:col-span-2">
                    <Label className="text-xs text-muted-foreground">Subject Contains</Label>
                    <div className="relative">
                      <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
                      <Input placeholder="Search subject…" value={sentFilters.subject}
                        onChange={(e) => setSF("subject", e.target.value)}
                        onKeyDown={(e) => e.key === "Enter" && applyFilters()}
                        className="h-9 pl-8 text-sm" />
                    </div>
                  </div>
                </div>

                {/* Row 2: Recipient, Campaign, Sender, Has Replies */}
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                  {/* Recipient email with autocomplete */}
                  <div className="space-y-1.5" ref={recipientRef}>
                    <Label className="text-xs text-muted-foreground">Recipient Email</Label>
                    <div className="relative">
                      <Input placeholder="Search recipient…" value={sentFilters.recipientEmail}
                        onChange={(e) => { setSF("recipientEmail", e.target.value); setRecipientSearch(e.target.value); setShowRecipientDrop(true); }}
                        onFocus={() => setShowRecipientDrop(true)}
                        className="h-9 text-sm" />
                      {sentFilters.recipientEmail && (
                        <button onClick={() => { setSF("recipientEmail", ""); setRecipientSearch(""); }}
                          className="absolute right-2 top-2.5 text-muted-foreground hover:text-foreground">
                          <X className="h-3.5 w-3.5" />
                        </button>
                      )}
                      {showRecipientDrop && (
                        <div className="absolute z-20 w-full mt-1 bg-background border rounded-md shadow-lg max-h-48 overflow-y-auto">
                          {recipients
                            .filter((r) => r.email.toLowerCase().includes(recipientSearch.toLowerCase()))
                            .slice(0, 20)
                            .map((r) => (
                              <button key={r.email} type="button"
                                className="w-full text-left px-3 py-2 hover:bg-muted flex items-center justify-between text-sm"
                                onClick={() => { setSF("recipientEmail", r.email); setShowRecipientDrop(false); setRecipientSearch(""); }}>
                                <div>
                                  <p className="font-medium text-sm">{r.email}</p>
                                  <p className="text-xs text-muted-foreground">{r.emailCount} sent</p>
                                </div>
                                {sentFilters.recipientEmail === r.email && <Check className="h-3.5 w-3.5 text-primary" />}
                              </button>
                            ))}
                          {recipients.filter((r) => r.email.toLowerCase().includes(recipientSearch.toLowerCase())).length === 0 && (
                            <p className="px-3 py-2 text-xs text-muted-foreground">No matches</p>
                          )}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Campaign */}
                  <div className="space-y-1.5">
                    <Label className="text-xs text-muted-foreground">Campaign</Label>
                    <Select value={sentFilters.campaignId || "all"}
                      onValueChange={(v) => setSF("campaignId", v === "all" ? "" : v)}>
                      <SelectTrigger className="h-9 text-sm">
                        <SelectValue placeholder="All campaigns" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All campaigns</SelectItem>
                        {campaigns.map((c) => (
                          <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Sender */}
                  <div className="space-y-1.5">
                    <Label className="text-xs text-muted-foreground">Sender</Label>
                    <Select value={sentFilters.senderId || "all"}
                      onValueChange={(v) => setSF("senderId", v === "all" ? "" : v)}>
                      <SelectTrigger className="h-9 text-sm">
                        <SelectValue placeholder="All senders" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All senders</SelectItem>
                        {senders.map((s) => (
                          <SelectItem key={s.id} value={s.id}>
                            <span>{s.name}</span>
                            <span className="text-muted-foreground ml-1 text-xs">({s.email})</span>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Has Replies */}
                  <div className="space-y-1.5">
                    <Label className="text-xs text-muted-foreground">Reply Status</Label>
                    <Select value={sentFilters.hasReplies || "all"}
                      onValueChange={(v) => setSF("hasReplies", v === "all" ? "" : v)}>
                      <SelectTrigger className="h-9 text-sm">
                        <SelectValue placeholder="All emails" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All emails</SelectItem>
                        <SelectItem value="true">Has replies</SelectItem>
                        <SelectItem value="false">No replies</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* ── Sent List + Detail ── */}
          {sentLoading ? <LoadingState label="Loading sent emails…" /> :
            sentEmails.length === 0 ? (
              <EmptyState icon={<Send className="h-12 w-12 text-muted-foreground" />}
                title="No sent emails found"
                desc={filterCount > 0 ? "No emails match the current filters." : "Sent emails with tracked Message-IDs will appear here."} />
            ) : (
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className="lg:col-span-2">
                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <Send className="h-5 w-5" /> Sent Emails
                        <Badge variant="secondary" className="ml-1">{sentTotal}</Badge>
                      </CardTitle>
                      <CardDescription>Tracked outbound emails from your senders</CardDescription>
                    </CardHeader>
                    <CardContent>
                      <ScrollArea className="h-[600px] pr-4">
                        <div className="space-y-3">
                          {sentEmails.map((email) => (
                            <div key={email.id}
                              className={`p-4 border rounded-lg cursor-pointer transition-colors hover:bg-muted/50 ${selectedSent?.id === email.id ? "border-primary bg-primary/5" : ""}`}
                              onClick={() => setSelectedSent(email)}>
                              <div className="flex items-start justify-between mb-2">
                                <div className="flex items-center gap-2 min-w-0">
                                  <div className="bg-green-100 p-1.5 rounded-full shrink-0">
                                    <Send className="h-4 w-4 text-green-600" />
                                  </div>
                                  <div className="min-w-0">
                                    <p className="font-semibold text-sm truncate">
                                      {email.recipient_name || email.recipient_email}
                                    </p>
                                    <Badge variant="secondary" className="text-[10px] h-4 px-1 font-normal">
                                      {email.recipient_email}
                                    </Badge>
                                  </div>
                                </div>
                                <div className="flex flex-col items-end gap-1 shrink-0 ml-2">
                                  <span className="text-[10px] text-muted-foreground flex items-center gap-1 whitespace-nowrap">
                                    <Clock className="h-3 w-3" />{fmt(email.sent_at)}
                                  </span>
                                  {email.reply_count > 0 ? (
                                    <Badge className="text-[10px] h-5 bg-blue-100 text-blue-700 hover:bg-blue-100 gap-1">
                                      <MessageSquare className="h-2.5 w-2.5" />
                                      {email.reply_count} {email.reply_count === 1 ? "reply" : "replies"}
                                    </Badge>
                                  ) : (
                                    <Badge variant="outline" className="text-[10px] h-5 text-muted-foreground">
                                      No replies
                                    </Badge>
                                  )}
                                </div>
                              </div>
                              <p className="text-sm font-medium mb-1.5 truncate">{email.subject}</p>
                              <div className="flex items-center gap-2 flex-wrap">
                                {email.campaign_name && (
                                  <Badge variant="outline" className="text-[10px] h-4">{email.campaign_name}</Badge>
                                )}
                                {email.sender_name && (
                                  <span className="text-[10px] text-muted-foreground">via {email.sender_name}</span>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      </ScrollArea>
                    </CardContent>
                  </Card>
                </div>

                {/* Detail panel */}
                <div className="lg:col-span-1">
                  {selectedSent ? (
                    <Card>
                      <CardHeader>
                        <CardTitle className="flex items-center gap-2"><Mail className="h-5 w-5" /> Email Details</CardTitle>
                        <CardDescription>To {selectedSent.recipient_email}</CardDescription>
                      </CardHeader>
                      <CardContent className="space-y-4">
                        <div>
                          <p className="text-xs font-medium text-muted-foreground mb-1">Subject</p>
                          <p className="text-sm font-medium">{selectedSent.subject}</p>
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                          <div>
                            <p className="text-xs font-medium text-muted-foreground mb-1">Sent At</p>
                            <p className="text-sm">{fmt(selectedSent.sent_at)}</p>
                          </div>
                          <div>
                            <p className="text-xs font-medium text-muted-foreground mb-1">Replies</p>
                            <p className={`text-sm font-semibold ${selectedSent.reply_count > 0 ? "text-blue-600" : "text-muted-foreground"}`}>
                              {selectedSent.reply_count}
                            </p>
                          </div>
                        </div>
                        {selectedSent.sender_name && (
                          <div>
                            <p className="text-xs font-medium text-muted-foreground mb-1">Sent From</p>
                            <p className="text-sm">{selectedSent.sender_name}
                              <span className="text-muted-foreground text-xs ml-1">({selectedSent.sender_email})</span>
                            </p>
                          </div>
                        )}
                        {selectedSent.campaign_name && (
                          <div>
                            <p className="text-xs font-medium text-muted-foreground mb-1">Campaign</p>
                            <p className="text-sm">{selectedSent.campaign_name}</p>
                          </div>
                        )}
                        <Separator />
                        <div>
                          <p className="text-xs font-medium text-muted-foreground mb-2">Email Body</p>
                          <ScrollArea className="h-[220px] border rounded-md p-3 bg-muted/20">
                            {selectedSent.html_content ? (
                              <div className="text-sm prose prose-sm max-w-none"
                                dangerouslySetInnerHTML={{ __html: selectedSent.html_content }} />
                            ) : (
                              <p className="text-sm text-muted-foreground">No content available</p>
                            )}
                          </ScrollArea>
                        </div>
                        {selectedSent.reply_count > 0 && (
                          <>
                            <Separator />
                            <Button variant="outline" size="sm" className="w-full"
                              onClick={() => {
                                setSF("recipientEmail", selectedSent.recipient_email);
                                setActiveTab("replies");
                              }}>
                              <Reply className="h-4 w-4 mr-2" />
                              View {selectedSent.reply_count} {selectedSent.reply_count === 1 ? "Reply" : "Replies"}
                            </Button>
                          </>
                        )}
                      </CardContent>
                    </Card>
                  ) : (
                    <Card>
                      <CardContent className="flex items-center justify-center h-[400px]">
                        <div className="text-center text-muted-foreground">
                          <Send className="h-10 w-10 mx-auto mb-3" />
                          <p>Select an email to view details</p>
                        </div>
                      </CardContent>
                    </Card>
                  )}
                </div>
              </div>
            )}
        </TabsContent>
      </Tabs>
    </div>
  );
}

// ─── Shared sub-components ────────────────────────────────────────────────────

function LoadingState({ label }: { label: string }) {
  return (
    <div className="flex items-center justify-center h-64">
      <div className="text-center">
        <Mail className="h-12 w-12 text-muted-foreground mx-auto mb-4 animate-pulse" />
        <p className="text-muted-foreground">{label}</p>
      </div>
    </div>
  );
}

function EmptyState({ icon, title, desc }: { icon: React.ReactNode; title: string; desc: string }) {
  return (
    <Card>
      <CardContent className="flex items-center justify-center h-64">
        <div className="text-center">
          {icon}
          <p className="text-muted-foreground font-medium mt-4">{title}</p>
          <p className="text-sm text-muted-foreground mt-1">{desc}</p>
        </div>
      </CardContent>
    </Card>
  );
}
