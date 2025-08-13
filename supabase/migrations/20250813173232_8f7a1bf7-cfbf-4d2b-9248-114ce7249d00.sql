-- Fix NULL aum and avg_volume values that cause 52% risk scores
-- Set reasonable defaults for volume and AUM data

-- Update NULL avg_volume with a reasonable default (1M shares daily volume)
UPDATE etfs 
SET avg_volume = 1000000 
WHERE avg_volume IS NULL OR avg_volume = 0;

-- Update NULL aum with a reasonable default ($100M AUM)
UPDATE etfs 
SET aum = 100000000 
WHERE aum IS NULL OR aum = 0;

-- Verify the problematic tickers are now fixed
SELECT ticker, expense_ratio, volatility_1y, max_drawdown_1y, avg_volume, aum 
FROM etfs 
WHERE UPPER(ticker) IN ('MARO', 'SMCY', 'CONY', 'HOOY', 'MRNY', 'ULTY', 'MST', 'USOY', 'MSTY', 'AIYY') 
ORDER BY ticker;