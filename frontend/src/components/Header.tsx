import { Button } from "@/components/ui/button";
import { Moon, Sun, Zap, Menu, X } from "lucide-react";
import { useTheme } from "./ThemeProvider";
import { useState } from "react";
import { Link } from "react-router-dom";
import { clearAuth, getRole, getToken } from "@/lib/api";

const Header = () => {
  const { theme, setTheme } = useTheme();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const token = getToken();
  const role = getRole();
  const isAuthenticated = Boolean(token);
  const dashboardPath = role === "admin" ? "/admin/dashboard" : "/dashboard";

  const toggleTheme = () => {
    setTheme(theme === "light" ? "dark" : "light");
  };

  const navItems = [
    { name: "Features", href: "#features" },
    { name: "Benefits", href: "#benefits" },
    { name: "Contact", href: "#contact" },
  ];

  return (
    <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container flex h-16 items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="rounded-lg bg-electric p-2">
            <Zap className="h-5 w-5 text-white" />
          </div>
          <span className="text-xl font-bold">Smart Energy Meter</span>
        </div>

        <nav className="hidden md:flex items-center gap-6">
          {navItems.map((item) => (
            <a
              key={item.name}
              href={item.href}
              className="text-muted-foreground hover:text-foreground transition-colors"
            >
              {item.name}
            </a>
          ))}
        </nav>

        <div className="flex items-center gap-2">
          <Button variant="ghost" size="icon" onClick={toggleTheme} className="hover:bg-secondary">
            {theme === "light" ? <Moon className="h-5 w-5" /> : <Sun className="h-5 w-5" />}
          </Button>

          {isAuthenticated ? (
            <>
              <Button variant="outline" className="hidden md:flex" asChild>
                <Link to={dashboardPath}>Dashboard</Link>
              </Button>
              <Button
                variant="ghost"
                className="hidden md:flex"
                onClick={() => {
                  clearAuth();
                  window.location.href = "/";
                }}
              >
                Logout
              </Button>
            </>
          ) : (
            <>
              <Button variant="outline" className="hidden md:flex" asChild>
                <Link to="/login">Sign In</Link>
              </Button>
              <Button className="hidden md:flex bg-electric hover:bg-electric/90" asChild>
                <Link to="/register">Register</Link>
              </Button>
            </>
          )}

          <Button
            variant="ghost"
            size="icon"
            className="md:hidden"
            onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
          >
            {isMobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </Button>
        </div>
      </div>

      {isMobileMenuOpen && (
        <div className="md:hidden border-t bg-background">
          <nav className="container py-4 space-y-3">
            {navItems.map((item) => (
              <a
                key={item.name}
                href={item.href}
                className="block text-muted-foreground hover:text-foreground transition-colors"
                onClick={() => setIsMobileMenuOpen(false)}
              >
                {item.name}
              </a>
            ))}
            <div className="flex flex-col gap-2 pt-4">
              {isAuthenticated ? (
                <>
                  <Button variant="outline" className="w-full" asChild>
                    <Link to={dashboardPath}>Dashboard</Link>
                  </Button>
                  <Button
                    variant="ghost"
                    className="w-full"
                    onClick={() => {
                      clearAuth();
                      window.location.href = "/";
                    }}
                  >
                    Logout
                  </Button>
                </>
              ) : (
                <>
                  <Button variant="outline" className="w-full" asChild>
                    <Link to="/login">Sign In</Link>
                  </Button>
                  <Button className="w-full bg-electric hover:bg-electric/90" asChild>
                    <Link to="/register">Register</Link>
                  </Button>
                </>
              )}
            </div>
          </nav>
        </div>
      )}
    </header>
  );
};

export default Header;