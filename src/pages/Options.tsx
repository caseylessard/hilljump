import { useState, useEffect } from 'react';
import { Calendar, TrendingUp, Bell, Target, DollarSign, Activity, Clock, Plus, X, ChevronDown, ChevronUp, Filter, ArrowUpDown, Download, Edit2, Save } from 'lucide-react';

// Stochastic Calculations
const normalCDF = (x: number) => {
  const t = 1 / (1 + 0.2316419 * Math.abs(x));
  const d = 0.3989423 * Math.exp(-x * x / 2);
  const prob = d * t * (0.3193815 + t * (-0.3565638 + t * (1.781478 + t * (-1.821256 + t * 1.330274))));
  return x > 0 ? 1 - prob : prob;
};

const blackScholesCall = (S: number, K: number, T: number, r: number, sigma: number) => {
  if (T <= 0) return Math.max(S - K, 0);
  const d1 = (Math.log(S / K) + (r + 0.5 * sigma ** 2) * T) / (sigma * Math.sqrt(T));
  const d2 = d1 - sigma * Math.sqrt(T);
  return S * normalCDF(d1) - K * Math.exp(-r * T) * normalCDF(d2);
};

const calculateGreeks = (S: number, K: number, T: number, r: number, sigma: number) => {
  if (T <= 0) return { delta: S > K ? 1 : 0, gamma: 0, theta: 0 };
  const d1 = (Math.log(S / K) + (r + 0.5 * sigma ** 2) * T) / (sigma * Math.sqrt(T));
  const d2 = d1 - sigma * Math.sqrt(T);
  const nd1 = Math.exp(-d1 * d1 / 2) / Math.sqrt(2 * Math.PI);
  
  const delta = normalCDF(d1);
  const gamma = nd1 / (S * sigma * Math.sqrt(T));
  const theta = (-S * nd1 * sigma / (2 * Math.sqrt(T)) - r * K * Math.exp(-r * T) * normalCDF(d2)) / 365;
  
  return { delta, gamma, theta };
};

const API_ENDPOINT = 'https://earnings-scanner-api.caseylessard.workers.dev/api/research';

interface Signal {
  ticker: string;
  currentPrice: number;
  strike: number;
  premium: number;
  expiry: string;
  earningsDate: string;
  impliedVol: number;
  score: number;
  signalType: string;
  daysToExpiry: number;
  daysToEarnings: number;
  fairValue: number;
  delta: number;
  gamma: number;
  theta: number;
  probITM: number;
  edge: number;
  expectedReturn: number;
  reasons: string[];
}

interface Position {
  id: number;
  ticker: string;
  strike: number;
  expiry: string;
  contracts: number;
  entryPrice: number;
  currentPrice: number;
  notes: string;
  entryDate: string;
}

