import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Shield, Loader2 } from "lucide-react";
import { api, getRole, getToken, setAuth } from "@/lib/api";
import { useTheme } from "@/components/ThemeProvider";
import { Moon, Sun } from "lucide-react";
import { toast } from "sonner";

const AdminLogin = () => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const { theme, setTheme } = useTheme();

  useEffect(() => {
    const token = getToken();
    if (!token) return;

    const role = getRole();
    navigate(role === "admin" ? "/admin/dashboard" : "/dashboard", { replace: true });
  }, [navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !password.trim()) {
      toast.error("Please fill in all fields");
      return;
    }
    setLoading(true);
    try {
      const data = await api<{ access_token: string }>("/auth/admin/login", {
        method: "POST",
        body: JSON.stringify({ email: email.trim(), password }),
      });
      setAuth(data.access_token, "admin");
      toast.success("Admin login successful!");
      navigate("/admin/dashboard");
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Login failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <Button
        variant="ghost"
        size="icon"
        className="fixed top-4 right-4"
        onClick={() => setTheme(theme === "light" ? "dark" : "light")}
      >
        {theme === "light" ? <Moon className="h-5 w-5" /> : <Sun className="h-5 w-5" />}
      </Button>

      <Card className="w-full max-w-md shadow-electric border-warning/30">
        <CardHeader className="text-center space-y-2">
          <div className="mx-auto rounded-xl bg-warning p-3 w-fit">
            <Shield className="h-8 w-8 text-primary-foreground" />
          </div>
          <CardTitle className="text-2xl">Admin Login</CardTitle>
          <CardDescription>Access the admin control panel</CardDescription>
        </CardHeader>
        <form onSubmit={handleSubmit}>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">Admin Email</Label>
              <Input
                id="email"
                type="email"
                placeholder="admin@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </div>
          </CardContent>
          <CardFooter className="flex-col gap-3">
            <Button type="submit" className="w-full bg-warning hover:bg-warning/90 text-primary-foreground" disabled={loading}>
              {loading && <Loader2 className="h-4 w-4 animate-spin" />}
              Sign In as Admin
            </Button>
            <Link to="/login" className="text-sm text-muted-foreground hover:underline">
              ← Back to User Login
            </Link>
          </CardFooter>
        </form>
      </Card>
    </div>
  );
};

export default AdminLogin;
