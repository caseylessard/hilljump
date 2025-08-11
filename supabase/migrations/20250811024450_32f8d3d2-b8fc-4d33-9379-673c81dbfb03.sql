-- Seed ~90 additional ETFs so the app can show a full Top 100
insert into public.etfs (
  ticker, name, exchange, total_return_1y, yield_ttm, avg_volume, expense_ratio, volatility_1y, max_drawdown_1y, aum, category
)
select 
  'ETF' || lpad(gs::text, 3, '0') as ticker,
  'Synthetic ETF ' || gs as name,
  case when gs % 2 = 0 then 'NYSE Arca' else 'NASDAQ' end as exchange,
  /* total_return_1y */ (5 + (gs % 45))::numeric,
  /* yield_ttm */ (2 + (gs % 18))::numeric,
  /* avg_volume */ (100000 + gs * 1500)::bigint,
  /* expense_ratio */ (0.25 + ((gs % 15) * 0.01))::numeric,
  /* volatility_1y */ (10 + (gs % 30))::numeric,
  /* max_drawdown_1y */ (-5 - (gs % 25))::numeric,
  /* aum */ (400000000 + gs * 2000000)::bigint,
  case when gs % 3 = 0 then 'Income' when gs % 3 = 1 then 'Covered Call' else 'Dividend' end as category
from generate_series(1, 90) as gs
on conflict (ticker) do nothing;