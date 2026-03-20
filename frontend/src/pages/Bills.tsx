import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { IndianRupee, Loader2 } from "lucide-react";
import { api } from "@/lib/api";
import DashboardLayout from "@/components/DashboardLayout";
import { toast } from "sonner";

interface Bill {
  bill_id: string;
  month: string;
  units: number;
  amount: number;
  status: "UNPAID" | "PAID" | "OVERDUE";
}

const statusColors: Record<string, string> = {
  PAID: "bg-energy/20 text-energy border-energy/30",
  UNPAID: "bg-warning/20 text-warning border-warning/30",
  OVERDUE: "bg-destructive/20 text-destructive border-destructive/30",
};

const RAZORPAY_SCRIPT_URL = "https://checkout.razorpay.com/v1/checkout.js";

const ensureRazorpayLoaded = async (): Promise<boolean> => {
  const win = window as { Razorpay?: new (opts: unknown) => { open: () => void } };
  if (win.Razorpay) {
    return true;
  }

  const existingScript = document.querySelector<HTMLScriptElement>(`script[src="${RAZORPAY_SCRIPT_URL}"]`);
  if (existingScript) {
    await new Promise<void>((resolve) => {
      existingScript.addEventListener("load", () => resolve(), { once: true });
      existingScript.addEventListener("error", () => resolve(), { once: true });
      window.setTimeout(() => resolve(), 3000);
    });
    return Boolean((window as { Razorpay?: unknown }).Razorpay);
  }

  const script = document.createElement("script");
  script.src = RAZORPAY_SCRIPT_URL;
  script.async = true;
  document.body.appendChild(script);

  await new Promise<void>((resolve) => {
    script.onload = () => resolve();
    script.onerror = () => resolve();
    window.setTimeout(() => resolve(), 5000);
  });

  return Boolean((window as { Razorpay?: unknown }).Razorpay);
};

const Bills = () => {
  const [bills, setBills] = useState<Bill[]>([]);
  const [loading, setLoading] = useState(true);
  const [payingId, setPayingId] = useState<string | null>(null);

  useEffect(() => {
    loadBills();
  }, []);

  const loadBills = async () => {
    try {
      const response = await api<Bill[]>("/user/bills");
      setBills(response);
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Failed to load bills");
    } finally {
      setLoading(false);
    }
  };

  const handlePay = async (bill: Bill) => {
    setPayingId(bill.bill_id);
    try {
      const sdkLoaded = await ensureRazorpayLoaded();
      if (!sdkLoaded) {
        toast.error("Unable to load Razorpay SDK. Check internet/CSP and try again.");
        return;
      }

      const order = await api<{
        order_id: string;
        amount_paise: number;
        currency: string;
        key_id: string;
      }>("/payment/create", {
        method: "POST",
        body: JSON.stringify({ bill_id: bill.bill_id }),
      });

      // Razorpay checkout
      const options = {
        key: order.key_id,
        amount: order.amount_paise,
        currency: order.currency,
        order_id: order.order_id,
        name: "Smart Energy Meter",
        description: `Electricity Bill Payment - ${formatMonth(bill.month)}`,
        handler: async (response: { razorpay_order_id: string; razorpay_payment_id: string; razorpay_signature: string }) => {
          try {
            // Finalize payment synchronously (no webhook for prototype)
            await api("/payment/finalize", {
              method: "POST",
              body: JSON.stringify({
                order_id: response.razorpay_order_id,
                payment_id: response.razorpay_payment_id,
                signature: response.razorpay_signature,
              }),
            });

            toast.success("Payment successful!");
            // Reload bills to show updated status
            await loadBills();
          } catch (err: unknown) {
            toast.error(err instanceof Error ? err.message : "Payment finalization failed");
          }
        },
      };

      const win = window as { Razorpay?: new (opts: typeof options) => { open: () => void } };
      if (win.Razorpay) {
        const rzp = new win.Razorpay(options);
        rzp.open();
      } else {
        toast.error("Razorpay SDK not loaded");
      }
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Payment initiation failed");
    } finally {
      setPayingId(null);
    }
  };

  const formatMonth = (m: string) => {
    const [year, month] = m.split("-");
    const date = new Date(parseInt(year), parseInt(month) - 1);
    return date.toLocaleString("default", { month: "long", year: "numeric" });
  };

  return (
    <DashboardLayout>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <IndianRupee className="h-5 w-5" />
            Your Bills
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex justify-center p-8">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : bills.length === 0 ? (
            <div className="text-center p-8 text-muted-foreground">
              No bills available yet
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Month</TableHead>
                  <TableHead>Units</TableHead>
                  <TableHead>Amount</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {bills.map((bill) => (
                  <TableRow key={bill.bill_id}>
                    <TableCell className="font-medium">{formatMonth(bill.month)}</TableCell>
                    <TableCell>{bill.units} kWh</TableCell>
                    <TableCell>₹{bill.amount.toLocaleString()}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className={statusColors[bill.status]}>
                        {bill.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      {bill.status !== "PAID" && (
                        <Button
                          size="sm"
                          className="bg-electric hover:bg-electric/90"
                          onClick={() => handlePay(bill)}
                          disabled={payingId === bill.bill_id}
                        >
                          {payingId === bill.bill_id && <Loader2 className="h-3 w-3 animate-spin" />}
                          Pay Now
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </DashboardLayout>
  );
};

export default Bills;
