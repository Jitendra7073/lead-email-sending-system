"use client";

import React, { useEffect, useState, useCallback } from "react";
import {
    AreaChart, Area, BarChart, Bar,
    XAxis, YAxis, CartesianGrid, Tooltip,
    ResponsiveContainer, Legend,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Send, Reply, AlertCircle, Trophy, TrendingUp } from "lucide-react";
import { cn } from "@/lib/utils";

// ─── Types ────────────────────────────────────────────────────────────────────

type Period = "day" | "week" | "month" | "year";

interface TimePoint {
    label: string;
    sent: number;
    failed: number;
    replies: number;
}

interface SenderRow {
    sender_name: string;
    sender_email: string;
    sent: number;
    failed: number;
}

interface Summary {
    sent: number;
    failed: number;
    replies: number;
    replyRate: number;
}

interface AnalyticsData {
    timeSeries: TimePoint[];
    senders: SenderRow[];
    summary: Summary;
}

// ─── Custom tooltip ───────────────────────────────────────────────────────────

function ChartTooltip({ active, payload, label }: any) {
    if (!active || !payload?.length) return null;
    return (
        <div className="bg-background border rounded-lg shadow-lg px-3 py-2 text-xs space-y-1">
            <p className="font-semibold text-foreground mb-1">{label}</p>
            {payload.map((p: any) => (
                <div key={p.dataKey} className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full" style={{ background: p.color }} />
                    <span className="text-muted-foreground capitalize">{p.dataKey}:</span>
                    <span className="font-medium">{p.value}</span>
                </div>
            ))}
        </div>
    );
}

// ─── Period labels ────────────────────────────────────────────────────────────

const PERIOD_LABELS: Record<Period, string> = {
    day: "Today",
    week: "This Week",
    month: "This Month",
    year: "This Year",
};

// ─── Main component ───────────────────────────────────────────────────────────

