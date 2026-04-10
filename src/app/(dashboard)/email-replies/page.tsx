"use client";

import { useEffect, useState } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import {
  RefreshCw,
  Mail,
  Reply,
  Clock,
  User,
  Filter,
  X,
  Trash2,
} from "lucide-react";
import { format } from "date-fns";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Check, ChevronDown } from "lucide-react";

interface Reply {
  id: string;
  queue_id: string;
  message_id: string;
  reply_message_id: string;
  from_email: string;
  from_name: string;
  subject: string;
  body: string;
  received_at: string;
  processed: boolean;
  thread_id?: string;
  in_reply_to: string;
  is_reply: boolean;
  recipient_email: string;
  original_subject: string;
}

interface RecipientEmail {
  email: string;
  emailCount: number;
  lastSentAt: string;
  recentSubjects: string[];
}

interface EmailRepliesProps {
  queueId?: string;
}

type CheckStage =
  | "idle"
  | "fetching_sent"
  | "searching_replies"
  | "processing_replies"
  | "completed"
  | "error";

interface CheckProgress {
  stage: CheckStage;
  sentEmailsFound?: number;
  unreadRepliesFound?: number;
  newRepliesProcessed?: number;
  currentReply?: number;
  totalReplies?: number;
  message?: string;
  error?: string;
}

