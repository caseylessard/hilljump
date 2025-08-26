-- Remove non-dividend paying ETFs from the database
DELETE FROM public.etfs 
WHERE ticker IN (
  'BETZ',
  'CHAT', 
  'DRAG',
  'HUMN',
  'IWMI',
  'MAGS',
  'MAGX',
  'METV',
  'NERD',
  'OZEM',
  'QQQI',
  'RNCC.TO',
  'UX',
  'WEED'
);