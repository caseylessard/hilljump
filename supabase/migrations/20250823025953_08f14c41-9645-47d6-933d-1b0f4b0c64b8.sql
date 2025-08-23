-- Update GOOY current price to match live price
UPDATE etfs SET current_price = 13.15, price_updated_at = now() WHERE ticker = 'GOOY';

-- Update other tickers with known live prices from the polygon logs
UPDATE etfs SET current_price = 17.1, price_updated_at = now() WHERE ticker = 'GLDY';
UPDATE etfs SET current_price = 17.55, price_updated_at = now() WHERE ticker = 'MSTY';
UPDATE etfs SET current_price = 15.07, price_updated_at = now() WHERE ticker = 'RYLD';
UPDATE etfs SET current_price = 16.65, price_updated_at = now() WHERE ticker = 'QYLD';
UPDATE etfs SET current_price = 38.87, price_updated_at = now() WHERE ticker = 'XYLD';
UPDATE etfs SET current_price = 35.015, price_updated_at = now() WHERE ticker = 'QDTE';
UPDATE etfs SET current_price = 44.04, price_updated_at = now() WHERE ticker = 'XDTE';

-- Update Canadian ticker prices from EODHD logs
UPDATE etfs SET current_price = 18.8, price_updated_at = now() WHERE ticker = 'HUTL.TO';
UPDATE etfs SET current_price = 13.99, price_updated_at = now() WHERE ticker = 'HYLD.TO';
UPDATE etfs SET current_price = 24.18, price_updated_at = now() WHERE ticker = 'QQCL.TO';
UPDATE etfs SET current_price = 39.2, price_updated_at = now() WHERE ticker = 'CDZ.TO';
UPDATE etfs SET current_price = 18.95, price_updated_at = now() WHERE ticker = 'HDIV.TO';
UPDATE etfs SET current_price = 3.055, price_updated_at = now() WHERE ticker = 'HPF.TO';