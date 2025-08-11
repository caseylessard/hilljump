-- Seed many real-world tickers provided by user into public.etfs with placeholders
with new_rows(ticker, category, exchange) as (
  values
    -- YieldMax (US)
    ('TSLY','YieldMax (US)','NYSE Arca'),('APLY','YieldMax (US)','NYSE Arca'),('NVDY','YieldMax (US)','NYSE Arca'),('AMZY','YieldMax (US)','NYSE Arca'),('FBY','YieldMax (US)','NYSE Arca'),('GOOY','YieldMax (US)','NYSE Arca'),('CONY','YieldMax (US)','NYSE Arca'),('NFLY','YieldMax (US)','NYSE Arca'),('DISO','YieldMax (US)','NYSE Arca'),('MSFO','YieldMax (US)','NYSE Arca'),('AMDY','YieldMax (US)','NYSE Arca'),('XOMO','YieldMax (US)','NYSE Arca'),('JPMO','YieldMax (US)','NYSE Arca'),('PYPY','YieldMax (US)','NYSE Arca'),('SQY','YieldMax (US)','NYSE Arca'),('MRNY','YieldMax (US)','NYSE Arca'),('AIYY','YieldMax (US)','NYSE Arca'),('YMAX','YieldMax (US)','NYSE Arca'),('YMAG','YieldMax (US)','NYSE Arca'),('MSTY','YieldMax (US)','NYSE Arca'),('ULTY','YieldMax (US)','NYSE Arca'),('YBIT','YieldMax (US)','NYSE Arca'),('CRSH','YieldMax (US)','NYSE Arca'),('FIAT','YieldMax (US)','NYSE Arca'),('DIPS','YieldMax (US)','NYSE Arca'),('YQQQ','YieldMax (US)','NYSE Arca'),('SNOY','YieldMax (US)','NYSE Arca'),('ABNY','YieldMax (US)','NYSE Arca'),('BABO','YieldMax (US)','NYSE Arca'),('TSMY','YieldMax (US)','NYSE Arca'),('SMCY','YieldMax (US)','NYSE Arca'),('PLTY','YieldMax (US)','NYSE Arca'),('BIGY','YieldMax (US)','NYSE Arca'),('SOXY','YieldMax (US)','NYSE Arca'),('RNTY','YieldMax (US)','NYSE Arca'),('MARO','YieldMax (US)','NYSE Arca'),('FEAT','YieldMax (US)','NYSE Arca'),('FIVY','YieldMax (US)','NYSE Arca'),('LFGY','YieldMax (US)','NYSE Arca'),('GPTY','YieldMax (US)','NYSE Arca'),('CHPY','YieldMax (US)','NYSE Arca'),('CVNY','YieldMax (US)','NYSE Arca'),('HOOY','YieldMax (US)','NYSE Arca'),('BRKC','YieldMax (US)','NYSE Arca'),('DRAY','YieldMax (US)','NYSE Arca'),('RBLY','YieldMax (US)','NYSE Arca'),('GDXY','YieldMax (US)','NYSE Arca'),('SDTY','YieldMax (US)','NYSE Arca'),('QDTY','YieldMax (US)','NYSE Arca'),('RDTY','YieldMax (US)','NYSE Arca'),
    -- Defiance (US)
    ('QQQY','Defiance (US)','NYSE Arca'),('WDTE','Defiance (US)','NYSE Arca'),('IWMY','Defiance (US)','NYSE Arca'),('SPYT','Defiance (US)','NYSE Arca'),('QQQT','Defiance (US)','NYSE Arca'),('USOY','Defiance (US)','NYSE Arca'),('GLDY','Defiance (US)','NYSE Arca'),('MST','Defiance (US)','NYSE Arca'),
    -- GraniteShares YieldBoost (US)
    ('COIY','GraniteShares YieldBoost (US)','NYSE Arca'),('NVYY','GraniteShares YieldBoost (US)','NYSE Arca'),('CRBY','GraniteShares YieldBoost (US)','NYSE Arca'),('PYLY','GraniteShares YieldBoost (US)','NYSE Arca'),
    -- REX Shares (US)
    ('YBTC','REX Shares (US)','NYSE Arca'),('YETH','REX Shares (US)','NYSE Arca'),('QDTE','REX Shares (US)','NYSE Arca'),('XDTE','REX Shares (US)','NYSE Arca'),('RDTE','REX Shares (US)','NYSE Arca'),
    -- Roundhill (US)
    ('AMDW','Roundhill (US)','NYSE Arca'),('AVGW','Roundhill (US)','NYSE Arca'),('GOOW','Roundhill (US)','NYSE Arca'),('PLTW','Roundhill (US)','NYSE Arca'),('METW','Roundhill (US)','NYSE Arca'),
    -- Global X (US)
    ('QYLD','Global X (US)','NYSE Arca'),('XYLD','Global X (US)','NYSE Arca'),('RYLD','Global X (US)','NYSE Arca'),('QYLG','Global X (US)','NYSE Arca'),('XYLG','Global X (US)','NYSE Arca'),('RYLG','Global X (US)','NYSE Arca'),('QYLI','Global X (US)','NYSE Arca'),('DYLI','Global X (US)','NYSE Arca'),('TYLG','Global X (US)','NYSE Arca'),('HYLG','Global X (US)','NYSE Arca'),
    -- Global X (Canada)
    ('QQCL','Global X (Canada)','TSX'),('USCL','Global X (Canada)','TSX'),('CNCL','Global X (Canada)','TSX'),('ENCL','Global X (Canada)','TSX'),('BKCL','Global X (Canada)','TSX'),('USCC','Global X (Canada)','TSX'),('QQCC','Global X (Canada)','TSX'),('RSCC','Global X (Canada)','TSX'),
    -- iShares (US)
    ('DGRO','iShares (US)','NYSE Arca'),('HDV','iShares (US)','NYSE Arca'),('DVY','iShares (US)','NYSE Arca'),('IDV','iShares (US)','NYSE Arca'),('DVYE','iShares (US)','NYSE Arca'),
    -- iShares (Canada)
    ('XEI','iShares (Canada)','TSX'),('XDV','iShares (Canada)','TSX'),('XDIV','iShares (Canada)','TSX'),
    -- Evolve (Canada)
    ('BANK','Evolve (Canada)','TSX'),('ESPX','Evolve (Canada)','TSX'),('ETSX','Evolve (Canada)','TSX'),('CALL','Evolve (Canada)','TSX'),('EBNK','Evolve (Canada)','TSX'),('BASE','Evolve (Canada)','TSX'),('LIFE','Evolve (Canada)','TSX'),('OILY','Evolve (Canada)','TSX'),('UTES','Evolve (Canada)','TSX'),
    -- Hamilton (Canada)
    ('HYLD','Hamilton (Canada)','TSX'),('HDIV','Hamilton (Canada)','TSX'),('HMAX','Hamilton (Canada)','TSX'),('UMAX','Hamilton (Canada)','TSX'),('QMAX','Hamilton (Canada)','TSX'),('SMAX','Hamilton (Canada)','TSX'),('HBND','Hamilton (Canada)','TSX'),('HCAL','Hamilton (Canada)','TSX'),('QDAY','Hamilton (Canada)','TSX'),('SDAY','Hamilton (Canada)','TSX'),('CDAY','Hamilton (Canada)','TSX'),
    -- Harvest (Canada)
    ('HHL','Harvest (Canada)','TSX'),('HTA','Harvest (Canada)','TSX'),('HBF','Harvest (Canada)','TSX'),('HUTL','Harvest (Canada)','TSX'),('HGR','Harvest (Canada)','TSX'),('HPF','Harvest (Canada)','TSX'),('HUBL','Harvest (Canada)','TSX'),('HLIF','Harvest (Canada)','TSX'),('TRVI','Harvest (Canada)','TSX'),('HRIF','Harvest (Canada)','TSX'),('HDIF','Harvest (Canada)','TSX'),('HHLE','Harvest (Canada)','TSX'),('HTAE','Harvest (Canada)','TSX'),('HUTE','Harvest (Canada)','TSX'),('HBFE','Harvest (Canada)','TSX'),('HLFE','Harvest (Canada)','TSX'),
    -- NEOS & JPM
    ('SPYI','NEOS (US)','NYSE Arca'),('JEPI','JPMorgan (US)','NYSE Arca'),('JEPQ','JPMorgan (US)','NYSE Arca')
)
insert into public.etfs (
  ticker, name, exchange, total_return_1y, yield_ttm, avg_volume, expense_ratio, volatility_1y, max_drawdown_1y, aum, category
)
select
  r.ticker,
  r.ticker, -- placeholder name; will be enriched later
  r.exchange,
  10.0::numeric,
  12.0::numeric,
  100000::bigint,
  0.75::numeric,
  20.0::numeric,
  -15.0::numeric,
  100000000::bigint,
  r.category
from new_rows r
on conflict (ticker) do nothing;