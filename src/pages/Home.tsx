import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import Navigation from "@/components/Navigation";
import hero from "/lovable-uploads/4dff6720-7418-49b2-a73f-7417a6feb921.png";
import { TrendingUp, Shield, Zap, BarChart3 } from "lucide-react";

// Import data preloading hooks
import { useCachedETFs, useCachedPrices, useCachedDistributions, useCachedYields } from "@/hooks/useCachedETFData";
import { initializeCache } from "@/lib/cacheUtils";

const Home = () => {
  // Preload all data for other pages
  const { data: etfs = [] } = useCachedETFs();
  const tickers = (etfs as any[]).map(e => e.ticker);
  
  // Trigger data preloading
  useCachedPrices(tickers);
  useCachedDistributions(tickers);
  useCachedYields(tickers);

  useEffect(() => {
    // Initialize cache system
    initializeCache();

    // SEO
    document.title = "HillJump — Smart ETF Analysis & Income Investing";
    const meta =
      (document.querySelector('meta[name="description"]') as HTMLMetaElement) ||
      (() => { 
        const m = document.createElement('meta'); 
        m.setAttribute('name', 'description'); 
        document.head.appendChild(m); 
        return m as HTMLMetaElement; 
      })();
    meta.setAttribute('content', 'HillJump provides advanced ETF analysis tools, income-focused rankings, portfolio tracking, and market insights for smarter investing decisions.');
  }, []);

  const features = [
    {
      icon: TrendingUp,
      title: "Smart Rankings",
      description: "AI-powered ETF rankings based on total return, yield, risk, and market factors"
    },
    {
      icon: Shield,
      title: "Risk Analysis",
      description: "Comprehensive risk assessment including volatility, drawdowns, and market exposure"
    },
    {
      icon: Zap,
      title: "Real-time Data",
      description: "Live pricing, dividend tracking, and market alerts to keep you informed"
    },
    {
      icon: BarChart3,
      title: "Portfolio Tools",
      description: "Track your positions, analyze performance, and optimize your income strategy"
    }
  ];

  return (
    <div>
      <Navigation />
      
      <main>
        {/* Hero Section */}
        <section className="relative overflow-hidden py-20">
          <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-primary/10 to-primary/5" />
          <div className="container relative">
            <div className="grid lg:grid-cols-2 gap-12 items-center">
              <div className="space-y-8">
                <div className="space-y-4">
                  <Badge variant="secondary" className="mb-4">
                    Welcome to HillJump
                  </Badge>
                  <h1 className="text-4xl md:text-6xl font-bold tracking-tight">
                    Smart ETF Analysis for 
                    <span className="text-primary"> Income Investors</span>
                  </h1>
                  <p className="text-xl text-muted-foreground leading-relaxed">
                    Make informed investment decisions with our comprehensive ETF rankings, 
                    real-time market data, and advanced portfolio analysis tools.
                  </p>
                </div>
                
                <div className="flex flex-col sm:flex-row gap-4">
                  <Button size="lg" asChild>
                    <a href="/ranking">Explore Rankings</a>
                  </Button>
                  <Button size="lg" variant="outline" asChild>
                    <a href="/portfolio">Track Portfolio</a>
                  </Button>
                </div>
              </div>
              
              <Card className="overflow-hidden">
                <img 
                  src={hero} 
                  alt="Pixelated Wall Street bull representing market strength and financial growth" 
                  className="w-full h-80 object-cover"
                />
              </Card>
            </div>
          </div>
        </section>

        {/* Features Section */}
        <section className="py-20 bg-muted/30">
          <div className="container">
            <div className="text-center space-y-4 mb-16">
              <h2 className="text-3xl md:text-4xl font-bold">
                Everything You Need for Smart Investing
              </h2>
              <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
                Our platform combines cutting-edge analysis with intuitive tools 
                to help you build a winning income portfolio.
              </p>
            </div>
            
            <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-8">
              {features.map((feature, index) => (
                <Card key={index} className="p-6 text-center hover:shadow-lg transition-shadow">
                  <div className="w-12 h-12 bg-primary/10 rounded-lg flex items-center justify-center mx-auto mb-4">
                    <feature.icon className="w-6 h-6 text-primary" />
                  </div>
                  <h3 className="text-xl font-semibold mb-2">{feature.title}</h3>
                  <p className="text-muted-foreground">{feature.description}</p>
                </Card>
              ))}
            </div>
          </div>
        </section>

        {/* Quick Actions Section */}
        <section className="py-20">
          <div className="container">
            <div className="grid md:grid-cols-3 gap-8">
              <Card className="p-6">
                <h3 className="text-xl font-semibold mb-3">Income Rankings</h3>
                <p className="text-muted-foreground mb-4">
                  Discover top-performing income ETFs ranked by total return with risk adjustments.
                </p>
                <Button asChild className="w-full">
                  <a href="/ranking">View Rankings</a>
                </Button>
              </Card>
              
              <Card className="p-6">
                <h3 className="text-xl font-semibold mb-3">Portfolio Tracker</h3>
                <p className="text-muted-foreground mb-4">
                  Track your positions, monitor performance, and optimize your income strategy.
                </p>
                <Button asChild variant="outline" className="w-full">
                  <a href="/portfolio">Manage Portfolio</a>
                </Button>
              </Card>
              
              <Card className="p-6">
                <h3 className="text-xl font-semibold mb-3">Market Alerts</h3>
                <p className="text-muted-foreground mb-4">
                  Stay informed with daily market alerts and trading opportunities.
                </p>
                <Button asChild variant="outline" className="w-full">
                  <a href="/bots">View Alerts</a>
                </Button>
              </Card>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
};

export default Home;