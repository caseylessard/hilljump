import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import Navigation from "@/components/Navigation";
import { TrendingUp, Shield, Zap, BarChart3 } from "lucide-react";

// Import data preloading hooks
import { useCachedETFs, useCachedPrices, useCachedDistributions, useCachedYields } from "@/hooks/useCachedETFData";
import { initializeCache } from "@/lib/cacheUtils";
import { useHomepageContent } from "@/hooks/useHomepageContent";
import { useSEOSettings } from "@/hooks/useSEOSettings";
import { clearHomepageCache } from "@/lib/globalCache";
import { AdminEditToggle } from "@/components/admin/AdminEditToggle";

const Home = () => {
  // Load dynamic content and SEO settings
  const { content, loading: contentLoading, forceRefresh } = useHomepageContent();
  const { settings: seoSettings, loading: seoLoading } = useSEOSettings();
  
  // Preload data silently in background - disabled, data comes from cache
  // const { data: etfs = [] } = useCachedETFs();
  // const tickers = (etfs as any[]).map(e => e.ticker);
  
  // Trigger data preloading - disabled
  // useCachedPrices(tickers);
  // useCachedDistributions(tickers);
  // useCachedYields(tickers);

  useEffect(() => {
    // Initialize cache system
    initializeCache();
    
    // Force clear homepage cache and refresh content for deployed site
    console.log('🔄 Clearing homepage cache and forcing refresh...');
    clearHomepageCache();
    forceRefresh();
  }, [forceRefresh]);

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
      <AdminEditToggle />
      
      <main>
        {/* Hero Section */}
        <section className="relative overflow-hidden py-12 sm:py-16 lg:py-20">
          <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-primary/10 to-primary/5" />
          <div className="container relative px-4 sm:px-6 lg:px-8">
            <div className="grid lg:grid-cols-2 gap-8 lg:gap-12 items-center">
              <div className="space-y-6 lg:space-y-8 text-center lg:text-left">
                <div className="space-y-3 sm:space-y-4">
                  <Badge variant="secondary" className="mb-3 sm:mb-4 text-xs sm:text-sm">
                    {contentLoading ? 'Loading...' : content.hero_badge_text}
                  </Badge>
                  <h1 className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-jersey font-bold tracking-tight leading-tight">
                    {contentLoading ? (
                      'Loading...'
                    ) : content.hero_title.includes('Income Investors') ? (
                      <>
                        {content.hero_title.split('Income Investors')[0]}
                        <span className="text-primary">Income Investors</span>
                      </>
                    ) : (
                      content.hero_title
                    )}
                  </h1>
                  <p className="text-lg sm:text-xl text-muted-foreground leading-relaxed max-w-2xl lg:max-w-none">
                    {contentLoading ? 'Loading content...' : content.hero_description}
                  </p>
                </div>
                
                <div className="flex flex-col sm:flex-row gap-3 sm:gap-4 justify-center lg:justify-start">
                  <Button size="lg" asChild className="w-full sm:w-auto">
                    <a href="/ranking">Explore Rankings</a>
                  </Button>
                  <Button size="lg" variant="outline" asChild className="w-full sm:w-auto">
                    <a href="/portfolio">Track Portfolio</a>
                  </Button>
                </div>
              </div>
              
              <Card className="overflow-hidden order-first lg:order-last">
                <img 
                  src={`${content.hero_image_url}?v=${Date.now()}`} 
                  alt="Investment platform visualization showing market data and analysis tools" 
                  className="w-full h-64 sm:h-80 lg:h-96 object-cover"
                />
              </Card>
            </div>
          </div>
        </section>

        {/* Features Section */}
        <section className="py-12 sm:py-16 lg:py-20 bg-muted/30">
          <div className="container px-4 sm:px-6 lg:px-8">
            <div className="text-center space-y-3 sm:space-y-4 mb-12 sm:mb-16">
              <h2 className="text-2xl sm:text-3xl md:text-4xl font-jersey font-bold">
                {contentLoading ? 'Loading...' : content.features_title}
              </h2>
              <p className="text-lg sm:text-xl text-muted-foreground max-w-2xl mx-auto px-4">
                {contentLoading ? 'Loading content...' : content.features_description}
              </p>
            </div>
            
            <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6 lg:gap-8">
              {features.map((feature, index) => (
                <Card key={index} className="p-4 sm:p-6 text-center hover:shadow-lg transition-shadow">
                  <div className="w-10 h-10 sm:w-12 sm:h-12 bg-primary/10 rounded-lg flex items-center justify-center mx-auto mb-3 sm:mb-4">
                    <feature.icon className="w-5 h-5 sm:w-6 sm:h-6 text-primary" />
                  </div>
                  <h3 className="text-lg sm:text-xl font-jersey font-semibold mb-2">{feature.title}</h3>
                  <p className="text-sm sm:text-base text-muted-foreground leading-relaxed">{feature.description}</p>
                </Card>
              ))}
            </div>
          </div>
        </section>

        {/* Quick Actions Section */}
        <section className="py-12 sm:py-16 lg:py-20">
          <div className="container px-4 sm:px-6 lg:px-8">
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6 lg:gap-8">
              <Card className="p-4 sm:p-6">
                <h3 className="text-lg sm:text-xl font-jersey font-semibold mb-3">Income Rankings</h3>
                <p className="text-sm sm:text-base text-muted-foreground mb-4 leading-relaxed">
                  Discover top-performing income ETFs ranked by total return with risk adjustments.
                </p>
                <Button asChild className="w-full">
                  <a href="/ranking">View Rankings</a>
                </Button>
              </Card>
              
              <Card className="p-4 sm:p-6">
                <h3 className="text-lg sm:text-xl font-jersey font-semibold mb-3">Portfolio Tracker</h3>
                <p className="text-sm sm:text-base text-muted-foreground mb-4 leading-relaxed">
                  Track your positions, monitor performance, and optimize your income strategy.
                </p>
                <Button asChild variant="outline" className="w-full">
                  <a href="/portfolio">Manage Portfolio</a>
                </Button>
              </Card>
              
              <Card className="p-4 sm:p-6 sm:col-span-2 lg:col-span-1">
                <h3 className="text-lg sm:text-xl font-jersey font-semibold mb-3">Market Alerts</h3>
                <p className="text-sm sm:text-base text-muted-foreground mb-4 leading-relaxed">
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