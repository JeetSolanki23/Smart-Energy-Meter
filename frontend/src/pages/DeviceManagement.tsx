import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Cpu, Loader2, Power, PowerOff, RotateCcw, Trash2, ToggleLeft, ToggleRight } from "lucide-react";
import { api } from "@/lib/api";
import DashboardLayout from "@/components/DashboardLayout";
import { AdminDeviceSummary } from "@/types/admin";
import { toast } from "sonner";

const DeviceManagement = () => {
  const [devices, setDevices] = useState<AdminDeviceSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const fetchDevices = () => {
    setLoading(true);
    api<AdminDeviceSummary[]>("/admin/device/list")
      .then(setDevices)
      .catch(() => {
        setDevices([]);
        toast.error("Failed to load device list");
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => { fetchDevices(); }, []);

  const deviceAction = async (endpoint: string, body: object, successMsg: string) => {
    const key = JSON.stringify(body);
    setActionLoading(key);
    try {
      await api(endpoint, { method: "POST", body: JSON.stringify(body) });
      toast.success(successMsg);
      fetchDevices();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Action failed");
    } finally {
      setActionLoading(null);
    }
  };

  const statusColors: Record<string, string> = {
    ACTIVE: "bg-energy/20 text-energy border-energy/30",
    DEACTIVATED: "bg-muted text-muted-foreground border-border",
    PENDING_ACTIVATION: "bg-warning/20 text-warning border-warning/30",
  };

  return (
    <DashboardLayout>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Cpu className="h-5 w-5" />
            Device Management
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex justify-center p-8">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Device ID</TableHead>
                    <TableHead>Owner</TableHead>
                    <TableHead>Location</TableHead>
                    <TableHead>This Month (kWh)</TableHead>
                    <TableHead>Lifetime (kWh)</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Relay</TableHead>
                    <TableHead>Health</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {devices.map((d) => (
                    <TableRow key={d.device_id}>
                      <TableCell className="font-mono text-sm">{d.device_id}</TableCell>
                      <TableCell>{d.owner_email || "-"}</TableCell>
                      <TableCell>{d.location}</TableCell>
                      <TableCell>{d.current_month_units.toFixed(4)}</TableCell>
                      <TableCell>{d.lifetime_units.toFixed(4)}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className={statusColors[d.status] || ""}>
                          {d.status}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge variant={d.relay_state === "ON" ? "default" : "secondary"}>
                          {d.relay_state}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {d.health_status === "TAMPERED" && <Badge variant="destructive">TAMPERED</Badge>}
                        {d.health_status === "OFFLINE" && <Badge variant="outline">OFFLINE</Badge>}
                        {d.health_status === "GOOD" && <Badge variant="secondary">GOOD</Badge>}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-1 flex-wrap">
                          {d.status !== "ACTIVE" && (
                            <Button
                              size="sm"
                              variant="outline"
                              className="text-energy border-energy/30"
                              disabled={actionLoading !== null}
                              onClick={() => deviceAction("/admin/device/activate", { device_id: d.device_id }, "Device activated")}
                            >
                              <Power className="h-3 w-3" />
                            </Button>
                          )}
                          {d.status === "ACTIVE" && (
                            <Button
                              size="sm"
                              variant="outline"
                              disabled={actionLoading !== null}
                              onClick={() => deviceAction("/admin/device/deactivate", { device_id: d.device_id }, "Device deactivated")}
                            >
                              <PowerOff className="h-3 w-3" />
                            </Button>
                          )}
                          {d.health_status === "TAMPERED" && (
                            <AlertDialog>
                              <AlertDialogTrigger asChild>
                                <Button size="sm" variant="outline" disabled={actionLoading !== null}>
                                  <RotateCcw className="h-3 w-3" />
                                </Button>
                              </AlertDialogTrigger>
                              <AlertDialogContent>
                                <AlertDialogHeader>
                                  <AlertDialogTitle>Recover This Tampered Device?</AlertDialogTitle>
                                  <AlertDialogDescription>
                                    This will clear tamper status and reactivate the device. Relay remains OFF for safety.
                                  </AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                                  <AlertDialogAction
                                    onClick={() => deviceAction("/admin/device/recover", { device_id: d.device_id }, "Device recovered")}
                                  >
                                    Confirm Recovery
                                  </AlertDialogAction>
                                </AlertDialogFooter>
                              </AlertDialogContent>
                            </AlertDialog>
                          )}
                          {d.status === "ACTIVE" && (
                            <Button
                              size="sm"
                              variant="outline"
                              disabled={actionLoading !== null || d.health_status === "TAMPERED"}
                              onClick={() =>
                                deviceAction(
                                  "/admin/device/relay",
                                  { device_id: d.device_id, relay_state: d.relay_state === "ON" ? "OFF" : "ON" },
                                  `Relay ${d.relay_state === "ON" ? "OFF" : "ON"} queued`
                                )
                              }
                            >
                              {d.relay_state === "ON" ? <ToggleRight className="h-3 w-3" /> : <ToggleLeft className="h-3 w-3" />}
                            </Button>
                          )}
                          <Button
                            size="sm"
                            variant="outline"
                            className="text-destructive border-destructive/30"
                            disabled={actionLoading !== null}
                            onClick={() => deviceAction("/admin/device/remove", { device_id: d.device_id }, "Device removed")}
                          >
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </DashboardLayout>
  );
};

export default DeviceManagement;
