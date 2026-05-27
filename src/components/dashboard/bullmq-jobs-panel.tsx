"use client";

import * as React from "react";
import { Pause, Play, RefreshCw, Settings2, Square, Timer, Zap } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";

type BullMqQueueCounts = {
    waiting: number;
    active: number;
    delayed: number;
    completed: number;
    failed: number;
    paused: number;
};

type BullMqRepeatable = {
    key: string;
    name: string;
    every?: string;
    pattern?: string;
    next?: number;
};

type BullMqStatus = {
    success: boolean;
    action: string;
    redisOpen: boolean;
    config: {
        queueName: string;
        appUrl: string;
        processIntervalMs: number;
        workerConcurrency: number;
    };
    status: {
        queueName: string;
        paused: boolean;
        counts: BullMqQueueCounts;
        repeatables: BullMqRepeatable[];
    };
};

const ACTION_LABELS: Record<string, string> = {
    start: "Start Scheduler",
    stop: "Stop Scheduler",
    pause: "Pause Queue",
    resume: "Resume Queue",
    "run-now": "Run Now",
    "set-interval": "Set Interval",
};

/**
 * Live BullMQ job control panel with polling-based realtime status.
 */
export function BullMqJobsPanel() {
    const [status, setStatus] = React.useState<BullMqStatus | null>(null);
    const [loading, setLoading] = React.useState(true);
    const [actionLoading, setActionLoading] = React.useState<string | null>(null);
    const [refreshing, setRefreshing] = React.useState(false);
    const [intervalValue, setIntervalValue] = React.useState("60000");
    const [lastUpdated, setLastUpdated] = React.useState<Date | null>(null);
    const [error, setError] = React.useState<string | null>(null);

    const fetchStatus = React.useCallback(async (quiet = false) => {
        if (!quiet) {
            setLoading(true);
        } else {
            setRefreshing(true);
        }

        try {
            const res = await fetch("/api/jobs/control");
            const json = await res.json();

            if (!res.ok || json.success === false) {
                throw new Error(json.error || res.statusText || "Failed to load BullMQ status");
            }

            setStatus(json as BullMqStatus);
            setIntervalValue(String(json?.config?.processIntervalMs || 60000));
            setLastUpdated(new Date());
            setError(null);
        } catch (err) {
            setError(err instanceof Error ? err.message : "Failed to load BullMQ status");
        } finally {
            if (!quiet) {
                setLoading(false);
            }
            setRefreshing(false);
        }
    }, []);

    React.useEffect(() => {
        fetchStatus(false);
        const interval = setInterval(() => fetchStatus(true), 3000);
        return () => clearInterval(interval);
    }, [fetchStatus]);

    const runAction = async (action: string, payload?: Record<string, unknown>) => {
        setActionLoading(action);
        try {
            const res = await fetch("/api/jobs/control", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ action, ...payload }),
            });

            const json = await res.json();
            if (!res.ok || json.success === false) {
                throw new Error(json.error || res.statusText || "BullMQ action failed");
            }

            setStatus(json.status ? json : null);
            setLastUpdated(new Date());
            setError(null);
            await fetchStatus(true);
        } catch (err) {
            setError(err instanceof Error ? err.message : "BullMQ action failed");
        } finally {
            setActionLoading(null);
        }
    };

    const queuePaused = Boolean(status?.status.paused);
    const repeatableCount = status?.status.repeatables?.length || 0;
    const counts = status?.status.counts;

    return (
        <Card className="border-primary/20">
            <CardHeader className="bg-linear-to-r from-primary/5 to-primary/10 px-6 rounded">
                <div className="flex items-start justify-between gap-4">
                    <div className="space-y-1">
                        <CardTitle className="flex items-center gap-2 text-xl">
                            <Settings2 className="h-5 w-5 text-primary" />
                            BullMQ Jobs
                        </CardTitle>
                        <CardDescription className="text-sm">
                            Redis-backed queue controls with live job counts and scheduler state
                        </CardDescription>
                    </div>

                    <div className="flex items-center gap-2 flex-wrap justify-end">
                        <Badge variant={status?.redisOpen ? "default" : "destructive"} className="gap-1.5">
                            <span className={cn("h-2 w-2 rounded-full", status?.redisOpen ? "bg-green-500" : "bg-white/80")}></span>
                            {status?.redisOpen ? "Redis Connected" : "Redis Offline"}
                        </Badge>
                        <Badge variant={queuePaused ? "outline" : "default"} className="gap-1.5">
                            <span className={cn("h-2 w-2 rounded-full", queuePaused ? "bg-amber-500" : "bg-green-500")}></span>
                            {queuePaused ? "Queue Paused" : "Queue Active"}
                        </Badge>
                        <Button variant="outline" size="sm" className="gap-2" onClick={() => fetchStatus(false)} disabled={loading || refreshing}>
                            <RefreshCw className={cn("h-4 w-4", refreshing && "animate-spin")} />
                            Refresh
                        </Button>
                    </div>
                </div>
            </CardHeader>

            <CardContent className="pt-6 space-y-6">
                {error && (
                    <div className="rounded-lg border border-destructive/20 bg-destructive/10 px-4 py-3 text-sm text-destructive">
                        {error}
                    </div>
                )}

                <div className="grid grid-cols-2 md:grid-cols-6 gap-3">
                    <Metric label="Waiting" value={counts?.waiting ?? 0} tone="blue" />
                    <Metric label="Active" value={counts?.active ?? 0} tone="purple" />
                    <Metric label="Delayed" value={counts?.delayed ?? 0} tone="amber" />
                    <Metric label="Completed" value={counts?.completed ?? 0} tone="emerald" />
                    <Metric label="Failed" value={counts?.failed ?? 0} tone="destructive" />
                    <Metric label="Repeatables" value={repeatableCount} tone="gray" />
                </div>

                <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
                    <div className="p-4 rounded-xl border bg-muted/20 space-y-3">
                        <div className="flex items-center justify-between gap-2">
                            <div>
                                <p className="text-sm font-semibold">Scheduler</p>
                                <p className="text-xs text-muted-foreground">
                                    Interval: {status?.config.processIntervalMs ?? 60000} ms · Concurrency: {status?.config.workerConcurrency ?? 1}
                                </p>
                            </div>
                            <Badge variant={queuePaused ? "outline" : "default"}>{queuePaused ? "Paused" : "Running"}</Badge>
                        </div>

                        <div className="grid grid-cols-2 gap-2">
                            <Button size="sm" variant="default" className="gap-2" onClick={() => runAction("start", { intervalMs: Number(intervalValue) || 60000 })} disabled={!!actionLoading}>
                                {actionLoading === "start" ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}
                                {ACTION_LABELS.start}
                            </Button>
                            <Button size="sm" variant="outline" className="gap-2" onClick={() => runAction("stop", { pauseQueue: true })} disabled={!!actionLoading}>
                                {actionLoading === "stop" ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Square className="h-4 w-4" />}
                                {ACTION_LABELS.stop}
                            </Button>
                            <Button size="sm" variant="outline" className="gap-2" onClick={() => runAction("pause")} disabled={!!actionLoading || queuePaused}>
                                {actionLoading === "pause" ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Pause className="h-4 w-4" />}
                                {ACTION_LABELS.pause}
                            </Button>
                            <Button size="sm" variant="outline" className="gap-2" onClick={() => runAction("resume")} disabled={!!actionLoading || !queuePaused}>
                                {actionLoading === "resume" ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}
                                {ACTION_LABELS.resume}
                            </Button>
                            <Button size="sm" variant="secondary" className="gap-2 col-span-2" onClick={() => runAction("run-now", { source: "dashboard" })} disabled={!!actionLoading}>
                                {actionLoading === "run-now" ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Zap className="h-4 w-4" />}
                                {ACTION_LABELS["run-now"]}
                            </Button>
                        </div>
                    </div>

                    <div className="p-4 rounded-xl border bg-muted/20 space-y-3">
                        <div>
                            <p className="text-sm font-semibold">Timer Configuration</p>
                            <p className="text-xs text-muted-foreground">
                                Update the repeat interval used by the BullMQ scheduler.
                            </p>
                        </div>

                        <div className="flex items-end gap-2">
                            <div className="flex-1 space-y-1">
                                <label className="text-xs font-medium text-muted-foreground">Interval (ms)</label>
                                <Input type="number" min={1000} step={1000} value={intervalValue} onChange={(e) => setIntervalValue(e.target.value)} />
                            </div>
                            <Button size="sm" className="gap-2" onClick={() => runAction("set-interval", { intervalMs: Number(intervalValue) || 60000 })} disabled={!!actionLoading}>
                                {actionLoading === "set-interval" ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Timer className="h-4 w-4" />}
                                {ACTION_LABELS["set-interval"]}
                            </Button>
                        </div>

                        <Separator />

                        <div className="space-y-2">
                            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Repeatables</p>
                            {status?.status.repeatables?.length ? (
                                <div className="space-y-2 max-h-40 overflow-auto pr-1">
                                    {status.status.repeatables.map((repeatable) => (
                                        <div key={repeatable.key} className="rounded-lg border bg-background px-3 py-2 text-xs">
                                            <div className="flex items-center justify-between gap-2">
                                                <span className="font-medium truncate">{repeatable.name}</span>
                                                <span className="text-muted-foreground">{repeatable.key}</span>
                                            </div>
                                            <div className="mt-1 text-muted-foreground">
                                                {repeatable.every ? `every ${repeatable.every} ms` : repeatable.pattern || "one-off"}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <p className="text-xs text-muted-foreground">No repeatable jobs are registered yet.</p>
                            )}
                        </div>
                    </div>
                </div>

                <div className="flex items-center justify-between gap-3 text-xs text-muted-foreground">
                    <div>
                        Queue: <span className="font-medium text-foreground">{status?.status.queueName || "unknown"}</span>
                    </div>
                    <div>
                        Last refreshed: <span className="font-medium text-foreground">{lastUpdated ? lastUpdated.toLocaleTimeString() : "never"}</span>
                    </div>
                </div>
            </CardContent>
        </Card>
    );
}

type BullMetricTone = "blue" | "purple" | "amber" | "emerald" | "destructive" | "gray";

function Metric({ label, value, tone }: { label: string; value: number; tone: BullMetricTone; }) {
    const tones: Record<BullMetricTone, string> = {
        blue: "bg-blue-500/10 text-blue-600 border-blue-500/20",
        purple: "bg-purple-500/10 text-purple-600 border-purple-500/20",
        amber: "bg-amber-500/10 text-amber-600 border-amber-500/20",
        emerald: "bg-emerald-500/10 text-emerald-600 border-emerald-500/20",
        destructive: "bg-destructive/10 text-destructive border-destructive/20",
        gray: "bg-muted/30 text-muted-foreground border-border",
    };

    return (
        <div className={cn("rounded-lg border px-3 py-2", tones[tone])}>
            <div className="text-[10px] uppercase tracking-wide font-medium">{label}</div>
            <div className="text-xl font-bold leading-tight">{value}</div>
        </div>
    );
}
