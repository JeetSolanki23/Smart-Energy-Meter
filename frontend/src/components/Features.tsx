import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { 
  Smartphone, 
  BarChart3, 
  Shield, 
  Clock, 
  Battery, 
  Wifi, 
  AlertTriangle, 
  TrendingDown,
  Zap
} from "lucide-react";

const Features = () => {
  const features = [
    {
      icon: Smartphone,
      title: "Mobile App Control",
      description: "Monitor and control your energy consumption from anywhere with our intuitive mobile application.",
      highlight: "Real-time alerts"
    },
    {
      icon: BarChart3,
      title: "Advanced Analytics",
      description: "Detailed consumption reports, usage patterns, and predictive insights to optimize your energy usage.",
      highlight: "30-day trends"
    },
    {
      icon: Shield,
      title: "Security & Privacy",
      description: "Bank-level encryption and secure data transmission ensure your energy data stays protected.",
      highlight: "256-bit encryption"
    },
    {
      icon: Clock,
      title: "Real-time Monitoring",
      description: "Get instant updates on energy consumption with readings updated every minute.",
      highlight: "Live updates"
    },
    {
      icon: Battery,
      title: "Energy Storage Integration",
      description: "Seamlessly integrates with solar panels and home battery systems for complete energy management.",
      highlight: "Solar compatible"
    },
    {
      icon: Wifi,
      title: "Smart Grid Ready",
      description: "Future-proof technology ready for smart grid integration and time-of-use pricing.",
      highlight: "IoT enabled"
    },
    {
      icon: AlertTriangle,
      title: "Fault Detection",
      description: "Automatic detection of electrical issues and anomalies with instant notifications.",
      highlight: "Proactive alerts"
    },
    {
      icon: TrendingDown,
      title: "Cost Optimization",
      description: "AI-powered recommendations to reduce your electricity bills by up to 30%.",
      highlight: "Save 30%"
    },
    {
      icon: Zap,
      title: "Load Balancing",
      description: "Smart load distribution to prevent overloading and optimize energy efficiency.",
      highlight: "Smart control"
    }
  ];

  return (
    <section id="features" className="py-20 lg:py-32 bg-secondary/30">
      <div className="container">
        <div className="text-center mb-16">
          <h2 className="text-3xl lg:text-5xl font-bold mb-6">
            Powerful Features for
            <span className="text-electric block">Smart Energy Management</span>
          </h2>
          <p className="text-xl text-muted-foreground max-w-3xl mx-auto">
            Our smart electric meter comes packed with advanced features designed to 
            give you complete control over your energy consumption and costs.
          </p>
        </div>

        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          {features.map((feature, index) => {
            const Icon = feature.icon;
            return (
              <Card 
                key={index} 
                className="group hover:shadow-electric transition-all duration-300 hover:-translate-y-1 bg-card-gradient border-border/50"
              >
                <CardHeader className="pb-4">
                  <div className="flex items-center justify-between mb-3">
                    <div className="p-3 rounded-lg bg-electric/10 group-hover:bg-electric/20 transition-colors">
                      <Icon className="h-6 w-6 text-electric" />
                    </div>
                    <span className="text-xs font-medium text-energy bg-energy/10 px-2 py-1 rounded-full">
                      {feature.highlight}
                    </span>
                  </div>
                  <CardTitle className="text-xl group-hover:text-electric transition-colors">
                    {feature.title}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <CardDescription className="text-base leading-relaxed">
                    {feature.description}
                  </CardDescription>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </div>
    </section>
  );
};

export default Features;