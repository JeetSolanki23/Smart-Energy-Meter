import { Link, useLocation, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { useTheme } from "@/components/ThemeProvider";
import {
  Zap, LayoutDashboard, BarChart3, Receipt, Moon, Sun, LogOut, Menu, X,
  Cpu, PlusCircle, Shield,
} from "lucide-react";
import { clearAuth, getRole } from "@/lib/api";
import { useState } from "react";

interface DashboardLayoutProps {
  children: React.ReactNode;
}

const DashboardLayout = ({ children }: DashboardLayoutProps) => {
  const { theme, setTheme } = useTheme();
  const location = useLocation();
  const navigate = useNavigate();
  const role = getRole();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const userLinks = [
    { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
    { to: "/usage", label: "Usage", icon: BarChart3 },
    { to: "/bills", label: "Bills", icon: Receipt },
  ];

  const adminLinks = [
    { to: "/admin/dashboard", label: "Dashboard", icon: LayoutDashboard },
    { to: "/admin/devices", label: "Devices", icon: Cpu },
    { to: "/admin/device/register", label: "Register Device", icon: PlusCircle },
  ];

  const links = role === "admin" ? adminLinks : userLinks;

  const handleLogout = () => {
    clearAuth();
    navigate(role === "admin" ? "/admin/login" : "/login");
  };

  return (
    <div className="min-h-screen bg-background flex">
      {/* Mobile overlay */}
      {sidebarOpen && (
        <div className="fixed inset-0 z-40 bg-foreground/20 md:hidden" onClick={() => setSidebarOpen(false)} />
      )}

      {/* Sidebar */}
      <aside className={`fixed inset-y-0 left-0 z-50 w-64 bg-card border-r transform transition-transform md:translate-x-0 md:static md:z-auto ${sidebarOpen ? "translate-x-0" : "-translate-x-full"}`}>
        <div className="flex items-center gap-2 p-4 border-b">
          <div className="rounded-lg bg-electric p-2">
            <Zap className="h-5 w-5 text-primary-foreground" />
          </div>
          <span className="text-lg font-bold">
            {role === "admin" ? "Admin Panel" : "SmartMeter"}
          </span>
          {role === "admin" && <Shield className="h-4 w-4 text-warning ml-auto" />}
        </div>

        <nav className="p-3 space-y-1 flex-1">
          {links.map((link) => {
            const isActive = location.pathname === link.to;
            return (
              <Link
                key={link.to}
                to={link.to}
                onClick={() => setSidebarOpen(false)}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                  isActive
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:bg-secondary hover:text-foreground"
                }`}
              >
                <link.icon className="h-4 w-4" />
                {link.label}
              </Link>
            );
          })}
        </nav>

        <div className="p-3 border-t space-y-1">
          <Button
            variant="ghost"
            className="w-full justify-start gap-3 text-muted-foreground"
            onClick={() => setTheme(theme === "light" ? "dark" : "light")}
          >
            {theme === "light" ? <Moon className="h-4 w-4" /> : <Sun className="h-4 w-4" />}
            {theme === "light" ? "Dark Mode" : "Light Mode"}
          </Button>
          <Button
            variant="ghost"
            className="w-full justify-start gap-3 text-destructive hover:text-destructive"
            onClick={handleLogout}
          >
            <LogOut className="h-4 w-4" />
            Logout
          </Button>
        </div>
      </aside>

      {/* Main */}
      <div className="flex-1 flex flex-col min-h-screen">
        <header className="sticky top-0 z-30 h-14 border-b bg-background/95 backdrop-blur flex items-center px-4 md:px-6 gap-4">
          <Button variant="ghost" size="icon" className="md:hidden" onClick={() => setSidebarOpen(true)}>
            <Menu className="h-5 w-5" />
          </Button>
          <h1 className="text-lg font-semibold capitalize">
            {links.find((l) => l.to === location.pathname)?.label || "Page"}
          </h1>
        </header>
        <main className="flex-1 p-4 md:p-6">{children}</main>
      </div>
    </div>
  );
};

export default DashboardLayout;
