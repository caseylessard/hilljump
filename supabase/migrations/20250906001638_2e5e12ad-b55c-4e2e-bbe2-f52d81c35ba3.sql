-- Create function to check dividend data freshness
CREATE OR REPLACE FUNCTION check_dividend_freshness()
RETURNS TABLE (
    ticker text,
    last_dividend_date date,
    days_since_update integer,
    is_stale boolean,
    total_dividends bigint
) 
LANGUAGE sql STABLE
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

-- Create function to log dividend data source performance
CREATE TABLE IF NOT EXISTS dividend_source_logs (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    created_at timestamptz DEFAULT now(),
    ticker text NOT NULL,
    source text NOT NULL, -- 'yahoo', 'alpha_vantage', 'manual'
    success boolean NOT NULL,
    dividends_found integer DEFAULT 0,
    error_message text,
    response_time_ms integer
);

-- Enable RLS
ALTER TABLE dividend_source_logs ENABLE ROW LEVEL SECURITY;

-- Policy for service role to manage logs
CREATE POLICY "Service can manage dividend source logs"
ON dividend_source_logs
FOR ALL
USING (true)
WITH CHECK (true);

-- Policy for public read access
CREATE POLICY "Dividend source logs are publicly viewable"
ON dividend_source_logs
FOR SELECT
USING (true);