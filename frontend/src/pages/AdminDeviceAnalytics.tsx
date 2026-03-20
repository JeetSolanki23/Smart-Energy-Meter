import { useEffect, useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Cpu, Activity, XCircle, AlertTriangle } from "lucide-react";
import { api } from "@/lib/api";
import DashboardLayout from "@/components/DashboardLayout";
import { AdminDeviceSummary, DeviceHealthStatus, DeviceStatus } from "@/types/admin";

const AdminDeviceAnalytics = () => {
  const [devices, setDevices] = useState<AdminDeviceSummary[]>([]);
  const [deviceSearch, setDeviceSearch] = useState("");
  const [deviceStatusFilter, setDeviceStatusFilter] = useState<"ALL" | DeviceStatus>("ALL");
  const [deviceHealthFilter, setDeviceHealthFilter] = useState<"ALL" | DeviceHealthStatus>("ALL");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api<AdminDeviceSummary[]>("/admin/device/list")
      .then((rows) => setDevices(rows || []))
      .catch(() => setDevices([]))
      .finally(() => setLoading(false));
  }, []);

  const sortedDevices = useMemo(
    () => [...devices].sort((a, b) => (b.current_month_units || 0) - (a.current_month_units || 0)),
    [devices]
  );

  const filteredDevices = useMemo(() => {
    const q = deviceSearch.trim().toLowerCase();

    return sortedDevices.filter((d) => {
      const matchesSearch =
        !q ||
        d.device_id.toLowerCase().includes(q) ||
        d.location.toLowerCase().includes(q) ||
        (d.owner_email || "").toLowerCase().includes(q);

      const matchesStatus = deviceStatusFilter === "ALL" || d.status === deviceStatusFilter;
      const matchesHealth = deviceHealthFilter === "ALL" || d.health_status === deviceHealthFilter;
      return matchesSearch && matchesStatus && matchesHealth;
    });
  }, [sortedDevices, deviceSearch, deviceStatusFilter, deviceHealthFilter]);

  const totalDevices = devices.length;
  const activeDevices = devices.filter((d) => d.status === "ACTIVE").length;
  const offlineDevices = devices.filter((d) => d.health_status === "OFFLINE").length;
  const tamperedDevices = devices.filter((d) => d.health_status === "TAMPERED").length;

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h2 className="text-2xl font-bold">Device Analytics</h2>
          <p className="text-sm text-muted-foreground">Monitor device consumption, ownership, state, and health in one place.</p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Total Devices</CardTitle>
              <Cpu className="h-5 w-5 text-primary" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">{loading ? "..." : totalDevices}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Active</CardTitle>
              <Activity className="h-5 w-5 text-energy" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">{loading ? "..." : activeDevices}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Offline</CardTitle>
              <XCircle className="h-5 w-5 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">{loading ? "..." : offlineDevices}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Tampered</CardTitle>
              <AlertTriangle className="h-5 w-5 text-destructive" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">{loading ? "..." : tamperedDevices}</div>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Consumption and Device Health</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="mb-4 flex flex-col gap-3">
              <div className="w-full md:w-80">
                <Input
                  placeholder="Search device ID, owner, or location"
                  value={deviceSearch}
                  onChange={(e) => setDeviceSearch(e.target.value)}
                />
              </div>
              <div className="flex flex-wrap gap-2">
                <Button size="sm" variant={deviceStatusFilter === "ALL" ? "default" : "outline"} onClick={() => setDeviceStatusFilter("ALL")}>
                  All Status
                </Button>
                <Button size="sm" variant={deviceStatusFilter === "ACTIVE" ? "default" : "outline"} onClick={() => setDeviceStatusFilter("ACTIVE")}>
                  Active
                </Button>
                <Button size="sm" variant={deviceStatusFilter === "DEACTIVATED" ? "default" : "outline"} onClick={() => setDeviceStatusFilter("DEACTIVATED")}>
                  Deactivated
                </Button>
                <Button size="sm" variant={deviceStatusFilter === "PENDING_ACTIVATION" ? "default" : "outline"} onClick={() => setDeviceStatusFilter("PENDING_ACTIVATION")}>
                  Pending
                </Button>
                <Button size="sm" variant={deviceHealthFilter === "ALL" ? "default" : "outline"} onClick={() => setDeviceHealthFilter("ALL")}>
                  All Health
                </Button>
                <Button size="sm" variant={deviceHealthFilter === "GOOD" ? "default" : "outline"} onClick={() => setDeviceHealthFilter("GOOD")}>
                  Good
                </Button>
                <Button size="sm" variant={deviceHealthFilter === "OFFLINE" ? "default" : "outline"} onClick={() => setDeviceHealthFilter("OFFLINE")}>
                  Offline
                </Button>
                <Button size="sm" variant={deviceHealthFilter === "TAMPERED" ? "default" : "outline"} onClick={() => setDeviceHealthFilter("TAMPERED")}>
                  Tampered
                </Button>
              </div>
            </div>

            {sortedDevices.length === 0 ? (
              <p className="text-sm text-muted-foreground">No device usage data yet.</p>
            ) : filteredDevices.length === 0 ? (
              <p className="text-sm text-muted-foreground">No devices match your search/filter.</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Device ID</TableHead>
                    <TableHead>Owner</TableHead>
                    <TableHead>Location</TableHead>
                    <TableHead>This Month (kWh)</TableHead>
                    <TableHead>Lifetime (kWh)</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Health</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredDevices.map((d) => (
                    <TableRow key={d.device_id}>
                      <TableCell className="font-mono text-xs">{d.device_id}</TableCell>
                      <TableCell>{d.owner_email || "-"}</TableCell>
                      <TableCell>{d.location}</TableCell>
                      <TableCell>{d.current_month_units.toFixed(4)}</TableCell>
                      <TableCell>{d.lifetime_units.toFixed(4)}</TableCell>
                      <TableCell>{d.status}</TableCell>
                      <TableCell>{d.health_status}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
};

export default AdminDeviceAnalytics;
