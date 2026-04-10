"use client";

import * as React from "react";
import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, Eye, EyeOff, CheckCircle2, XCircle, Mail, ShieldCheck, Cog, Key, Shield, ExternalLink, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { AccordionItem } from "@/components/ui/accordion";

interface AppSettings {
  // Apify Settings
  apify_api_key: string;
  apify_actor_id: string;
  apify_user_id: string;
  apify_timeout_ms: string;
  apify_max_retries: string;
  apify_batch_size: string;
  apify_recheck_days: string;
  
  // Gmail Settings
  GMAIL_CLIENT_ID: string;
  GMAIL_CLIENT_SECRET: string;
  GMAIL_REDIRECT_URI: string;
  GMAIL_REFRESH_TOKEN: string;
}

export default function SettingsPage() {
  const [settings, setSettings] = useState<AppSettings>({
    apify_api_key: "",
    apify_actor_id: "yasir-on-apify/email-verifier-deliverability-checker",
    apify_user_id: "",
    apify_timeout_ms: "300000",
    apify_max_retries: "3",
    apify_batch_size: "10",
    apify_recheck_days: "30",
    GMAIL_CLIENT_ID: "",
    GMAIL_CLIENT_SECRET: "",
    GMAIL_REDIRECT_URI: "https://developers.google.com/oauthplayground",
    GMAIL_REFRESH_TOKEN: ""
  });

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [showApiKey, setShowApiKey] = useState(false);
  const [showGmailClientSecret, setShowGmailClientSecret] = useState(false);
  const [showGmailRefreshToken, setShowGmailRefreshToken] = useState(false);
  const [apiKeyValid, setApiKeyValid] = useState<boolean | null>(null);
  const [expandedSections, setExpandedSections] = useState<string[]>(["apify", "email"]);

  const toggleSection = (section: string) => {
    setExpandedSections(prev => 
      prev.includes(section) 
        ? prev.filter(s => s !== section) 
        : [...prev, section]
    );
  };

  useEffect(() => {
    fetchSettings();
  }, []);

  const fetchSettings = async () => {
    try {
      setLoading(true);
      const res = await fetch("/api/settings");
      const json = await res.json();

      if (json.success) {
        setSettings({
          apify_api_key: json.settings.apify_api_key?.value || "",
          apify_actor_id: json.settings.apify_actor_id?.value || "yasir-on-apify/email-verifier-deliverability-checker",
          apify_user_id: json.settings.apify_user_id?.value || "",
          apify_timeout_ms: json.settings.apify_timeout_ms?.value || "300000",
          apify_max_retries: json.settings.apify_max_retries?.value || "3",
          apify_batch_size: json.settings.apify_batch_size?.value || "10",
          apify_recheck_days: json.settings.apify_recheck_days?.value || "30",
          GMAIL_CLIENT_ID: json.settings.GMAIL_CLIENT_ID?.value || "",
          GMAIL_CLIENT_SECRET: json.settings.GMAIL_CLIENT_SECRET?.value || "",
          GMAIL_REDIRECT_URI: json.settings.GMAIL_REDIRECT_URI?.value || "https://developers.google.com/oauthplayground",
          GMAIL_REFRESH_TOKEN: json.settings.GMAIL_REFRESH_TOKEN?.value || ""
        });
      }
    } catch (error) {
      console.error("Error fetching settings:", error);
      toast.error("Failed to load settings");
    } finally {
      setLoading(false);
    }
  };

  const testApiKey = async () => {
    if (!settings.apify_api_key) {
      toast.error("Please enter an API key first");
      return;
    }

    setTesting(true);
    setApiKeyValid(null);

    try {
      const res = await fetch("/api/email-verification/test-api-key", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ api_key: settings.apify_api_key })
      });

      const json = await res.json();

      if (json.success) {
        setApiKeyValid(true);
        toast.success("API key is valid!");
      } else {
        setApiKeyValid(false);
        toast.error(json.error || "Invalid API key");
      }
    } catch (error) {
      setApiKeyValid(false);
      toast.error("Failed to test API key");
    } finally {
      setTesting(false);
    }
  };

  const saveSettings = async () => {
    setSaving(true);

    try {
      // Save each setting
      for (const [key, value] of Object.entries(settings)) {
        await fetch("/api/settings", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ key, value })
        });
      }

      toast.success("Settings saved successfully!");
    } catch (error) {
      console.error("Error saving settings:", error);
      toast.error("Failed to save settings");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="container mx-auto py-6">
        <div className="flex items-center justify-center h-64">
          <Loader2 className="h-8 w-8 animate-spin" />
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-6 max-w-4xl">
      <div className="mb-8">
        <h1 className="text-3xl font-bold tracking-tight">Settings</h1>
        <p className="text-muted-foreground mt-1 text-lg">
          Configure your platform integrations and system defaults.
        </p>
      </div>

      <div className="space-y-4">
        {/* Apify Settings */}
        <AccordionItem 
          title="Apify settings"
          icon={
            <div className="p-2 rounded-md bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400">
              <ShieldCheck className="h-5 w-5" />
            </div>
          }
          description="Email verification & deliverability"
          isExpanded={expandedSections.includes('apify')}
          onToggle={() => toggleSection('apify')}
        >
          <div className="space-y-6 pt-2">
            {/* API Key */}
            <div className="space-y-2">
              <Label htmlFor="api_key">
                API Key <span className="text-destructive">*</span>
              </Label>
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <Input
                    id="api_key"
                    type={showApiKey ? "text" : "password"}
                    value={settings.apify_api_key}
                    onChange={(e) => setSettings({ ...settings, apify_api_key: e.target.value })}
                    placeholder="apify_api_..."
                    className="pr-10"
                  />
                  <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1">
                    {apiKeyValid === true && <CheckCircle2 className="h-4 w-4 text-green-500" />}
                    {apiKeyValid === false && <XCircle className="h-4 w-4 text-red-500" />}
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8"
                      onClick={() => setShowApiKey(!showApiKey)}
                    >
                      {showApiKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </Button>
                  </div>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  onClick={testApiKey}
                  disabled={testing || !settings.apify_api_key}
                >
                  {testing ? <Loader2 className="h-4 w-4 animate-spin" /> : "Test"}
                </Button>
              </div>
              <p className="text-xs text-muted-foreground">
                Required for email verification. Get it from <a href="https://console.apify.com/" target="_blank" className="text-primary hover:underline">console.apify.com</a>
              </p>
            </div>

            {/* Actor ID */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="actor_id">Actor ID</Label>
                <Input
                  id="actor_id"
                  value={settings.apify_actor_id}
                  onChange={(e) => setSettings({ ...settings, apify_actor_id: e.target.value })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="user_id">User ID (Optional)</Label>
                <Input
                  id="user_id"
                  value={settings.apify_user_id}
                  onChange={(e) => setSettings({ ...settings, apify_user_id: e.target.value })}
                  placeholder="Apify username"
                />
              </div>
            </div>

            {/* Advanced Apify Settings */}
            <div className="p-4 rounded-md border bg-muted/30">
              <h4 className="text-sm font-medium mb-3 flex items-center gap-2">
                <Cog className="h-4 w-4" /> Advanced Configuration
              </h4>
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="space-y-1">
                  <Label className="text-[10px] uppercase font-bold text-muted-foreground">Timeout (ms)</Label>
                  <Input
                    type="number"
                    value={settings.apify_timeout_ms}
                    onChange={(e) => setSettings({ ...settings, apify_timeout_ms: e.target.value })}
                    className="h-8"
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-[10px] uppercase font-bold text-muted-foreground">Retries</Label>
                  <Input
                    type="number"
                    value={settings.apify_max_retries}
                    onChange={(e) => setSettings({ ...settings, apify_max_retries: e.target.value })}
                    className="h-8"
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-[10px] uppercase font-bold text-muted-foreground">Batch Size</Label>
                  <Input
                    type="number"
                    value={settings.apify_batch_size}
                    onChange={(e) => setSettings({ ...settings, apify_batch_size: e.target.value })}
                    className="h-8"
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-[10px] uppercase font-bold text-muted-foreground">Re-check (Days)</Label>
                  <Input
                    type="number"
                    value={settings.apify_recheck_days}
                    onChange={(e) => setSettings({ ...settings, apify_recheck_days: e.target.value })}
                    className="h-8"
                  />
                </div>
              </div>
            </div>
          </div>
        </AccordionItem>

        {/* Email Settings */}
        <AccordionItem 
          title="Email settings"
          icon={
            <div className="p-2 rounded-md bg-purple-100 text-purple-600 dark:bg-purple-900/30 dark:text-purple-400">
              <Mail className="h-5 w-5" />
            </div>
          }
          description="Gmail OAuth & API configuration"
          isExpanded={expandedSections.includes('email')}
          onToggle={() => toggleSection('email')}
        >
          <div className="space-y-6 pt-2">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Client ID */}
              <div className="space-y-2">
                <Label htmlFor="GMAIL_CLIENT_ID">Gmail Client ID</Label>
                <div className="relative">
                  <Input
                    id="GMAIL_CLIENT_ID"
                    value={settings.GMAIL_CLIENT_ID}
                    onChange={(e) => setSettings({ ...settings, GMAIL_CLIENT_ID: e.target.value })}
                    placeholder="OAuth 2.0 Client ID"
                    className="pl-9"
                  />
                  <Key className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                </div>
              </div>

              {/* Client Secret */}
              <div className="space-y-2">
                <Label htmlFor="GMAIL_CLIENT_SECRET">Gmail Client Secret</Label>
                <div className="relative">
                  <Input
                    id="GMAIL_CLIENT_SECRET"
                    type={showGmailClientSecret ? "text" : "password"}
                    value={settings.GMAIL_CLIENT_SECRET}
                    onChange={(e) => setSettings({ ...settings, GMAIL_CLIENT_SECRET: e.target.value })}
                    placeholder="OAuth 2.0 Client Secret"
                    className="pl-9 pr-10"
                  />
                  <Shield className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="absolute right-1 top-1/2 -translate-y-1/2 h-8 w-8"
                    onClick={() => setShowGmailClientSecret(!showGmailClientSecret)}
                  >
                    {showGmailClientSecret ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </Button>
                </div>
              </div>
            </div>

            {/* Redirect URI */}
            <div className="space-y-2">
              <Label htmlFor="GMAIL_REDIRECT_URI">Gmail Redirect URI</Label>
              <div className="relative">
                <Input
                  id="GMAIL_REDIRECT_URI"
                  value={settings.GMAIL_REDIRECT_URI}
                  onChange={(e) => setSettings({ ...settings, GMAIL_REDIRECT_URI: e.target.value })}
                  placeholder="https://..."
                  className="pl-9"
                />
                <ExternalLink className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              </div>
              <p className="text-[10px] text-muted-foreground italic">
                Must match the URI configured in Google Cloud Console.
              </p>
            </div>

            {/* Refresh Token */}
            <div className="space-y-2">
              <Label htmlFor="GMAIL_REFRESH_TOKEN">Gmail Refresh Token</Label>
              <div className="relative">
                <Input
                  id="GMAIL_REFRESH_TOKEN"
                  type={showGmailRefreshToken ? "text" : "password"}
                  value={settings.GMAIL_REFRESH_TOKEN}
                  onChange={(e) => setSettings({ ...settings, GMAIL_REFRESH_TOKEN: e.target.value })}
                  placeholder="Enter offline refresh token"
                  className="pl-9 pr-10"
                />
                <RefreshCw className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="absolute right-1 top-1/2 -translate-y-1/2 h-8 w-8"
                  onClick={() => setShowGmailRefreshToken(!showGmailRefreshToken)}
                >
                  {showGmailRefreshToken ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </Button>
              </div>
            </div>
          </div>
        </AccordionItem>
      </div>

      {/* Save Button */}
      <div className="mt-8 flex justify-end">
        <Button 
          onClick={saveSettings} 
          disabled={saving} 
          size="lg"
          className="min-w-[150px] font-semibold shadow-lg shadow-primary/20 transition-all hover:scale-[1.02]"
        >
          {saving ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin mr-2" />
              Saving...
            </>
          ) : (
            "Save All Settings"
          )}
        </Button>
      </div>

      {/* Help Card */}
      <div className="mt-12 grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card className="bg-muted/30 border-none">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <ShieldCheck className="h-4 w-4" /> Apify Help
            </CardTitle>
          </CardHeader>
          <CardContent className="text-xs text-muted-foreground space-y-2">
            <p>1. Get API Key from <a href="https://console.apify.com/" target="_blank" className="text-primary hover:underline">console.apify.com</a></p>
            <p>2. Test your key before saving to ensure connectivity.</p>
            <p>3. Default actor supports real-time deliverability checks.</p>
          </CardContent>
        </Card>

        <Card className="bg-muted/30 border-none">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <Mail className="h-4 w-4" /> Gmail Help
            </CardTitle>
          </CardHeader>
          <CardContent className="text-xs text-muted-foreground space-y-2">
            <p>1. Create project in <a href="https://console.cloud.google.com/" target="_blank" className="text-primary hover:underline">Google Cloud Console</a></p>
            <p>2. Enable Gmail API and create OAuth 2.0 Credentials.</p>
            <p>3. Use OAuth Playground to generate the Refresh Token.</p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
