import { useEffect, useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Cpu, Activity, XCircle, AlertTriangle, Users } from "lucide-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { api } from "@/lib/api";
import DashboardLayout from "@/components/DashboardLayout";
import {
  AdminDeviceSummary,
  AdminPricingResponse,
  AdminRuntimeConfigResponse,
  AdminUserOverview,
} from "@/types/admin";
import { toast } from "sonner";

const AdminDashboard = () => {
  const [devices, setDevices] = useState<AdminDeviceSummary[]>([]);
  const [users, setUsers] = useState<AdminUserOverview[]>([]);
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
        const [deviceRows, pricing, runtimeConfig, usersOverview] = await Promise.all([
          api<AdminDeviceSummary[]>("/admin/device/list"),
          api<AdminPricingResponse>("/admin/pricing"),
          api<AdminRuntimeConfigResponse>("/admin/device-interval"),
          api<AdminUserOverview[]>("/admin/users/overview"),
        ]);
        setDevices(deviceRows || []);
        setUsers(usersOverview || []);
        setPricePerUnit(pricing.price_per_unit || 0);
        setPriceInput((pricing.price_per_unit || 0).toString());
        setDeviceIntervalSeconds(runtimeConfig.device_data_interval_seconds || 0);
        setIntervalInput((runtimeConfig.device_data_interval_seconds || 0).toString());
      } catch {
        setDevices([]);
        setUsers([]);
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
      const res = await api<AdminPricingResponse>("/admin/pricing", {
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
      const res = await api<AdminRuntimeConfigResponse>("/admin/device-interval", {
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

  const totalDevices = devices.length;
  const activeDevices = devices.filter((d) => d.status === "ACTIVE").length;
  const offlineDevices = devices.filter((d) => d.health_status === "OFFLINE").length;
  const tamperedDevices = devices.filter((d) => d.health_status === "TAMPERED").length;
  const totalMembers = users.length;
  const membersWithDues = users.filter((u) => u.unpaid_bills > 0 || u.overdue_bills > 0).length;
  const totalDueAmount = users.reduce((sum, u) => sum + (u.due_amount || 0), 0);

  const topDevicePreview = useMemo(
    () => [...devices].sort((a, b) => b.current_month_units - a.current_month_units).slice(0, 5),
    [devices]
  );

  const dueMemberPreview = useMemo(
    () => [...users].filter((u) => u.unpaid_bills > 0 || u.overdue_bills > 0).sort((a, b) => b.due_amount - a.due_amount).slice(0, 5),
    [users]
  );

  const stats = [
    { title: "Total Devices", value: totalDevices, icon: Cpu, color: "text-primary" },
    { title: "Active Devices", value: activeDevices, icon: Activity, color: "text-energy" },
    { title: "Offline Devices", value: offlineDevices, icon: XCircle, color: "text-muted-foreground" },
    { title: "Tampered Devices", value: tamperedDevices, icon: AlertTriangle, color: "text-destructive" },
    { title: "Total Members", value: totalMembers, icon: Users, color: "text-primary" },
    { title: "Members With Dues", value: membersWithDues, icon: AlertTriangle, color: "text-warning" },
    { title: "Total Due Amount", value: `₹${totalDueAmount.toFixed(2)}`, icon: Cpu, color: "text-destructive" },
  ];

  return (
    <DashboardLayout>
      <div className="space-y-6">
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

        <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
          <Card>
            <CardHeader>
              <CardTitle>Top 5 Devices (Current Month)</CardTitle>
            </CardHeader>
            <CardContent>
              {topDevicePreview.length === 0 ? (
                <p className="text-sm text-muted-foreground">No device usage data yet.</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Device</TableHead>
                      <TableHead>Owner</TableHead>
                      <TableHead>kWh</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {topDevicePreview.map((d) => (
                      <TableRow key={d.device_id}>
                        <TableCell className="font-mono text-xs">{d.device_id}</TableCell>
                        <TableCell>{d.owner_email || "-"}</TableCell>
                        <TableCell>{d.current_month_units.toFixed(4)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Top 5 Members By Due Amount</CardTitle>
            </CardHeader>
            <CardContent>
              {dueMemberPreview.length === 0 ? (
                <p className="text-sm text-muted-foreground">No outstanding dues.</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Member</TableHead>
                      <TableHead>Unpaid</TableHead>
                      <TableHead>Overdue</TableHead>
                      <TableHead>Due (₹)</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {dueMemberPreview.map((u) => (
                      <TableRow key={u.user_id}>
                        <TableCell className="font-medium">{u.email}</TableCell>
                        <TableCell>{u.unpaid_bills}</TableCell>
                        <TableCell>{u.overdue_bills}</TableCell>
                        <TableCell>₹{u.due_amount.toFixed(2)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </DashboardLayout>
  );
};

export default AdminDashboard;
