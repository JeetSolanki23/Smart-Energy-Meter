import { useEffect, useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Loader2 } from "lucide-react";
import { api } from "@/lib/api";
import DashboardLayout from "@/components/DashboardLayout";
import {
  AdminAnalyticsTrendsResponse,
  AdminConsumptionTrendPoint,
  AdminDeviceSummary,
  AdminDueTrendPoint,
  AdminUserOverview,
} from "@/types/admin";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

const STATUS_COLORS: Record<string, string> = {
  ACTIVE: "hsl(142 76% 36%)",
  DEACTIVATED: "hsl(215 20% 45%)",
  PENDING_ACTIVATION: "hsl(35 92% 50%)",
  REMOVED: "hsl(0 70% 50%)",
};

const HEALTH_COLORS: Record<string, string> = {
  GOOD: "hsl(142 76% 36%)",
  OFFLINE: "hsl(215 20% 45%)",
  TAMPERED: "hsl(0 70% 50%)",
};

const toDateInputValue = (value: Date) => {
  const y = value.getFullYear();
  const m = String(value.getMonth() + 1).padStart(2, "0");
  const d = String(value.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
};

const shiftedDate = (daysBack: number) => {
  const d = new Date();
  d.setDate(d.getDate() - daysBack);
  return toDateInputValue(d);
};

const formatShortDate = (isoDate: string) => {
  const d = new Date(`${isoDate}T00:00:00`);
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
};

const AdminAnalyticsCharts = () => {
  const [devices, setDevices] = useState<AdminDeviceSummary[]>([]);
  const [users, setUsers] = useState<AdminUserOverview[]>([]);
  const [startDate, setStartDate] = useState<string>(shiftedDate(29));
  const [endDate, setEndDate] = useState<string>(toDateInputValue(new Date()));
  const [consumptionTrend, setConsumptionTrend] = useState<AdminConsumptionTrendPoint[]>([]);
  const [duesTrend, setDuesTrend] = useState<AdminDueTrendPoint[]>([]);
  const [trendLoading, setTrendLoading] = useState(true);
  const [trendError, setTrendError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadData = async () => {
      try {
        const [deviceRows, userRows] = await Promise.all([
          api<AdminDeviceSummary[]>("/admin/device/list"),
          api<AdminUserOverview[]>("/admin/users/overview"),
        ]);
        setDevices(deviceRows || []);
        setUsers(userRows || []);
      } catch {
        setDevices([]);
        setUsers([]);
      } finally {
        setLoading(false);
      }
    };

    void loadData();
  }, []);

  const loadTrends = async (start: string, end: string) => {
    setTrendLoading(true);
    setTrendError(null);

    try {
      const res = await api<AdminAnalyticsTrendsResponse>(
        `/admin/analytics/trends?start_date=${encodeURIComponent(start)}&end_date=${encodeURIComponent(end)}`
      );
      setConsumptionTrend(res.consumption_daily || []);
      setDuesTrend(res.dues_daily || []);
    } catch (err: unknown) {
      setConsumptionTrend([]);
      setDuesTrend([]);
      setTrendError(err instanceof Error ? err.message : "Failed to load trend analytics");
    } finally {
      setTrendLoading(false);
    }
  };

  useEffect(() => {
    void loadTrends(startDate, endDate);
    // Initial trend load should run only once on mount with default dates.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const applyRange = async () => {
    if (!startDate || !endDate) {
      setTrendError("Select both start and end dates.");
      return;
    }
    if (startDate > endDate) {
      setTrendError("Start date cannot be after end date.");
      return;
    }
    await loadTrends(startDate, endDate);
  };

  const applyPreset = async (days: number) => {
    const nextStart = shiftedDate(days - 1);
    const nextEnd = toDateInputValue(new Date());
    setStartDate(nextStart);
    setEndDate(nextEnd);
    await loadTrends(nextStart, nextEnd);
  };

  const statusChartData = useMemo(() => {
    const counts = devices.reduce<Record<string, number>>((acc, d) => {
      const key = d.status || "UNKNOWN";
      acc[key] = (acc[key] || 0) + 1;
      return acc;
    }, {});

    return Object.entries(counts).map(([name, value]) => ({
      name,
      value,
      color: STATUS_COLORS[name] || "hsl(215 15% 60%)",
    }));
  }, [devices]);

  const healthChartData = useMemo(() => {
    const counts = devices.reduce<Record<string, number>>((acc, d) => {
      const key = d.health_status || "UNKNOWN";
      acc[key] = (acc[key] || 0) + 1;
      return acc;
    }, {});

    return Object.entries(counts).map(([name, value]) => ({
      name,
      value,
      color: HEALTH_COLORS[name] || "hsl(215 15% 60%)",
    }));
  }, [devices]);

  const topDeviceUsageData = useMemo(
    () =>
      [...devices]
        .sort((a, b) => (b.current_month_units || 0) - (a.current_month_units || 0))
        .slice(0, 8)
        .map((d) => ({
          label: d.device_id.slice(-6),
          device_id: d.device_id,
          value: Number((d.current_month_units || 0).toFixed(4)),
        })),
    [devices]
  );

  const topMemberDueData = useMemo(
    () =>
      [...users]
        .filter((u) => (u.due_amount || 0) > 0)
        .sort((a, b) => (b.due_amount || 0) - (a.due_amount || 0))
        .slice(0, 8)
        .map((u) => ({
          label: u.email.split("@")[0].slice(0, 10),
          email: u.email,
          value: Number((u.due_amount || 0).toFixed(2)),
        })),
    [users]
  );

  const consumptionTrendChartData = useMemo(
    () =>
      consumptionTrend.map((p) => ({
        ...p,
        label: formatShortDate(p.date),
      })),
    [consumptionTrend]
  );

  const duesTrendChartData = useMemo(
    () =>
      duesTrend.map((p) => ({
        ...p,
        label: formatShortDate(p.date),
      })),
    [duesTrend]
  );

  const chartTooltipStyle = {
    backgroundColor: "hsl(var(--card))",
    border: "1px solid hsl(var(--border))",
    borderRadius: "8px",
    color: "hsl(var(--foreground))",
  };

  const noData = !loading && devices.length === 0 && users.length === 0;

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h2 className="text-2xl font-bold">Analytics Charts</h2>
          <p className="text-sm text-muted-foreground">Visual system snapshot for operations, health, and billing risk.</p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Date Range</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex flex-col gap-3 md:flex-row md:items-end">
              <div className="w-full md:w-48 space-y-2">
                <label className="text-sm text-muted-foreground">Start Date</label>
                <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
              </div>
              <div className="w-full md:w-48 space-y-2">
                <label className="text-sm text-muted-foreground">End Date</label>
                <Input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
              </div>
              <Button onClick={() => void applyRange()} className="md:w-auto w-full">Apply Range</Button>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button size="sm" variant="outline" onClick={() => void applyPreset(7)}>Last 7 Days</Button>
              <Button size="sm" variant="outline" onClick={() => void applyPreset(30)}>Last 30 Days</Button>
              <Button size="sm" variant="outline" onClick={() => void applyPreset(90)}>Last 90 Days</Button>
            </div>
            {trendError && <p className="text-sm text-destructive">{trendError}</p>}
          </CardContent>
        </Card>

        <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
          <Card>
            <CardHeader>
              <CardTitle>Daily Consumption Trend</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-72">
                {trendLoading ? (
                  <div className="h-full flex items-center justify-center">
                    <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                  </div>
                ) : consumptionTrendChartData.length === 0 ? (
                  <div className="h-full flex items-center justify-center text-sm text-muted-foreground">No consumption data in selected range.</div>
                ) : (
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={consumptionTrendChartData}>
                      <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                      <XAxis dataKey="label" tick={{ fontSize: 11 }} />
                      <YAxis tick={{ fontSize: 11 }} />
                      <Tooltip
                        contentStyle={chartTooltipStyle}
                        labelFormatter={(_, payload) => (payload?.[0]?.payload?.date as string) || "Date"}
                        formatter={(value: number) => [`${value.toFixed(4)} kWh`, "Consumption"]}
                      />
                      <Line type="monotone" dataKey="units" stroke="hsl(142 76% 36%)" strokeWidth={2} dot={false} />
                    </LineChart>
                  </ResponsiveContainer>
                )}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Daily Due Amount Trend</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-72">
                {trendLoading ? (
                  <div className="h-full flex items-center justify-center">
                    <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                  </div>
                ) : duesTrendChartData.length === 0 ? (
                  <div className="h-full flex items-center justify-center text-sm text-muted-foreground">No due data in selected range.</div>
                ) : (
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={duesTrendChartData}>
                      <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                      <XAxis dataKey="label" tick={{ fontSize: 11 }} />
                      <YAxis tick={{ fontSize: 11 }} />
                      <Tooltip
                        contentStyle={chartTooltipStyle}
                        labelFormatter={(_, payload) => (payload?.[0]?.payload?.date as string) || "Date"}
                        formatter={(value: number) => [`₹${value.toFixed(2)}`, "Due Amount"]}
                      />
                      <Line type="monotone" dataKey="due_amount" stroke="hsl(0 70% 50%)" strokeWidth={2} dot={false} />
                    </LineChart>
                  </ResponsiveContainer>
                )}
              </div>
            </CardContent>
          </Card>
        </div>

        {loading ? (
          <Card>
            <CardContent className="flex items-center justify-center py-16">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </CardContent>
          </Card>
        ) : noData ? (
          <Card>
            <CardContent className="py-10 text-sm text-muted-foreground">No analytics data available yet.</CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle>Device Status Distribution</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="h-72">
                  {statusChartData.length === 0 ? (
                    <div className="h-full flex items-center justify-center text-sm text-muted-foreground">No device status data.</div>
                  ) : (
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={statusChartData}>
                        <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                        <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                        <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
                        <Tooltip contentStyle={chartTooltipStyle} />
                        <Bar dataKey="value" radius={[6, 6, 0, 0]}>
                          {statusChartData.map((entry) => (
                            <Cell key={entry.name} fill={entry.color} />
                          ))}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  )}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Device Health Distribution</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="h-72">
                  {healthChartData.length === 0 ? (
                    <div className="h-full flex items-center justify-center text-sm text-muted-foreground">No device health data.</div>
                  ) : (
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie data={healthChartData} dataKey="value" nameKey="name" outerRadius={96} label>
                          {healthChartData.map((entry) => (
                            <Cell key={entry.name} fill={entry.color} />
                          ))}
                        </Pie>
                        <Tooltip contentStyle={chartTooltipStyle} />
                      </PieChart>
                    </ResponsiveContainer>
                  )}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Top Device Usage (Current Month)</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="h-72">
                  {topDeviceUsageData.length === 0 ? (
                    <div className="h-full flex items-center justify-center text-sm text-muted-foreground">No usage data.</div>
                  ) : (
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={topDeviceUsageData}>
                        <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                        <XAxis dataKey="label" tick={{ fontSize: 11 }} />
                        <YAxis tick={{ fontSize: 11 }} />
                        <Tooltip
                          contentStyle={chartTooltipStyle}
                          formatter={(value: number) => [`${value.toFixed(4)} kWh`, "Usage"]}
                          labelFormatter={(_, payload) => (payload?.[0]?.payload?.device_id as string) || "Device"}
                        />
                        <Bar dataKey="value" fill="hsl(217 91% 60%)" radius={[6, 6, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  )}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Top Member Due Amount</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="h-72">
                  {topMemberDueData.length === 0 ? (
                    <div className="h-full flex items-center justify-center text-sm text-muted-foreground">No due amount data.</div>
                  ) : (
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={topMemberDueData}>
                        <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                        <XAxis dataKey="label" tick={{ fontSize: 11 }} />
                        <YAxis tick={{ fontSize: 11 }} />
                        <Tooltip
                          contentStyle={chartTooltipStyle}
                          formatter={(value: number) => [`₹${value.toFixed(2)}`, "Due"]}
                          labelFormatter={(_, payload) => (payload?.[0]?.payload?.email as string) || "Member"}
                        />
                        <Bar dataKey="value" fill="hsl(0 70% 50%)" radius={[6, 6, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
};

export default AdminAnalyticsCharts;
