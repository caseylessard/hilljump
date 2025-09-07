import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

export const SystemCssTest = () => {
  useEffect(() => {
    // Load system.css from CDN for this test page
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = 'https://unpkg.com/sakofchit-system-css@1.0.0/system.css';
    link.id = 'system-css';
    document.head.appendChild(link);

    // Cleanup when component unmounts
    return () => {
      const existingLink = document.getElementById('system-css');
      if (existingLink) {
        document.head.removeChild(existingLink);
      }
    };
  }, []);

  return (
    <div className="min-h-screen bg-gray-200 p-8">
      <div className="max-w-4xl mx-auto space-y-8">
        {/* Current Design System */}
        <Card className="p-6">
          <h2 className="text-xl font-semibold mb-4">Current Design System</h2>
          <div className="space-x-4">
            <Button>Primary Button</Button>
            <Button variant="secondary">Secondary</Button>
            <Button variant="outline">Outline</Button>
            <Button variant="destructive">Destructive</Button>
            <Button variant="hero">Hero Button</Button>
          </div>
        </Card>

        {/* System.css Retro Design */}
        <div className="bg-white p-6 border-2 border-black" style={{ fontFamily: 'Chicago, Monaco, monospace' }}>
          <h2 className="text-xl font-bold mb-4">System.css Retro Design</h2>
          
          {/* Window-like container */}
          <div className="window" style={{ width: '100%', maxWidth: '600px' }}>
            <div className="title-bar">
              <div className="title-bar-text">ETF Dashboard - Retro Style</div>
              <div className="title-bar-controls">
                <button aria-label="Close"></button>
              </div>
            </div>
            <div className="window-body" style={{ padding: '16px' }}>
              <h3>Classic Mac Interface Test</h3>
              <p>Testing retro Apple System 6 styling on our ETF dashboard.</p>
              
              <div style={{ margin: '16px 0' }}>
                <button className="btn">Cancel</button>
                <button className="btn btn-default">Find ETFs</button>
                <button className="btn">View Portfolio</button>
              </div>

              <fieldset>
                <legend>Investment Preferences</legend>
                <div>
                  <input type="radio" id="high-yield" name="preference" />
                  <label htmlFor="high-yield">High Yield</label>
                </div>
                <div>
                  <input type="radio" id="growth" name="preference" />
                  <label htmlFor="growth">Growth</label>
                </div>
                <div>
                  <input type="radio" id="balanced" name="preference" />
                  <label htmlFor="balanced">Balanced</label>
                </div>
              </fieldset>

              <div style={{ marginTop: '16px' }}>
                <label htmlFor="ticker-search">ETF Ticker Search:</label>
                <input type="text" id="ticker-search" placeholder="Enter ticker..." />
              </div>

              <details>
                <summary>Advanced Options</summary>
                <p>Configure additional filtering and sorting options for your ETF analysis.</p>
              </details>
            </div>
          </div>
        </div>

        {/* Comparison */}
        <Card className="p-6">
          <h2 className="text-xl font-semibold mb-4">Style Comparison</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <h3 className="font-medium mb-2">Modern (Current)</h3>
              <ul className="text-sm space-y-1">
                <li>• Clean, minimal design</li>
                <li>• Rounded corners</li>
                <li>• Gradients and shadows</li>
                <li>• Modern typography</li>
                <li>• Responsive layout</li>
              </ul>
            </div>
            <div>
              <h3 className="font-medium mb-2">Retro System.css</h3>
              <ul className="text-sm space-y-1">
                <li>• Classic Mac OS aesthetics</li>
                <li>• Monospaced fonts</li>
                <li>• Window chrome styling</li>
                <li>• Nostalgic 1980s-1990s feel</li>
                <li>• Bitmap-style buttons</li>
              </ul>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
};