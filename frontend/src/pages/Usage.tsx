import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";
import { api } from "@/lib/api";
import DashboardLayout from "@/components/DashboardLayout";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line } from "recharts";

interface DailyUsagePoint {
  day: string;
  date: string;
  units: number;
}

interface HourlyUsagePoint {
  hour: string;
  timestamp: string;
  units: number;
}

interface LiveUsagePoint {
  time: string;
  timestamp: string;
  power: number;
}

interface LiveUsageResponse {
  current_power: number;
  last_reading_at: string | null;
  series: LiveUsagePoint[];
}

interface Bill {
  bill_id: string;
  month: string;
  units: number;
}

interface PricingResponse {
  price_per_unit: number;
}

const USAGE_CHART_MODE_KEY = "usage-chart-mode";

const getSavedUsageChartMode = (): "daily" | "hourly" | "live" => {
  if (typeof window === "undefined") {
    return "daily";
  }
  const saved = window.localStorage.getItem(USAGE_CHART_MODE_KEY);
  if (saved === "daily" || saved === "hourly" || saved === "live") {
    return saved;
  }
  return "daily";
};

const Usage = () => {
  const [totalUnits, setTotalUnits] = useState<number>(0);
  const [dailyData, setDailyData] = useState<DailyUsagePoint[]>([]);
  const [hourlyData, setHourlyData] = useState<HourlyUsagePoint[]>([]);
  const [liveData, setLiveData] = useState<LiveUsagePoint[]>([]);
  const [livePower, setLivePower] = useState<number>(0);
  const [liveLastReadingAt, setLiveLastReadingAt] = useState<string | null>(null);
  const [chartMode, setChartMode] = useState<"daily" | "hourly" | "live">(getSavedUsageChartMode);
  const [monthlyData, setMonthlyData] = useState<Array<{ month: string; units: number }>>([]);
  const [pricePerUnit, setPricePerUnit] = useState<number>(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadUsage = async () => {
      try {
        const [totalRes, dailyRes, hourlyRes, liveRes, billsRes, pricingRes] = await Promise.allSettled([
          api<{ total_units: number }>("/user/usage"),
          api<DailyUsagePoint[]>("/user/usage/daily"),
          api<HourlyUsagePoint[]>("/user/usage/hourly?hours=24"),
          api<LiveUsageResponse>("/user/usage/live?minutes=60"),
          api<Bill[]>("/user/bills"),
          api<PricingResponse>("/user/pricing"),
        ]);

        const total = totalRes.status === "fulfilled" ? totalRes.value : null;
        const daily = dailyRes.status === "fulfilled" ? dailyRes.value : [];
        const hourly = hourlyRes.status === "fulfilled" ? hourlyRes.value : [];
        const live = liveRes.status === "fulfilled" ? liveRes.value : null;
        const bills = billsRes.status === "fulfilled" ? billsRes.value : [];
        const pricing = pricingRes.status === "fulfilled" ? pricingRes.value : null;

        setTotalUnits(total?.total_units || 0);
        setDailyData(daily ?? []);
        setHourlyData(hourly ?? []);
        setLiveData(live?.series ?? []);
        setLivePower(live?.current_power || 0);
        setLiveLastReadingAt(live?.last_reading_at || null);
        setPricePerUnit(pricing?.price_per_unit || 0);

        const monthly = (bills ?? [])
          .slice()
          .reverse()
          .slice(-6)
          .map((bill) => {
            const date = new Date(bill.month);
            return {
              month: date.toLocaleString("default", { month: "short" }),
              units: bill.units,
            };
          });
        setMonthlyData(monthly);
      } catch {
        setTotalUnits(0);
        setDailyData([]);
        setHourlyData([]);
        setLiveData([]);
        setLivePower(0);
        setLiveLastReadingAt(null);
        setMonthlyData([]);
      } finally {
        setLoading(false);
      }
    };

    void loadUsage();
  }, []);

  useEffect(() => {
    if (chartMode !== "live") {
      return;
    }

    const loadLive = async () => {
      try {
        const live = await api<LiveUsageResponse>("/user/usage/live?minutes=60");
        setLiveData(live?.series ?? []);
        setLivePower(live?.current_power || 0);
        setLiveLastReadingAt(live?.last_reading_at || null);
      } catch {
        // Keep existing chart data if live polling fails temporarily.
      }
    };

    void loadLive();
    const timer = window.setInterval(() => {
      void loadLive();
    }, 15000);

    return () => window.clearInterval(timer);
  }, [chartMode]);

  useEffect(() => {
    window.localStorage.setItem(USAGE_CHART_MODE_KEY, chartMode);
  }, [chartMode]);

  const selectedChartData = chartMode === "daily" ? dailyData : chartMode === "hourly" ? hourlyData : liveData;
  const xAxisKey = chartMode === "daily" ? "day" : chartMode === "hourly" ? "hour" : "time";
  const yAxisKey = chartMode === "live" ? "power" : "units";
  const yLabel = chartMode === "live" ? "W" : "kWh";
  const lineColor = chartMode === "live" ? "hsl(142 76% 36%)" : "hsl(142 76% 36%)";
  const lastLiveSeenText = liveLastReadingAt ? new Date(liveLastReadingAt).toLocaleTimeString() : "No recent reading";

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              Usage Trend
              <Badge>{loading ? "..." : `${totalUnits.toFixed(2)} kWh`}</Badge>
              <Badge variant="outline">Rate ₹{pricePerUnit.toFixed(2)}/unit</Badge>
              <Badge variant="secondary">{chartMode === "daily" ? "Last 7 days" : chartMode === "hourly" ? "Last 24 hours" : "Live (last 60 min)"}</Badge>
              {chartMode === "live" && <Badge className="bg-green-600">{livePower.toFixed(1)} W now</Badge>}
              {chartMode === "live" && <Badge variant="outline">Updated {lastLiveSeenText}</Badge>}
            </CardTitle>
            <div className="flex gap-2">
              <Button variant={chartMode === "daily" ? "default" : "outline"} size="sm" onClick={() => setChartMode("daily")}>Daily</Button>
              <Button variant={chartMode === "hourly" ? "default" : "outline"} size="sm" onClick={() => setChartMode("hourly")}>Hourly</Button>
              <Button variant={chartMode === "live" ? "default" : "outline"} size="sm" onClick={() => setChartMode("live")}>Live</Button>
            </div>
          </CardHeader>
          <CardContent>
            <div className="h-72">
              {loading ? (
                <div className="h-full flex items-center justify-center">
                  <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                </div>
              ) : selectedChartData.length === 0 ? (
                <div className="h-full flex items-center justify-center text-muted-foreground text-sm">
                  No {chartMode} usage data available
                </div>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  {chartMode === "daily" ? (
                    <BarChart data={selectedChartData}>
                      <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                      <XAxis dataKey={xAxisKey} tick={{ fontSize: 11 }} />
                      <YAxis tick={{ fontSize: 11 }} />
                      <Tooltip
                        formatter={(value: number) => [`${value.toFixed(2)} ${yLabel}`, "Usage"]}
                        contentStyle={{
                          backgroundColor: "hsl(var(--card))",
                          border: "1px solid hsl(var(--border))",
                          borderRadius: "8px",
                          color: "hsl(var(--foreground))",
                        }}
                      />
                      <Bar dataKey="units" fill="hsl(217 91% 60%)" radius={[6, 6, 0, 0]} />
                    </BarChart>
                  ) : (
                    <LineChart data={selectedChartData}>
                      <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                      <XAxis dataKey={xAxisKey} tick={{ fontSize: 11 }} />
                      <YAxis tick={{ fontSize: 11 }} />
                      <Tooltip
                        formatter={(value: number) => [`${value.toFixed(2)} ${yLabel}`, chartMode === "live" ? "Power" : "Usage"]}
                        contentStyle={{
                          backgroundColor: "hsl(var(--card))",
                          border: "1px solid hsl(var(--border))",
                          borderRadius: "8px",
                          color: "hsl(var(--foreground))",
                        }}
                      />
                      <Line type="monotone" dataKey={yAxisKey} stroke={lineColor} strokeWidth={2} dot={false} />
                    </LineChart>
                  )}
                </ResponsiveContainer>
              )}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Monthly Comparison</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-72">
              {monthlyData.length === 0 ? (
                <div className="h-full flex items-center justify-center text-muted-foreground text-sm">
                  No billing data available
                </div>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={monthlyData}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                    <XAxis dataKey="month" tick={{ fontSize: 12 }} />
                    <YAxis tick={{ fontSize: 12 }} />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: "hsl(var(--card))",
                        border: "1px solid hsl(var(--border))",
                        borderRadius: "8px",
                        color: "hsl(var(--foreground))",
                      }}
                    />
                    <Bar dataKey="units" fill="hsl(217 91% 60%)" radius={[6, 6, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
};

export default Usage;
