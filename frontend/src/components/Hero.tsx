import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ArrowRight, Zap, Shield, Wifi, UserPlus } from "lucide-react";
import { Link } from "react-router-dom";
import heroImage from "@/assets/smart-meter-hero.jpg";
import { getRole, getToken } from "@/lib/api";

const Hero = () => {
  const token = getToken();
  const role = getRole();
  const isAuthenticated = Boolean(token);
  const dashboardPath = role === "admin" ? "/admin/dashboard" : "/dashboard";

  return (
    <section className="relative overflow-hidden bg-hero-gradient">
      <div className="container relative z-10 py-20 lg:py-32">
        <div className="grid lg:grid-cols-2 gap-12 items-center">
          <div className="space-y-8">
            <Badge 
              variant="secondary" 
              className="bg-electric/10 text-electric border-electric/20 hover:bg-electric/20"
            >
              <Zap className="w-4 h-4 mr-2" />
              Next Generation Energy Monitoring
            </Badge>
            
            <div className="space-y-4">
              <h1 className="text-4xl lg:text-6xl font-bold tracking-tight">
                Smart Electric Meter
                <span className="text-electric block">Revolution</span>
              </h1>
              
              <p className="text-xl text-muted-foreground max-w-lg">
                Monitor, control, and optimize your energy consumption with our 
                advanced digital smart meter technology. Real-time insights for 
                better energy efficiency.
              </p>
            </div>

            <div className="flex flex-col sm:flex-row gap-4">
              {isAuthenticated ? (
                <Button size="lg" className="bg-electric hover:bg-electric/90 shadow-electric" asChild>
                  <Link to={dashboardPath}>
                    Open Dashboard
                    <ArrowRight className="w-5 h-5 ml-2" />
                  </Link>
                </Button>
              ) : (
                <>
                  <Button size="lg" className="bg-electric hover:bg-electric/90 shadow-electric" asChild>
                    <Link to="/register">
                      <UserPlus className="w-5 h-5 mr-2" />
                      Create Account
                    </Link>
                  </Button>

                  <Button variant="outline" size="lg" asChild>
                    <Link to="/login">
                      Sign In
                      <ArrowRight className="w-5 h-5 ml-2" />
                    </Link>
                  </Button>
                </>
              )}
            </div>

            <div className="flex flex-wrap gap-6 pt-4">
              <div className="flex items-center gap-2 text-sm">
                <div className="p-1 rounded-full bg-electric/20">
                  <Wifi className="w-4 h-4 text-electric" />
                </div>
                <span>Real-time Monitoring</span>
              </div>
              <div className="flex items-center gap-2 text-sm">
                <div className="p-1 rounded-full bg-energy/20">
                  <Shield className="w-4 h-4 text-energy" />
                </div>
                <span>Secure & Reliable</span>
              </div>
              <div className="flex items-center gap-2 text-sm">
                <div className="p-1 rounded-full bg-warning/20">
                  <Zap className="w-4 h-4 text-warning" />
                </div>
                <span>Energy Efficient</span>
              </div>
            </div>
          </div>

          <div className="relative">
            <div className="relative rounded-2xl overflow-hidden shadow-glow">
              <img src={heroImage} alt="Smart Electric Meter" className="w-full h-auto" />
              <div className="absolute top-4 right-4 bg-card/95 backdrop-blur rounded-xl p-4 shadow-card-custom">
                <div className="space-y-2">
                  <div className="text-2xl font-bold text-electric">24.7 kWh</div>
                  <div className="text-sm text-muted-foreground">Today's Usage</div>
                  <div className="flex items-center gap-1 text-energy text-sm">
                    <span className="w-2 h-2 rounded-full bg-energy animate-pulse"></span>
                    15% savings
                  </div>
                </div>
              </div>
            </div>
            <div className="absolute -top-6 -left-6 w-20 h-20 bg-electric/20 rounded-full blur-xl animate-pulse"></div>
            <div className="absolute -bottom-6 -right-6 w-32 h-32 bg-energy/20 rounded-full blur-xl animate-pulse delay-1000"></div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default Hero;