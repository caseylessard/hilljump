-- Update missing risk calculation fields with reasonable defaults
-- to prevent dummy 52% risk scores

-- Set default expense ratios (1% for missing values)
UPDATE etfs 
SET expense_ratio = 0.01 
WHERE expense_ratio IS NULL OR expense_ratio = 0;

-- Set default volatility (15% for missing values - typical ETF volatility)
UPDATE etfs 
SET volatility_1y = 15.0 
WHERE volatility_1y IS NULL OR volatility_1y = 0;

-- Set default max drawdown (-10% for missing values)
UPDATE etfs 
SET max_drawdown_1y = -10.0 
WHERE max_drawdown_1y IS NULL OR max_drawdown_1y = 0;

-- Log how many records were updated
SELECT 
  COUNT(*) as total_etfs,
  COUNT(CASE WHEN expense_ratio = 0.01 THEN 1 END) as default_expense_ratio,
  COUNT(CASE WHEN volatility_1y = 15.0 THEN 1 END) as default_volatility,
  COUNT(CASE WHEN max_drawdown_1y = -10.0 THEN 1 END) as default_drawdown
FROM etfs;