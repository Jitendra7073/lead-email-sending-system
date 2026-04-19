"use client";

import * as React from "react";
import {
  Users,
  Send,
  Mail,
  TrendingUp,
  Calendar,
  CheckCircle2,
  AlertCircle,
  Info,
  ArrowRight,
  Clock,
  FileText,
} from "lucide-react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { cn, formatNumber } from "@/lib/utils";
import Link from "next/link";

interface StatsData {
  campaigns: {
    total_campaigns: number;
    running_campaigns: number;
    paused_campaigns: number;
    completed_campaigns: number;
  };
  contacts: {
    total_contacts: number;
    contacts_with_email: number;
  };
  emails: {
    overall: {
      total_emails: number;
      total_sent: number;
      total_failed: number;
      success_rate: number;
    };
    today: {
      sent_today: number;
      failed_today: number;
      pending_today: number;
    };
    weekly: {
      sent_week: number;
      failed_week: number;
    };
  };
  senders: {
    total_senders: number;
    active_senders: number;
    total_daily_capacity: number;
    total_sent_today: number;
  };
  templates?: {
    total_templates: number;
    templates_by_tag: Record<string, number>;
  };
}

export default function Dashboard() {
  const [data, setData] = React.useState<StatsData | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    async function fetchStats() {
      try {
        const res = await fetch("/api/status/stats");
        const json = await res.json();
        if (json.success) {
          setData(json.data);
        } else {
          setError(json.error || "Failed to fetch stats");
        }
      } catch (err: any) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    }
    fetchStats();
  }, []);

  if (loading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {[...Array(4)].map((_, i) => (
          <div
            key={i}
            className="h-32 bg-card rounded-xl border animate-pulse"
          />
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <Card className="border-destructive">
        <CardContent className="p-6 flex items-center gap-3 text-destructive">
          <AlertCircle className="h-5 w-5" />
          <p>Error loading dashboard: {error}</p>
        </CardContent>
      </Card>
    );
  }

  const overall = data?.emails.overall;
  const today = data?.emails.today;
  const weekly = data?.emails.weekly;
  const senders = data?.senders;
  const templates = data?.templates;

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div className="space-y-1">
          <h2 className="text-3xl font-bold tracking-tight">Dashboard</h2>
          <p className="text-muted-foreground">
            Overview of your email campaigns and system performance
          </p>
        </div>
        <div className="flex items-center gap-2 px-3 py-1.5 bg-muted/40 rounded-full border border-border shadow-sm">
          <div
            className={cn(
              "h-2 w-2 rounded-full animate-pulse",
              data ? "bg-emerald-500" : "bg-amber-500",
            )}
          />
          <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
            {data ? "Database Connected" : "Connecting..."}
          </span>
        </div>
      </div>

      {/* Main Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatCard
          title="Total Contacts"
          value={formatNumber(data?.contacts.total_contacts || 0)}
          description="All prospects in database"
          icon={Users}
          color="text-blue-500"
        />
        <StatCard
          title="Emails Sent"
          value={formatNumber(overall?.total_sent || 0)}
          description="Lifetime emails delivered"
          icon={Send}
          color="text-emerald-500"
        />
        <StatCard
          title="Sent Today"
          value={formatNumber(today?.sent_today || 0)}
          description={`${formatNumber(senders?.total_daily_capacity || 0)} daily limit`}
          icon={TrendingUp}
          color="text-purple-500"
          progress={
            ((today?.sent_today || 0) / (senders?.total_daily_capacity || 1)) * 100
          }
        />
        <StatCard
          title="Sent This Week"
          value={formatNumber(weekly?.sent_week || 0)}
          description="Last 7 days performance"
          icon={Calendar}
          color="text-orange-500"
        />
      </div>

      {/* Additional Stats */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Active Senders */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Senders</CardTitle>
            <Mail className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{senders?.active_senders || 0} / {senders?.total_senders || 0}</div>
            <p className="text-xs text-muted-foreground mt-1">
              {formatNumber(senders?.total_daily_capacity || 0)} daily capacity
            </p>
          </CardContent>
        </Card>

        {/* Success Rate */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Success Rate</CardTitle>
            <CheckCircle2 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-emerald-500">
              {overall?.success_rate || 0}%
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              {formatNumber(overall?.total_failed || 0)} failed deliveries
            </p>
          </CardContent>
        </Card>

        {/* Templates */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Email Templates</CardTitle>
            <FileText className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{templates?.total_templates || 0}</div>
            <p className="text-xs text-muted-foreground mt-1">
              {Object.keys(templates?.templates_by_tag || {}).length} tags available
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function StatCard({
  title,
  value,
  description,
  icon: Icon,
  color = "",
  progress,
}: any) {
  return (
    <Card className="overflow-hidden relative">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium">{title}</CardTitle>
        <Icon className={cn("h-4 w-4 text-muted-foreground", color)} />
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold">{value}</div>
        <p className="text-xs text-muted-foreground mt-1">{description}</p>

        {progress !== undefined && (
          <div className="mt-4 h-1.5 w-full bg-muted rounded-full overflow-hidden">
            <div
              className={cn("h-full bg-primary transition-all duration-500", color)}
              style={{ width: `${Math.min(progress, 100)}%` }}
            />
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function Step({ number, title, description, icon: Icon }: any) {
  return (
    <div className="flex gap-4">
      <div className="flex-shrink-0 w-8 h-8 rounded-full bg-blue-600 text-white flex items-center justify-center font-bold text-sm">
        {number}
      </div>
      <div className="flex-1">
        <div className="flex items-center gap-2 mb-1">
          <Icon className="h-4 w-4 text-blue-600 dark:text-blue-400" />
          <h4 className="font-semibold text-blue-900 dark:text-blue-100">{title}</h4>
        </div>
        <p className="text-sm text-blue-700 dark:text-blue-300">{description}</p>
      </div>
    </div>
  );
}
