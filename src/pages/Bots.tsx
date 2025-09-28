import { useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import Navigation from "@/components/Navigation";
import { Bot, Download, Code, TrendingUp, Zap, Shield } from "lucide-react";
import Footer from "@/components/Footer";

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
    meta.setAttribute('content', 'Professional Pine Script trading bots for TradingView coming soon. Automated ETF trading strategies based on HillJump scoring and real-time analysis.');
  }, []);

  return (
    <div className="min-h-screen bg-background">
      <Navigation />
      
      <header className="container py-6 sm:py-8 px-4 sm:px-6 lg:px-8">
        <div className="flex items-center gap-2 sm:gap-3 mb-4">
          <Bot className="h-6 w-6 sm:h-8 sm:w-8 text-primary flex-shrink-0" />
          <h1 className="text-2xl sm:text-3xl lg:text-4xl font-bold">Trading Bots</h1>
        </div>
        <p className="text-base sm:text-lg text-muted-foreground leading-relaxed">
          Professional Pine Script trading bots for TradingView. Automated strategies based on HillJump ETF analysis.
        </p>
      </header>

      <main className="container pb-12 sm:pb-16 px-4 sm:px-6 lg:px-8">
        {/* Features Section */}
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6 mb-8 sm:mb-12">
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

        <div className="space-y-6">
          <div className="flex items-center gap-2 mb-6">
            <Zap className="h-6 w-6 text-primary" />
            <h2 className="text-2xl font-semibold">Trading Bots</h2>
            <Badge variant="secondary" className="ml-2">In Development</Badge>
          </div>

          <Card className="bg-primary/5 border-primary/20">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Bot className="h-5 w-5 text-primary" />
                Trading Bots Coming Soon
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground mb-4">
                Professional Pine Script trading bots are currently in development. These bots will integrate with HillJump's real-time ETF analysis and scoring system to provide automated trading strategies for TradingView.
              </p>
              <div className="grid gap-3 mb-4">
                <div className="flex items-center gap-2 text-sm">
                  <div className="w-2 h-2 rounded-full bg-primary"></div>
                  <span>Real-time HillJump scoring integration</span>
                </div>
                <div className="flex items-center gap-2 text-sm">
                  <div className="w-2 h-2 rounded-full bg-primary"></div>
                  <span>DRIP-based ETF selection algorithms</span>
                </div>
                <div className="flex items-center gap-2 text-sm">
                  <div className="w-2 h-2 rounded-full bg-primary"></div>
                  <span>Advanced risk management and position sizing</span>
                </div>
                <div className="flex items-center gap-2 text-sm">
                  <div className="w-2 h-2 rounded-full bg-primary"></div>
                  <span>Geographic bias and sector rotation strategies</span>
                </div>
              </div>
              <Button disabled className="w-full sm:w-auto">
                Get Notified When Available
              </Button>
            </CardContent>
          </Card>
        </div>
      </main>
      <Footer />
    </div>
  );
};

export default Bots;