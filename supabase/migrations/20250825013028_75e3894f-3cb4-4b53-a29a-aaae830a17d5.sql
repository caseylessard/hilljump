-- Remove non-dividend paying ETFs from the database
DELETE FROM etfs WHERE ticker IN (
  'AIPI',
  'BETZ', 
  'CHAT',
  'DJIA',
  'DRAG',
  'FBY',
  'FEAT',
  'HUMN',
  'IWMI',
  'MAGS',
  'MAGX',
  'METV',
  'NERD',
  'OZEM',
  'QQQI',
  'RNCC.TO',
  'RNTY',
  'RYLG',
  'UX',
  'WEED'
);

-- Also remove any dividend records for these tickers (cleanup)
DELETE FROM dividends WHERE ticker IN (
  'AIPI',
  'BETZ', 
  'CHAT',
  'DJIA',
  'DRAG',
  'FBY',
  'FEAT',
  'HUMN',
  'IWMI',
  'MAGS',
  'MAGX',
  'METV',
  'NERD',
  'OZEM',
  'QQQI',
  'RNCC.TO',
  'RNTY',
  'RYLG',
  'UX',
  'WEED'
);

-- Remove any historical price data for these tickers (cleanup)
DELETE FROM historical_prices WHERE ticker IN (
  'AIPI',
  'BETZ', 
  'CHAT',
  'DJIA',
  'DRAG',
  'FBY',
  'FEAT',
  'HUMN',
  'IWMI',
  'MAGS',
  'MAGX',
  'METV',
  'NERD',
  'OZEM',
  'QQQI',
  'RNCC.TO',
  'RNTY',
  'RYLG',
  'UX',
  'WEED'
);