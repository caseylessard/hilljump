import { useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import Navigation from "@/components/Navigation";
import { Bot, Download, Code, TrendingUp, Zap, Shield } from "lucide-react";

const Bots = () => {
  // SEO setup
  useEffect(() => {
    document.title = "Trading Bots — HillJump Pine Scripts";
    const meta = document.querySelector('meta[name="description"]') as HTMLMetaElement ||
      (() => {
        const m = document.createElement('meta');
        m.setAttribute('name', 'description');
        document.head.appendChild(m);
        return m as HTMLMetaElement;
      })();
    meta.setAttribute('content', 'Download professional Pine Script trading bots for TradingView. Automated ETF trading strategies based on HillJump scoring and DRIP analysis.');
  }, []);

  // Placeholder bot data - will be implemented later
  const comingSoonBots = [
    {
      id: 'hilljump-momentum',
      name: 'HillJump Momentum Bot',
      description: 'Automated ETF trading based on HillJump composite scores and momentum indicators',
      strategy: 'Momentum + Score-based',
      timeframe: '1D',
      riskLevel: 'Medium',
      status: 'Coming Soon'
    },
    {
      id: 'drip-focused',
      name: 'DRIP Performance Bot',
      description: 'Trade ETFs based on DRIP (dividend reinvestment) performance metrics',
      strategy: 'DRIP + Yield-focused',
      timeframe: '4H',
      riskLevel: 'Low',
      status: 'Coming Soon'
    },
    {
      id: 'canadian-bias',
      name: 'Canadian ETF Scanner',
      description: 'Automated scanner for high-performing Canadian ETFs with geographic bias',
      strategy: 'Geographic + Performance',
      timeframe: '1H',
      riskLevel: 'Medium-High',
      status: 'Coming Soon'
    },
    {
      id: 'volatility-breakout',
      name: 'Volatility Breakout Bot',
      description: 'Capture ETF breakouts using volatility and volume analysis',
      strategy: 'Breakout + Volume',
      timeframe: '15M',
      riskLevel: 'High',
      status: 'Coming Soon'
    }
  ];

  const getRiskColor = (risk: string) => {
    switch (risk) {
      case 'Low': return 'bg-green-100 text-green-800';
      case 'Medium': return 'bg-yellow-100 text-yellow-800';
      case 'Medium-High': return 'bg-orange-100 text-orange-800';
      case 'High': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <Navigation />
      
      <header className="container py-8">
        <div className="flex items-center gap-3 mb-4">
          <Bot className="h-8 w-8 text-primary" />
          <h1 className="text-4xl font-bold">Trading Bots</h1>
        </div>
        <p className="text-lg text-muted-foreground">
          Professional Pine Script trading bots for TradingView. Automated strategies based on HillJump ETF analysis.
        </p>
      </header>

      <main className="container pb-16">
        {/* Features Section */}
        <div className="grid md:grid-cols-3 gap-6 mb-12">
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <Code className="h-5 w-5 text-primary" />
                <CardTitle className="text-lg">Pine Script v5</CardTitle>
              </div>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                Professional-grade Pine Script code optimized for TradingView's latest version with advanced features.
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <TrendingUp className="h-5 w-5 text-primary" />
                <CardTitle className="text-lg">HillJump Integration</CardTitle>
              </div>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                Bots leverage HillJump's proprietary scoring system and DRIP analysis for intelligent ETF selection.
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <Shield className="h-5 w-5 text-primary" />
                <CardTitle className="text-lg">Risk Management</CardTitle>
              </div>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                Built-in stop losses, position sizing, and risk controls to protect your capital in volatile markets.
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Coming Soon Bots */}
        <div className="space-y-6">
          <div className="flex items-center gap-2 mb-6">
            <Zap className="h-6 w-6 text-primary" />
            <h2 className="text-2xl font-semibold">Available Bots</h2>
            <Badge variant="secondary" className="ml-2">Coming Soon</Badge>
          </div>

          <div className="grid gap-6">
            {comingSoonBots.map((bot) => (
              <Card key={bot.id} className="relative">
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div>
                      <CardTitle className="flex items-center gap-2">
                        <Bot className="h-5 w-5" />
                        {bot.name}
                      </CardTitle>
                      <p className="text-muted-foreground mt-2">{bot.description}</p>
                    </div>
                    <Badge variant="outline" className="ml-4">
                      {bot.status}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="flex flex-wrap gap-4 items-center">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium">Strategy:</span>
                      <Badge variant="secondary">{bot.strategy}</Badge>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium">Timeframe:</span>
                      <Badge variant="outline">{bot.timeframe}</Badge>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium">Risk Level:</span>
                      <Badge className={getRiskColor(bot.riskLevel)}>{bot.riskLevel}</Badge>
                    </div>
                  </div>
                  
                  <div className="flex gap-3 mt-6">
                    <Button disabled className="flex items-center gap-2">
                      <Download className="h-4 w-4" />
                      Download Pine Script
                    </Button>
                    <Button variant="outline" disabled>
                      View Documentation
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>

        {/* Notification Section */}
        <Card className="mt-12 bg-primary/5 border-primary/20">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Bot className="h-5 w-5 text-primary" />
              Get Notified
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground mb-4">
              Trading bots are currently in development. We're building sophisticated Pine Script strategies that integrate with HillJump's ETF analysis. 
              Sign up to be notified when they're ready for download.
            </p>
            <Button className="w-full sm:w-auto">
              Join Waitlist
            </Button>
          </CardContent>
        </Card>
      </main>
    </div>
  );
};

export default Bots;