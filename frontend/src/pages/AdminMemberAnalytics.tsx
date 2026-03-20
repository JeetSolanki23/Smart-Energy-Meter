import { useEffect, useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Users, AlertTriangle, Receipt } from "lucide-react";
import { api } from "@/lib/api";
import DashboardLayout from "@/components/DashboardLayout";
import { AdminUserOverview } from "@/types/admin";

const AdminMemberAnalytics = () => {
  const [users, setUsers] = useState<AdminUserOverview[]>([]);
  const [memberSearch, setMemberSearch] = useState("");
  const [memberFilter, setMemberFilter] = useState<"ALL" | "WITH_DUES" | "OVERDUE" | "UNPAID">("ALL");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api<AdminUserOverview[]>("/admin/users/overview")
      .then((rows) => setUsers(rows || []))
      .catch(() => setUsers([]))
      .finally(() => setLoading(false));
  }, []);

  const filteredUsers = useMemo(() => {
    const q = memberSearch.trim().toLowerCase();

    return users.filter((u) => {
      const matchesSearch = !q || u.email.toLowerCase().includes(q) || u.user_id.toLowerCase().includes(q);
      const matchesFilter =
        memberFilter === "ALL" ||
        (memberFilter === "WITH_DUES" && (u.unpaid_bills > 0 || u.overdue_bills > 0)) ||
        (memberFilter === "UNPAID" && u.unpaid_bills > 0) ||
        (memberFilter === "OVERDUE" && u.overdue_bills > 0);
      return matchesSearch && matchesFilter;
    });
  }, [users, memberSearch, memberFilter]);

  const totalMembers = users.length;
  const membersWithDues = users.filter((u) => u.unpaid_bills > 0 || u.overdue_bills > 0).length;
  const totalDueAmount = users.reduce((sum, u) => sum + (u.due_amount || 0), 0);

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h2 className="text-2xl font-bold">Member Analytics</h2>
          <p className="text-sm text-muted-foreground">Search and monitor usage, dues, and billing health for all members.</p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Total Members</CardTitle>
              <Users className="h-5 w-5 text-primary" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">{loading ? "..." : totalMembers}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Members With Dues</CardTitle>
              <AlertTriangle className="h-5 w-5 text-warning" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">{loading ? "..." : membersWithDues}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">Total Due Amount</CardTitle>
              <Receipt className="h-5 w-5 text-destructive" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">{loading ? "..." : `₹${totalDueAmount.toFixed(2)}`}</div>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Member Usage and Billing Details</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="mb-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <div className="w-full md:w-80">
                <Input
                  placeholder="Search by email or user ID"
                  value={memberSearch}
                  onChange={(e) => setMemberSearch(e.target.value)}
                />
              </div>
              <div className="flex flex-wrap gap-2">
                <Button size="sm" variant={memberFilter === "ALL" ? "default" : "outline"} onClick={() => setMemberFilter("ALL")}>
                  All
                </Button>
                <Button size="sm" variant={memberFilter === "WITH_DUES" ? "default" : "outline"} onClick={() => setMemberFilter("WITH_DUES")}>
                  With Dues
                </Button>
                <Button size="sm" variant={memberFilter === "UNPAID" ? "default" : "outline"} onClick={() => setMemberFilter("UNPAID")}>
                  Unpaid
                </Button>
                <Button size="sm" variant={memberFilter === "OVERDUE" ? "default" : "outline"} onClick={() => setMemberFilter("OVERDUE")}>
                  Overdue
                </Button>
              </div>
            </div>

            {users.length === 0 ? (
              <p className="text-sm text-muted-foreground">No members found.</p>
            ) : filteredUsers.length === 0 ? (
              <p className="text-sm text-muted-foreground">No members match your search/filter.</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Member</TableHead>
                    <TableHead>Devices</TableHead>
                    <TableHead>Active</TableHead>
                    <TableHead>This Month (kWh)</TableHead>
                    <TableHead>Lifetime (kWh)</TableHead>
                    <TableHead>Unpaid</TableHead>
                    <TableHead>Overdue</TableHead>
                    <TableHead>Due (₹)</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredUsers.map((u) => (
                    <TableRow key={u.user_id}>
                      <TableCell className="font-medium">{u.email}</TableCell>
                      <TableCell>{u.device_count}</TableCell>
                      <TableCell>{u.active_device_count}</TableCell>
                      <TableCell>{u.current_month_units.toFixed(4)}</TableCell>
                      <TableCell>{u.lifetime_units.toFixed(4)}</TableCell>
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
    </DashboardLayout>
  );
};

export default AdminMemberAnalytics;
