"use client";

import * as React from "react";
import { useState } from "react";
import {
  Plus,
  Mail,
  Server,
  Trash2,
  CheckCircle2,
  XCircle,
  Loader2,
  Eye,
  EyeOff,
  Pencil,
  AlertCircle,
  Info,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";

interface Alias {
  id: string;
  sender_id: string;
  alias_email: string;
  alias_name: string | null;
  is_verified: boolean;
  verification_method: string;
  dns_spf_valid: boolean | null;
  dns_dkim_valid: boolean | null;
  last_used_at: string | null;
  created_at: string;
}

interface Sender {
  id: string;
  name: string;
  email: string;
  service: string;
  smtp_host?: string;
  smtp_port?: number;
  is_active: boolean;
  daily_limit: number;
  sent_today: number;
  created_at: string;
  alias_email?: string | null;
}

export default function SendersPage() {
  const [senders, setSenders] = useState<Sender[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [addingSender, setAddingSender] = useState(false);
  const [updatingSender, setUpdatingSender] = useState(false);
  const [editingSenderId, setEditingSenderId] = useState<string | null>(null);
  const [showAppPassword, setShowAppPassword] = useState(false);
  const [showSmtpPassword, setShowSmtpPassword] = useState(false);
  const [showEditAppPassword, setShowEditAppPassword] = useState(false);
  const [showEditSmtpPassword, setShowEditSmtpPassword] = useState(false);
  const [testingGmailConnection, setTestingGmailConnection] = useState(false);
  const [testingSmtpConnection, setTestingSmtpConnection] = useState(false);
  const [testingEditConnection, setTestingEditConnection] = useState(false);
  const [gmailTestPassed, setGmailTestPassed] = useState(false);
  const [smtpTestPassed, setSmtpTestPassed] = useState(false);
  const [editTestPassed, setEditTestPassed] = useState(false);

  // Alias management state
  const [aliases, setAliases] = useState<Alias[]>([]);
  const [showAliasDialog, setShowAliasDialog] = useState(false);
  const [selectedSenderIdForAliases, setSelectedSenderIdForAliases] = useState<
    string | null
  >(null);
  const [addingAlias, setAddingAlias] = useState(false);
  const [verifyingAlias, setVerifyingAlias] = useState(false);
  const [aliasFormData, setAliasFormData] = useState({
    alias_email: "",
    alias_name: "",
  });

  // Gmail form state
  const [gmailData, setGmailData] = useState({
    name: "",
    email: "",
    appPassword: "",
    dailyLimit: "500",
    aliasEmail: "", // NEW: Support aliases for Gmail too
  });

  // SMTP form state
  const [smtpData, setSmtpData] = useState({
    name: "",
    email: "",
    password: "",
    smtpHost: "smtp.gmail.com",
    smtpPort: "587",
    dailyLimit: "500",
    aliasEmail: "", // NEW: Single alias email
  });

  // Edit form state
  const [editData, setEditData] = useState({
    name: "",
    email: "",
    appPassword: "",
    smtpHost: "",
    smtpPort: "",
    dailyLimit: "500",
    service: "",
    aliasEmail: "", // NEW: Support alias editing
  });

  const fetchSenders = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/senders");
      const json = await res.json();
      if (json.success) {
        setSenders(json.data);
        // Fetch aliases for all senders
        const aliasesRes = await fetch("/api/aliases");
        const aliasesJson = await aliasesRes.json();
        if (aliasesJson.success) {
          setAliases(aliasesJson.data);
        }
      }
    } catch (error) {
      console.error("Error fetching senders:", error);
      toast.error("Failed to load senders");
    } finally {
      setLoading(false);
    }
  };

  const fetchAliases = async (senderId?: string) => {
    try {
      const url = senderId
        ? `/api/aliases?sender_id=${senderId}`
        : "/api/aliases";
      const res = await fetch(url);
      const json = await res.json();
      if (json.success) {
        setAliases(json.data);
      }
    } catch (error) {
      console.error("Error fetching aliases:", error);
      toast.error("Failed to load aliases");
    }
  };

  React.useEffect(() => {
    fetchSenders();
  }, []);

  const handleAddGmailSender = async (e: React.FormEvent) => {
    e.preventDefault();
    setAddingSender(true);

    try {
      const res = await fetch("/api/senders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: gmailData.name,
          email: gmailData.email,
          app_password: gmailData.appPassword,
          service: "gmail",
          alias_email: gmailData.aliasEmail || null,
          daily_limit: parseInt(gmailData.dailyLimit),
        }),
      });

      const json = await res.json();

      if (json.success) {
        toast.success("Gmail sender added successfully!");
        setGmailData({
          name: "",
          email: "",
          appPassword: "",
          dailyLimit: "500",
          aliasEmail: "",
        });
        setShowAddDialog(false);
        fetchSenders();
      } else {
        toast.error(json.error || "Failed to add sender");
      }
    } catch (error) {
      console.error("Error adding sender:", error);
      toast.error("Failed to add sender");
    } finally {
      setAddingSender(false);
    }
  };

  const handleAddSmtpSender = async (e: React.FormEvent) => {
    e.preventDefault();
    setAddingSender(true);

    try {
      const res = await fetch("/api/senders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: smtpData.name,
          email: smtpData.email,
          app_password: smtpData.password,
          service: "smtp",
          smtp_host: smtpData.smtpHost,
          smtp_port: parseInt(smtpData.smtpPort),
          smtp_user: smtpData.email,
          daily_limit: parseInt(smtpData.dailyLimit),
          alias_email: smtpData.aliasEmail || null, // NEW: Send alias email
        }),
      });

      const json = await res.json();

      if (json.success) {
        toast.success("SMTP sender added successfully!");
        setSmtpData({
          name: "",
          email: "",
          password: "",
          smtpHost: "smtp.gmail.com",
          smtpPort: "587",
          dailyLimit: "500",
          aliasEmail: "",
        });
        setShowAddDialog(false);
        fetchSenders();
      } else {
        toast.error(json.error || "Failed to add sender");
      }
    } catch (error) {
      console.error("Error adding sender:", error);
      toast.error("Failed to add sender");
    } finally {
      setAddingSender(false);
    }
  };

  const handleToggleActive = async (id: string, isActive: boolean) => {
    try {
      const res = await fetch(`/api/senders/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ is_active: !isActive }),
      });

      const json = await res.json();

      if (json.success) {
        toast.success(
          `Sender ${!isActive ? "activated" : "deactivated"} successfully`,
        );
        fetchSenders();
      } else {
        toast.error(json.error || "Failed to update sender");
      }
    } catch (error) {
      console.error("Error updating sender:", error);
      toast.error("Failed to update sender");
    }
  };

  const handleTestGmailConnection = async () => {
    if (!gmailData.email || !gmailData.appPassword) {
      toast.error("Please enter email and app password first");
      return;
    }

    setTestingGmailConnection(true);
    setGmailTestPassed(false);

    try {
      const res = await fetch("/api/senders/test-connection", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: gmailData.email,
          password: gmailData.appPassword,
          service: "gmail",
        }),
      });

      const json = await res.json();

      if (json.success) {
        toast.success("✓ " + json.message);
        setGmailTestPassed(true);
      } else {
        toast.error("✗ " + json.error);
        setGmailTestPassed(false);
      }
    } catch (error) {
      console.error("Error testing connection:", error);
      toast.error("Failed to test connection");
      setGmailTestPassed(false);
    } finally {
      setTestingGmailConnection(false);
    }
  };

  const handleTestSmtpConnection = async () => {
    if (!smtpData.email || !smtpData.password) {
      toast.error("Please enter email and password first");
      return;
    }

    setTestingSmtpConnection(true);
    setSmtpTestPassed(false);

    try {
      const res = await fetch("/api/senders/test-connection", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: smtpData.email,
          password: smtpData.password,
          service: "smtp",
          smtp_host: smtpData.smtpHost,
          smtp_port: smtpData.smtpPort,
        }),
      });

      const json = await res.json();

      if (json.success) {
        toast.success("✓ " + json.message);
        setSmtpTestPassed(true);
      } else {
        toast.error("✗ " + json.error);
        setSmtpTestPassed(false);
      }
    } catch (error) {
      console.error("Error testing connection:", error);
      toast.error("Failed to test connection");
      setSmtpTestPassed(false);
    } finally {
      setTestingSmtpConnection(false);
    }
  };

  const handleDeleteSender = async (id: string) => {
    if (!confirm("Are you sure you want to delete this sender?")) return;

    try {
      const res = await fetch(`/api/senders/${id}`, {
        method: "DELETE",
      });

      const json = await res.json();

      if (json.success) {
        toast.success("Sender deleted successfully");
        fetchSenders();
      } else {
        toast.error(json.error || "Failed to delete sender");
      }
    } catch (error) {
      console.error("Error deleting sender:", error);
      toast.error("Failed to delete sender");
    }
  };

  const handleEditSender = (sender: Sender) => {
    setEditingSenderId(sender.id);
    setEditData({
      name: sender.name,
      email: sender.email,
      appPassword: "",
      smtpHost: sender.smtp_host || "smtp.gmail.com",
      smtpPort: sender.smtp_port?.toString() || "587",
      dailyLimit: sender.daily_limit.toString(),
      service: sender.service,
      aliasEmail: sender.alias_email || "",
    });
    setEditTestPassed(false);
    setShowEditDialog(true);
  };

  const handleUpdateSender = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingSenderId) return;

    setUpdatingSender(true);

    try {
      const res = await fetch(`/api/senders/${editingSenderId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: editData.name,
          email: editData.email,
          app_password: editData.appPassword || undefined,
          smtp_host:
            editData.service === "smtp" ? editData.smtpHost : undefined,
          smtp_port:
            editData.service === "smtp"
              ? parseInt(editData.smtpPort)
              : undefined,
          smtp_user: editData.service === "smtp" ? editData.email : undefined,
          daily_limit: parseInt(editData.dailyLimit),
          alias_email: editData.aliasEmail || null,
        }),
      });

      const json = await res.json();

      if (json.success) {
        toast.success("Sender updated successfully!");
        setShowEditDialog(false);
        setEditingSenderId(null);
        setEditData({
          name: "",
          email: "",
          appPassword: "",
          smtpHost: "",
          smtpPort: "",
          dailyLimit: "500",
          service: "",
          aliasEmail: "",
        });
        fetchSenders();
      } else {
        toast.error(json.error || "Failed to update sender");
      }
    } catch (error) {
      console.error("Error updating sender:", error);
      toast.error("Failed to update sender");
    } finally {
      setUpdatingSender(false);
    }
  };

  const handleTestEditConnection = async () => {
    if (!editData.email || !editData.appPassword) {
      toast.error("Please enter email and password first");
      return;
    }

    setTestingEditConnection(true);
    setEditTestPassed(false);

    try {
      const res = await fetch("/api/senders/test-connection", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: editData.email,
          password: editData.appPassword,
          service: editData.service,
          smtp_host: editData.smtpHost,
          smtp_port: editData.smtpPort,
        }),
      });

      const json = await res.json();

      if (json.success) {
        toast.success("✓ " + json.message);
        setEditTestPassed(true);
      } else {
        toast.error("✗ " + json.error);
        setEditTestPassed(false);
      }
    } catch (error) {
      console.error("Error testing connection:", error);
      toast.error("Failed to test connection");
      setEditTestPassed(false);
    } finally {
      setTestingEditConnection(false);
    }
  };

  const handleOpenAliasDialog = (senderId: string) => {
    setSelectedSenderIdForAliases(senderId);
    setAliasFormData({ alias_email: "", alias_name: "" });
    setShowAliasDialog(true);
  };

  const handleAddAlias = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedSenderIdForAliases) return;

    setAddingAlias(true);

    try {
      const res = await fetch("/api/aliases", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sender_id: selectedSenderIdForAliases,
          alias_email: aliasFormData.alias_email,
          alias_name: aliasFormData.alias_name || undefined,
        }),
      });

      const json = await res.json();

      if (json.success) {
        toast.success(json.message || "Alias added successfully!");
        setAliasFormData({ alias_email: "", alias_name: "" });
        fetchAliases();
      } else {
        toast.error(json.error || "Failed to add alias");
      }
    } catch (error) {
      console.error("Error adding alias:", error);
      toast.error("Failed to add alias");
    } finally {
      setAddingAlias(false);
    }
  };

  const handleVerifyAlias = async (aliasId: string) => {
    setVerifyingAlias(true);

    try {
      const res = await fetch("/api/aliases/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ alias_id: aliasId }),
      });

      const json = await res.json();

      if (json.success) {
        toast.success("✓ " + json.message);
        fetchAliases();
      } else {
        toast.error("✗ " + json.error);
      }
    } catch (error) {
      console.error("Error verifying alias:", error);
      toast.error("Failed to verify alias");
    } finally {
      setVerifyingAlias(false);
    }
  };

  const handleToggleAliasVerified = async (
    aliasId: string,
    currentStatus: boolean,
  ) => {
    try {
      const res = await fetch(`/api/aliases/${aliasId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ is_verified: !currentStatus }),
      });

      const json = await res.json();

      if (json.success) {
        toast.success(`Alias ${!currentStatus ? "verified" : "unverified"}`);
        fetchAliases();
      } else {
        toast.error(json.error || "Failed to update alias");
      }
    } catch (error) {
      console.error("Error updating alias:", error);
      toast.error("Failed to update alias");
    }
  };

  const handleDeleteAlias = async (aliasId: string) => {
    if (!confirm("Are you sure you want to delete this alias?")) return;

    try {
      const res = await fetch(`/api/aliases/${aliasId}`, {
        method: "DELETE",
      });

      const json = await res.json();

      if (json.success) {
        toast.success("Alias deleted successfully");
        fetchAliases();
      } else {
        toast.error(json.error || "Failed to delete alias");
      }
    } catch (error) {
      console.error("Error deleting alias:", error);
      toast.error("Failed to delete alias");
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">Email Senders</h2>
          <p className="text-muted-foreground">
            Manage your email sender accounts for campaigns
          </p>
        </div>
        <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
          <DialogTrigger asChild>
            <Button className="gap-2">
              <Plus className="h-4 w-4" />
              Add Sender
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Add New Sender</DialogTitle>
              <DialogDescription>
                Choose a method to add your email sender account
              </DialogDescription>
            </DialogHeader>

            <Tabs defaultValue="gmail" className="w-full">
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="gmail" className="gap-2">
                  <Mail className="h-4 w-4" />
                  Gmail / App Password
                </TabsTrigger>
                <TabsTrigger value="smtp" className="gap-2">
                  <Server className="h-4 w-4" />
                  Custom SMTP
                </TabsTrigger>
              </TabsList>

              {/* Gmail Tab */}
              <TabsContent value="gmail">
                <form onSubmit={handleAddGmailSender} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="gmail-name">Sender Name</Label>
                    <Input
                      id="gmail-name"
                      placeholder="My Gmail Account"
                      value={gmailData.name}
                      onChange={(e) =>
                        setGmailData({ ...gmailData, name: e.target.value })
                      }
                      required
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="gmail-email">Email Address</Label>
                    <Input
                      id="gmail-email"
                      type="email"
                      placeholder="yourname@gmail.com"
                      value={gmailData.email}
                      onChange={(e) => {
                        setGmailData({ ...gmailData, email: e.target.value });
                        setGmailTestPassed(false);
                      }}
                      required
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="gmail-app-password">App Password</Label>
                    <div className="relative">
                      <Input
                        id="gmail-app-password"
                        type={showAppPassword ? "text" : "password"}
                        placeholder="xxxx xxxx xxxx xxxx"
                        value={gmailData.appPassword}
                        onChange={(e) => {
                          setGmailData({
                            ...gmailData,
                            appPassword: e.target.value,
                          });
                          setGmailTestPassed(false);
                        }}
                        required
                      />
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="absolute right-0 top-0 h-full px-3 hover:bg-transparent"
                        onClick={() => setShowAppPassword(!showAppPassword)}>
                        {showAppPassword ? (
                          <EyeOff className="h-4 w-4" />
                        ) : (
                          <Eye className="h-4 w-4" />
                        )}
                      </Button>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Use an App Password from your Google Account settings.
                      Learn how to generate one at{" "}
                      <a
                        href="https://support.google.com/accounts/answer/185833"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-primary hover:underline">
                        Google Support
                      </a>
                    </p>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="gmail-alias">Alias Email (Optional)</Label>
                    <Input
                      id="gmail-alias"
                      type="email"
                      placeholder="alias@domain.com"
                      value={gmailData.aliasEmail}
                      onChange={(e) =>
                        setGmailData({ ...gmailData, aliasEmail: e.target.value })
                      }
                    />
                    <p className="text-xs text-muted-foreground">
                      Email will be sent through this email address. Leave empty
                      to use main email.
                    </p>
                  </div>

                  <Button
                    type="button"
                    variant="outline"
                    className="w-full gap-2"
                    onClick={handleTestGmailConnection}
                    disabled={
                      testingGmailConnection ||
                      !gmailData.email ||
                      !gmailData.appPassword
                    }>
                    {testingGmailConnection ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Testing Connection...
                      </>
                    ) : (
                      <>
                        {gmailTestPassed ? (
                          <>
                            <CheckCircle2 className="h-4 w-4 text-green-500" />
                            Connection Verified
                          </>
                        ) : (
                          <>
                            <Server className="h-4 w-4" />
                            Test Connection
                          </>
                        )}
                      </>
                    )}
                  </Button>

                  <div className="space-y-2">
                    <Label htmlFor="gmail-daily-limit">Daily Limit</Label>
                    <Input
                      id="gmail-daily-limit"
                      type="number"
                      min="1"
                      max="2000"
                      value={gmailData.dailyLimit}
                      onChange={(e) =>
                        setGmailData({
                          ...gmailData,
                          dailyLimit: e.target.value,
                        })
                      }
                      required
                    />
                    <p className="text-xs text-muted-foreground">
                      Gmail free accounts: 500/day. Google Workspace: up to
                      2000/day.
                    </p>
                  </div>

                  <div className="flex gap-2 pt-4">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => setShowAddDialog(false)}
                      className="flex-1">
                      Cancel
                    </Button>
                    <Button
                      type="submit"
                      disabled={addingSender}
                      className="flex-1">
                      {addingSender ? (
                        <>
                          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                          Adding...
                        </>
                      ) : (
                        "Add Sender"
                      )}
                    </Button>
                  </div>
                </form>
              </TabsContent>

              {/* SMTP Tab */}
              <TabsContent value="smtp">
                <form onSubmit={handleAddSmtpSender} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="smtp-name">Sender Name</Label>
                    <Input
                      id="smtp-name"
                      placeholder="My SMTP Account"
                      value={smtpData.name}
                      onChange={(e) =>
                        setSmtpData({ ...smtpData, name: e.target.value })
                      }
                      required
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="smtp-email">Email Address</Label>
                    <Input
                      id="smtp-email"
                      type="email"
                      placeholder="sender@domain.com"
                      value={smtpData.email}
                      onChange={(e) => {
                        setSmtpData({ ...smtpData, email: e.target.value });
                        setSmtpTestPassed(false);
                      }}
                      required
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="smtp-host">SMTP Host</Label>
                      <Input
                        id="smtp-host"
                        placeholder="smtp.gmail.com"
                        value={smtpData.smtpHost}
                        onChange={(e) => {
                          setSmtpData({
                            ...smtpData,
                            smtpHost: e.target.value,
                          });
                          setSmtpTestPassed(false);
                        }}
                        required
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="smtp-port">SMTP Port</Label>
                      <Select
                        value={smtpData.smtpPort}
                        onValueChange={(value) => {
                          setSmtpData({ ...smtpData, smtpPort: value });
                          setSmtpTestPassed(false);
                        }}>
                        <SelectTrigger id="smtp-port">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="25">25 (Non-secure)</SelectItem>
                          <SelectItem value="465">465 (SSL)</SelectItem>
                          <SelectItem value="587">587 (TLS)</SelectItem>
                          <SelectItem value="2525">
                            2525 (Alternative)
                          </SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="smtp-password">Password</Label>
                    <div className="relative">
                      <Input
                        id="smtp-password"
                        type={showSmtpPassword ? "text" : "password"}
                        placeholder="Your email password"
                        value={smtpData.password}
                        onChange={(e) => {
                          setSmtpData({
                            ...smtpData,
                            password: e.target.value,
                          });
                          setSmtpTestPassed(false);
                        }}
                        required
                      />
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="absolute right-0 top-0 h-full px-3 hover:bg-transparent"
                        onClick={() => setShowSmtpPassword(!showSmtpPassword)}>
                        {showSmtpPassword ? (
                          <EyeOff className="h-4 w-4" />
                        ) : (
                          <Eye className="h-4 w-4" />
                        )}
                      </Button>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="smtp-alias">Alias Email (Optional)</Label>
                    <Input
                      id="smtp-alias"
                      type="email"
                      placeholder="alias@domain.com"
                      value={smtpData.aliasEmail}
                      onChange={(e) =>
                        setSmtpData({ ...smtpData, aliasEmail: e.target.value })
                      }
                    />
                    <p className="text-xs text-muted-foreground">
                      Email will be sent through this email address. Leave empty
                      to use main email.
                    </p>
                  </div>

                  <Button
                    type="button"
                    variant="outline"
                    className="w-full gap-2"
                    onClick={handleTestSmtpConnection}
                    disabled={
                      testingSmtpConnection ||
                      !smtpData.email ||
                      !smtpData.password
                    }>
                    {testingSmtpConnection ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Testing Connection...
                      </>
                    ) : (
                      <>
                        {smtpTestPassed ? (
                          <>
                            <CheckCircle2 className="h-4 w-4 text-green-500" />
                            Connection Verified
                          </>
                        ) : (
                          <>
                            <Server className="h-4 w-4" />
                            Test Connection
                          </>
                        )}
                      </>
                    )}
                  </Button>

                  <div className="space-y-2">
                    <Label htmlFor="smtp-daily-limit">Daily Limit</Label>
                    <Input
                      id="smtp-daily-limit"
                      type="number"
                      min="1"
                      value={smtpData.dailyLimit}
                      onChange={(e) =>
                        setSmtpData({
                          ...smtpData,
                          dailyLimit: e.target.value,
                        })
                      }
                      required
                    />
                  </div>

                  <div className="flex gap-2 pt-4">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => setShowAddDialog(false)}
                      className="flex-1">
                      Cancel
                    </Button>
                    <Button
                      type="submit"
                      disabled={addingSender}
                      className="flex-1">
                      {addingSender ? (
                        <>
                          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                          Adding...
                        </>
                      ) : (
                        "Add Sender"
                      )}
                    </Button>
                  </div>
                </form>
              </TabsContent>
            </Tabs>
          </DialogContent>
        </Dialog>

        {/* Edit Sender Dialog */}
        <Dialog open={showEditDialog} onOpenChange={setShowEditDialog}>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Edit Sender</DialogTitle>
              <DialogDescription>
                Update sender credentials and settings
              </DialogDescription>
            </DialogHeader>

            <form onSubmit={handleUpdateSender} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="edit-name">Sender Name</Label>
                <Input
                  id="edit-name"
                  placeholder="My Email Account"
                  value={editData.name}
                  onChange={(e) =>
                    setEditData({ ...editData, name: e.target.value })
                  }
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="edit-email">Email Address</Label>
                <Input
                  id="edit-email"
                  type="email"
                  placeholder="email@example.com"
                  value={editData.email}
                  onChange={(e) => {
                    setEditData({ ...editData, email: e.target.value });
                    setEditTestPassed(false);
                  }}
                  required
                />
              </div>

              {editData.service === "smtp" && (
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="edit-smtp-host">SMTP Host</Label>
                    <Input
                      id="edit-smtp-host"
                      placeholder="smtp.gmail.com"
                      value={editData.smtpHost}
                      onChange={(e) => {
                        setEditData({
                          ...editData,
                          smtpHost: e.target.value,
                        });
                        setEditTestPassed(false);
                      }}
                      required
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="edit-smtp-port">SMTP Port</Label>
                    <Select
                      value={editData.smtpPort}
                      onValueChange={(value) => {
                        setEditData({ ...editData, smtpPort: value });
                        setEditTestPassed(false);
                      }}>
                      <SelectTrigger id="edit-smtp-port">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="25">25 (Non-secure)</SelectItem>
                        <SelectItem value="465">465 (SSL)</SelectItem>
                        <SelectItem value="587">587 (TLS)</SelectItem>
                        <SelectItem value="2525">2525 (Alternative)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              )}

              <div className="space-y-2">
                <Label htmlFor="edit-password">
                  {editData.service === "gmail" ? "App Password" : "Password"}
                  {editData.service === "gmail" && ""}
                </Label>
                <div className="relative">
                  <Input
                    id="edit-password"
                    type={
                      editData.service === "gmail"
                        ? showEditAppPassword
                          ? "text"
                          : "password"
                        : showEditSmtpPassword
                          ? "text"
                          : "password"
                    }
                    placeholder={
                      editData.service === "gmail"
                        ? "xxxx xxxx xxxx xxxx"
                        : "Your email password"
                    }
                    value={editData.appPassword}
                    onChange={(e) => {
                      setEditData({
                        ...editData,
                        appPassword: e.target.value,
                      });
                      setEditTestPassed(false);
                    }}
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="absolute right-0 top-0 h-full px-3 hover:bg-transparent"
                    onClick={() =>
                      editData.service === "gmail"
                        ? setShowEditAppPassword(!showEditAppPassword)
                        : setShowEditSmtpPassword(!showEditSmtpPassword)
                    }>
                    {editData.service === "gmail" ? (
                      showEditAppPassword ? (
                        <EyeOff className="h-4 w-4" />
                      ) : (
                        <Eye className="h-4 w-4" />
                      )
                    ) : showEditSmtpPassword ? (
                      <EyeOff className="h-4 w-4" />
                    ) : (
                      <Eye className="h-4 w-4" />
                    )}
                  </Button>
                </div>
                {editData.service === "gmail" && (
                  <p className="text-xs text-muted-foreground">
                    Leave empty to keep existing password. Enter new password to
                    update.
                  </p>
                )}
              </div>

              <Button
                type="button"
                variant="outline"
                className="w-full gap-2"
                onClick={handleTestEditConnection}
                disabled={
                  testingEditConnection ||
                  !editData.email ||
                  (!editData.appPassword && editData.service === "gmail")
                }>
                {testingEditConnection ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Testing Connection...
                  </>
                ) : (
                  <>
                    {editTestPassed ? (
                      <>
                        <CheckCircle2 className="h-4 w-4 text-green-500" />
                        Connection Verified
                      </>
                    ) : (
                      <>
                        <Server className="h-4 w-4" />
                        Test Connection
                      </>
                    )}
                  </>
                )}
              </Button>

              <div className="space-y-2">
                <Label htmlFor="edit-alias">Alias Email (Optional)</Label>
                <Input
                  id="edit-alias"
                  type="email"
                  placeholder="alias@domain.com"
                  value={editData.aliasEmail}
                  onChange={(e) =>
                    setEditData({ ...editData, aliasEmail: e.target.value })
                  }
                />
                <p className="text-xs text-muted-foreground">
                  Email will be sent through this email address. Leave empty to
                  use main email.
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="edit-daily-limit">Daily Limit</Label>
                <Input
                  id="edit-daily-limit"
                  type="number"
                  min="1"
                  max="2000"
                  value={editData.dailyLimit}
                  onChange={(e) =>
                    setEditData({
                      ...editData,
                      dailyLimit: e.target.value,
                    })
                  }
                  required
                />
              </div>

              <div className="flex gap-2 pt-4">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setShowEditDialog(false);
                    setEditingSenderId(null);
                    setEditTestPassed(false);
                  }}
                  className="flex-1">
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={updatingSender}
                  className="flex-1">
                  {updatingSender ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Updating...
                    </>
                  ) : (
                    "Update Sender"
                  )}
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>

        {/* Add Alias Dialog */}
        <Dialog open={showAliasDialog} onOpenChange={setShowAliasDialog}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Add Email Alias</DialogTitle>
              <DialogDescription>
                Add an alias address to send emails from. You can use multiple
                aliases per sender account.
              </DialogDescription>
            </DialogHeader>

            <form onSubmit={handleAddAlias} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="alias-email">Alias Email Address</Label>
                <Input
                  id="alias-email"
                  type="email"
                  placeholder="alias@domain.com"
                  value={aliasFormData.alias_email}
                  onChange={(e) =>
                    setAliasFormData({
                      ...aliasFormData,
                      alias_email: e.target.value,
                    })
                  }
                  required
                />
                <p className="text-xs text-muted-foreground">
                  This email will be used as the "From" address when sending
                  emails. Make sure it belongs to the same domain or is properly
                  configured.
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="alias-name">Sender Name (Optional)</Label>
                <Input
                  id="alias-name"
                  placeholder="Display Name"
                  value={aliasFormData.alias_name}
                  onChange={(e) =>
                    setAliasFormData({
                      ...aliasFormData,
                      alias_name: e.target.value,
                    })
                  }
                />
                <p className="text-xs text-muted-foreground">
                  The display name for emails sent from this alias. Leave empty
                  to use the sender&apos;s default name.
                </p>
              </div>

              <div className="bg-blue-50 dark:bg-blue-950 border border-blue-200 dark:border-blue-800 rounded-lg p-3">
                <div className="flex gap-2">
                  <Info className="h-4 w-4 text-blue-600 dark:text-blue-400 flex-shrink-0 mt-0.5" />
                  <div className="text-xs text-blue-800 dark:text-blue-200">
                    <p className="font-medium mb-1">Important Notes:</p>
                    <ul className="space-y-1 list-disc list-inside">
                      <li>
                        For Gmail: Use "Send mail as" feature in Gmail Settings
                      </li>
                      <li>
                        Ensure SPF/DKIM records are configured for the alias
                        domain
                      </li>
                      <li>
                        Verify the alias before sending emails to ensure
                        deliverability
                      </li>
                    </ul>
                  </div>
                </div>
              </div>

              <div className="flex gap-2 pt-4">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setShowAliasDialog(false)}
                  className="flex-1">
                  Cancel
                </Button>
                <Button type="submit" disabled={addingAlias} className="flex-1">
                  {addingAlias ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Adding...
                    </>
                  ) : (
                    "Add Alias"
                  )}
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {/* Senders List */}
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      ) : senders.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Mail className="h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-2">No Email Senders</h3>
            <p className="text-sm text-muted-foreground text-center mb-4">
              Add your first email sender to start sending campaigns
            </p>
            <Button onClick={() => setShowAddDialog(true)} className="gap-2">
              <Plus className="h-4 w-4" />
              Add Your First Sender
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {senders.map((sender) => (
            <Card key={sender.id}>
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-2">
                    {sender.service === "gmail" ? (
                      <Mail className="h-5 w-5 text-red-500" />
                    ) : (
                      <Server className="h-5 w-5 text-blue-500" />
                    )}
                    <CardTitle className="text-base">{sender.name}</CardTitle>
                  </div>
                  <div className="flex items-center gap-1">
                    {sender.is_active ? (
                      <CheckCircle2 className="h-4 w-4 text-green-500" />
                    ) : (
                      <XCircle className="h-4 w-4 text-gray-400" />
                    )}
                  </div>
                </div>
                <CardDescription className="text-xs">
                  {sender.email}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Service:</span>
                    <span className="font-medium capitalize">
                      {sender.service.toUpperCase()}
                    </span>
                  </div>
                  {sender.smtp_host && (
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">Host:</span>
                      <span className="font-medium">{sender.smtp_host}</span>
                    </div>
                  )}
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Daily Limit:</span>
                    <span className="font-medium">{sender.daily_limit}</span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Sent Today:</span>
                    <span className="font-medium">{sender.sent_today}</span>
                  </div>

                  {/* Alias Email Display */}
                  {sender.alias_email && (
                    <div className="pt-2 border-t">
                      <div className="text-xs text-muted-foreground mb-1">
                        Sending through:
                      </div>
                      <div className="text-sm font-medium text-primary">
                        {sender.alias_email}
                      </div>
                    </div>
                  )}

                  <div className="w-full bg-secondary rounded-full h-2 mt-2">
                    <div
                      className="bg-primary h-2 rounded-full transition-all"
                      style={{
                        width: `${Math.min(
                          (sender.sent_today / sender.daily_limit) * 100,
                          100,
                        )}%`,
                      }}
                    />
                  </div>

                  <div className="flex gap-2 pt-2">
                    <Button
                      variant="outline"
                      size="sm"
                      className="flex-1"
                      onClick={() =>
                        handleToggleActive(sender.id, sender.is_active)
                      }>
                      {sender.is_active ? "Deactivate" : "Activate"}
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleEditSender(sender)}>
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="destructive"
                      size="sm"
                      onClick={() => handleDeleteSender(sender.id)}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
