"use client";

import * as React from "react";
import {
  Search,
  Users,
  Mail,
  Phone,
  ExternalLink,
  Trash2,
  X,
  Loader2,
  FileText,
  AlertCircle,
  Clock,
  Calendar,
  CheckCircle2,
  ChevronRight,
  ChevronDown,
  ChevronUp,
  Info,
  Globe,
  AlertTriangle,
  Sparkles,
  TrendingUp,
  XCircle,
  Pencil,
  Filter,
  Copy,
  Plus,
  Upload,
  UserPlus,
} from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardContent } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { formatDate } from "@/lib/utils";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface Contact {
  id: number;
  type: "email" | "phone" | "linkedin";
  value: string;
  site_id?: number;
  site_url?: string;
  country?: string;
  source_page?: string;
  created_at: string;
  verification_status?:
  | "valid"
  | "invalid"
  | "risky"
  | "unverified"
  | "checking"
  | null;
  verification_reason?: string | null;
  verification_checked_at?: string | null;
  overall_score?: number | null;
}

interface Site {
  id: number;
  url: string;
  country: string;
}

interface ContactWithCountry extends Contact {
  countryInfo?: CountryTimezone;
  countryName?: string;
  businessHoursStatus?: "within_hours" | "outside_hours" | "weekend";
  nextBusinessHours?: Date;
}

interface Sequence {
  id: string;
  name: string;
  description: string | null;
  is_active: boolean;
  items: SequenceItem[];
  created_at: string;
}

interface SequenceItem {
  id: string;
  template_id: string;
  template_name: string;
  template_subject: string;
  position: number;
  delay_days: number | null;
  delay_hours: number | null;
  send_time?: string;
}

interface CountryTimezone {
  id: string;
  country_code: string;
  country_name: string;
  default_timezone: string;
  business_hours_start: string;
  business_hours_end: string;
  weekend_days: string[];
  region?: string;
}

interface QueuedEmail {
  contact_id: number;
  contact_email: string;
  template_id: string;
  template_name: string;
  template_subject: string;
  position: number;
  scheduled_at: Date;
  status: "ready" | "weekend" | "outside_hours";
  reason?: string;
}

type ContactType = "all" | "email" | "phone" | "linkedin";
type DeliveryOption = "immediate" | "next_business_hours" | "custom";

type WizardStep = "sequence" | "schedule";

