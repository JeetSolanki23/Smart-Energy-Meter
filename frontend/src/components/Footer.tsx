import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Zap, Mail, Phone, MapPin, Facebook, Twitter, Linkedin, Instagram } from "lucide-react";
import { Link } from "react-router-dom";
import { getRole, getToken } from "@/lib/api";

const Footer = () => {
  const token = getToken();
  const role = getRole();
  const isAuthenticated = Boolean(token);
  const dashboardPath = role === "admin" ? "/admin/dashboard" : "/dashboard";

  return (
    <footer id="contact" className="bg-secondary/50 border-t">
      <div className="container py-16">
        <div className="grid md:grid-cols-3 gap-12 mb-12">
          {/* Brand */}
          <div className="space-y-6">
            <div className="flex items-center gap-2">
              <div className="rounded-lg bg-electric p-2">
                <Zap className="h-6 w-6 text-white" />
              </div>
              <span className="text-2xl font-bold">Smart Energy Meter</span>
            </div>
            <p className="text-muted-foreground max-w-md">
              Reliable smart metering for real-time monitoring, tamper alerts, and
              transparent electricity billing.
            </p>
            <div className="flex items-center gap-3">
              {[Facebook, Twitter, Linkedin, Instagram].map((Icon, index) => (
                <Button key={index} variant="ghost" size="icon" className="hover:text-electric">
                  <Icon className="h-4 w-4" />
                </Button>
              ))}
            </div>
          </div>

          {/* Contact */}
          <div className="space-y-4">
            <h4 className="font-semibold text-lg">Contact Us</h4>
            <div className="space-y-3">
              <div className="flex items-center gap-3 text-sm">
                <Mail className="h-4 w-4 text-electric" />
                <span>support@smartenergymeter.app</span>
              </div>
              <div className="flex items-center gap-3 text-sm">
                <Phone className="h-4 w-4 text-electric" />
                <span>+91 80000 00000</span>
              </div>
              <div className="flex items-center gap-3 text-sm">
                <MapPin className="h-4 w-4 text-electric" />
                <span>Operations Dashboard, Smart Grid Network</span>
              </div>
            </div>
          </div>

          {/* Quick Links */}
          <div className="space-y-4">
            <h4 className="font-semibold text-lg">Quick Links</h4>
            <ul className="space-y-2">
              <li><a href="#features" className="text-muted-foreground hover:text-electric transition-colors text-sm">Features</a></li>
              <li><a href="#benefits" className="text-muted-foreground hover:text-electric transition-colors text-sm">Benefits</a></li>
              {isAuthenticated ? (
                <li><Link to={dashboardPath} className="text-muted-foreground hover:text-electric transition-colors text-sm">Dashboard</Link></li>
              ) : (
                <>
                  <li><Link to="/login" className="text-muted-foreground hover:text-electric transition-colors text-sm">User Login</Link></li>
                  <li><Link to="/register" className="text-muted-foreground hover:text-electric transition-colors text-sm">Register</Link></li>
                  <li><Link to="/admin/login" className="text-muted-foreground hover:text-electric transition-colors text-sm">Admin Login</Link></li>
                </>
              )}
            </ul>
          </div>
        </div>

        <Separator className="mb-8" />

        <div className="flex flex-col md:flex-row justify-between items-center gap-4">
          <div className="text-sm text-muted-foreground">
            © 2026 Smart Energy Meter. All rights reserved.
          </div>
          <div className="flex items-center gap-6 text-sm">
            <a href="#" className="text-muted-foreground hover:text-electric transition-colors">Privacy Policy</a>
            <a href="#" className="text-muted-foreground hover:text-electric transition-colors">Terms of Service</a>
          </div>
        </div>
      </div>
    </footer>
  );
};

export default Footer;