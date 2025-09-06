-- Fix function search path security issue
CREATE OR REPLACE FUNCTION check_dividend_freshness()
RETURNS TABLE (
    ticker text,
    last_dividend_date date,
    days_since_update integer,
    is_stale boolean,
    total_dividends bigint
) 
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
    WITH latest_dividends AS (
        SELECT 
            d.ticker,
            MAX(d.ex_date) as last_dividend_date,
            COUNT(*) as total_dividends
        FROM dividends d
        WHERE d.ticker IN ('MSTY', 'TSLY', 'NVYY', 'CONY', 'QQQY', 'YMAX', 'YMAG', 'RDTY', 'ULTY', 'USOY')
        GROUP BY d.ticker
    )
    SELECT 
        ld.ticker::text,
        ld.last_dividend_date,
        (CURRENT_DATE - ld.last_dividend_date)::integer as days_since_update,
        (CURRENT_DATE - ld.last_dividend_date) > 35 as is_stale,
        ld.total_dividends
    FROM latest_dividends ld
    ORDER BY days_since_update DESC;
$$;