export default function ContactsPage() {
  const [contacts, setContacts] = React.useState<Contact[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [meta, setMeta] = React.useState({
    total: 0,
    page: 1,
    limit: 20,
    totalPages: 1,
  });
  const [stats, setStats] = React.useState({
    email: 0,
    phone: 0,
    linkedin: 0,
    total: 0,
  });
  const [activeTab, setActiveTab] = React.useState<ContactType>("email");
  const [selectedIds, setSelectedIds] = React.useState<Set<number>>(new Set());
  const [searchQuery, setSearchQuery] = React.useState("");
  const [bulkActionLoading, setBulkActionLoading] = React.useState(false);

  // Filters
  const [showFilters, setShowFilters] = React.useState(false);
  const [filters, setFilters] = React.useState({
    verification_status: "" as "" | "valid" | "invalid" | "risky" | "unverified",
    country: "",
    site_url: "",
    has_site_id: "" as "" | "yes" | "no",
    hide_invalid: false,
    hide_duplicates: false,
  });
  const [availableCountries, setAvailableCountries] = React.useState<string[]>([]);
  const [availableSites, setAvailableSites] = React.useState<Array<{ url: string; count: number }>>([]);

  // Removed deprecated filter state - now using unified filters state

  // Edit modal state
  const [showEditModal, setShowEditModal] = React.useState(false);
  const [editingContact, setEditingContact] = React.useState<Contact | null>(
    null,
  );
  const [editForm, setEditForm] = React.useState({
    value: "",
  });
  const [updateLoading, setUpdateLoading] = React.useState(false);

  // Add contact modal state
  const [showAddModal, setShowAddModal] = React.useState(false);
  const [addStep, setAddStep] = React.useState<"site" | "contact">("site");
  const [addSiteForm, setAddSiteForm] = React.useState({ url: "", country: "" });
  const [addSiteData, setAddSiteData] = React.useState<{ id: number; url: string; country: string } | null>(null);
  const [addForm, setAddForm] = React.useState({
    type: "email" as "email" | "phone" | "linkedin",
    value: "",
    country_code: "",
    source_page: "",
  });
  const [addLoading, setAddLoading] = React.useState(false);
  const [addError, setAddError] = React.useState<string | null>(null);

  const resetAddForm = () => {
    setAddStep("site");
    setAddSiteForm({ url: "", country: "" });
    setAddSiteData(null);
    setAddForm({ type: "email", value: "", country_code: "", source_page: "" });
    setAddError(null);
  };

  // Bulk add modal state
  const [showBulkModal, setShowBulkModal] = React.useState(false);
  const [bulkMode, setBulkMode] = React.useState<"simple" | "advanced">("simple");
  const [bulkStep, setBulkStep] = React.useState<"mode" | "site" | "import">("mode");
  const [bulkSiteForm, setBulkSiteForm] = React.useState({ url: "", country: "" });
  const [bulkSiteData, setBulkSiteData] = React.useState<{ id: number; url: string; country: string } | null>(null);
  const [bulkType, setBulkType] = React.useState<"email" | "phone" | "linkedin">("email");
  const [bulkText, setBulkText] = React.useState("");
  const [bulkFile, setBulkFile] = React.useState<File | null>(null);
  const [bulkLoading, setBulkLoading] = React.useState(false);
  const [bulkResult, setBulkResult] = React.useState<{
    imported: number;
    failed: number;
    errors: string[];
  } | null>(null);

  const resetBulkForm = () => {
    setBulkMode("simple");
    setBulkStep("mode");
    setBulkSiteForm({ url: "", country: "" });
    setBulkSiteData(null);
    setBulkText("");
    setBulkFile(null);
    setBulkResult(null);
  };

  // Sequence modal state
  const [showSequenceModal, setShowSequenceModal] = React.useState(false);
  const [sequences, setSequences] = React.useState<Sequence[]>([]);
  const [selectedSequence, setSelectedSequence] =
    React.useState<Sequence | null>(null);
  const [sequencesLoading, setSequencesLoading] = React.useState(false);
  const [sequenceError, setSequenceError] = React.useState<string | null>(null);

  // Wizard state
  const [showWizard, setShowWizard] = React.useState(false);
  const [wizardStep, setWizardStep] = React.useState<WizardStep>("sequence");
  const [selectedSequenceForWizard, setSelectedSequenceForWizard] =
    React.useState<Sequence | null>(null);
  const [queuedEmails, setQueuedEmails] = React.useState<QueuedEmail[]>([]);
  const [wizardLoading, setWizardLoading] = React.useState(false);
  const [sequenceSearchQuery, setSequenceSearchQuery] = React.useState("");
  const [editingEmail, setEditingEmail] = React.useState<QueuedEmail | null>(
    null,
  );
  const [editingEmailDate, setEditingEmailDate] = React.useState("");
  const [countryTimezones, setCountryTimezones] = React.useState<
    Record<string, CountryTimezone>
  >({});
  const [scheduleWarnings, setScheduleWarnings] = React.useState<
    Record<string, string>
  >({});
  const [showSenderWarning, setShowSenderWarning] = React.useState(false);

  // Verification summary dialog state
  const [showVerificationSummary, setShowVerificationSummary] =
    React.useState(false);
  const [verificationSummary, setVerificationSummary] = React.useState<{
    valid: number;
    invalid: number;
    risky: number;
    unknown: number;
    newly_verified: number;
    reused: number;
  } | null>(null);

  const fetchContacts = async (page = 1, type: ContactType = "all") => {
    setLoading(true);
    try {
      const typeParam = type === "all" ? "" : `&type=${type}`;
      const searchParam = searchQuery
        ? `&search=${encodeURIComponent(searchQuery)}`
        : "";

      // Build filter params
      const filterParams = new URLSearchParams();
      if (filters.verification_status) filterParams.append("verification_status", filters.verification_status);
      if (filters.country) filterParams.append("country_code", filters.country);
      if (filters.site_url) filterParams.append("site_url", filters.site_url);
      if (filters.has_site_id === "yes") filterParams.append("has_site_id", "true");
      if (filters.has_site_id === "no") filterParams.append("has_site_id", "false");

      const filterString = filterParams.toString() ? `&${filterParams.toString()}` : "";

      const res = await fetch(
        `/api/contacts?page=${page}&limit=20${typeParam}${searchParam}${filterString}`,
      );
      const json = await res.json();
      if (json.success) {
        // Deduplicate contacts by ID to prevent React key errors
        const uniqueContacts = Array.from(
          new Map(
            json.data.map((contact: any) => [contact.id, contact]),
          ).values(),
        ) as Contact[];
        setContacts(uniqueContacts);
        setMeta(json.meta);
        if (json.stats) {
          setStats(json.stats);
        }
      } else {
        setError(json.error);
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  React.useEffect(() => {
    fetchContacts(1, activeTab);
    setSelectedIds(new Set());
  }, [activeTab]);

  // Refetch when filters change
  React.useEffect(() => {
    const timeoutId = setTimeout(() => {
      fetchContacts(1, activeTab);
    }, 300);
    return () => clearTimeout(timeoutId);
  }, [filters]);

  // Fetch filter options on mount
  React.useEffect(() => {
    async function fetchFilterOptions() {
      try {
        // Fetch unique countries
        const countriesRes = await fetch("/api/contacts/filter-options?field=country");
        const countriesJson = await countriesRes.json();
        if (countriesJson.success) {
          setAvailableCountries(countriesJson.data);
        }

        // Fetch unique sites
        const sitesRes = await fetch("/api/contacts/filter-options?field=site_url");
        const sitesJson = await sitesRes.json();
        if (sitesJson.success) {
          setAvailableSites(sitesJson.data);
        }
      } catch (err) {
        console.error("Failed to fetch filter options:", err);
      }
    }
    fetchFilterOptions();
  }, []);

  // Debounce search - auto-search after user stops typing
  React.useEffect(() => {
    const timeoutId = setTimeout(() => {
      fetchContacts(1, activeTab);
    }, 500);

    return () => clearTimeout(timeoutId);
  }, [searchQuery]);

  const handleSearch = () => {
    fetchContacts(1, activeTab);
  };

  const handleSelectAll = () => {
    const selectableIds = displayContacts.map((c) => c.id);
    if (selectedIds.size === selectableIds.length && selectableIds.every((id) => selectedIds.has(id))) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(selectableIds));
    }
  };

  const handleSelectOne = (id: number) => {
    const newSelected = new Set(selectedIds);
    if (newSelected.has(id)) {
      newSelected.delete(id);
    } else {
      newSelected.add(id);
    }
    setSelectedIds(newSelected);
  };

  // Wizard functions
  const handleWizardNext = async () => {
    if (wizardStep === "sequence") {
      // Calculate scheduled emails and move to schedule step
      await generateScheduledEmails();
      setWizardStep("schedule");
    } else if (wizardStep === "schedule") {
      // Submit to queue
      await submitToQueue();
    }
  };

  const handleWizardBack = () => {
    if (wizardStep === "schedule") {
      setWizardStep("sequence");
    }
  };

  const generateScheduledEmails = async () => {
    if (!selectedSequenceForWizard) return;

    setWizardLoading(true);
    setScheduleWarnings({});
    try {
      // 1. Fetch country timezones
      const timezoneRes = await fetch("/api/countries");
      const timezoneJson = await timezoneRes.json();
      const timezoneMap: Record<string, CountryTimezone> = {};
      if (timezoneJson.success) {
        timezoneJson.data.forEach((c: CountryTimezone) => {
          timezoneMap[c.country_code] = c;
        });
      }
      setCountryTimezones(timezoneMap);

      // 2. Get selected contacts with full data
      const contactsData = await Promise.all(
        Array.from(selectedIds).map(async (id) => {
          const res = await fetch(`/api/contacts/${id}`);
          const json = await res.json();
          return json.success ? json.data : null;
        }),
      );

      const validContacts = contactsData.filter((c) => c && c.type === "email");

      // 3. Calculate scheduled emails and validate business hours
      const now = new Date();
      const emails: QueuedEmail[] = [];
      const warnings: Record<string, string> = {};

      selectedSequenceForWizard.items.forEach((item) => {
        validContacts.forEach((contact) => {
          let scheduledAt = new Date(now);

          // Add delays
          if (item.delay_days) {
            scheduledAt.setDate(scheduledAt.getDate() + item.delay_days);
          }
          if (item.delay_hours) {
            scheduledAt.setHours(scheduledAt.getHours() + item.delay_hours);
          }

          // Use send_time if available
          if (item.send_time) {
            const [hours, minutes] = item.send_time.split(":").map(Number);
            scheduledAt.setHours(hours, minutes, 0, 0);
          }

          // 4. Validate against business hours
          let status: QueuedEmail["status"] = "ready";
          let reason = "";

          const countryCode = contact.country?.toUpperCase();
          const countryInfo = timezoneMap[countryCode];

          if (countryInfo) {
            // Convert scheduled time to country's timezone
            const countryTime = scheduledAt.toLocaleString("en-US", {
              timeZone: countryInfo.default_timezone,
            });
            const countryDate = new Date(countryTime);

            // Check if weekend
            const dayName = countryDate.toLocaleString("en-US", {
              weekday: "long",
            });
            const isWeekend = countryInfo.weekend_days.includes(dayName);

            if (isWeekend) {
              status = "weekend";
              reason = `Weekend in ${countryInfo.country_name} (${dayName})`;
            } else {
              // Check business hours
              const [startHours, startMinutes] =
                countryInfo.business_hours_start.split(":").map(Number);
              const [endHours, endMinutes] = countryInfo.business_hours_end
                .split(":")
                .map(Number);
              const currentHour = countryDate.getHours();
              const currentMinute = countryDate.getMinutes();

              const isWithinHours =
                currentHour >= startHours &&
                (currentHour < endHours ||
                  (currentHour === endHours && currentMinute <= endMinutes));

              if (!isWithinHours) {
                status = "outside_hours";
                reason = `Outside business hours (${currentHour}:${currentMinute.toString().padStart(2, "0")} local time)`;
              }
            }
          }

          const emailKey = `${contact.id}-${item.template_id}`;
          if (reason) {
            warnings[emailKey] = reason;
          }

          emails.push({
            contact_id: contact.id,
            contact_email: contact.value,
            template_id: item.template_id,
            template_name: item.template_name || `Template ${item.position}`,
            template_subject: item.template_subject || "No subject",
            position: item.position,
            scheduled_at: scheduledAt,
            status,
            reason,
          });
        });
      });

      setQueuedEmails(emails);
      setScheduleWarnings(warnings);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setWizardLoading(false);
    }
  };

  const saveEmailDate = () => {
    if (!editingEmail || !editingEmailDate) return;

    const newScheduledAt = new Date(editingEmailDate);

    // Re-validate the new date/time
    const updatedEmails = queuedEmails.map((email) => {
      if (
        email.contact_id === editingEmail.contact_id &&
        email.template_id === editingEmail.template_id
      ) {
        // Find the contact to get country info
        const contact = contacts.find((c) => c.id === email.contact_id);
        let status: QueuedEmail["status"] = "ready";
        let reason = "";

        if (contact && contact.country) {
          const countryCode = contact.country.toUpperCase();
          const countryInfo = countryTimezones[countryCode];

          if (countryInfo) {
            const countryTime = newScheduledAt.toLocaleString("en-US", {
              timeZone: countryInfo.default_timezone,
            });
            const countryDate = new Date(countryTime);

            // Check if weekend
            const dayName = countryDate.toLocaleString("en-US", {
              weekday: "long",
            });
            const isWeekend = countryInfo.weekend_days.includes(dayName);

            if (isWeekend) {
              status = "weekend";
              reason = `Weekend in ${countryInfo.country_name} (${dayName})`;
            } else {
              // Check business hours
              const [startHours] = countryInfo.business_hours_start
                .split(":")
                .map(Number);
              const [endHours] = countryInfo.business_hours_end
                .split(":")
                .map(Number);
              const currentHour = countryDate.getHours();

              if (currentHour < startHours || currentHour >= endHours) {
                status = "outside_hours";
                reason = `Outside business hours`;
              }
            }
          }
        }

        const emailKey = `${email.contact_id}-${email.template_id}`;
        const newWarnings = { ...scheduleWarnings };
        if (reason) {
          newWarnings[emailKey] = reason;
        } else {
          delete newWarnings[emailKey];
        }
        setScheduleWarnings(newWarnings);

        return {
          ...email,
          scheduled_at: newScheduledAt,
          status,
          reason,
        };
      }
      return email;
    });

    setQueuedEmails(updatedEmails);
    setEditingEmail(null);
    setEditingEmailDate("");
  };

  const submitToQueue = async () => {
    setWizardLoading(true);
    try {
      const response = await fetch("/api/queue/schedule-sequence", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sequence_id: selectedSequenceForWizard?.id,
          emails: queuedEmails,
        }),
      });

      const json = await response.json();

      if (json.success) {
        setShowWizard(false);
        alert(
          `✅ Successfully queued ${queuedEmails.length} emails for ${selectedIds.size} contacts`,
        );
        setSelectedIds(new Set());
        fetchContacts(meta.page, activeTab);
      } else {
        // Check if error is due to no active senders
        if (json.error === "NO_ACTIVE_SENDERS" || json.requires_sender_setup) {
          setShowWizard(false);
          setShowSenderWarning(true);
        } else {
          alert(json.error || "Failed to queue emails");
        }
      }
    } catch (err: any) {
      alert("Error: " + err.message);
    } finally {
      setWizardLoading(false);
    }
  };

  const fetchSequences = async (showModal = false) => {
    setSequencesLoading(true);
    setSequenceError(null);
    try {
      const response = await fetch("/api/sequences");
      const json = await response.json();

      if (json.success) {
        setSequences(json.data);
        if (showModal) setShowSequenceModal(true);
      } else {
        setSequenceError(json.error || "Failed to fetch sequences");
        if (showModal) setShowSequenceModal(true);
      }
    } catch (err: any) {
      setSequenceError(err.message);
      if (showModal) setShowSequenceModal(true);
    } finally {
      setSequencesLoading(false);
    }
  };

  // Load sequences when wizard step changes to 'sequence'
  React.useEffect(() => {
    if (wizardStep === "sequence") {
      fetchSequences(false);
    }
  }, [wizardStep]);

  const handleBulkAction = async (action: "queue" | "delete" | "cancel") => {
    if (selectedIds.size === 0) return;

    if (action === "queue") {
      // Start the wizard at sequence step
      setShowWizard(true);
      setWizardStep("sequence");
      setSelectedSequenceForWizard(null);
      setQueuedEmails([]);
      await fetchSequences(false);
      return;
    }

    setBulkActionLoading(true);
    try {
      if (action === "delete") {
        // Delete selected contacts
        const deletePromises = Array.from(selectedIds).map((id) =>
          fetch(`/api/contacts/${Number(id)}`, { method: "DELETE" }),
        );

        const results = await Promise.all(deletePromises);
        const allSuccessful = results.every((res) => res.ok);

        if (allSuccessful) {
          alert(`✅ Successfully deleted ${selectedIds.size} contacts`);
          setSelectedIds(new Set());
          fetchContacts(meta.page, activeTab);
        } else {
          setError("Some contacts failed to delete");
        }
      } else if (action === "cancel") {
        // Just clear selection
        setSelectedIds(new Set());
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setBulkActionLoading(false);
    }
  };

  const handleCheckEmails = async () => {
    if (selectedIds.size === 0) return;

    setBulkActionLoading(true);

    // Set checking status for selected contacts
    setContacts((prev) =>
      prev.map((c) =>
        selectedIds.has(c.id) && c.type === "email"
          ? { ...c, verification_status: "checking" as any }
          : c,
      ),
    );

    try {
      const contactIds = Array.from(selectedIds);
      console.log(`[DEBUG] Sending contact IDs for verification:`, contactIds);

      const response = await fetch("/api/email-verification", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contact_ids: contactIds,
        }),
      });

      const json = await response.json();

      console.log("Json:", json);

      if (json.success) {
        // Update each contact with its verification status
        setContacts((prev) =>
          prev.map((c) => {
            const result = json.results.find((r: any) => r.contact_id === c.id);
            return result
              ? {
                ...c,
                verification_status: result.status,
                verification_reason: result.reason,
                verification_checked_at: result.checked_at,
              }
              : c;
          }),
        );

        // Show success summary in dialog
        const { summary } = json;
        setVerificationSummary(summary);
        setShowVerificationSummary(true);
      } else {
        setError(json.error || "Failed to verify emails");
        // Reset checking status on error
        setContacts((prev) =>
          prev.map((c) =>
            c.verification_status === "checking"
              ? { ...c, verification_status: null }
              : c,
          ),
        );
      }
    } catch (err: any) {
      setError(err.message);
      // Reset checking status on error
      setContacts((prev) =>
        prev.map((c) =>
          c.verification_status === "checking"
            ? { ...c, verification_status: null }
            : c,
        ),
      );
    } finally {
      setBulkActionLoading(false);
      setSelectedIds(new Set());
    }
  };

  const handleConfirmAddToQueue = async () => {
    if (!selectedSequence) {
      alert("Please select a sequence first");
      return;
    }

    setShowSequenceModal(false);
    setBulkActionLoading(true);

    try {
      const response = await fetch("/api/contacts/add-to-queue", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contact_ids: Array.from(selectedIds),
          sequence_id: selectedSequence.id,
        }),
      });

      const json = await response.json();

      if (json.success) {
        const itemCount = selectedSequence.items?.length || 0;
        alert(
          `✅ ${json.message}\n\nCampaign ID: ${json.data.campaign_id}\nQueued: ${json.data.total_queued} emails\nSequence: ${selectedSequence.name}\nEmails per contact: ${itemCount}`,
        );
        setSelectedIds(new Set());
        setSelectedSequence(null);
        fetchContacts(meta.page, activeTab);
      } else {
        setError(json.error || "Failed to add contacts to queue");
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setBulkActionLoading(false);
    }
  };

  const handleSendEmails = async () => {
    if (!selectedSequence) {
      alert("Please select a sequence first");
      return;
    }

    setShowSequenceModal(false);
    setBulkActionLoading(true);

    try {
      // First get an active sender from the database
      const senderResponse = await fetch("/api/senders?is_active=true");
      const senderJson = await senderResponse.json();

      if (
        !senderJson.success ||
        !senderJson.data ||
        senderJson.data.length === 0
      ) {
        setError(
          "No active email sender found. Please activate an email sender first.",
        );
        return;
      }

      const sender = senderJson.data[0];

      // Send emails using the selected sequence (first template)
      const response = await fetch("/api/contacts/send-emails", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contact_ids: Array.from(selectedIds),
          sequence_id: selectedSequence.id,
          sender_id: sender.id,
        }),
      });

      const json = await response.json();

      if (json.success) {
        alert(
          `✅ ${json.message}\n\nSent: ${json.data.sent_count} emails\nFailed: ${json.data.failed_count || 0}\nSequence: ${selectedSequence.name}\nSender: ${sender.from_name || sender.from_email}`,
        );
        setSelectedIds(new Set());
        setSelectedSequence(null);
        fetchContacts(meta.page, activeTab);
      } else {
        setError(json.error || "Failed to send emails");
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setBulkActionLoading(false);
    }
  };

  const handleDeleteContact = async (id: number) => {
    if (!confirm("Are you sure you want to delete this contact?")) return;

    try {
      const res = await fetch(`/api/contacts/${id}`, { method: "DELETE" });
      const json = await res.json();
      if (json.success) {
        fetchContacts(meta.page, activeTab);
      }
    } catch (err: any) {
      setError(err.message);
    }
  };

  const handleEditContact = (contact: Contact) => {
    setEditingContact(contact);
    setEditForm({
      value: contact.value,
    });
    setShowEditModal(true);
  };

  const handleUpdateContact = async () => {
    if (!editingContact) return;

    setUpdateLoading(true);
    try {
      const res = await fetch(`/api/contacts/${editingContact.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(editForm),
      });
      const json = await res.json();
      if (json.success) {
        setShowEditModal(false);
        setEditingContact(null);
        fetchContacts(meta.page, activeTab);
      } else {
        setError(json.error);
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setUpdateLoading(false);
    }
  };

  const handleSiteLookup = async () => {
    if (!addSiteForm.url.trim()) {
      setAddError("Site URL is required");
      return;
    }
    if (!addSiteForm.country.trim()) {
      setAddError("Country is required");
      return;
    }
    setAddLoading(true);
    setAddError(null);
    try {
      const res = await fetch("/api/sites", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          url: addSiteForm.url.trim(),
          country: addSiteForm.country.trim(),
        }),
      });
      const json = await res.json();
      if (json.success) {
        setAddSiteData(json.data);
        // Pre-fill contact step from site data
        setAddForm((f) => ({
          ...f,
          source_page: json.data.url,
          country_code: (json.data.country || addSiteForm.country).toUpperCase(),
        }));
        setAddStep("contact");
      } else {
        setAddError(json.error || "Failed to resolve site");
      }
    } catch (err: any) {
      setAddError(err.message);
    } finally {
      setAddLoading(false);
    }
  };

  const handleAddContact = async () => {
    if (!addForm.value.trim()) {
      setAddError("Contact value is required");
      return;
    }
    setAddLoading(true);
    setAddError(null);
    try {
      const res = await fetch("/api/contacts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: addForm.type,
          value: addForm.value.trim(),
          site_id: addSiteData?.id,
          country_code: addForm.country_code.trim(),
          source_page: addForm.source_page.trim(),
        }),
      });
      const json = await res.json();
      if (json.success) {
        setShowAddModal(false);
        resetAddForm();
        fetchContacts(1, activeTab);
      } else {
        setAddError(json.error || "Failed to add contact");
      }
    } catch (err: any) {
      setAddError(err.message);
    } finally {
      setAddLoading(false);
    }
  };

  const handleBulkAdd = async () => {
    setBulkLoading(true);
    setBulkResult(null);

    try {
      // If a CSV file is selected, use the import API
      if (bulkFile) {
        const formData = new FormData();
        formData.append("file", bulkFile);
        // If simple mode, pass the site_id
        if (bulkMode === "simple" && bulkSiteData) {
          formData.append("site_id", bulkSiteData.id.toString());
        }
        const res = await fetch("/api/contacts/import", {
          method: "POST",
          body: formData,
        });
        const json = await res.json();
        if (json.success) {
          setBulkResult(json.data);
          fetchContacts(1, activeTab);
        } else {
          setBulkResult({ imported: 0, failed: 0, errors: [json.error] });
        }
        return;
      }

      // Otherwise parse the pasted text — one value per line
      const lines = bulkText
        .split("\n")
        .map((l) => l.trim())
        .filter(Boolean);

      if (lines.length === 0) {
        setBulkResult({ imported: 0, failed: 0, errors: ["No contacts entered"] });
        return;
      }

      let imported = 0;
      let failed = 0;
      const errors: string[] = [];

      await Promise.all(
        lines.map(async (value, idx) => {
          try {
            const res = await fetch("/api/contacts", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                type: bulkType,
                value,
                site_id: bulkSiteData?.id,
                country_code: bulkSiteData?.country,
                source_page: bulkSiteData?.url,
              }),
            });
            const json = await res.json();
            if (json.success) {
              imported++;
            } else {
              failed++;
              errors.push(`Line ${idx + 1} (${value}): ${json.error}`);
            }
          } catch (err: any) {
            failed++;
            errors.push(`Line ${idx + 1} (${value}): ${err.message}`);
          }
        }),
      );

      setBulkResult({ imported, failed, errors });
      if (imported > 0) fetchContacts(1, activeTab);
    } finally {
      setBulkLoading(false);
    }
  };

  const handleBulkSiteLookup = async () => {
    if (!bulkSiteForm.url.trim()) {
      setBulkResult({ imported: 0, failed: 0, errors: ["Site URL is required"] });
      return;
    }
    if (!bulkSiteForm.country.trim()) {
      setBulkResult({ imported: 0, failed: 0, errors: ["Country is required"] });
      return;
    }
    setBulkLoading(true);
    try {
      const res = await fetch("/api/sites", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          url: bulkSiteForm.url.trim(),
          country: bulkSiteForm.country.trim(),
        }),
      });
      const json = await res.json();
      if (json.success) {
        setBulkSiteData(json.data);
        setBulkStep("import");
      } else {
        setBulkResult({ imported: 0, failed: 0, errors: [json.error || "Failed to resolve site"] });
      }
    } catch (err: any) {
      setBulkResult({ imported: 0, failed: 0, errors: [err.message] });
    } finally {
      setBulkLoading(false);
    }
  };

  // Apply active filters to the contact list
  const displayContacts = React.useMemo(() => {
    let list = contacts;

    if (filters.hide_invalid) {
      list = list.filter((c) => c.verification_status !== "invalid");
    }

    if (filters.hide_duplicates) {
      const seen = new Set<string>();
      list = list.filter((c) => {
        const key = c.value.toLowerCase().trim();
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      });
    }

    return list;
  }, [contacts, filters.hide_invalid, filters.hide_duplicates]);

  // Count how many contacts are hidden by the active filters
  const hiddenByFilters = contacts.length - displayContacts.length;

  // Ids of duplicate contacts (same email as an earlier entry)
  const duplicateIds = React.useMemo(() => {
    const seen = new Set<string>();
    const dupes = new Set<number>();
    for (const c of contacts) {
      const key = c.value.toLowerCase().trim();
      if (seen.has(key)) {
        dupes.add(c.id);
      } else {
        seen.add(key);
      }
    }
    return dupes;
  }, [contacts]);

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      {error && (
        <Card className="border-destructive">
          <CardContent className="p-4 flex items-center gap-3 text-destructive">
            <X className="h-5 w-5" />
            <p>{error}</p>
          </CardContent>
        </Card>
      )}

      <div className="flex items-center justify-between">
        <div className="space-y-1">
          <h2 className="text-3xl font-bold tracking-tight">Contacts</h2>
          <p className="text-muted-foreground">
            Manage your prospects and leads
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            className="gap-2"
            onClick={() => {
              resetBulkForm();
              setShowBulkModal(true);
            }}>
            <Upload className="h-4 w-4" />
            <span className="hidden sm:inline">Bulk Add</span>
          </Button>
          <Button
            size="sm"
            className="gap-2"
            onClick={() => {
              setAddError(null);
              setAddForm({ type: "email", value: "", country_code: "", source_page: "" });
              setShowAddModal(true);
            }}>
            <UserPlus className="h-4 w-4" />
            <span className="hidden sm:inline">Add Contact</span>
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <Card>
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-muted-foreground">
                Emails
              </p>
              <p className="text-2xl font-bold">{stats.email}</p>
            </div>
            <Mail className="h-8 w-8 text-muted-foreground opacity-20" />
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-muted-foreground">
                Phones
              </p>
              <p className="text-2xl font-bold">{stats.phone}</p>
            </div>
            <Phone className="h-8 w-8 text-muted-foreground opacity-20" />
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-muted-foreground">
                LinkedIn
              </p>
              <p className="text-2xl font-bold">{stats.linkedin}</p>
            </div>
            <ExternalLink className="h-8 w-8 text-muted-foreground opacity-20" />
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="px-4 sm:px-6">
          <div className="flex flex-col md:flex-row md:items-center gap-4 justify-between border-b pb-4 -mx-4 sm:-mx-6 px-4 sm:px-6">
            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-2 order-2 md:order-1 w-full md:w-auto">
              {/* Search input */}
              <div className="relative w-full max-w-sm">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <input
                  className="w-full bg-muted/40 border border-input rounded-lg pl-10 pr-10 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary"
                  placeholder="Search contacts..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleSearch()}
                />
                {searchQuery && (
                  <button
                    onClick={() => {
                      setSearchQuery("");
                      fetchContacts(1, activeTab);
                    }}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                    <X className="h-4 w-4" />
                  </button>
                )}
              </div>

              {/* Advanced Filters Toggle */}
              <div className="flex items-center gap-2 flex-shrink-0">
                {hiddenByFilters > 0 && (
                  <span className="text-xs text-muted-foreground">
                    {hiddenByFilters} hidden
                  </span>
                )}

                <button
                  onClick={() => setShowFilters((v) => !v)}
                  className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-md border text-xs font-medium transition-colors ${showFilters || Object.values(filters).some(v => v)
                    ? "bg-primary/10 border-primary/40 text-primary"
                    : "border-input text-muted-foreground hover:border-primary/50 hover:text-foreground"
                    }`}>
                  <Filter className="h-3.5 w-3.5" />
                  Filters
                  {Object.values(filters).some(v => v) && (
                    <span className="ml-0.5 bg-primary/20 text-primary rounded px-1 text-[10px] font-bold">
                      {Object.values(filters).filter(v => v).length}
                    </span>
                  )}
                  {showFilters ? <ChevronUp className="h-3.5 w-3.5 ml-0.5" /> : <ChevronDown className="h-3.5 w-3.5 ml-0.5" />}
                </button>
              </div>
            </div>
            <div className="flex items-center gap-2 flex-wrap order-1 md:order-2 w-full md:w-auto justify-end">
              {selectedIds.size > 0 && (
                <>
                  <span className="text-sm text-muted-foreground">
                    {selectedIds.size} selected
                  </span>
                  <div className="flex items-center gap-1 sm:gap-2 flex-wrap">
                    <Button
                      variant="outline"
                      size="sm"
                      className="gap-2"
                      onClick={() => handleBulkAction("queue")}
                      disabled={bulkActionLoading}>
                      {bulkActionLoading ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Mail className="h-4 w-4" />
                      )}
                      <span className="hidden xs:inline">Queue</span>
                    </Button>
                    {activeTab === "email" && (
                      <Button
                        variant="outline"
                        size="sm"
                        className="gap-2"
                        onClick={handleCheckEmails}
                        disabled={bulkActionLoading}>
                        {bulkActionLoading ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <CheckCircle2 className="h-4 w-4" />
                        )}
                        <span className="hidden xs:inline">Check</span>
                      </Button>
                    )}
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleBulkAction("cancel")}
                      disabled={bulkActionLoading}>
                      <X className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      className="gap-2 text-destructive hover:text-destructive"
                      onClick={() => handleBulkAction("delete")}
                      disabled={bulkActionLoading}>
                      {bulkActionLoading ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Trash2 className="h-4 w-4" />
                      )}
                      <span className="hidden sm:inline">Delete</span>
                    </Button>
                  </div>
                </>
              )}
            </div>
          </div>

          {/* Advanced Filters Panel */}
          {showFilters && (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 pt-4 pb-2 px-4 sm:px-6 border-b">
              {/* Verification Status */}
              <div className="space-y-1.5">
                <Label className="text-xs">Verification Status</Label>
                <Select
                  value={filters.verification_status}
                  onValueChange={(v) => setFilters({ ...filters, verification_status: v === " " ? "" : v as any })}>
                  <SelectTrigger className="h-9">
                    <SelectValue placeholder="All statuses" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value=" ">All statuses</SelectItem>
                    <SelectItem value="valid">Valid</SelectItem>
                    <SelectItem value="invalid">Invalid</SelectItem>
                    <SelectItem value="risky">Risky</SelectItem>
                    <SelectItem value="unverified">Unverified</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Country */}
              <div className="space-y-1.5">
                <Label className="text-xs">Country</Label>
                <Select
                  value={filters.country}
                  onValueChange={(v) => setFilters({ ...filters, country: v === " " ? "" : v })}>
                  <SelectTrigger className="h-9">
                    <SelectValue placeholder="All countries" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value=" ">All countries</SelectItem>
                    {availableCountries.map((country) => (
                      <SelectItem key={country} value={country}>
                        {country.toUpperCase()}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Site URL */}
              <div className="space-y-1.5">
                <Label className="text-xs">Source Website</Label>
                <Select
                  value={filters.site_url}
                  onValueChange={(v) => setFilters({ ...filters, site_url: v === " " ? "" : v })}>
                  <SelectTrigger className="h-9">
                    <SelectValue placeholder="All websites" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value=" ">All websites</SelectItem>
                    {availableSites.slice(0, 50).map((site) => (
                      <SelectItem key={site.url} value={site.url}>
                        {site.url} ({site.count})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Has Site ID */}
              <div className="space-y-1.5">
                <Label className="text-xs">Has Site Link</Label>
                <Select
                  value={filters.has_site_id}
                  onValueChange={(v) => setFilters({ ...filters, has_site_id: v === " " ? "" : v as any })}>
                  <SelectTrigger className="h-9">
                    <SelectValue placeholder="All contacts" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value=" ">All contacts</SelectItem>
                    <SelectItem value="yes">Linked to site</SelectItem>
                    <SelectItem value="no">Not linked</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Hide Invalid Checkbox */}
              <div className="flex items-center space-x-2 pt-6">
                <Checkbox
                  id="hide-invalid"
                  checked={filters.hide_invalid}
                  onCheckedChange={(checked) => setFilters({ ...filters, hide_invalid: !!checked })}
                />
                <label
                  htmlFor="hide-invalid"
                  className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer">
                  Hide Invalid Emails
                </label>
              </div>

              {/* Hide Duplicates Checkbox */}
              <div className="flex items-center space-x-2 pt-6">
                <Checkbox
                  id="hide-duplicates"
                  checked={filters.hide_duplicates}
                  onCheckedChange={(checked) => setFilters({ ...filters, hide_duplicates: !!checked })}
                />
                <label
                  htmlFor="hide-duplicates"
                  className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer">
                  Hide Duplicate Contacts
                </label>
              </div>

              {/* Clear Filters Button */}
              <div className="flex items-end pt-6">
                <Button
                  variant="outline"
                  size="sm"
                  className="h-9 w-full"
                  onClick={() => setFilters({
                    verification_status: "",
                    country: "",
                    site_url: "",
                    has_site_id: "",
                    hide_invalid: false,
                    hide_duplicates: false,
                  })}>
                  <X className="h-3.5 w-3.5 mr-1.5" />
                  Clear All
                </Button>
              </div>

              {/* Show hidden count */}
              {hiddenByFilters > 0 && (
                <div className="col-span-full">
                  <p className="text-xs text-muted-foreground text-center py-2 bg-muted/30 rounded">
                    {hiddenByFilters} contact{hiddenByFilters !== 1 ? 's' : ''} hidden by active filters
                  </p>
                </div>
              )}
            </div>
          )}
        </CardHeader>
        <CardContent className="p-0">
          <Tabs
            value={activeTab}
            onValueChange={(v) => setActiveTab(v as ContactType)}>
            <div className="mx-4 sm:mx-6 mt-4 overflow-x-auto -mx-4 px-4 sm:mx-0 sm:px-0">
              <TabsList className="w-full sm:w-auto inline-flex min-w-max">
                <TabsTrigger value="all">All</TabsTrigger>
                <TabsTrigger value="email">
                  <Mail className="h-4 w-4 mr-1" />
                  <span className="hidden sm:inline">Email</span>
                </TabsTrigger>
                <TabsTrigger value="phone">
                  <Phone className="h-4 w-4 mr-1" />
                  <span className="hidden sm:inline">Phone</span>
                </TabsTrigger>
                <TabsTrigger value="linkedin">
                  <ExternalLink className="h-4 w-4 mr-1" />
                  <span className="hidden sm:inline">LinkedIn</span>
                </TabsTrigger>
              </TabsList>
            </div>

            {/* Mobile-friendly table wrapper with horizontal scroll */}
            <div className="overflow-x-auto -mx-6 px-6">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[50px] sticky left-0 bg-background">
                      <Checkbox
                        checked={
                          displayContacts.length > 0 &&
                          displayContacts.every((c) => selectedIds.has(c.id))
                        }
                        onCheckedChange={handleSelectAll}
                      />
                    </TableHead>
                    <TableHead>Contact Info</TableHead>
                    <TableHead className="hidden sm:table-cell">Type</TableHead>
                    <TableHead className="hidden md:table-cell">
                      Source Website
                    </TableHead>
                    <TableHead className="hidden lg:table-cell">
                      Country
                    </TableHead>
                    <TableHead>Verification</TableHead>
                    <TableHead className="hidden md:table-cell">
                      Added On
                    </TableHead>
                    <TableHead className="text-right sticky right-0 bg-background">
                      Actions
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {loading ? (
                    [...Array(6)].map((_, i) => (
                      <TableRow key={`skeleton-${i}`}>
                        {[...Array(7)].map((_, j) => (
                          <TableCell key={`skeleton-${i}-${j}`}>
                            <div className="h-8 bg-muted animate-pulse rounded" />
                          </TableCell>
                        ))}
                      </TableRow>
                    ))
                  ) : displayContacts.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={8} className="h-64 text-center">
                        <div className="flex flex-col items-center gap-2 opacity-40">
                          <Users className="h-12 w-12" />
                          <p className="font-medium text-lg">
                            {contacts.length > 0
                              ? "All contacts hidden by active filters"
                              : "No contacts found"}
                          </p>
                          {contacts.length > 0 && (
                            <p className="text-sm">
                              {hiddenByFilters} contact{hiddenByFilters !== 1 ? "s" : ""} hidden — turn off a filter to show them
                            </p>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ) : (
                    displayContacts.map((contact) => (
                      <TableRow
                        key={contact.id}
                        className={
                          contact.verification_status === "invalid"
                            ? "opacity-60"
                            : duplicateIds.has(contact.id)
                              ? "opacity-75"
                              : undefined
                        }>
                        <TableCell className="sticky left-0 bg-background">
                          <Checkbox
                            checked={selectedIds.has(contact.id)}
                            onCheckedChange={() => handleSelectOne(contact.id)}
                          />
                        </TableCell>
                        <TableCell className="font-medium">
                          <div className="flex flex-col sm:flex-row sm:items-center gap-1">
                            <span className="break-all">{contact.value}</span>
                            {/* Duplicate badge */}
                            {duplicateIds.has(contact.id) && (
                              <span className="inline-flex items-center gap-1 text-[10px] font-semibold uppercase px-1.5 py-0.5 rounded bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/25 flex-shrink-0">
                                <Copy className="h-2.5 w-2.5" />
                                Duplicate
                              </span>
                            )}
                            {/* Show type inline on mobile */}
                            <div className="flex items-center gap-1 sm:hidden">
                              <TypeIcon type={contact.type} />
                              <span className="text-[10px] text-muted-foreground uppercase">
                                {contact.type}
                              </span>
                            </div>
                          </div>
                          {/* Show country below contact on mobile */}
                          {(contact.country || contact.site_url) && (
                            <div className="flex flex-wrap items-center gap-2 mt-1 sm:hidden text-xs text-muted-foreground">
                              {contact.country && (
                                <span className="bg-muted/50 px-1.5 py-0.5 rounded text-[10px] uppercase font-bold">
                                  {contact.country}
                                </span>
                              )}
                            </div>
                          )}
                        </TableCell>
                        <TableCell className="hidden sm:table-cell">
                          <div className="flex items-center gap-2">
                            <TypeIcon type={contact.type} />
                            <span className="capitalize text-xs">
                              {contact.type}
                            </span>
                          </div>
                        </TableCell>
                        <TableCell className="hidden md:table-cell max-w-[200px] truncate text-muted-foreground text-xs">
                          {contact.site_url || "N/A"}
                        </TableCell>
                        <TableCell className="hidden lg:table-cell">
                          {contact.country ? (
                            <span className="bg-muted px-2 py-0.5 rounded text-[10px] uppercase font-bold tracking-tight">
                              {contact.country}
                            </span>
                          ) : (
                            "N/A"
                          )}
                        </TableCell>
                        <TableCell>
                          {contact.type === "email" ? (
                            contact.verification_status === "checking" ? (
                              <Loader2 className="h-4 w-4 animate-spin text-blue-500" />
                            ) : contact.verification_status === "valid" ? (
                              <div className="flex items-center gap-1">
                                <CheckCircle2 className="h-4 w-4 text-green-500" />
                                <span className="text-xs text-green-600 hidden sm:inline">
                                  Valid
                                </span>
                                {contact.overall_score && (
                                  <span className="text-xs font-semibold text-green-700">
                                    - {contact.overall_score}%
                                  </span>
                                )}
                              </div>
                            ) : contact.verification_status === "invalid" ? (
                              <div className="flex items-center gap-1">
                                <XCircle className="h-4 w-4 text-red-500" />
                                <span className="text-xs text-red-600 hidden sm:inline">
                                  Invalid
                                </span>
                                {contact.overall_score && (
                                  <span className="text-xs font-semibold text-red-700">
                                    - {contact.overall_score}%
                                  </span>
                                )}
                              </div>
                            ) : contact.verification_status === "risky" ? (
                              <div className="flex items-center gap-1">
                                <AlertTriangle className="h-4 w-4 text-yellow-500" />
                                <span className="text-xs text-yellow-600 hidden sm:inline">
                                  Risky
                                </span>
                                {contact.overall_score && (
                                  <span className="text-xs font-semibold text-yellow-700">
                                    - {contact.overall_score}%
                                  </span>
                                )}
                              </div>
                            ) : (
                              <div className="flex items-center gap-1 opacity-50">
                                <AlertCircle className="h-4 w-4" />
                                <span className="text-xs hidden sm:inline">
                                  Unverified
                                </span>
                              </div>
                            )
                          ) : (
                            <span className="text-xs text-muted-foreground">
                              N/A
                            </span>
                          )}
                        </TableCell>
                        <TableCell className="hidden md:table-cell text-muted-foreground text-xs">
                          {formatDate(contact.created_at)}
                        </TableCell>
                        <TableCell className="text-right sticky right-0 bg-background">
                          <div className="flex items-center justify-end gap-1">
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8"
                              onClick={() => handleEditContact(contact)}>
                              <Pencil className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 text-destructive hover:text-destructive"
                              onClick={() => handleDeleteContact(contact.id)}>
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>
          </Tabs>
        </CardContent>
        <div className="flex items-center justify-between p-4 border-t gap-2 bg-muted/5">
          <div className="text-xs text-muted-foreground hidden sm:block">
            Showing <span className="font-medium">{contacts.length}</span> of{" "}
            <span className="font-medium">{meta.total}</span> contacts
          </div>
          <div className="flex items-center gap-1 sm:gap-2 mx-auto sm:mx-0">
            <Button
              variant="outline"
              size="icon"
              className="h-8 w-8 hidden xs:flex"
              disabled={meta.page <= 1}
              onClick={() => fetchContacts(1, activeTab)}
              title="First Page">
              <ChevronUp className="h-4 w-4 -rotate-90" />
              <ChevronUp className="h-4 w-4 -rotate-90 -ml-2" />
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="h-8 gap-1"
              disabled={meta.page <= 1}
              onClick={() => fetchContacts(meta.page - 1, activeTab)}>
              <ChevronUp className="h-4 w-4 -rotate-90" />
              <span className="hidden xs:inline">Prev</span>
            </Button>

            <div className="flex items-center gap-1 mx-1">
              {Array.from({ length: Math.min(5, meta.totalPages) }, (_, i) => {
                let pageNum: number;
                if (meta.totalPages <= 5) {
                  pageNum = i + 1;
                } else if (meta.page <= 3) {
                  pageNum = i + 1;
                } else if (meta.page >= meta.totalPages - 2) {
                  pageNum = meta.totalPages - 4 + i;
                } else {
                  pageNum = meta.page - 2 + i;
                }

                return (
                  <Button
                    key={pageNum}
                    variant={meta.page === pageNum ? "default" : "outline"}
                    size="icon"
                    className="h-8 w-8 text-xs"
                    onClick={() => fetchContacts(pageNum, activeTab)}>
                    {pageNum}
                  </Button>
                );
              })}
            </div>

            <Button
              variant="outline"
              size="sm"
              className="h-8 gap-1"
              disabled={meta.page >= meta.totalPages}
              onClick={() => fetchContacts(meta.page + 1, activeTab)}>
              <span className="hidden xs:inline">Next</span>
              <ChevronRight className="h-4 w-4" />
            </Button>
            <Button
              variant="outline"
              size="icon"
              className="h-8 w-8 hidden xs:flex"
              disabled={meta.page >= meta.totalPages}
              onClick={() => fetchContacts(meta.totalPages, activeTab)}
              title="Last Page">
              <ChevronRight className="h-4 w-4" />
              <ChevronRight className="h-4 w-4 -ml-2" />
            </Button>
          </div>
        </div>
      </Card>

      {/* Sequence Selection Modal */}
      <Dialog open={showSequenceModal} onOpenChange={setShowSequenceModal}>
        <DialogContent className="w-[95%] mx-auto max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Select Email Sequence</DialogTitle>
            <DialogDescription>
              Choose a sequence to add {selectedIds.size} selected contact(s) to
              the queue
            </DialogDescription>
          </DialogHeader>

          {sequencesLoading ? (
            <div className="flex flex-col items-center justify-center py-8">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
              <p className="mt-2 text-sm text-muted-foreground">
                Loading sequences...
              </p>
            </div>
          ) : sequenceError ? (
            <div className="flex flex-col items-center justify-center py-8">
              <AlertCircle className="h-12 w-12 text-destructive mb-2" />
              <p className="text-lg font-semibold">Error Loading Sequences</p>
              <p className="text-sm text-muted-foreground text-center mt-2">
                {sequenceError}
              </p>
            </div>
          ) : sequences.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8">
              <Mail className="h-12 w-12 text-muted-foreground mb-2" />
              <p className="text-lg font-semibold">No Sequences Found</p>
              <p className="text-sm text-muted-foreground text-center mt-2 max-w-md">
                Create sequences first to add contacts to email queues. Go to
                the Sequences page to create one.
              </p>
            </div>
          ) : (
            <div className="space-y-3 py-4">
              {sequences.map((sequence) => (
                <div
                  key={sequence.id}
                  className={`border rounded-lg p-4 cursor-pointer transition-colors ${selectedSequence?.id === sequence.id
                    ? "border-primary bg-primary/5 ring-2 ring-primary/20"
                    : "border-border hover:border-primary/50 hover:bg-muted/50"
                    }`}
                  onClick={() => setSelectedSequence(sequence)}>
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <h3 className="font-semibold">{sequence.name}</h3>
                        {!sequence.is_active && (
                          <span className="text-xs bg-muted-foreground/20 text-muted-foreground px-2 py-0.5 rounded">
                            Inactive
                          </span>
                        )}
                        <span className="text-xs bg-blue-500/10 text-blue-500 px-2 py-0.5 rounded">
                          {sequence.items?.length || 0} emails
                        </span>
                      </div>
                      {sequence.description && (
                        <p className="text-sm text-muted-foreground mt-1">
                          {sequence.description}
                        </p>
                      )}
                      {sequence.items && sequence.items.length > 0 && (
                        <div className="mt-2 flex flex-wrap gap-2">
                          {sequence.items.slice(0, 4).map((item, idx) => (
                            <span
                              key={item.id}
                              className="text-xs bg-muted px-2 py-1 rounded">
                              {idx + 1}. {item.template_name || "Unknown"}
                              {item.delay_days && ` (+${item.delay_days}d)`}
                            </span>
                          ))}
                          {sequence.items.length > 4 && (
                            <span className="text-xs text-muted-foreground">
                              +{sequence.items.length - 4} more
                            </span>
                          )}
                        </div>
                      )}
                    </div>
                    <div className="ml-4">
                      <div
                        className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${selectedSequence?.id === sequence.id
                          ? "border-primary bg-primary"
                          : "border-muted-foreground"
                          }`}>
                        {selectedSequence?.id === sequence.id && (
                          <div className="w-2.5 h-2.5 rounded-full bg-white" />
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          <DialogFooter className="flex gap-2">
            <Button
              variant="outline"
              onClick={() => {
                setShowSequenceModal(false);
                setSelectedSequence(null);
              }}
              disabled={bulkActionLoading}>
              Cancel
            </Button>
            <Button
              onClick={handleConfirmAddToQueue}
              disabled={
                !selectedSequence || bulkActionLoading || sequences.length === 0
              }
              variant="outline"
              className="gap-2">
              {bulkActionLoading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Adding to Queue...
                </>
              ) : (
                <>
                  <Mail className="h-4 w-4" />
                  Add to Queue
                </>
              )}
            </Button>
            {selectedSequence && (
              <Button
                onClick={handleSendEmails}
                disabled={bulkActionLoading}
                className="gap-2 bg-green-600 hover:bg-green-700 text-white">
                {bulkActionLoading ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Sending...
                  </>
                ) : (
                  <>Send Emails</>
                )}
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Sequence Wizard Modal */}
      <Dialog open={showWizard} onOpenChange={setShowWizard}>
        <DialogContent className="w-[95%] mx-auto max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {wizardStep === "sequence" && "Step 1: Select Email Sequence"}
              {wizardStep === "schedule" && "Step 2: Schedule Emails"}
            </DialogTitle>
            <DialogDescription>
              {wizardStep === "sequence" &&
                `Adding ${selectedIds.size} contact(s) to email queue`}
              {wizardStep === "schedule" &&
                `Review and schedule ${queuedEmails.length} emails`}
            </DialogDescription>
          </DialogHeader>

          {/* Step 1: Select Sequence */}
          {wizardStep === "sequence" && (
            <div className="space-y-4 py-4">
              {sequencesLoading ? (
                <div className="flex justify-center py-8">
                  <Loader2 className="h-8 w-8 animate-spin" />
                </div>
              ) : (
                <>
                  {/* Search Input */}
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="Search sequences..."
                      className="pl-10"
                      value={sequenceSearchQuery}
                      onChange={(e) => setSequenceSearchQuery(e.target.value)}
                    />
                  </div>

                  {/* Info Message */}
                  {!sequenceSearchQuery && sequences.length > 3 && (
                    <div className="flex items-center gap-2 text-sm text-muted-foreground bg-muted/50 px-3 py-2 rounded-lg">
                      <Info className="h-4 w-4" />
                      <span>
                        Showing 3 latest sequences. Use search to find more.
                      </span>
                    </div>
                  )}

                  {/* Filtered Sequences */}
                  <div className="space-y-3 max-h-[400px] overflow-y-auto">
                    {sequences
                      .filter((seq) => {
                        // First filter by search query
                        const matchesSearch =
                          !sequenceSearchQuery ||
                          seq.name
                            .toLowerCase()
                            .includes(sequenceSearchQuery.toLowerCase()) ||
                          seq.description
                            ?.toLowerCase()
                            .includes(sequenceSearchQuery.toLowerCase());

                        if (!matchesSearch) return false;

                        // If searching, show all matching sequences
                        if (sequenceSearchQuery) return true;

                        // If not searching, show only 3 latest sequences
                        const sortedSequences = [...sequences].sort(
                          (a, b) =>
                            new Date(b.created_at).getTime() -
                            new Date(a.created_at).getTime(),
                        );
                        const latestThreeIds = sortedSequences
                          .slice(0, 3)
                          .map((s) => s.id);

                        return latestThreeIds.includes(seq.id);
                      })
                      .sort((a, b) => {
                        // Sort by created_at descending (newest first)
                        return (
                          new Date(b.created_at).getTime() -
                          new Date(a.created_at).getTime()
                        );
                      })
                      .map((sequence) => {
                        const hasEmails = (sequence.items?.length || 0) > 0;

                        return (
                          <div
                            key={sequence.id}
                            className={`border rounded-lg p-4 transition-colors ${!hasEmails
                              ? "border-muted bg-muted/30 cursor-not-allowed opacity-60"
                              : selectedSequenceForWizard?.id === sequence.id
                                ? "border-primary bg-primary/5 cursor-pointer"
                                : "border-border hover:border-primary/50 cursor-pointer"
                              }`}
                            onClick={() =>
                              hasEmails &&
                              setSelectedSequenceForWizard(sequence)
                            }>
                            <div className="flex items-start justify-between">
                              <div className="flex-1">
                                <div className="flex items-center gap-2">
                                  <h3 className="font-semibold">
                                    {sequence.name}
                                  </h3>
                                  {!hasEmails && (
                                    <span className="text-xs bg-amber-500/10 text-amber-600 px-2 py-0.5 rounded">
                                      Empty
                                    </span>
                                  )}
                                </div>
                                {sequence.description && (
                                  <p className="text-sm text-muted-foreground mt-1">
                                    {sequence.description}
                                  </p>
                                )}

                                {!hasEmails ? (
                                  <div className="mt-3 p-3 bg-background rounded border border-dashed border-muted-foreground/30">
                                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                                      <AlertCircle className="h-4 w-4" />
                                      <span>
                                        Add emails to this sequence first
                                      </span>
                                    </div>
                                  </div>
                                ) : (
                                  <div className="flex items-center gap-2 mt-2">
                                    <span className="text-xs bg-blue-500/10 text-blue-500 px-2 py-1 rounded">
                                      {sequence.items?.length || 0} emails
                                    </span>
                                    {sequence.items
                                      ?.slice(0, 3)
                                      .map((item, idx) => (
                                        <span
                                          key={item.id}
                                          className="text-xs bg-muted px-2 py-1 rounded">
                                          {idx + 1}. {item.template_name}
                                          {item.delay_days &&
                                            ` (+${item.delay_days}d)`}
                                        </span>
                                      ))}
                                  </div>
                                )}
                              </div>
                              {hasEmails &&
                                selectedSequenceForWizard?.id ===
                                sequence.id && (
                                  <CheckCircle2 className="h-5 w-5 text-primary shrink-0" />
                                )}
                            </div>
                          </div>
                        );
                      })}
                  </div>
                </>
              )}
              <DialogFooter>
                <Button variant="outline" onClick={() => setShowWizard(false)}>
                  Cancel
                </Button>
                <Button
                  onClick={handleWizardNext}
                  disabled={
                    !selectedSequenceForWizard ||
                    (selectedSequenceForWizard.items?.length || 0) === 0
                  }>
                  Next <ChevronRight className="h-4 w-4 ml-2" />
                </Button>
              </DialogFooter>
            </div>
          )}

          {/* Step 2: Schedule Emails */}
          {wizardStep === "schedule" && (
            <div className="space-y-4 py-4">
              <div className="bg-muted/50 p-4 rounded-lg">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <Calendar className="h-4 w-4 text-primary" />
                    <h3 className="font-semibold text-sm">
                      Email Schedule Validation
                    </h3>
                  </div>
                  {Object.keys(scheduleWarnings).length > 0 && (
                    <div className="flex items-center gap-2 text-amber-600">
                      <AlertTriangle className="h-4 w-4" />
                      <span className="text-sm font-medium">
                        {Object.keys(scheduleWarnings).length} warning(s)
                      </span>
                    </div>
                  )}
                </div>
                <p className="text-sm text-muted-foreground">
                  {queuedEmails.length} emails scheduled for {selectedIds.size}{" "}
                  contacts
                </p>
                {Object.keys(scheduleWarnings).length > 0 && (
                  <div className="mt-2 text-xs text-amber-600">
                    Some emails are scheduled outside business hours or on
                    weekends. Review and update them below.
                  </div>
                )}
              </div>

              {/* Email Schedule List with Edit Capability */}
              <div className="space-y-2">
                <h4 className="text-sm font-medium">
                  Scheduled Emails (click date/time to edit)
                </h4>
                <div className="space-y-2 max-h-[400px] overflow-y-auto">
                  {queuedEmails.map((email, idx) => {
                    const scheduleDate = new Date(email.scheduled_at);
                    const now = new Date();
                    const isEditing =
                      email.contact_id === editingEmail?.contact_id &&
                      email.template_id === editingEmail?.template_id;
                    const emailKey = `${email.contact_id}-${email.template_id}`;
                    const hasWarning = scheduleWarnings[emailKey];

                    // Find contact for this email
                    const contact = contacts.find(
                      (c) => c.id === email.contact_id,
                    );
                    const countryInfo = contact?.country
                      ? countryTimezones[contact.country.toUpperCase()]
                      : null;

                    // Show local time in recipient's timezone
                    const localTime = countryInfo
                      ? scheduleDate.toLocaleString("en-US", {
                        timeZone: countryInfo.default_timezone,
                        hour: "2-digit",
                        minute: "2-digit",
                        weekday: "short",
                        month: "short",
                        day: "numeric",
                      })
                      : scheduleDate.toLocaleString();

                    return (
                      <div
                        key={`${email.contact_id}-${email.template_id}-${idx}`}
                        className={`flex flex-col sm:flex-row sm:items-start gap-2 sm:gap-3 p-3 border rounded-lg transition-colors ${hasWarning
                          ? "border-amber-500/50 bg-amber-500/5"
                          : email.status === "ready"
                            ? "border-emerald-500/50 bg-emerald-500/5"
                            : "border-border hover:bg-muted/50"
                          }`}
                        onClick={() => !isEditing && setEditingEmail(email)}>
                        <div className="flex-1 space-y-2">
                          <div className="flex flex-wrap items-center gap-1.5">
                            <span className="text-xs bg-blue-500/10 text-blue-500 px-2 py-0.5 rounded font-medium shrink-0">
                              {email.position}
                            </span>
                            <p className="text-sm font-medium truncate">
                              {email.template_name}
                            </p>
                            {hasWarning && (
                              <span className="text-xs bg-amber-500/10 text-amber-600 px-2 py-0.5 rounded flex items-center gap-1 shrink-0">
                                <AlertCircle className="h-3 w-3" />
                                {email.status === "weekend"
                                  ? "Weekend"
                                  : "Outside Hours"}
                              </span>
                            )}
                            {!hasWarning && email.status === "ready" && (
                              <span className="text-xs bg-emerald-500/10 text-emerald-600 px-2 py-0.5 rounded flex items-center gap-1 shrink-0">
                                <CheckCircle2 className="h-3 w-3" />
                                Valid
                              </span>
                            )}
                          </div>
                          <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                            <Mail className="h-3 w-3 shrink-0" />
                            <span className="truncate">
                              {email.contact_email}
                            </span>
                            {contact?.country && (
                              <span className="bg-muted px-2 py-0.5 rounded text-[10px] uppercase font-bold tracking-tight shrink-0">
                                {contact.country}
                              </span>
                            )}
                          </div>

                          {/* Warning Message */}
                          {hasWarning && (
                            <div className="text-xs text-amber-600 bg-amber-500/10 px-2 py-1 rounded">
                              {email.reason}
                            </div>
                          )}

                          {/* Edit Mode */}
                          {isEditing && (
                            <div
                              className="mt-2 space-y-2"
                              onClick={(e) => e.stopPropagation()}>
                              <Input
                                type="datetime-local"
                                value={editingEmailDate}
                                onChange={(e) =>
                                  setEditingEmailDate(e.target.value)
                                }
                                min={new Date().toISOString().slice(0, 16)}
                                className="text-sm"
                              />
                              <div className="flex gap-2">
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="flex-1"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    saveEmailDate();
                                  }}>
                                  Save
                                </Button>
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setEditingEmail(null);
                                  }}>
                                  Cancel
                                </Button>
                              </div>
                            </div>
                          )}
                        </div>

                        {/* Scheduled Date Display */}
                        {!isEditing && (
                          <div
                            className="text-left sm:text-right shrink-0 cursor-pointer hover:bg-muted p-2 rounded w-full sm:w-auto"
                            onClick={(e) => {
                              e.stopPropagation();
                              setEditingEmail(email);
                              setEditingEmailDate(
                                new Date(email.scheduled_at)
                                  .toISOString()
                                  .slice(0, 16),
                              );
                            }}>
                            <p className="text-xs text-muted-foreground">
                              {contact?.country
                                ? `Local Time (${contact.country})`
                                : "Scheduled"}
                            </p>
                            <p className="text-sm font-medium">{localTime}</p>
                            <p className="text-xs text-muted-foreground">
                              Your time:{" "}
                              {scheduleDate.toLocaleDateString() ===
                                now.toLocaleDateString()
                                ? `Today ${scheduleDate.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`
                                : `${scheduleDate.toLocaleDateString()} ${scheduleDate.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`}
                            </p>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>

              <DialogFooter>
                <Button variant="outline" onClick={handleWizardBack}>
                  Back
                </Button>
                <Button
                  onClick={handleWizardNext}
                  disabled={
                    wizardLoading || Object.keys(scheduleWarnings).length > 0
                  }>
                  {wizardLoading ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    `Queue ${queuedEmails.length} Emails`
                  )}
                </Button>
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Edit Contact Modal */}
      <Dialog open={showEditModal} onOpenChange={setShowEditModal}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Contact</DialogTitle>
            <DialogDescription>
              Update the contact information below. The contact type cannot be
              changed.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Contact Type</Label>
              <div className="flex items-center gap-2 px-3 py-2 bg-muted rounded-md">
                <TypeIcon type={editingContact?.type || "email"} />
                <span className="capitalize">{editingContact?.type}</span>
                <span className="text-xs text-muted-foreground">
                  (cannot be changed)
                </span>
              </div>
            </div>
            <div className="space-y-2">
              <Label>
                {editingContact?.type === "email"
                  ? "Email Address"
                  : editingContact?.type === "phone"
                    ? "Phone Number"
                    : "LinkedIn Profile"}
              </Label>
              <Input
                value={editForm.value}
                onChange={(e) =>
                  setEditForm({ ...editForm, value: e.target.value })
                }
                placeholder={
                  editingContact?.type === "email"
                    ? "Enter email address"
                    : editingContact?.type === "phone"
                      ? "Enter phone number"
                      : "Enter LinkedIn URL"
                }
              />
            </div>
            <div className="space-y-2">
              <Label>Source Website</Label>
              <div className="px-3 py-2 bg-muted rounded-md text-sm text-muted-foreground">
                {editingContact?.site_url || "N/A"}
              </div>
              <p className="text-xs text-muted-foreground">
                Source website cannot be edited
              </p>
            </div>
            <div className="space-y-2">
              <Label>Country</Label>
              <div className="px-3 py-2 bg-muted rounded-md text-sm">
                {editingContact?.country ? (
                  <span className="bg-muted-foreground/10 px-2 py-0.5 rounded text-xs uppercase font-bold tracking-tight">
                    {editingContact.country}
                  </span>
                ) : (
                  <span className="text-muted-foreground">N/A</span>
                )}
              </div>
              <p className="text-xs text-muted-foreground">
                Country cannot be edited
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowEditModal(false)}>
              Cancel
            </Button>
            <Button onClick={handleUpdateContact} disabled={updateLoading}>
              {updateLoading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                "Save Changes"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Sender Warning Modal */}
      <Dialog open={showSenderWarning} onOpenChange={setShowSenderWarning}>
        <DialogContent className="w-[95%] mx-auto max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-amber-600">
              <AlertTriangle className="h-5 w-5" />
              No Active Email Senders Found
            </DialogTitle>
            <DialogDescription>
              You need to add or activate at least one email sender before
              queuing emails.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
              <p className="text-sm text-amber-900">
                <strong>Why is this required?</strong>
              </p>
              <p className="text-sm text-amber-800 mt-1">
                Email senders are the email accounts used to send your queued
                emails. Without at least one active sender, the system cannot
                deliver your emails.
              </p>
            </div>
            <div className="space-y-2">
              <p className="text-sm font-medium">To fix this, you can:</p>
              <ul className="text-sm text-muted-foreground space-y-1 list-disc list-inside">
                <li>Add a new email sender account</li>
                <li>Activate an existing inactive sender</li>
              </ul>
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              onClick={() => setShowSenderWarning(false)}>
              Cancel
            </Button>
            <Button
              onClick={() => {
                window.location.href = "/history#senders";
              }}
              className="bg-amber-600 hover:bg-amber-700">
              Go to Senders
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Verification Summary Dialog */}
      <Dialog
        open={showVerificationSummary}
        onOpenChange={setShowVerificationSummary}>
        <DialogContent className="w-[95%] mx-auto max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <CheckCircle2 className="h-5 w-5 text-emerald-500" />
              Verification Complete!
            </DialogTitle>
            <DialogDescription>
              Email verification has been completed successfully.
            </DialogDescription>
          </DialogHeader>
          {verificationSummary && (
            <div className="space-y-4 py-4">
              {/* Summary Table */}
              <div className="border rounded-lg overflow-hidden">
                <table className="w-full text-sm">
                  <tbody>
                    <tr
                      className="border-b"
                      style={{ backgroundColor: "rgba(16, 185, 129, 0.1)" }}>
                      <td className="px-4 py-3 flex items-center gap-2">
                        <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                        Valid Emails
                      </td>
                      <td className="px-4 py-3 text-right font-semibold text-emerald-600">
                        {verificationSummary.valid}
                      </td>
                    </tr>
                    <tr
                      className="border-b"
                      style={{ backgroundColor: "rgba(239, 68, 68, 0.1)" }}>
                      <td className="px-4 py-3 flex items-center gap-2">
                        <XCircle className="h-4 w-4 text-red-500" />
                        Invalid Emails
                      </td>
                      <td className="px-4 py-3 text-right font-semibold text-red-600">
                        {verificationSummary.invalid}
                      </td>
                    </tr>
                    <tr
                      className="border-b"
                      style={{ backgroundColor: "rgba(245, 158, 11, 0.1)" }}>
                      <td className="px-4 py-3 flex items-center gap-2">
                        <AlertTriangle className="h-4 w-4 text-amber-500" />
                        Risky Emails
                      </td>
                      <td className="px-4 py-3 text-right font-semibold text-amber-600">
                        {verificationSummary.risky}
                      </td>
                    </tr>
                    <tr
                      style={{ backgroundColor: "rgba(148, 163, 184, 0.15)" }}>
                      <td className="px-4 py-3 flex items-center gap-2">
                        <AlertCircle className="h-4 w-4 text-slate-500" />
                        Unknown Status
                      </td>
                      <td className="px-4 py-3 text-right font-semibold text-slate-600">
                        {verificationSummary.unknown}
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>

              {/* Additional Info */}
              <div className="grid grid-cols-2 gap-3">
                <div
                  className="rounded-lg p-3 text-center border"
                  style={{
                    backgroundColor: "rgba(59, 130, 246, 0.1)",
                    borderColor: "rgba(59, 130, 246, 0.3)",
                  }}>
                  <p className="text-xs text-blue-600 mb-1">Newly Verified</p>
                  <p className="text-2xl font-bold text-blue-700">
                    {verificationSummary.newly_verified}
                  </p>
                </div>
                <div
                  className="rounded-lg p-3 text-center border"
                  style={{
                    backgroundColor: "rgba(168, 85, 247, 0.1)",
                    borderColor: "rgba(168, 85, 247, 0.3)",
                  }}>
                  <p className="text-xs text-purple-600 mb-1">Reused Cached</p>
                  <p className="text-2xl font-bold text-purple-700">
                    {verificationSummary.reused}
                  </p>
                </div>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button onClick={() => setShowVerificationSummary(false)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add Contact Modal - 2 Step Flow */}
      <Dialog open={showAddModal} onOpenChange={(open) => { setShowAddModal(open); if (!open) resetAddForm(); }}>
        <DialogContent className="w-[95%] mx-auto max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <UserPlus className="h-5 w-5" />
              Add Contact {addStep === "site" ? "- Step 1: Site" : "- Step 2: Contact"}
            </DialogTitle>
            <DialogDescription>
              {addStep === "site"
                ? "First, enter the website where this contact was found."
                : "Now add the contact details for this site."}
            </DialogDescription>
          </DialogHeader>

          {addError && (
            <div className="flex items-center gap-2 text-sm text-destructive bg-destructive/10 px-3 py-2 rounded-md mx-6">
              <AlertCircle className="h-4 w-4 shrink-0" />
              {addError}
            </div>
          )}

          {/* Step 1: Site Details */}
          {addStep === "site" && (
            <div className="space-y-4 py-4 px-6">
              <div className="space-y-2">
                <Label>Site URL <span className="text-destructive">*</span></Label>
                <Input
                  placeholder="https://example.com"
                  value={addSiteForm.url}
                  onChange={(e) => setAddSiteForm({ ...addSiteForm, url: e.target.value })}
                />
                <p className="text-xs text-muted-foreground">
                  The website where you found this contact. We'll lookup or create a site record.
                </p>
              </div>
              <div className="space-y-2">
                <Label>Country <span className="text-destructive">*</span></Label>
                <Input
                  placeholder="e.g. US, GB, DE, IN"
                  maxLength={3}
                  value={addSiteForm.country}
                  onChange={(e) => setAddSiteForm({ ...addSiteForm, country: e.target.value.toUpperCase() })}
                  onKeyDown={(e) => e.key === "Enter" && handleSiteLookup()}
                />
                <p className="text-xs text-muted-foreground">
                  2–3 letter ISO country code for this website.
                </p>
              </div>
            </div>
          )}

          {/* Step 2: Contact Details */}
          {addStep === "contact" && (
            <div className="space-y-4 py-4 px-6">
              {addSiteData && (
                <div className="bg-muted/50 p-3 rounded-lg text-sm">
                  <p className="font-medium">Site: {addSiteData.url}</p>
                  <p className="text-muted-foreground">Country: {addSiteData.country.toUpperCase()}</p>
                </div>
              )}
              <div className="space-y-2">
                <Label>Type <span className="text-destructive">*</span></Label>
                <Select
                  value={addForm.type}
                  onValueChange={(v) => setAddForm({ ...addForm, type: v as typeof addForm.type })}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="email">Email</SelectItem>
                    <SelectItem value="phone">Phone</SelectItem>
                    <SelectItem value="linkedin">LinkedIn</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>
                  {addForm.type === "email" ? "Email Address" : addForm.type === "phone" ? "Phone Number" : "LinkedIn URL"}{" "}
                  <span className="text-destructive">*</span>
                </Label>
                <Input
                  placeholder={
                    addForm.type === "email" ? "name@example.com"
                      : addForm.type === "phone" ? "+1 555 000 0000"
                        : "https://linkedin.com/in/username"
                  }
                  value={addForm.value}
                  onChange={(e) => setAddForm({ ...addForm, value: e.target.value })}
                  onKeyDown={(e) => e.key === "Enter" && handleAddContact()}
                />
              </div>
            </div>
          )}

          <DialogFooter className="px-6 pb-6">
            {addStep === "site" ? (
              <>
                <Button variant="outline" onClick={() => { setShowAddModal(false); resetAddForm(); }} disabled={addLoading}>
                  Cancel
                </Button>
                <Button onClick={handleSiteLookup} disabled={addLoading}>
                  {addLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Next"}
                </Button>
              </>
            ) : (
              <>
                <Button variant="outline" onClick={() => { setAddStep("site"); setAddError(null); }} disabled={addLoading}>
                  Back
                </Button>
                <Button onClick={handleAddContact} disabled={addLoading}>
                  {addLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Add Contact"}
                </Button>
              </>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Bulk Add Modal - 3 Step Flow */}
      <Dialog
        open={showBulkModal}
        onOpenChange={(open) => {
          setShowBulkModal(open);
          if (!open) resetBulkForm();
        }}>
        <DialogContent className="w-[95%] mx-auto max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Upload className="h-5 w-5" />
              Bulk Add Contacts
              {bulkStep === "mode" && " - Step 1: Choose Mode"}
              {bulkStep === "site" && " - Step 2: Site Details"}
              {bulkStep === "import" && " - Step 3: Import"}
            </DialogTitle>
            <DialogDescription>
              {bulkStep === "mode" && "Choose how you want to bulk add contacts."}
              {bulkStep === "site" && "Enter the website where these contacts were found."}
              {bulkStep === "import" && "Paste contacts or upload a CSV file."}
            </DialogDescription>
          </DialogHeader>

          {bulkResult ? (
            /* Result view */
            <div className="space-y-4 py-4 px-6">
              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-lg border p-4 text-center bg-emerald-500/5 border-emerald-500/30">
                  <p className="text-xs text-emerald-600 mb-1">Imported</p>
                  <p className="text-3xl font-bold text-emerald-600">{bulkResult.imported}</p>
                </div>
                <div className="rounded-lg border p-4 text-center bg-red-500/5 border-red-500/30">
                  <p className="text-xs text-red-600 mb-1">Failed</p>
                  <p className="text-3xl font-bold text-red-600">{bulkResult.failed}</p>
                </div>
              </div>
              {bulkResult.errors.length > 0 && (
                <div className="space-y-1">
                  <p className="text-xs font-medium text-muted-foreground">Errors (first 10):</p>
                  <div className="max-h-40 overflow-y-auto space-y-1">
                    {bulkResult.errors.slice(0, 10).map((e, i) => (
                      <p key={i} className="text-xs text-destructive bg-destructive/5 px-2 py-1 rounded">{e}</p>
                    ))}
                  </div>
                </div>
              )}
              <DialogFooter>
                <Button variant="outline" onClick={() => { resetBulkForm(); }}>Add More</Button>
                <Button onClick={() => setShowBulkModal(false)}>Done</Button>
              </DialogFooter>
            </div>
          ) : (
            <>
              {/* Step 1: Choose Mode */}
              {bulkStep === "mode" && (
                <div className="space-y-4 py-4 px-6">
                  <div className="grid gap-3">
                    <button
                      onClick={() => { setBulkMode("simple"); setBulkStep("site"); }}
                      className={`p-4 border-2 rounded-lg text-left transition-colors hover:border-primary/50 ${bulkMode === "simple" ? "border-primary bg-primary/5" : "border-border"}`}>
                      <div className="flex items-start gap-3">
                        <div className="w-10 h-10 rounded-full bg-blue-500/10 flex items-center justify-center shrink-0">
                          <Users className="h-5 w-5 text-blue-600" />
                        </div>
                        <div className="flex-1">
                          <h3 className="font-semibold mb-1">Simple Mode</h3>
                          <p className="text-sm text-muted-foreground">All contacts from one website. Paste a list or upload CSV without site column.</p>
                        </div>
                      </div>
                    </button>
                    <button
                      onClick={() => { setBulkMode("advanced"); setBulkStep("import"); }}
                      className={`p-4 border-2 rounded-lg text-left transition-colors hover:border-primary/50 ${bulkMode === "advanced" ? "border-primary bg-primary/5" : "border-border"}`}>
                      <div className="flex items-start gap-3">
                        <div className="w-10 h-10 rounded-full bg-purple-500/10 flex items-center justify-center shrink-0">
                          <FileText className="h-5 w-5 text-purple-600" />
                        </div>
                        <div className="flex-1">
                          <h3 className="font-semibold mb-1">Advanced Mode</h3>
                          <p className="text-sm text-muted-foreground">Contacts from multiple websites. Upload CSV with site_url column.</p>
                        </div>
                      </div>
                    </button>
                  </div>
                </div>
              )}

              {/* Step 2: Site Details (Simple Mode Only) */}
              {bulkStep === "site" && (
                <div className="space-y-4 py-4 px-6">
                  <div className="space-y-2">
                    <Label>Site URL <span className="text-destructive">*</span></Label>
                    <Input
                      placeholder="https://example.com"
                      value={bulkSiteForm.url}
                      onChange={(e) => setBulkSiteForm({ ...bulkSiteForm, url: e.target.value })}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Country <span className="text-destructive">*</span></Label>
                    <Input
                      placeholder="e.g. US, GB, DE, IN"
                      maxLength={3}
                      value={bulkSiteForm.country}
                      onChange={(e) => setBulkSiteForm({ ...bulkSiteForm, country: e.target.value.toUpperCase() })}
                      onKeyDown={(e) => e.key === "Enter" && handleBulkSiteLookup()}
                    />
                  </div>
                </div>
              )}

              {/* Step 3: Import Contacts */}
              {bulkStep === "import" && (
                <div className="space-y-4 py-4 px-6">
                  {bulkSiteData && (
                    <div className="bg-muted/50 p-3 rounded-lg text-sm">
                      <p className="font-medium">Site: {bulkSiteData.url}</p>
                      <p className="text-muted-foreground">Country: {bulkSiteData.country.toUpperCase()}</p>
                    </div>
                  )}

                  {bulkMode === "simple" && (
                    <>
                      <div className="space-y-2">
                        <Label>Contact Type</Label>
                        <Select value={bulkType} onValueChange={(v) => setBulkType(v as typeof bulkType)}>
                          <SelectTrigger><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="email">Email</SelectItem>
                            <SelectItem value="phone">Phone</SelectItem>
                            <SelectItem value="linkedin">LinkedIn</SelectItem>
                          </SelectContent>
                        </Select>
                        <p className="text-xs text-muted-foreground">Used for paste input. CSV auto-detects from headers.</p>
                      </div>

                      <div className="space-y-2">
                        <Label>Paste Contacts</Label>
                        <textarea
                          className="w-full min-h-[140px] rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-primary resize-y font-mono"
                          placeholder={bulkType === "email" ? "alice@example.com\nbob@example.com" : bulkType === "phone" ? "+1 555 000 0001\n+1 555 000 0002" : "https://linkedin.com/in/alice"}
                          value={bulkText}
                          onChange={(e) => setBulkText(e.target.value)}
                        />
                        <p className="text-xs text-muted-foreground">One contact per line.</p>
                      </div>

                      <div className="relative flex items-center gap-3">
                        <div className="flex-1 border-t" />
                        <span className="text-xs text-muted-foreground">or</span>
                        <div className="flex-1 border-t" />
                      </div>
                    </>
                  )}

                  <div className="space-y-2">
                    <Label>Upload CSV File</Label>
                    <div
                      className={`border-2 border-dashed rounded-lg p-4 text-center transition-colors cursor-pointer hover:border-primary/50 ${bulkFile ? "border-primary/50 bg-primary/5" : "border-muted"}`}
                      onClick={() => document.getElementById("bulk-csv-input")?.click()}>
                      <input
                        id="bulk-csv-input"
                        type="file"
                        accept=".csv"
                        className="hidden"
                        onChange={(e) => {
                          const f = e.target.files?.[0] || null;
                          setBulkFile(f);
                          if (f) setBulkText("");
                        }}
                      />
                      {bulkFile ? (
                        <div className="flex items-center justify-center gap-2 text-sm">
                          <FileText className="h-4 w-4 text-primary" />
                          <span className="font-medium">{bulkFile.name}</span>
                          <button
                            className="text-muted-foreground hover:text-destructive"
                            onClick={(e) => {
                              e.stopPropagation();
                              setBulkFile(null);
                              (document.getElementById("bulk-csv-input") as HTMLInputElement).value = "";
                            }}>
                            <X className="h-4 w-4" />
                          </button>
                        </div>
                      ) : (
                        <div className="space-y-1">
                          <Upload className="h-6 w-6 mx-auto text-muted-foreground" />
                          <p className="text-sm text-muted-foreground">Click to upload CSV</p>
                          <p className="text-xs text-muted-foreground">
                            {bulkMode === "advanced" ? (
                              <>Required columns: <code className="bg-muted px-1 rounded">type, value, site_url, country</code></>
                            ) : (
                              <>Columns: <code className="bg-muted px-1 rounded">type, value</code> or <code className="bg-muted px-1 rounded">email, phone, ...</code></>
                            )}
                          </p>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* Footer Buttons */}
              <DialogFooter className="px-6 pb-6">
                {bulkStep === "mode" && (
                  <Button variant="outline" onClick={() => setShowBulkModal(false)}>Cancel</Button>
                )}
                {bulkStep === "site" && (
                  <>
                    <Button variant="outline" onClick={() => setBulkStep("mode")} disabled={bulkLoading}>Back</Button>
                    <Button onClick={handleBulkSiteLookup} disabled={bulkLoading}>
                      {bulkLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Next"}
                    </Button>
                  </>
                )}
                {bulkStep === "import" && (
                  <>
                    <Button variant="outline" onClick={() => bulkMode === "simple" ? setBulkStep("site") : setBulkStep("mode")} disabled={bulkLoading}>
                      Back
                    </Button>
                    <Button onClick={handleBulkAdd} disabled={bulkLoading || (!bulkText.trim() && !bulkFile)}>
                      {bulkLoading ? (
                        <><Loader2 className="h-4 w-4 animate-spin mr-2" />Importing...</>
                      ) : (
                        <><Plus className="h-4 w-4 mr-2" />Import Contacts</>
                      )}
                    </Button>
                  </>
                )}
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function TypeIcon({ type }: { type: string }) {
  if (type === "email") return <Mail className="h-3.5 w-3.5 text-blue-500" />;
  if (type === "phone")
    return <Phone className="h-3.5 w-3.5 text-emerald-500" />;
  if (type === "linkedin")
    return <ExternalLink className="h-3.5 w-3.5 text-sky-600" />;
  return null;
}
