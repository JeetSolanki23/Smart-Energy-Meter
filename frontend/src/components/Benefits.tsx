import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { 
  DollarSign, 
  Leaf, 
  TrendingUp, 
  Clock,
  CheckCircle
} from "lucide-react";

const Benefits = () => {
  const benefits = [
    {
      icon: DollarSign,
      title: "Reduce Energy Bills",
      subtitle: "Up to 30% savings",
      description: "Smart monitoring and optimization can significantly reduce your monthly electricity costs through better usage patterns and peak-hour avoidance.",
      stats: "Average $200/month savings",
      color: "text-energy"
    },
    {
      icon: Leaf,
      title: "Environmental Impact",
      subtitle: "Lower carbon footprint",
      description: "Contribute to a sustainable future by reducing energy waste and optimizing consumption patterns for a cleaner environment.",
      stats: "15% less CO₂ emissions",
      color: "text-energy"
    },
    {
      icon: TrendingUp,
      title: "Usage Insights",
      subtitle: "Data-driven decisions",
      description: "Make informed decisions about your energy usage with detailed analytics, trends, and personalized recommendations.",
      stats: "Real-time data analysis",
      color: "text-electric"
    },
    {
      icon: Clock,
      title: "Time-of-Use Optimization",
      subtitle: "Peak hour management",
      description: "Automatically shift high-energy activities to off-peak hours when electricity rates are lower.",
      stats: "24/7 optimization",
      color: "text-warning"
    }
  ];

  const features = [
    "Automatic billing accuracy",
    "Remote meter reading",
    "Outage detection & notification",
    "Tamper detection & security",
    "Two-way communication",
    "Integration with renewable energy"
  ];

  return (
    <section id="benefits" className="py-20 lg:py-32">
      <div className="container">
        <div className="grid lg:grid-cols-2 gap-16 items-center">
          {/* Benefits Cards */}
          <div className="space-y-6">
            <div className="space-y-4">
              <Badge variant="outline" className="border-electric/20 text-electric">
                Why Choose Smart Meters?
              </Badge>
              <h2 className="text-3xl lg:text-4xl font-bold">
                Transform Your Energy
                <span className="text-electric block">Experience</span>
              </h2>
              <p className="text-lg text-muted-foreground">
                Smart electric meters offer numerous advantages over traditional meters, 
                providing you with unprecedented control and insights into your energy consumption.
              </p>
            </div>

            <div className="grid gap-4">
              {benefits.map((benefit, index) => {
                const Icon = benefit.icon;
                return (
                  <Card key={index} className="p-6 hover:shadow-card-custom transition-shadow">
                    <CardContent className="p-0">
                      <div className="flex items-start gap-4">
                        <div className={`p-2 rounded-lg bg-secondary ${benefit.color} bg-opacity-10`}>
                          <Icon className={`h-5 w-5 ${benefit.color}`} />
                        </div>
                        <div className="space-y-1 flex-1">
                          <div className="flex items-center justify-between">
                            <h3 className="font-semibold">{benefit.title}</h3>
                            <span className={`text-sm font-medium ${benefit.color}`}>
                              {benefit.subtitle}
                            </span>
                          </div>
                          <p className="text-sm text-muted-foreground leading-relaxed">
                            {benefit.description}
                          </p>
                          <div className={`text-xs font-medium ${benefit.color} mt-2`}>
                            {benefit.stats}
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </div>

          {/* Features List */}
          <div className="space-y-8">
            <div className="relative">
              <div className="absolute inset-0 bg-electric-gradient rounded-2xl opacity-10"></div>
              <div className="relative p-8 rounded-2xl border bg-card/50 backdrop-blur">
                <h3 className="text-2xl font-bold mb-6">Key Capabilities</h3>
                <div className="space-y-4">
                  {features.map((feature, index) => (
                    <div key={index} className="flex items-center gap-3">
                      <CheckCircle className="h-5 w-5 text-energy flex-shrink-0" />
                      <span className="text-foreground">{feature}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-2 gap-6">
              <div className="text-center p-6 rounded-xl bg-electric/10">
                <div className="text-3xl font-bold text-electric mb-2">99.9%</div>
                <div className="text-sm text-muted-foreground">Uptime Reliability</div>
              </div>
              <div className="text-center p-6 rounded-xl bg-energy/10">
                <div className="text-3xl font-bold text-energy mb-2">24/7</div>
                <div className="text-sm text-muted-foreground">Monitoring</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default Benefits;