export default function AnalyticsSection() {
    const [period, setPeriod] = useState<Period>("week");
    const [data, setData] = useState<AnalyticsData | null>(null);
    const [loading, setLoading] = useState(true);

    const fetchAnalytics = useCallback(async (p: Period) => {
        setLoading(true);
        try {
            const res = await fetch(`/api/status/analytics?period=${p}`);
            const json = await res.json();
            if (json.success) setData(json.data);
        } catch (e) {
            console.error(e);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => { fetchAnalytics(period); }, [period, fetchAnalytics]);

    const summary = data?.summary;
    const topSender = data?.senders?.[0];

    return (
        <div className="space-y-5">
            {/* ── Header row with period tabs ── */}
            <div className="flex items-center justify-between flex-wrap gap-3">
                <div>
                    <h3 className="text-lg font-semibold">Analytics</h3>
                    <p className="text-xs text-muted-foreground">Email activity — {PERIOD_LABELS[period]}</p>
                </div>
                <Tabs value={period} onValueChange={(v) => setPeriod(v as Period)}>
                    <TabsList className="h-8">
                        <TabsTrigger value="day" className="text-xs px-3 h-6">Day</TabsTrigger>
                        <TabsTrigger value="week" className="text-xs px-3 h-6">Week</TabsTrigger>
                        <TabsTrigger value="month" className="text-xs px-3 h-6">Month</TabsTrigger>
                        <TabsTrigger value="year" className="text-xs px-3 h-6">Year</TabsTrigger>
                    </TabsList>
                </Tabs>
            </div>

            {/* ── Summary stat pills ── */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <SummaryPill
                    icon={<Send className="h-3.5 w-3.5" />}
                    label="Sent"
                    value={summary?.sent ?? 0}
                    color="text-emerald-600"
                    bg="bg-emerald-50 dark:bg-emerald-950/30"
                    loading={loading}
                />
                <SummaryPill
                    icon={<AlertCircle className="h-3.5 w-3.5" />}
                    label="Failed"
                    value={summary?.failed ?? 0}
                    color="text-red-500"
                    bg="bg-red-50 dark:bg-red-950/30"
                    loading={loading}
                />
                <SummaryPill
                    icon={<Reply className="h-3.5 w-3.5" />}
                    label="Replies"
                    value={summary?.replies ?? 0}
                    color="text-blue-600"
                    bg="bg-blue-50 dark:bg-blue-950/30"
                    loading={loading}
                />
                <SummaryPill
                    icon={<TrendingUp className="h-3.5 w-3.5" />}
                    label="Reply Rate"
                    value={`${summary?.replyRate ?? 0}%`}
                    color="text-purple-600"
                    bg="bg-purple-50 dark:bg-purple-950/30"
                    loading={loading}
                />
            </div>

            {/* ── Charts row ── */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">

                {/* Area chart — sent + replies over time */}
                <Card className="lg:col-span-2">
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-medium">Email Activity</CardTitle>
                        <CardDescription className="text-xs">Sent vs replies over time</CardDescription>
                    </CardHeader>
                    <CardContent>
                        {loading ? (
                            <div className="h-[220px] flex items-center justify-center">
                                <div className="h-4 w-4 rounded-full border-2 border-primary border-t-transparent animate-spin" />
                            </div>
                        ) : (
                            <ResponsiveContainer width="100%" height={220}>
                                <AreaChart data={data?.timeSeries ?? []} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
                                    <defs>
                                        <linearGradient id="gradSent" x1="0" y1="0" x2="0" y2="1">
                                            <stop offset="5%" stopColor="#10b981" stopOpacity={0.25} />
                                            <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                                        </linearGradient>
                                        <linearGradient id="gradReplies" x1="0" y1="0" x2="0" y2="1">
                                            <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.25} />
                                            <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                                        </linearGradient>
                                    </defs>
                                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                                    <XAxis dataKey="label" tick={{ fontSize: 10 }} tickLine={false} axisLine={false} />
                                    <YAxis tick={{ fontSize: 10 }} tickLine={false} axisLine={false} allowDecimals={false} />
                                    <Tooltip content={<ChartTooltip />} />
                                    <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 11 }} />
                                    <Area type="monotone" dataKey="sent" stroke="#10b981" strokeWidth={2} fill="url(#gradSent)" name="Sent" />
                                    <Area type="monotone" dataKey="replies" stroke="#3b82f6" strokeWidth={2} fill="url(#gradReplies)" name="Replies" />
                                </AreaChart>
                            </ResponsiveContainer>
                        )}
                    </CardContent>
                </Card>

                {/* Bar chart — failed */}
                <Card>
                    <CardHeader className="pb-2">
                        <CardTitle className="text-sm font-medium">Failed Deliveries</CardTitle>
                        <CardDescription className="text-xs">Bounces & errors over time</CardDescription>
                    </CardHeader>
                    <CardContent>
                        {loading ? (
                            <div className="h-[220px] flex items-center justify-center">
                                <div className="h-4 w-4 rounded-full border-2 border-primary border-t-transparent animate-spin" />
                            </div>
                        ) : (
                            <ResponsiveContainer width="100%" height={220}>
                                <BarChart data={data?.timeSeries ?? []} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
                                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                                    <XAxis dataKey="label" tick={{ fontSize: 10 }} tickLine={false} axisLine={false} />
                                    <YAxis tick={{ fontSize: 10 }} tickLine={false} axisLine={false} allowDecimals={false} />
                                    <Tooltip content={<ChartTooltip />} />
                                    <Bar dataKey="failed" fill="#f87171" radius={[3, 3, 0, 0]} name="Failed" maxBarSize={32} />
                                </BarChart>
                            </ResponsiveContainer>
                        )}
                    </CardContent>
                </Card>
            </div>

            {/* ── Sender leaderboard ── */}
            <Card>
                <CardHeader className="pb-3">
                    <div className="flex items-center justify-between">
                        <div>
                            <CardTitle className="text-sm font-medium flex items-center gap-2">
                                <Trophy className="h-4 w-4 text-amber-500" /> Top Senders
                            </CardTitle>
                            <CardDescription className="text-xs">{PERIOD_LABELS[period]} — ranked by emails sent</CardDescription>
                        </div>
                        {topSender && !loading && (
                            <Badge className="bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300 text-xs font-normal">
                                🥇 {topSender.sender_name} — {topSender.sent} sent
                            </Badge>
                        )}
                    </div>
                </CardHeader>
                <CardContent>
                    {loading ? (
                        <div className="space-y-2">
                            {[...Array(3)].map((_, i) => (
                                <div key={i} className="h-9 rounded-md bg-muted animate-pulse" />
                            ))}
                        </div>
                    ) : !data?.senders?.length ? (
                        <p className="text-sm text-muted-foreground text-center py-4">No sending activity in this period</p>
                    ) : (
                        <div className="space-y-2">
                            {data.senders.map((s, i) => {
                                const max = data.senders[0]?.sent || 1;
                                const pct = Math.round((s.sent / max) * 100);
                                return (
                                    <div key={`${s.sender_email}-${i}`} className="flex items-center gap-3">
                                        {/* Rank */}
                                        <span className={cn(
                                            "w-5 text-center text-xs font-bold shrink-0",
                                            i === 0 ? "text-amber-500" : i === 1 ? "text-slate-400" : i === 2 ? "text-orange-400" : "text-muted-foreground"
                                        )}>
                                            {i + 1}
                                        </span>
                                        {/* Name + bar */}
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center justify-between mb-0.5">
                                                <span className="text-xs font-medium truncate">{s.sender_name}</span>
                                                <span className="text-xs text-muted-foreground ml-2 shrink-0">{s.sent} sent</span>
                                            </div>
                                            <div className="h-1.5 w-full bg-muted rounded-full overflow-hidden">
                                                <div
                                                    className={cn("h-full rounded-full transition-all duration-500",
                                                        i === 0 ? "bg-amber-400" : i === 1 ? "bg-slate-400" : "bg-emerald-400"
                                                    )}
                                                    style={{ width: `${pct}%` }}
                                                />
                                            </div>
                                        </div>
                                        {/* Failed badge */}
                                        {s.failed > 0 && (
                                            <Badge variant="outline" className="text-[10px] h-4 text-red-500 border-red-200 shrink-0">
                                                {s.failed} failed
                                            </Badge>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </CardContent>
            </Card>
        </div>
    );
}

// ─── Summary pill ─────────────────────────────────────────────────────────────

function SummaryPill({ icon, label, value, color, bg, loading }: {
    icon: React.ReactNode; label: string; value: number | string;
    color: string; bg: string; loading: boolean;
}) {
    return (
        <div className={cn("rounded-lg px-4 py-3 flex items-center gap-3", bg)}>
            <span className={cn("shrink-0", color)}>{icon}</span>
            <div>
                {loading
                    ? <div className="h-5 w-10 rounded bg-muted animate-pulse mb-1" />
                    : <p className={cn("text-lg font-bold leading-none", color)}>{value}</p>
                }
                <p className="text-[11px] text-muted-foreground mt-0.5">{label}</p>
            </div>
        </div>
    );
}
