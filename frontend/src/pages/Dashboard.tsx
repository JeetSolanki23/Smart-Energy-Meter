import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Zap, IndianRupee, TrendingUp, Calendar, AlertCircle } from "lucide-react";
import { api } from "@/lib/api";
import DashboardLayout from "@/components/DashboardLayout";
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar } from "recharts";
import { Loader2 } from "lucide-react";

interface DailyChartData {
  day: string;
  units: number;
}

interface HourlyChartData {
  hour: string;
  timestamp: string;
  units: number;
}

interface LiveSeriesPoint {
  time: string;
  timestamp: string;
  power: number;
}

interface LiveUsageResponse {
  current_power: number;
  last_reading_at: string | null;
  series: LiveSeriesPoint[];
}

interface Device {
  device_id: string;
  device_uid: string;
  location: string;
  status: string;
  total_units: number;
  tampered: boolean;
  health_status: "GOOD" | "OFFLINE" | "TAMPERED";
}

interface PricingResponse {
  price_per_unit: number;
}

const Dashboard = () => {
  const [totalUnits, setTotalUnits] = useState<number>(0);
  const [dailyChartData, setDailyChartData] = useState<DailyChartData[]>([]);
  const [hourlyChartData, setHourlyChartData] = useState<HourlyChartData[]>([]);
  const [liveChartData, setLiveChartData] = useState<LiveSeriesPoint[]>([]);
  const [livePower, setLivePower] = useState<number>(0);
  const [liveLastReadingAt, setLiveLastReadingAt] = useState<string | null>(null);
  const [chartMode, setChartMode] = useState<"daily" | "hourly" | "live">("daily");
  const [devices, setDevices] = useState<Device[]>([]);
  const [pricePerUnit, setPricePerUnit] = useState<number>(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadDashboardData();
  }, []);

  const loadDashboardData = async () => {
    try {
      setLoading(true);
      const [usage, dailyData, hourlyData, liveData, devicesData, pricing] = await Promise.all([
        api<{ total_units: number }>("/user/usage"),
        api<DailyChartData[]>("/user/usage/daily"),
        api<HourlyChartData[]>("/user/usage/hourly?hours=24"),
        api<LiveUsageResponse>("/user/usage/live?minutes=60"),
        api<Device[]>("/user/devices/usage"),
        api<PricingResponse>("/user/pricing"),
      ]);

      setTotalUnits(usage.total_units);
      setDailyChartData(dailyData || []);
      setHourlyChartData(hourlyData || []);
      setLiveChartData(liveData?.series || []);
      setLivePower(liveData?.current_power || 0);
      setLiveLastReadingAt(liveData?.last_reading_at || null);
      setDevices(devicesData || []);
      setPricePerUnit(pricing.price_per_unit || 0);
    } catch (err: unknown) {
      console.error(err instanceof Error ? err.message : "Failed to load dashboard data");
    } finally {
      setLoading(false);
    }
  };

  const loadLiveData = async () => {
    try {
      const liveData = await api<LiveUsageResponse>("/user/usage/live?minutes=60");
      setLiveChartData(liveData?.series || []);
      setLivePower(liveData?.current_power || 0);
      setLiveLastReadingAt(liveData?.last_reading_at || null);
    } catch (err: unknown) {
      console.error(err instanceof Error ? err.message : "Failed to load live usage");
    }
  };

  useEffect(() => {
    if (chartMode !== "live") {
      return;
    }

    void loadLiveData();
    const timer = window.setInterval(() => {
      void loadLiveData();
    }, 15000);

    return () => window.clearInterval(timer);
  }, [chartMode]);

  const selectedChartData = chartMode === "daily" ? dailyChartData : chartMode === "hourly" ? hourlyChartData : liveChartData;
  const xAxisKey = chartMode === "daily" ? "day" : chartMode === "hourly" ? "hour" : "time";
  const yAxisKey = chartMode === "live" ? "power" : "units";
  const lineColor = chartMode === "live" ? "hsl(142 76% 36%)" : "hsl(217 91% 60%)";
  const lastLiveSeenText = liveLastReadingAt ? new Date(liveLastReadingAt).toLocaleTimeString() : "No recent reading";

  const estimatedBill = totalUnits * pricePerUnit;
  const currentMonth = new Date().toLocaleString("default", { month: "long", year: "numeric" });
  const tamperedDevices = devices.filter((d) => d.health_status === "TAMPERED").length;

  const stats = [
    { title: "Total Units Used", value: `${totalUnits.toFixed(2)} kWh`, icon: Zap, color: "text-electric" },
    { title: "Estimated Bill", value: `₹${estimatedBill.toFixed(0)}`, icon: IndianRupee, color: "text-energy" },
    { title: "Current Month", value: currentMonth, icon: Calendar, color: "text-primary" },
    { title: "Avg Daily", value: `${(totalUnits / 30).toFixed(1)} kWh`, icon: TrendingUp, color: "text-warning" },
  ];

  return (
    <DashboardLayout>
      <div className="space-y-6">
        {/* Stats Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {stats.map((stat) => (
            <Card key={stat.title}>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">{stat.title}</CardTitle>
                <stat.icon className={`h-5 w-5 ${stat.color}`} />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{loading ? "..." : stat.value}</div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Alerts */}
        {tamperedDevices > 0 && (
          <Card className="border-destructive/50 bg-destructive/5">
            <CardContent className="pt-6 flex items-center gap-3">
              <AlertCircle className="h-5 w-5 text-destructive" />
              <div>
                <p className="font-semibold text-destructive">{tamperedDevices} Device(s) Tampered</p>
                <p className="text-sm text-destructive/70">Please contact support or admin immediately</p>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Weekly Chart */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              Usage Trend
              <Badge variant="secondary">{chartMode === "daily" ? "Last 7 days" : chartMode === "hourly" ? "Last 24 hours" : "Live (last 60 min)"}</Badge>
              <Badge variant="outline">Rate ₹{pricePerUnit.toFixed(2)}/unit</Badge>
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
            {loading ? (
              <div className="h-72 flex items-center justify-center">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              </div>
            ) : selectedChartData.length === 0 ? (
              <div className="h-72 flex items-center justify-center text-muted-foreground">
                No {chartMode} usage data available yet
              </div>
            ) : (
              <div className="h-72">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={selectedChartData}>
                    <defs>
                      <linearGradient id="colorUnits" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor={lineColor} stopOpacity={0.3} />
                        <stop offset="95%" stopColor={lineColor} stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                    <XAxis dataKey={xAxisKey} className="text-muted-foreground" tick={{ fontSize: 12 }} />
                    <YAxis className="text-muted-foreground" tick={{ fontSize: 12 }} />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: "hsl(var(--card))",
                        border: "1px solid hsl(var(--border))",
                        borderRadius: "8px",
                        color: "hsl(var(--foreground))",
                      }}
                    />
                    <Area type="monotone" dataKey={yAxisKey} stroke={lineColor} fillOpacity={1} fill="url(#colorUnits)" strokeWidth={2} />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Per-Device Usage */}
        {devices.length > 1 && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                Per-Device Breakdown
                <Badge variant="secondary">{devices.length} Meters</Badge>
              </CardTitle>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="h-64 flex items-center justify-center">
                  <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                </div>
              ) : (
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={devices}>
                      <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                      <XAxis dataKey="location" className="text-muted-foreground" tick={{ fontSize: 12 }} />
                      <YAxis className="text-muted-foreground" tick={{ fontSize: 12 }} />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: "hsl(var(--card))",
                          border: "1px solid hsl(var(--border))",
                          borderRadius: "8px",
                          color: "hsl(var(--foreground))",
                        }}
                      />
                      <Bar dataKey="total_units" fill="hsl(217 91% 60%)" />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Device List */}
        {devices.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle>Your Meters</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {devices.map((device) => (
                  <div key={device.device_id} className="flex items-center justify-between p-3 border rounded-lg">
                    <div>
                      <p className="font-semibold text-sm">{device.location}</p>
                      <p className="text-xs text-muted-foreground">{device.device_id}</p>
                    </div>
                    <div className="text-right">
                      <p className="font-semibold">{device.total_units.toFixed(1)} kWh</p>
                      <div className="flex gap-2 mt-1">
                        <Badge variant="outline" className="text-xs">
                          {device.status}
                        </Badge>
                        {device.health_status === "TAMPERED" && (
                          <Badge variant="destructive" className="text-xs">
                            TAMPERED
                          </Badge>
                        )}
                        {device.health_status === "OFFLINE" && (
                          <Badge variant="outline" className="text-xs">
                            OFFLINE
                          </Badge>
                        )}
                        {device.health_status === "GOOD" && (
                          <Badge variant="secondary" className="text-xs">
                            GOOD
                          </Badge>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </DashboardLayout>
  );
};

export default Dashboard;