const Options = () => {
  useEffect(() => {
    document.title = "HillJump — Options Scanner";
    const meta =
      (document.querySelector('meta[name="description"]') as HTMLMetaElement) ||
      (() => {
        const m = document.createElement('meta');
        m.setAttribute('name', 'description');
        document.head.appendChild(m);
        return m as HTMLMetaElement;
      })();
    meta.setAttribute('content', 'AI-powered earnings options scanner with real-time signals and analysis.');

    const link =
      (document.querySelector('link[rel="canonical"]') as HTMLLinkElement) ||
      (() => {
        const l = document.createElement('link');
        l.setAttribute('rel', 'canonical');
        document.head.appendChild(l);
        return l as HTMLLinkElement;
      })();
    link.setAttribute('href', window.location.origin + window.location.pathname);
  }, []);

  const [activeTab, setActiveTab] = useState('signals');
  const [expandedSignals, setExpandedSignals] = useState<Record<number, boolean>>({});
  const [sortBy, setSortBy] = useState('score');
  const [filterType, setFilterType] = useState('all');
  const [isLoading, setIsLoading] = useState(false);
  const [signals, setSignals] = useState<Signal[]>([]);
  const [error, setError] = useState<string | null>(null);
  
  const [watchlistTickers, setWatchlistTickers] = useState(['NVDA', 'PLTR', 'SOFI', 'AMD', 'PLUG']);
  const [newTicker, setNewTicker] = useState('');
  
  useEffect(() => {
    if (watchlistTickers.length > 0) {
      fetchSignals();
    }
  }, []);

  const fetchSignals = async () => {
    console.log('Fetching signals for:', watchlistTickers);
    setIsLoading(true);
    setError(null);
    
    try {
      const response = await fetch(API_ENDPOINT, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ tickers: watchlistTickers }),
      });

      console.log('Response status:', response.status);

      if (!response.ok) {
        throw new Error(`API returned ${response.status}`);
      }

      const data = await response.json();
      console.log('Received data:', data);
      
      if (!data.signals || data.signals.length === 0) {
        setError('No signals returned from API');
        setSignals([]);
        return;
      }

      const processedSignals = generateSignalsFromData(data.signals);
      console.log('Processed signals:', processedSignals);
      setSignals(processedSignals);
    } catch (err) {
      console.error('Error fetching signals:', err);
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setIsLoading(false);
    }
  };
  
  const [positions, setPositions] = useState<Position[]>([]);
  const [editingPosition, setEditingPosition] = useState<number | null>(null);
  const [newPosition, setNewPosition] = useState({
    ticker: '',
    strike: '',
    expiry: '',
    contracts: '',
    entryPrice: '',
    currentPrice: '',
    notes: ''
  });

  const generateSignalsFromData = (candidates: any[]): Signal[] => {
    const r = 0.045;

    return candidates.map(c => {
      const daysToExpiry = Math.floor((new Date(c.expiry).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24));
      const daysToEarnings = Math.floor((new Date(c.earningsDate).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24));
      const T = daysToExpiry / 365;
      
      const fairValue = blackScholesCall(c.currentPrice, c.strike, T, r, c.impliedVol);
      const greeks = calculateGreeks(c.currentPrice, c.strike, T, r, c.impliedVol);
      const d2 = (Math.log(c.currentPrice / c.strike) + (r - 0.5 * c.impliedVol ** 2) * T) / (c.impliedVol * Math.sqrt(T));
      const probITM = normalCDF(d2) * 100;
      const edge = ((fairValue - c.premium) / c.premium) * 100;
      const expectedReturn = (probITM / 100) * ((c.currentPrice - c.strike) / c.premium) * 100;

      let score = 0;
      if (greeks.delta > 0.65) score += 25;
      else if (greeks.delta > 0.50) score += 20;
      else if (greeks.delta > 0.40) score += 12;

      if (greeks.gamma > 0.015 && greeks.gamma < 0.050) score += 15;
      else if (greeks.gamma > 0.010) score += 10;

      const thetaRatio = Math.abs(greeks.theta) / c.premium;
      if (thetaRatio < 0.01) score += 20;
      else if (thetaRatio < 0.02) score += 15;

      if (probITM > 60) score += 20;
      else if (probITM > 50) score += 15;
      else if (probITM > 40) score += 10;

      if (edge > 20) score += 20;
      else if (edge > 10) score += 15;
      else if (edge > 5) score += 10;

      let signalType = score >= 80 ? 'STRONG BUY' : score >= 65 ? 'BUY' : 'LOTTERY TICKET';

      const reasons = [];
      if (greeks.delta > 0.50) reasons.push('High probability ITM ' + (greeks.delta * 100).toFixed(0) + '%');
      if (edge > 10) reasons.push('Underpriced by ' + edge.toFixed(0) + '%');
      if (thetaRatio < 0.02) reasons.push('Low time decay');
      if (greeks.gamma > 0.015) reasons.push('Good convexity');

      return {
        ...c,
        score: Math.min(100, Math.max(0, score)),
        signalType,
        daysToExpiry,
        daysToEarnings,
        fairValue,
        delta: greeks.delta,
        gamma: greeks.gamma,
        theta: greeks.theta,
        probITM,
        edge,
        expectedReturn,
        reasons
      };
    });
  };

  const sortedSignals = [...signals].sort((a, b) => {
    switch(sortBy) {
      case 'score': return b.score - a.score;
      case 'delta': return b.delta - a.delta;
      case 'edge': return b.edge - a.edge;
      case 'expiry': return new Date(a.expiry).getTime() - new Date(b.expiry).getTime();
      case 'earnings': return new Date(a.earningsDate).getTime() - new Date(b.earningsDate).getTime();
      default: return b.score - a.score;
    }
  });

  const filteredSignals = sortedSignals.filter(signal => {
    if (filterType === 'all') return true;
    return signal.signalType === filterType;
  });

  const addTicker = () => {
    if (!newTicker.trim()) return;
    
    const tickers = newTicker
      .split(',')
      .map(t => t.trim().toUpperCase())
      .filter(t => t.length > 0 && !watchlistTickers.includes(t));
    
    if (tickers.length > 0) {
      setWatchlistTickers([...watchlistTickers, ...tickers]);
      alert(`Added ${tickers.length} ticker${tickers.length > 1 ? 's' : ''} to watchlist`);
      setNewTicker('');
    }
  };

  const removeTicker = (ticker: string) => {
    setWatchlistTickers(watchlistTickers.filter(t => t !== ticker));
  };

  const addPosition = () => {
    if (newPosition.ticker && newPosition.strike && newPosition.expiry && newPosition.contracts && newPosition.entryPrice) {
      const position: Position = {
        id: Date.now(),
        ticker: newPosition.ticker,
        entryDate: new Date().toISOString().split('T')[0],
        strike: parseFloat(newPosition.strike),
        expiry: newPosition.expiry,
        contracts: parseInt(newPosition.contracts),
        entryPrice: parseFloat(newPosition.entryPrice),
        currentPrice: parseFloat(newPosition.currentPrice) || parseFloat(newPosition.entryPrice),
        notes: newPosition.notes
      };
      setPositions([...positions, position]);
      setNewPosition({ ticker: '', strike: '', expiry: '', contracts: '', entryPrice: '', currentPrice: '', notes: '' });
    }
  };

  const updatePosition = (id: number, updates: Partial<Position>) => {
    setPositions(positions.map(p => p.id === id ? { ...p, ...updates } : p));
    setEditingPosition(null);
  };

  const removePosition = (id: number) => {
    setPositions(positions.filter(p => p.id !== id));
  };

  const calculatePnL = (position: Position) => {
    const currentValue = position.currentPrice * position.contracts * 100;
    const entryValue = position.entryPrice * position.contracts * 100;
    const pnl = currentValue - entryValue;
    const pnlPercent = ((pnl / entryValue) * 100);
    return { pnl, pnlPercent, currentValue, entryValue };
  };

  const toggleExpand = (idx: number) => {
    setExpandedSignals(prev => ({...prev, [idx]: !prev[idx]}));
  };

  const exportToCSV = () => {
    const headers = ['Ticker', 'Score', 'Signal', 'Current Price', 'Strike', 'Premium', 'Expiry', 'Earnings', 'Delta', 'Gamma', 'Theta', 'Edge%', 'Expected Return%'];
    const rows = filteredSignals.map(s => [
      s.ticker, s.score, s.signalType, s.currentPrice, s.strike, s.premium, s.expiry, s.earningsDate,
      (s.delta * 100).toFixed(1), s.gamma.toFixed(4), s.theta.toFixed(2), s.edge.toFixed(1), s.expectedReturn.toFixed(0)
    ]);
    const csv = [headers, ...rows].map(row => row.join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `earnings-signals-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
  };

  const getSignalColor = (signal: string) => {
    if (signal === 'STRONG BUY') return 'bg-green-100 text-green-800 border-green-300';
    if (signal === 'BUY') return 'bg-blue-100 text-blue-800 border-blue-300';
    return 'bg-yellow-100 text-yellow-800 border-yellow-300';
  };

  const getScoreColor = (score: number) => {
    if (score >= 80) return 'text-green-600';
    if (score >= 60) return 'text-blue-600';
    return 'text-yellow-600';
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100">
      <div className="bg-gradient-to-r from-blue-600 to-purple-600 text-white p-6 shadow-lg">
        <div className="max-w-7xl mx-auto">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold flex items-center gap-3">
                <Target className="w-8 h-8" />
                Earnings Edge Scanner
              </h1>
              <p className="text-blue-100 mt-1">AI-Powered Options Research & Analysis</p>
            </div>
            <div className="flex items-center gap-4">
              <div className="bg-white/20 backdrop-blur px-4 py-2 rounded-lg">
                <div className="text-sm text-blue-100">Tracking</div>
                <div className="text-2xl font-bold">{watchlistTickers.length} stocks</div>
              </div>
              <div className="bg-white/20 backdrop-blur px-4 py-2 rounded-lg">
                <div className="text-sm text-blue-100">Positions</div>
                <div className="text-2xl font-bold">{positions.length}</div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto mt-6 px-6">
        <div className="flex gap-2 bg-white rounded-lg p-1 shadow-sm">
          {[
            { id: 'signals', label: 'AI Signals', icon: TrendingUp },
            { id: 'watchlist', label: 'Watchlist', icon: Activity },
            { id: 'positions', label: 'My Positions', icon: DollarSign },
            { id: 'schedule', label: 'Schedule', icon: Calendar }
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={'flex-1 flex items-center justify-center gap-2 px-4 py-3 rounded-md transition-all ' + (
                activeTab === tab.id
                  ? 'bg-blue-600 text-white shadow-md'
                  : 'text-gray-600 hover:bg-gray-100'
              )}
            >
              <tab.icon className="w-4 h-4" />
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      <div className="max-w-7xl mx-auto mt-6 px-6 pb-12">
        {activeTab === 'signals' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-2xl font-bold text-gray-800">AI-Researched Signals</h2>
              <div className="flex gap-2">
                <button
                  onClick={fetchSignals}
                  disabled={isLoading}
                  className="bg-purple-600 text-white px-4 py-2 rounded-lg hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 shadow-sm"
                >
                  {isLoading ? '🔄 Researching...' : '🔄 Refresh Signals'}
                </button>
                <div className="flex items-center gap-2 bg-white px-4 py-2 rounded-lg shadow-sm">
                  <Filter className="w-4 h-4 text-gray-600" />
                  <select 
                    value={filterType}
                    onChange={(e) => setFilterType(e.target.value)}
                    className="border-none bg-transparent focus:outline-none text-sm font-medium"
                  >
                    <option value="all">All Signals</option>
                    <option value="STRONG BUY">Strong Buy Only</option>
                    <option value="BUY">Buy Only</option>
                    <option value="LOTTERY TICKET">Lottery Tickets</option>
                  </select>
                </div>
                <div className="flex items-center gap-2 bg-white px-4 py-2 rounded-lg shadow-sm">
                  <ArrowUpDown className="w-4 h-4 text-gray-600" />
                  <select 
                    value={sortBy}
                    onChange={(e) => setSortBy(e.target.value)}
                    className="border-none bg-transparent focus:outline-none text-sm font-medium"
                  >
                    <option value="score">Sort by Score</option>
                    <option value="delta">Sort by Delta</option>
                    <option value="edge">Sort by Edge</option>
                    <option value="expiry">Sort by Expiry</option>
                    <option value="earnings">Sort by Earnings</option>
                  </select>
                </div>
                <button
                  onClick={exportToCSV}
                  className="bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 flex items-center gap-2 shadow-sm"
                >
                  <Download className="w-4 h-4" />
                  Export CSV
                </button>
              </div>
            </div>

            <div className="bg-blue-50 border-l-4 border-blue-500 p-4 rounded">
              <div className="flex items-center justify-between">
                <p className="text-sm text-blue-900">
                  <strong>AI Auto-Research:</strong> These signals are automatically generated from your watchlist using real-time data from Yahoo Finance. 
                  The AI researches current prices, earnings dates, option chains, and calculates optimal strikes based on stochastic models.
                </p>
                <button
                  onClick={() => {
                    console.log('Test button clicked');
                    console.log('Current watchlist:', watchlistTickers);
                    console.log('API Endpoint:', API_ENDPOINT);
                    fetchSignals();
                  }}
                  className="bg-blue-600 text-white px-3 py-1 rounded text-sm hover:bg-blue-700 whitespace-nowrap ml-4"
                >
                  Test API
                </button>
              </div>
            </div>

            {error && (
              <div className="bg-red-50 border-l-4 border-red-500 p-4 rounded">
                <p className="text-sm text-red-900">
                  <strong>Error:</strong> {error}. Please try refreshing the signals.
                </p>
              </div>
            )}

            {isLoading && (
              <div className="bg-white rounded-xl shadow-md p-12 text-center">
                <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-blue-600 mx-auto mb-4"></div>
                <div className="text-gray-600 text-lg">Researching options for {watchlistTickers.length} tickers...</div>
                <div className="text-gray-400 text-sm mt-2">This may take a few moments</div>
              </div>
            )}

            {!isLoading && filteredSignals.length === 0 && !error && (
              <div className="bg-white rounded-xl shadow-md p-12 text-center">
                <div className="text-gray-400 text-lg">No signals available</div>
                <button
                  onClick={fetchSignals}
                  className="mt-4 text-blue-600 hover:text-blue-700 font-semibold"
                >
                  Refresh Signals
                </button>
              </div>
            )}

            {!isLoading && filteredSignals.map((signal, idx) => (
              <div key={idx} className="bg-white rounded-xl shadow-md hover:shadow-lg transition-all">
                <div 
                  className="p-6 cursor-pointer"
                  onClick={() => toggleExpand(idx)}
                >
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex items-center gap-4">
                      <div className="bg-gradient-to-br from-blue-500 to-purple-500 text-white w-16 h-16 rounded-xl flex items-center justify-center text-xl font-bold">
                        {signal.ticker}
                      </div>
                      <div>
                        <div className="flex items-center gap-3">
                          <span className={'px-3 py-1 rounded-full text-sm font-semibold border ' + getSignalColor(signal.signalType)}>
                            {signal.signalType}
                          </span>
                          <span className={'text-2xl font-bold ' + getScoreColor(signal.score)}>
                            {signal.score}/100
                          </span>
                        </div>
                        <div className="text-gray-600 mt-1">
                          ${signal.currentPrice.toFixed(2)} | Earnings in {signal.daysToEarnings} days | Expires {signal.expiry}
                        </div>
                      </div>
                    </div>
                    <button className="text-gray-400 hover:text-gray-600">
                      {expandedSignals[idx] ? <ChevronUp className="w-6 h-6" /> : <ChevronDown className="w-6 h-6" />}
                    </button>
                  </div>

                  <div className="grid grid-cols-5 gap-4">
                    <div className="bg-gray-50 p-3 rounded-lg hover:bg-gray-100 transition-colors">
                      <div className="text-xs text-gray-500 mb-1">Strike</div>
                      <div className="text-lg font-bold">${signal.strike}</div>
                    </div>
                    <div className="bg-gray-50 p-3 rounded-lg hover:bg-gray-100 transition-colors">
                      <div className="text-xs text-gray-500 mb-1">Premium</div>
                      <div className="text-lg font-bold">${signal.premium.toFixed(2)}</div>
                    </div>
                    <div className="bg-orange-50 p-3 rounded-lg border-2 border-orange-300 hover:bg-orange-100 transition-colors">
                      <div className="text-xs text-orange-700 font-semibold mb-1">Expiry</div>
                      <div className="text-sm font-bold">{signal.expiry}</div>
                      <div className="text-xs text-gray-500">{signal.daysToExpiry} days</div>
                    </div>
                    <div className="bg-gray-50 p-3 rounded-lg hover:bg-gray-100 transition-colors">
                      <div className="text-xs text-gray-500 mb-1">Fair Value</div>
                      <div className="text-lg font-bold">${signal.fairValue.toFixed(2)}</div>
                    </div>
                    <div className="bg-gray-50 p-3 rounded-lg hover:bg-gray-100 transition-colors">
                      <div className="text-xs text-gray-500 mb-1">Edge</div>
                      <div className={'text-lg font-bold ' + (signal.edge > 0 ? 'text-green-600' : 'text-red-600')}>
                        {signal.edge > 0 ? '+' : ''}{signal.edge.toFixed(1)}%
                      </div>
                    </div>
                  </div>
                </div>

                {expandedSignals[idx] && (
                  <div className="px-6 pb-6 border-t border-gray-100 pt-4 space-y-4">
                    <div className="grid grid-cols-4 gap-4">
                      <div className="bg-blue-50 p-3 rounded-lg border-l-4 border-blue-500">
                        <div className="text-xs text-blue-600 mb-1">Delta</div>
                        <div className="text-lg font-bold">{(signal.delta * 100).toFixed(1)}%</div>
                        <div className="text-xs text-gray-500">Prob ITM</div>
                      </div>
                      <div className="bg-purple-50 p-3 rounded-lg border-l-4 border-purple-500">
                        <div className="text-xs text-purple-600 mb-1">Gamma</div>
                        <div className="text-lg font-bold">{signal.gamma.toFixed(4)}</div>
                        <div className="text-xs text-gray-500">Convexity</div>
                      </div>
                      <div className="bg-red-50 p-3 rounded-lg border-l-4 border-red-500">
                        <div className="text-xs text-red-600 mb-1">Theta</div>
                        <div className="text-lg font-bold">${signal.theta.toFixed(2)}</div>
                        <div className="text-xs text-gray-500">Daily decay</div>
                      </div>
                      <div className="bg-green-50 p-3 rounded-lg border-l-4 border-green-500">
                        <div className="text-xs text-green-600 mb-1">Expected Return</div>
                        <div className="text-lg font-bold">{signal.expectedReturn.toFixed(0)}%</div>
                        <div className="text-xs text-gray-500">If held</div>
                      </div>
                    </div>

                    <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                      <div className="text-sm font-semibold text-blue-900 mb-2">AI Analysis:</div>
                      <div className="flex flex-wrap gap-2">
                        {signal.reasons.map((reason, i) => (
                          <span key={i} className="bg-white px-3 py-1 rounded-full text-xs text-blue-800 border border-blue-200">
                            {reason}
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {activeTab === 'watchlist' && (
          <div className="space-y-4">
            <h2 className="text-2xl font-bold text-gray-800">Stock Watchlist</h2>

            <div className="bg-white rounded-xl shadow-md p-6">
              <h3 className="font-bold text-lg mb-4">Add Tickers to Monitor</h3>
              <div className="flex gap-3">
                <textarea
                  placeholder="Enter ticker symbols separated by commas (e.g., AAPL, TSLA, NVDA, MSFT)"
                  value={newTicker}
                  onChange={(e) => setNewTicker(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && e.ctrlKey && addTicker()}
                  className="flex-1 border rounded px-4 py-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none min-h-20"
                />
                <button
                  onClick={addTicker}
                  className="bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700 flex items-center gap-2 h-fit"
                >
                  <Plus className="w-4 h-4" />
                  Add All
                </button>
              </div>
              <p className="text-sm text-gray-500 mt-2">
                💡 Paste a comma-separated list to add multiple tickers at once. AI will automatically research all of them.
              </p>
            </div>

            <div className="bg-white rounded-xl shadow-md p-6">
              <h3 className="font-bold text-lg mb-4">Currently Tracking ({watchlistTickers.length})</h3>
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                {watchlistTickers.map((ticker, idx) => (
                  <div key={idx} className="flex items-center justify-between p-4 bg-gradient-to-br from-blue-50 to-purple-50 rounded-lg border-2 border-blue-200 hover:border-blue-400 transition-colors">
                    <div className="flex items-center gap-3">
                      <div className="bg-blue-600 text-white w-10 h-10 rounded-lg flex items-center justify-center font-bold text-sm">
                        {ticker}
                      </div>
                      <div className="text-sm text-gray-600">Monitored</div>
                    </div>
                    <button
                      onClick={() => removeTicker(ticker)}
                      className="text-red-600 hover:bg-red-50 p-1 rounded transition-colors"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {activeTab === 'positions' && (
          <div className="space-y-4">
            <h2 className="text-2xl font-bold text-gray-800">Position Tracker</h2>

            <div className="bg-white rounded-xl shadow-md p-6">
              <h3 className="font-bold text-lg mb-4">Add New Position</h3>
              <div className="grid grid-cols-7 gap-3 mb-3">
                <input
                  type="text"
                  placeholder="Ticker"
                  value={newPosition.ticker}
                  onChange={(e) => setNewPosition({...newPosition, ticker: e.target.value.toUpperCase()})}
                  className="border rounded px-3 py-2 focus:ring-2 focus:ring-blue-500 outline-none"
                />
                <input
                  type="number"
                  placeholder="Strike"
                  value={newPosition.strike}
                  onChange={(e) => setNewPosition({...newPosition, strike: e.target.value})}
                  className="border rounded px-3 py-2 focus:ring-2 focus:ring-blue-500 outline-none"
                />
                <input
                  type="date"
                  placeholder="Expiry"
                  value={newPosition.expiry}
                  onChange={(e) => setNewPosition({...newPosition, expiry: e.target.value})}
                  className="border rounded px-3 py-2 focus:ring-2 focus:ring-blue-500 outline-none"
                />
                <input
                  type="number"
                  placeholder="Contracts"
                  value={newPosition.contracts}
                  onChange={(e) => setNewPosition({...newPosition, contracts: e.target.value})}
                  className="border rounded px-3 py-2 focus:ring-2 focus:ring-blue-500 outline-none"
                />
                <input
                  type="number"
                  step="0.01"
                  placeholder="Entry Price"
                  value={newPosition.entryPrice}
                  onChange={(e) => setNewPosition({...newPosition, entryPrice: e.target.value})}
                  className="border rounded px-3 py-2 focus:ring-2 focus:ring-blue-500 outline-none"
                />
                <input
                  type="number"
                  step="0.01"
                  placeholder="Current Price"
                  value={newPosition.currentPrice}
                  onChange={(e) => setNewPosition({...newPosition, currentPrice: e.target.value})}
                  className="border rounded px-3 py-2 focus:ring-2 focus:ring-blue-500 outline-none"
                />
                <input
                  type="text"
                  placeholder="Notes"
                  value={newPosition.notes}
                  onChange={(e) => setNewPosition({...newPosition, notes: e.target.value})}
                  className="border rounded px-3 py-2 focus:ring-2 focus:ring-blue-500 outline-none"
                />
              </div>
              <button
                onClick={addPosition}
                className="bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700 flex items-center gap-2"
              >
                <Plus className="w-4 h-4" />
                Add Position
              </button>
            </div>

            {positions.length === 0 ? (
              <div className="bg-white rounded-xl shadow-md p-12 text-center">
                <DollarSign className="w-16 h-16 mx-auto text-gray-300 mb-4" />
                <div className="text-gray-500 text-lg mb-2">No active positions</div>
                <div className="text-gray-400 text-sm">Add your trades above to track P&L</div>
              </div>
            ) : (
              <div className="bg-white rounded-xl shadow-md overflow-hidden">
                <table className="w-full">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Ticker</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Strike</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Expiry</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Contracts</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Entry $</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Current $</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">P&L</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Notes</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {positions.map((position) => {
                      const { pnl, pnlPercent } = calculatePnL(position);
                      const isEditing = editingPosition === position.id;
                      
                      return (
                        <tr key={position.id} className="hover:bg-gray-50">
                          <td className="px-4 py-3 font-bold text-blue-600">{position.ticker}</td>
                          <td className="px-4 py-3">${position.strike}</td>
                          <td className="px-4 py-3 text-sm">{position.expiry}</td>
                          <td className="px-4 py-3">{position.contracts}</td>
                          <td className="px-4 py-3">${position.entryPrice.toFixed(2)}</td>
                          <td className="px-4 py-3">
                            {isEditing ? (
                              <input
                                type="number"
                                step="0.01"
                                value={position.currentPrice}
                                onChange={(e) => updatePosition(position.id, { currentPrice: parseFloat(e.target.value) })}
                                className="border rounded px-2 py-1 w-20 text-sm"
                              />
                            ) : (
                              `$${position.currentPrice.toFixed(2)}`
                            )}
                          </td>
                          <td className="px-4 py-3">
                            <div className={pnl >= 0 ? 'text-green-600 font-semibold' : 'text-red-600 font-semibold'}>
                              ${pnl.toFixed(2)}
                              <div className="text-xs">({pnlPercent >= 0 ? '+' : ''}{pnlPercent.toFixed(1)}%)</div>
                            </div>
                          </td>
                          <td className="px-4 py-3 text-sm text-gray-600">{position.notes || '-'}</td>
                          <td className="px-4 py-3">
                            <div className="flex gap-2">
                              <button
                                onClick={() => setEditingPosition(isEditing ? null : position.id)}
                                className="text-blue-600 hover:bg-blue-50 p-1 rounded"
                              >
                                {isEditing ? <Save className="w-4 h-4" /> : <Edit2 className="w-4 h-4" />}
                              </button>
                              <button
                                onClick={() => removePosition(position.id)}
                                className="text-red-600 hover:bg-red-50 p-1 rounded"
                              >
                                <X className="w-4 h-4" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {activeTab === 'schedule' && (
          <div className="space-y-4">
            <h2 className="text-2xl font-bold text-gray-800">Automated Scan Schedule</h2>
            
            <div className="bg-white rounded-xl shadow-md p-6">
              <div className="space-y-4">
                {[
                  { day: 'Friday', time: '5:30 AM', task: 'AI Signal Generation', desc: 'Research watchlist tickers, analyze options, calculate Greeks & scores', icon: '🎯' },
                  { day: 'Friday', time: '9:00 AM', task: 'Pre-Market Update', desc: 'Refresh signals based on overnight price movements', icon: '✅' }
                ].map((item, idx) => (
                  <div key={idx} className="flex items-center gap-4 p-4 bg-gradient-to-r from-blue-50 to-purple-50 border-2 border-blue-300 rounded-lg">
                    <div className="text-3xl">{item.icon}</div>
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-1">
                        <span className="font-bold text-gray-800">{item.day}</span>
                        <span className="text-sm text-gray-500">{item.time}</span>
                        <span className="font-semibold text-blue-700 text-lg">{item.task}</span>
                      </div>
                      <div className="text-sm text-gray-600">{item.desc}</div>
                    </div>
                    <Clock className="w-6 h-6 text-blue-500" />
                  </div>
                ))}
              </div>
            </div>

            <div className="bg-white border-2 border-gray-200 rounded-lg p-6">
              <div className="font-bold text-lg mb-3">AI Research Process:</div>
              <div className="space-y-2 text-sm text-gray-700">
                <div className="flex items-start gap-2">
                  <div className="text-blue-600 font-bold">1.</div>
                  <div>Fetch real-time stock prices and upcoming earnings dates</div>
                </div>
                <div className="flex items-start gap-2">
                  <div className="text-blue-600 font-bold">2.</div>
                  <div>Scan option chains to find optimal strikes and expiries</div>
                </div>
                <div className="flex items-start gap-2">
                  <div className="text-blue-600 font-bold">3.</div>
                  <div>Calculate Black-Scholes fair values and Greeks (Delta, Gamma, Theta)</div>
                </div>
                <div className="flex items-start gap-2">
                  <div className="text-blue-600 font-bold">4.</div>
                  <div>Score opportunities based on edge, probability, and risk metrics</div>
                </div>
                <div className="flex items-start gap-2">
                  <div className="text-blue-600 font-bold">5.</div>
                  <div>Generate buy signals and send email alerts for top opportunities</div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default Options;
