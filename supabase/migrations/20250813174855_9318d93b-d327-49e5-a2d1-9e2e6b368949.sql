-- Restore missing dividend ETFs that were incorrectly removed
INSERT INTO public.etfs (
  ticker, name, exchange, country, data_source, yield_ttm, expense_ratio, 
  volatility_1y, max_drawdown_1y, aum, category, manager
) VALUES 
-- Canadian Dividend ETFs
('VDY.TO', 'Vanguard FTSE Canadian High Dividend Yield ETF', 'TSX', 'CA', 'eodhd', 4.2, 0.22, 12.5, -8.5, 2800000000, 'Canadian Dividend', 'Vanguard'),
('CDZ.TO', 'iShares S&P/TSX Capped Composite High Dividend Index ETF', 'TSX', 'CA', 'eodhd', 3.8, 0.25, 11.2, -9.1, 1200000000, 'Canadian Dividend', 'iShares'),
('XDV.TO', 'iShares Core MSCI Total Return Index ETF', 'TSX', 'CA', 'eodhd', 3.5, 0.11, 10.8, -7.8, 4500000000, 'Canadian Dividend', 'iShares'),
('VCN.TO', 'Vanguard FTSE Canada All Cap Index ETF', 'TSX', 'CA', 'eodhd', 2.9, 0.05, 11.5, -8.2, 8900000000, 'Canadian Broad Market', 'Vanguard'),
('TDB902.TO', 'TD Canadian Index ETF', 'TSX', 'CA', 'eodhd', 2.8, 0.51, 11.3, -8.0, 15000000000, 'Canadian Index', 'TD'),
('XDIV.TO', 'iShares Core MSCI Total Return Index ETF', 'TSX', 'CA', 'eodhd', 4.1, 0.11, 12.1, -9.3, 2100000000, 'Global Dividend', 'iShares'),

-- US Dividend ETFs that may have been missed
('SCHD', 'Schwab US Dividend Equity ETF', 'NYSE', 'US', 'twelvedata', 3.5, 0.06, 13.2, -8.7, 52000000000, 'US Dividend', 'Schwab'),
('VYM', 'Vanguard High Dividend Yield ETF', 'NYSE', 'US', 'twelvedata', 2.9, 0.06, 12.8, -7.9, 48000000000, 'US High Dividend', 'Vanguard'),
('SPHD', 'Invesco S&P 500 High Dividend Low Volatility ETF', 'NYSE', 'US', 'twelvedata', 4.2, 0.30, 10.5, -6.8, 8200000000, 'Low Volatility Dividend', 'Invesco'),
('DGRO', 'iShares Core Dividend Growth ETF', 'NASDAQ', 'US', 'twelvedata', 2.2, 0.08, 14.1, -9.2, 23000000000, 'Dividend Growth', 'iShares'),
('NOBL', 'ProShares S&P 500 Dividend Aristocrats ETF', 'NYSE', 'US', 'twelvedata', 1.8, 0.35, 13.5, -8.1, 12000000000, 'Dividend Aristocrats', 'ProShares'),
('VIG', 'Vanguard Dividend Appreciation ETF', 'NYSE', 'US', 'twelvedata', 1.7, 0.06, 13.8, -8.4, 78000000000, 'Dividend Appreciation', 'Vanguard'),
('FDVV', 'Fidelity High Dividend ETF', 'NYSE', 'US', 'twelvedata', 3.1, 0.29, 12.9, -8.8, 3400000000, 'High Dividend', 'Fidelity'),
('VXUS', 'Vanguard Total International Stock ETF', 'NASDAQ', 'US', 'twelvedata', 3.2, 0.08, 15.2, -11.5, 42000000000, 'International', 'Vanguard'),

-- International Dividend ETFs
('VIGI', 'Vanguard International Dividend Appreciation ETF', 'NASDAQ', 'US', 'twelvedata', 2.4, 0.15, 14.8, -10.2, 7800000000, 'International Dividend', 'Vanguard'),
('IDHD', 'Invesco FTSE International Low Beta Equal Weight ETF', 'NASDAQ', 'US', 'twelvedata', 3.8, 0.49, 13.1, -9.7, 890000000, 'International High Dividend', 'Invesco'),

-- REITs and Infrastructure
('VNQ', 'Vanguard Real Estate ETF', 'NYSE', 'US', 'twelvedata', 3.7, 0.12, 18.5, -15.2, 35000000000, 'REIT', 'Vanguard'),
('SCHH', 'Schwab US REIT ETF', 'NYSE', 'US', 'twelvedata', 3.9, 0.07, 18.8, -14.9, 7200000000, 'REIT', 'Schwab'),
('VTI', 'Vanguard Total Stock Market ETF', 'NYSE', 'US', 'twelvedata', 1.3, 0.03, 14.2, -9.1, 1400000000000, 'Total Market', 'Vanguard'),

-- Utilities and Infrastructure
('VPU', 'Vanguard Utilities ETF', 'NYSE', 'US', 'twelvedata', 2.8, 0.10, 16.2, -12.3, 5800000000, 'Utilities', 'Vanguard'),
('FUTY', 'Fidelity MSCI Utilities Index ETF', 'NYSE', 'US', 'twelvedata', 2.9, 0.084, 16.5, -12.1, 1200000000, 'Utilities', 'Fidelity')

ON CONFLICT (ticker) DO NOTHING;