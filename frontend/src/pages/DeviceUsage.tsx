import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Zap, AlertCircle, ArrowLeft, Loader2 } from "lucide-react";
import { api } from "@/lib/api";
import DashboardLayout from "@/components/DashboardLayout";
import { toast } from "sonner";

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

const DeviceUsage = () => {
  const { deviceId } = useParams<{ deviceId: string }>();
  const navigate = useNavigate();
  const [device, setDevice] = useState<Device | null>(null);
  const [devices, setDevices] = useState<Device[]>([]);
  const [pricePerUnit, setPricePerUnit] = useState<number>(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadDevices();
  }, []);

  const loadDevices = async () => {
    try {
      setLoading(true);
      const [data, pricing] = await Promise.all([
        api<Device[]>("/user/devices/usage"),
        api<PricingResponse>("/user/pricing"),
      ]);
      setDevices(data || []);
      setPricePerUnit(pricing.price_per_unit || 0);

      // Find the specific device if deviceId is provided
      if (deviceId) {
        const found = data?.find((d) => d.device_id === deviceId);
        if (found) {
          setDevice(found);
        } else if (data && data.length > 0) {
          setDevice(data[0]);
        }
      } else if (data && data.length > 0) {
        setDevice(data[0]);
      }
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Failed to load devices");
    } finally {
      setLoading(false);
    }
  };

  const statusColors: Record<string, string> = {
    ACTIVE: "bg-energy/20 text-energy",
    PENDING_ACTIVATION: "bg-warning/20 text-warning",
    DEACTIVATED: "bg-muted/20 text-muted-foreground",
    REMOVED: "bg-destructive/20 text-destructive",
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <Button variant="ghost" size="sm" onClick={() => navigate("/dashboard")} className="gap-2">
          <ArrowLeft className="h-4 w-4" />
          Back to Dashboard
        </Button>

        {loading ? (
          <div className="flex items-center justify-center p-12">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : device ? (
          <>
            {/* Device Details */}
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="text-2xl">{device.location}</CardTitle>
                    <p className="text-sm text-muted-foreground mt-1">ID: {device.device_id}</p>
                  </div>
                  <Badge className={statusColors[device.status]}>
                    {device.status}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="p-4 border rounded-lg">
                    <p className="text-sm text-muted-foreground">Total Consumption</p>
                    <p className="text-3xl font-bold">{device.total_units.toFixed(2)}</p>
                    <p className="text-xs text-muted-foreground mt-1">kWh</p>
                  </div>
                  <div className="p-4 border rounded-lg">
                    <p className="text-sm text-muted-foreground">Estimated Cost</p>
                    <p className="text-3xl font-bold">₹{(device.total_units * pricePerUnit).toFixed(0)}</p>
                    <p className="text-xs text-muted-foreground mt-1">@ ₹{pricePerUnit.toFixed(2)}/unit</p>
                  </div>
                </div>

                {device.health_status === "TAMPERED" && (
                  <div className="p-3 border border-destructive/50 bg-destructive/5 rounded-lg flex items-center gap-3">
                    <AlertCircle className="h-5 w-5 text-destructive" />
                    <div>
                      <p className="font-semibold text-destructive text-sm">Tamper Detected</p>
                      <p className="text-xs text-destructive/70">This meter has been tampered with. Contact admin immediately.</p>
                    </div>
                  </div>
                )}

                {device.health_status === "OFFLINE" && (
                  <div className="p-3 border rounded-lg flex items-center gap-3">
                    <AlertCircle className="h-5 w-5 text-muted-foreground" />
                    <div>
                      <p className="font-semibold text-sm">Device Offline</p>
                      <p className="text-xs text-muted-foreground">No recent readings from this meter.</p>
                    </div>
                  </div>
                )}

                <div className="pt-4 border-t space-y-2">
                  <p className="text-sm font-semibold">Device Information</p>
                  <div className="space-y-1 text-sm">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Device UID:</span>
                      <code className="bg-muted px-2 py-1 rounded text-xs">{device.device_uid}</code>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Other Devices Quick Access */}
            {devices.length > 1 && (
              <Card>
                <CardHeader>
                  <CardTitle>Other Meters</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    {devices
                      .filter((d) => d.device_id !== device.device_id)
                      .map((d) => (
                        <button
                          key={d.device_id}
                          onClick={() => setDevice(d)}
                          className="w-full text-left p-3 border rounded-lg hover:bg-muted/50 transition-colors"
                        >
                          <div className="flex items-center justify-between">
                            <div>
                              <p className="font-semibold text-sm">{d.location}</p>
                              <p className="text-xs text-muted-foreground">{d.device_id}</p>
                            </div>
                            <Zap className="h-4 w-4 text-muted-foreground" />
                          </div>
                        </button>
                      ))}
                  </div>
                </CardContent>
              </Card>
            )}
          </>
        ) : (
          <Card>
            <CardContent className="pt-6">
              <p className="text-center text-muted-foreground">No devices found</p>
            </CardContent>
          </Card>
        )}
      </div>
    </DashboardLayout>
  );
};

export default DeviceUsage;
