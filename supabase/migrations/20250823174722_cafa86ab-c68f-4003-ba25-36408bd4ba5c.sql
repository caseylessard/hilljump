-- Update user_preferences table defaults to match Balanced Income preset
ALTER TABLE user_preferences 
  ALTER COLUMN return_weight SET DEFAULT 15,
  ALTER COLUMN yield_weight SET DEFAULT 25,
  ALTER COLUMN risk_weight SET DEFAULT 20,
  ALTER COLUMN dividend_stability SET DEFAULT 20,
  ALTER COLUMN period_4w_weight SET DEFAULT 8,
  ALTER COLUMN period_52w_weight SET DEFAULT 2,
  ALTER COLUMN home_country_bias SET DEFAULT 6;