export default function EmailReplies({ queueId }: EmailRepliesProps = {}) {
  const [selectedReply, setSelectedReply] = useState<Reply | null>(null);
  const [replies, setReplies] = useState<Reply[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isChecking, setIsChecking] = useState(false);
  const [checkProgress, setCheckProgress] = useState<CheckProgress>({
    stage: "idle",
  });
  const [showNewReplies, setShowNewReplies] = useState(false);

  // Filters
  const [filterStartDate, setFilterStartDate] = useState("");
  const [filterEndDate, setFilterEndDate] = useState("");
  const [filterEmail, setFilterEmail] = useState("");
  const [showFilters, setShowFilters] = useState(false);
  const [recipients, setRecipients] = useState<RecipientEmail[]>([]);
  const [showEmailDropdown, setShowEmailDropdown] = useState(false);
  const [emailSearchTerm, setEmailSearchTerm] = useState("");

  // Filters are now OPTIONAL - no validation needed

  // Fetch recipient emails
  const fetchRecipients = async () => {
    try {
      const response = await fetch("/api/email-replies/recipients");
      const result = await response.json();

      if (result.success) {
        setRecipients(result.recipients);
      }
    } catch (error) {
      console.error("Error fetching recipients:", error);
    }
  };

  // Fetch replies
  const fetchReplies = async () => {
    try {
      const params = new URLSearchParams();
      if (queueId) params.append("queueId", queueId);
      params.append("limit", "100");

      const response = await fetch(`/api/email-replies?${params}`);
      const result = await response.json();

      if (result.success) {
        // Deduplicate replies by ID to prevent React key errors
        const uniqueReplies = Array.from(
          new Map(result.data.map((reply: Reply) => [reply.id, reply])).values()
        ) as Reply[];
        setReplies(uniqueReplies);
      }
    } catch (error) {
      console.error("Error fetching replies:", error);
    } finally {
      setIsLoading(false);
    }
  };

  // Manual check for new replies
  const checkForNewReplies = async () => {
    setIsChecking(true);
    setCheckProgress({
      stage: "fetching_sent",
      message: "Fetching sent emails from database...",
    });

    try {
      const response = await fetch("/api/email-replies/check-replies", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          force: true,
          startDate: filterStartDate || undefined,
          endDate: filterEndDate || undefined,
          recipientEmail: filterEmail || undefined,
          searchDirectly: true, // Flag to tell backend to search inbox directly
        }),
      });

      const result = await response.json();

      if (result.success) {
        const { stage, details } = result;

        if (stage === "fetching_sent") {
          setCheckProgress({
            stage: "completed",
            sentEmailsFound: details.sentEmailsFound,
            message: details.message,
          });
        } else if (stage === "searching_replies") {
          setCheckProgress({
            stage: "completed",
            sentEmailsFound: details.sentEmailsFound,
            message: details.message,
          });
        } else if (stage === "completed") {
          setCheckProgress({
            stage: "completed",
            sentEmailsFound: details.sentEmailsFound,
            unreadRepliesFound: details.unreadRepliesFound,
            newRepliesProcessed: details.newRepliesProcessed,
            message: `Found ${details.newRepliesProcessed} new replies!`,
          });

          if (details.newRepliesProcessed > 0) {
            setShowNewReplies(true);
          }
        } else {
          setCheckProgress({
            stage: "error",
            error: result.error || "Unknown error occurred",
          });
        }

        // Refresh the replies list after checking
        await fetchReplies();
      } else {
        setCheckProgress({
          stage: "error",
          error: result.error || "Failed to check for replies",
        });
      }
    } catch (error: any) {
      setCheckProgress({
        stage: "error",
        error: error.message || "Failed to check for replies",
      });
    } finally {
      setTimeout(() => {
        setIsChecking(false);
        setCheckProgress({ stage: "idle" });
      }, 3000);
    }
  };

  // Delete a reply
  const deleteReply = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation(); // Don't select the card

    if (!confirm("Are you sure you want to delete this reply?")) return;

    try {
      const response = await fetch(`/api/email-replies/${id}`, {
        method: "DELETE",
      });

      const result = await response.json();

      if (result.success) {
        // Remove from local state
        setReplies(replies.filter((r) => r.id !== id));
        if (selectedReply?.id === id) setSelectedReply(null);
      } else {
        alert(result.error || "Failed to delete reply");
      }
    } catch (error) {
      console.error("Error deleting reply:", error);
      alert("An error occurred while deleting");
    }
  };

  // Initial fetch and set up interval
  useEffect(() => {
    fetchReplies();
    fetchRecipients(); // Fetch recipients on mount

    const interval = setInterval(fetchReplies, 30000); // Refresh every 30 seconds

    return () => clearInterval(interval);
  }, [queueId]);

  const formatTime = (dateString: string) => {
    return format(new Date(dateString), "MMM dd, yyyy HH:mm");
  };

  const getReplyPreview = (body: string, maxLength = 150) => {
    return body.length > maxLength
      ? body.substring(0, maxLength) + "..."
      : body;
  };

  return (
    <div className="container mx-auto py-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Email Replies</h1>
          <p className="text-muted-foreground">
            Monitor responses to your sent emails
          </p>
        </div>
        <div className="flex gap-2 relative">
          <Button
            variant="outline"
            onClick={() => setShowFilters(!showFilters)}
            className={showFilters ? "bg-muted" : ""}>
            <Filter className="h-4 w-4 mr-2" />
            {showFilters ? "Hide Filters" : "Filters"}
          </Button>
          <Button
            onClick={checkForNewReplies}
            disabled={isChecking}
            className="bg-blue-600 hover:bg-blue-700 text-white">
            <Mail
              className={`h-4 w-4 mr-2 ${isChecking ? "animate-pulse" : ""}`}
            />
            {isChecking ? "Checking..." : "Check for New Replies"}
          </Button>
          {/* Filters are now optional - no warning message needed */}
          <Button
            variant="outline"
            onClick={fetchReplies}
            disabled={isLoading || isChecking}>
            <RefreshCw
              className={`h-4 w-4 mr-2 ${isLoading ? "animate-spin" : ""}`}
            />
            Refresh List
          </Button>
        </div>
      </div>

      {/* Filter UI */}
      {showFilters && (
        <Card className="mb-6">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-medium">
                Search Filters
              </CardTitle>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setFilterStartDate("");
                  setFilterEndDate("");
                  setFilterEmail("");
                }}
                className="h-8 text-xs">
                <X className="h-3 w-3 mr-1" />
                Clear
              </Button>
            </div>
            <CardDescription className="text-xs">
              Optionally filter by date range or recipient email. Leave blank to
              check all replies.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label htmlFor="startDate" className="text-xs">
                  Sent After (Date/Time)
                </Label>
                <Input
                  id="startDate"
                  type="datetime-local"
                  value={filterStartDate}
                  onChange={(e) => setFilterStartDate(e.target.value)}
                  className="h-9"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="endDate" className="text-xs">
                  Sent Before (Date/Time)
                </Label>
                <Input
                  id="endDate"
                  type="datetime-local"
                  value={filterEndDate}
                  onChange={(e) => setFilterEndDate(e.target.value)}
                  className="h-9"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="email" className="text-xs">
                  Recipient Email
                </Label>
                <div className="relative">
                  <Input
                    id="email"
                    type="email"
                    placeholder="Select or type recipient email..."
                    value={filterEmail}
                    onChange={(e) => {
                      setFilterEmail(e.target.value);
                      setEmailSearchTerm(e.target.value);
                      setShowEmailDropdown(e.target.value.length > 0);
                    }}
                    onFocus={() => setShowEmailDropdown(true)}
                    className="h-9"
                  />
                  {showEmailDropdown && (
                    <div className="absolute z-10 w-full mt-1 bg-background border rounded-md shadow-lg max-h-60 overflow-y-auto">
                      {recipients.length > 0 ? (
                        <div className="p-1">
                          {recipients
                            .filter((r) =>
                              r.email
                                .toLowerCase()
                                .includes(emailSearchTerm.toLowerCase()),
                            )
                            .map((recipient) => (
                              <button
                                key={recipient.email}
                                type="button"
                                className="w-full text-left px-3 py-2 hover:bg-muted rounded-md transition-colors flex items-center justify-between group"
                                onClick={() => {
                                  setFilterEmail(recipient.email);
                                  setShowEmailDropdown(false);
                                  setEmailSearchTerm("");
                                }}>
                                <div className="flex flex-col items-start">
                                  <span className="text-sm font-medium">
                                    {recipient.email}
                                  </span>
                                  <span className="text-xs text-muted-foreground">
                                    {recipient.emailCount} email
                                    {recipient.emailCount > 1 ? "s" : ""} sent
                                  </span>
                                </div>
                                {filterEmail === recipient.email && (
                                  <Check className="h-4 w-4 text-primary" />
                                )}
                              </button>
                            ))}
                        </div>
                      ) : (
                        <div className="p-3 text-sm text-muted-foreground text-center">
                          No sent emails found
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Check Progress Indicator */}
      {isChecking && checkProgress.stage !== "idle" && (
        <Card className="mb-6 border-blue-200 bg-blue-50/50">
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <div className="flex-shrink-0">
                <Mail className="h-8 w-8 text-blue-600 animate-pulse" />
              </div>
              <div className="flex-1">
                <h3 className="font-semibold text-blue-900 mb-1">
                  Checking for New Replies
                </h3>
                <p className="text-sm text-blue-700">{checkProgress.message}</p>
                {checkProgress.sentEmailsFound !== undefined && (
                  <div className="flex gap-4 mt-2 text-xs text-blue-600">
                    <span>📧 Sent emails: {checkProgress.sentEmailsFound}</span>
                    {checkProgress.unreadRepliesFound !== undefined && (
                      <span>
                        📨 Unread replies: {checkProgress.unreadRepliesFound}
                      </span>
                    )}
                    {checkProgress.newRepliesProcessed !== undefined &&
                      checkProgress.newRepliesProcessed > 0 && (
                        <span className="font-semibold text-green-600">
                          ✨ New replies: {checkProgress.newRepliesProcessed}
                        </span>
                      )}
                  </div>
                )}
                {checkProgress.stage === "error" && (
                  <div className="mt-2 text-xs text-red-600">
                    {checkProgress.error}
                  </div>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Success Banner for New Replies */}
      {showNewReplies && !isChecking && (
        <Card className="mb-6 border-green-200 bg-green-50/50">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="flex-shrink-0">
                  <Reply className="h-6 w-6 text-green-600" />
                </div>
                <div>
                  <h3 className="font-semibold text-green-900">
                    New Replies Found!
                  </h3>
                  <p className="text-sm text-green-700">
                    {checkProgress.newRepliesProcessed} new reply
                    {checkProgress.newRepliesProcessed !== 1
                      ? "ies have"
                      : "has"}{" "}
                    been detected and added to the list below.
                  </p>
                </div>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowNewReplies(false)}>
                Dismiss
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {isLoading ? (
        <div className="flex items-center justify-center h-64">
          <div className="text-center">
            <Mail className="h-12 w-12 text-muted-foreground mx-auto mb-4 animate-pulse" />
            <p className="text-muted-foreground font-medium">
              Loading email replies...
            </p>
            <p className="text-sm text-muted-foreground mt-2">
              Fetching from database
            </p>
          </div>
        </div>
      ) : replies && replies.length > 0 ? (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Replies List */}
          <div className="lg:col-span-2">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Reply className="h-5 w-5" />
                  Recent Replies ({replies.length})
                </CardTitle>
                <CardDescription>
                  {queueId
                    ? "Replies to this specific email"
                    : "All replies from the last 7 days"}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <ScrollArea className="h-[600px] pr-4">
                  <div className="space-y-4">
                    {replies.map((reply) => (
                      <div
                        key={reply.id}
                        className={`p-4 border rounded-lg cursor-pointer transition-colors hover:bg-muted/50 ${
                          selectedReply?.id === reply.id
                            ? "border-primary bg-primary/5"
                            : ""
                        }`}
                        onClick={() => setSelectedReply(reply)}>
                        <div className="flex items-start justify-between mb-2">
                          <div className="flex items-center gap-2">
                            <div className="bg-blue-100 p-1.5 rounded-full">
                              <User className="h-4 w-4 text-blue-600" />
                            </div>
                            <div className="flex flex-col">
                              <span className="font-semibold text-sm leading-none mb-1">
                                {reply.from_name || "Unknown Sender"}
                              </span>
                              <Badge
                                variant="secondary"
                                className="text-[10px] h-4 px-1 font-normal w-fit">
                                {reply.from_email}
                              </Badge>
                            </div>
                          </div>
                          <div className="flex flex-col items-end gap-2">
                            <div className="flex items-center gap-1 text-[10px] text-muted-foreground bg-muted/50 px-2 py-0.5 rounded-full">
                              <Clock className="h-3 w-3" />
                              {formatTime(reply.received_at)}
                            </div>
                            <div className="flex gap-1">
                              <a
                                className="h-7 w-7 inline-flex items-center
                              justify-center text-blue-600 hover:text-white
                              hover:bg-blue-600 rounded-full transition-colors"
                                href={`https://mail.google.com/mail/?view=cm&fs=1&to=${reply.from_email}`}
                                target="_blank"
                                rel="noopener noreferrer">
                                <Reply />
                              </a>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-7 w-7 text-destructive hover:text-white hover:bg-destructive rounded-full"
                                onClick={(e) => deleteReply(e, reply.id)}
                                title="Delete Reply">
                                <Trash2 className="h-3.5 w-3.5" />
                              </Button>
                            </div>
                          </div>
                        </div>

                        <p className="text-xs text-muted-foreground line-clamp-2 italic border-l-2 border-muted pl-2 mb-3">
                          "{getReplyPreview(reply.body, 100)}"
                        </p>

                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <Badge
                              variant={
                                reply.processed ? "default" : "secondary"
                              }
                              className="text-[10px] h-4">
                              {reply.processed ? "Processed" : "Unread"}
                            </Badge>
                            {reply.thread_id && (
                              <Badge
                                variant="outline"
                                className="text-[10px] h-4">
                                Threaded
                              </Badge>
                            )}
                          </div>
                          <span className="text-[10px] font-medium text-blue-600">
                            Original: {reply.original_subject.substring(0, 20)}
                            ...
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              </CardContent>
            </Card>
          </div>

          {/* Reply Detail */}
          <div className="lg:col-span-1">
            {selectedReply ? (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Mail className="h-5 w-5" />
                    Reply Details
                  </CardTitle>
                  <CardDescription>
                    From {selectedReply.from_name || selectedReply.from_email}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div>
                      <h4 className="font-medium text-sm mb-1">Subject</h4>
                      <p className="text-sm">{selectedReply.subject}</p>
                    </div>

                    <Separator />

                    <div>
                      <h4 className="font-medium text-sm mb-1">Received</h4>
                      <p className="text-sm text-muted-foreground">
                        {formatTime(selectedReply.received_at)}
                      </p>
                    </div>

                    <div>
                      <h4 className="font-medium text-sm mb-1">Message ID</h4>
                      <p className="text-xs font-mono text-muted-foreground">
                        {selectedReply.reply_message_id}
                      </p>
                    </div>

                    <div>
                      <h4 className="font-medium text-sm mb-1">In Reply To</h4>
                      <p className="text-xs font-mono text-muted-foreground">
                        {selectedReply.in_reply_to}
                      </p>
                    </div>

                    <Separator />

                    <div>
                      <h4 className="font-medium text-sm mb-1">Message Body</h4>
                      <ScrollArea className="h-[300px] w-full">
                        <div className="text-sm whitespace-pre-wrap text-muted-foreground">
                          {selectedReply.body || "No body content available"}
                        </div>
                      </ScrollArea>
                    </div>

                    <Separator />
                    <div className="pt-2">
                      <p className="text-[10px] text-muted-foreground italic text-center">
                        Use the action buttons on the reply card to reply or
                        delete.
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ) : (
              <Card>
                <CardContent className="flex items-center justify-center h-[400px]">
                  <div className="text-center">
                    <Reply className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                    <p className="text-muted-foreground">
                      Select a reply to view details
                    </p>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      ) : (
        <Card>
          <CardContent className="flex items-center justify-center h-64">
            <div className="text-center">
              <Mail className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <p className="text-muted-foreground">No replies found yet</p>
              <p className="text-sm text-muted-foreground">
                {queueId
                  ? "This email hasn't received any replies yet."
                  : "Your emails will appear here when recipients reply."}
              </p>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
