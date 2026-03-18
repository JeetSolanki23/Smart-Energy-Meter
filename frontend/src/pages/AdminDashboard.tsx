import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Cpu, Activity, XCircle, AlertTriangle } from "lucide-react";
import { api } from "@/lib/api";
import DashboardLayout from "@/components/DashboardLayout";
import { toast } from "sonner";

interface Device {
  device_id: string;
  location: string;
  status: string;
  relay_state: string;
  tampered: boolean;
  health_status: "GOOD" | "OFFLINE" | "TAMPERED";
}

interface PricingResponse {
  price_per_unit: number;
}

interface RuntimeConfigResponse {
  device_data_interval_seconds: number;
}

const AdminDashboard = () => {
  const [devices, setDevices] = useState<Device[]>([]);
  const [pricePerUnit, setPricePerUnit] = useState<number>(0);
  const [priceInput, setPriceInput] = useState<string>("");
  const [savingPrice, setSavingPrice] = useState(false);
  const [deviceIntervalSeconds, setDeviceIntervalSeconds] = useState<number>(0);
  const [intervalInput, setIntervalInput] = useState<string>("");
  const [savingInterval, setSavingInterval] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadData = async () => {
      try {
        const [deviceRows, pricing, runtimeConfig] = await Promise.all([
          api<Device[]>("/admin/device/list"),
          api<PricingResponse>("/admin/pricing"),
          api<RuntimeConfigResponse>("/admin/device-interval"),
        ]);
        setDevices(deviceRows || []);
        setPricePerUnit(pricing.price_per_unit || 0);
        setPriceInput((pricing.price_per_unit || 0).toString());
        setDeviceIntervalSeconds(runtimeConfig.device_data_interval_seconds || 0);
        setIntervalInput((runtimeConfig.device_data_interval_seconds || 0).toString());
      } catch {
        setDevices([]);
      } finally {
        setLoading(false);
      }
    };

    void loadData();
  }, []);

  const handleSavePrice = async () => {
    const parsed = Number(priceInput);
    if (!Number.isFinite(parsed) || parsed <= 0) {
      toast.error("Enter a valid price greater than 0");
      return;
    }

    setSavingPrice(true);
    try {
      const res = await api<PricingResponse>("/admin/pricing", {
        method: "PUT",
        body: JSON.stringify({ price_per_unit: parsed }),
      });
      setPricePerUnit(res.price_per_unit);
      setPriceInput(res.price_per_unit.toString());
      toast.success("Unit price updated");
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Failed to update price");
    } finally {
      setSavingPrice(false);
    }
  };

  const handleSaveInterval = async () => {
    const parsed = Number(intervalInput);
    if (!Number.isFinite(parsed) || parsed < 5 || parsed > 3600) {
      toast.error("Enter interval between 5 and 3600 seconds");
      return;
    }

    setSavingInterval(true);
    try {
      const res = await api<RuntimeConfigResponse>("/admin/device-interval", {
        method: "PUT",
        body: JSON.stringify({ device_data_interval_seconds: parsed }),
      });
      setDeviceIntervalSeconds(res.device_data_interval_seconds);
      setIntervalInput(res.device_data_interval_seconds.toString());
      toast.success("Device interval updated");
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Failed to update interval");
    } finally {
      setSavingInterval(false);
    }
  };

  const total = devices.length;
  const active = devices.filter((d) => d.status === "ACTIVE").length;
  const tampered = devices.filter((d) => d.health_status === "TAMPERED").length;
  const offline = devices.filter((d) => d.health_status === "OFFLINE").length;

  const stats = [
    { title: "Total Devices", value: total, icon: Cpu, color: "text-primary" },
    { title: "Active", value: active, icon: Activity, color: "text-energy" },
    { title: "Offline", value: offline, icon: XCircle, color: "text-muted-foreground" },
    { title: "Tampered", value: tampered, icon: AlertTriangle, color: "text-destructive" },
  ];

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>Unit Price Settings</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm text-muted-foreground">Current Price: ₹{pricePerUnit.toFixed(2)} per unit</p>
            <div className="flex flex-col sm:flex-row gap-3 sm:items-end">
              <div className="w-full sm:w-64 space-y-2">
                <Label htmlFor="unitPrice">Set New Price (₹/unit)</Label>
                <Input
                  id="unitPrice"
                  type="number"
                  min="0.01"
                  step="0.01"
                  value={priceInput}
                  onChange={(e) => setPriceInput(e.target.value)}
                />
              </div>
              <Button onClick={handleSavePrice} disabled={savingPrice} className="sm:w-auto w-full">
                {savingPrice ? "Saving..." : "Update Price"}
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Device Polling Interval</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm text-muted-foreground">Current Interval: {deviceIntervalSeconds}s</p>
            <div className="flex flex-col sm:flex-row gap-3 sm:items-end">
              <div className="w-full sm:w-64 space-y-2">
                <Label htmlFor="deviceInterval">Set Interval (seconds)</Label>
                <Input
                  id="deviceInterval"
                  type="number"
                  min="5"
                  max="3600"
                  step="1"
                  value={intervalInput}
                  onChange={(e) => setIntervalInput(e.target.value)}
                />
              </div>
              <Button onClick={handleSaveInterval} disabled={savingInterval} className="sm:w-auto w-full">
                {savingInterval ? "Saving..." : "Update Interval"}
              </Button>
            </div>
          </CardContent>
        </Card>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {stats.map((stat) => (
            <Card key={stat.title}>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">{stat.title}</CardTitle>
                <stat.icon className={`h-5 w-5 ${stat.color}`} />
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-bold">{loading ? "..." : stat.value}</div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </DashboardLayout>
  );
};

export default AdminDashboard;
