# ETF Analysis & Ranking Application Schema

## Overview
A comprehensive ETF (Exchange Traded Fund) analysis platform with real-time data, DRIP calculations, user portfolios, and advanced ranking algorithms.

## Technology Stack
- **Frontend**: React 18 + TypeScript + Vite
- **Styling**: Tailwind CSS + shadcn/ui components
- **Backend**: Supabase (PostgreSQL + Edge Functions)
- **Authentication**: Supabase Auth
- **Charts**: Recharts
- **State Management**: React Query (@tanstack/react-query)
- **Routing**: React Router DOM

## Database Schema

### Core Tables

#### `etfs` - Main ETF data
```sql
- id (uuid, primary)
- ticker (text, unique)
- name (text)
- exchange (text)
- category (text)
- total_return_1y (numeric)
- yield_ttm (numeric)
- avg_volume (bigint)
- expense_ratio (numeric)
- volatility_1y (numeric) 
- max_drawdown_1y (numeric)
- aum (bigint)
- current_price (numeric)
- currency (text, default: 'USD')
- country (text)
- manager (text)
- strategy_label (text)
- logo_key (text)
- data_source (text)
- polygon_supported (boolean)
- twelve_symbol (text)
- eodhd_symbol (text)
- active (boolean, default: true)
- created_at, updated_at (timestamps)
```

#### `dividends` - Dividend/distribution data
```sql
- id (uuid, primary)
- ticker (text)
- etf_id (uuid, references etfs)
- ex_date (date)
- pay_date (date)
- amount (numeric)
- cadence (text)
- cash_currency (text, default: 'USD')
- created_at (timestamp)
```

#### `historical_prices` - Price history
```sql
- id (uuid, primary)
- ticker (text)
- date (date)
- open_price (numeric)
- high_price (numeric)
- low_price (numeric)
- close_price (numeric)
- adjusted_close (numeric)
- volume (bigint)
- created_at, updated_at (timestamps)
```

#### `drip_cache_us` / `drip_cache_ca` - DRIP performance cache
```sql
- id (uuid, primary)
- ticker (text, unique)
- period_4w (jsonb) - 4-week DRIP performance
- period_13w (jsonb) - 13-week DRIP performance  
- period_26w (jsonb) - 26-week DRIP performance
- period_52w (jsonb) - 52-week DRIP performance
- created_at, updated_at (timestamps)
```

#### User Tables
```sql
-- profiles: User profile data
- id (uuid, references auth.users)
- first_name, last_name (text)
- username (text)
- country (text, default: 'CA')
- approved (boolean, default: false)

-- user_roles: Role-based access control
- id (uuid, primary)
- user_id (uuid)
- role (enum: admin, premium, subscriber, user)

-- user_preferences: Ranking preferences
- user_id (uuid, primary)
- return_weight, yield_weight, risk_weight (integer)
- dividend_stability (integer) 
- period_4w_weight, period_52w_weight (integer)
- home_country_bias (integer)
- tax_enabled (boolean)
- tax_country (text)
- tax_rate (numeric)

-- portfolio_positions: User portfolios
- id (uuid, primary)
- user_id (uuid)
- ticker (text)
- shares (numeric)

-- subscribers: Stripe subscription data
- id (uuid, primary)
- user_id (uuid)
- email (text)
- stripe_customer_id (text)
- subscribed (boolean)
- subscription_tier (text)
- subscription_end (timestamp)
```

#### Cache & Analytics Tables
```sql
-- price_cache: Real-time price cache
- ticker, price, source, updated_at

-- etf_rankings: Historical rankings
- ticker, rank_position, composite_score, week_date

-- etf_scores: Scoring cache  
- ticker, country, composite_score, return_score, yield_score, risk_score, weights

-- daily_update_logs: ETF data update tracking
-- dividend_update_logs: Dividend update tracking
```

## Edge Functions (Supabase)

### Data Processing
- `daily-etf-updater`: Updates ETF fundamental data daily
- `daily-etf-updater-yahoo`: Yahoo Finance price updates
- `premium-eodhd-updater`: Premium EODHD API updates
- `dividend-updater`: Fetches latest dividend data
- `update-historical-prices-daily`: Historical price updates
- `calculate-drip`: DRIP performance calculations
- `daily-drip-calculator`: Automated DRIP calculations

### Real-time Data
- `quotes`: Real-time price quotes
- `polygon-quotes`: Polygon API price data
- `get-single-price`: Single ticker price lookup
- `get-stored-prices`: Bulk cached price retrieval
- `sync-price-cache`: Cache synchronization

### Analytics & Scoring
- `momentum-signals`: RSI and momentum indicators
- `save-rankings`: Persist weekly rankings
- `yfinance-rsi`: RSI calculations via yfinance
- `tiingo-yields`: Yield data from Tiingo API

### Data Import/Export
- `import-etfs`: Bulk ETF data import
- `import-dividends`: Bulk dividend import  
- `import-historical-prices`: Historical price import
- `fetch-etf-data`: External ETF data fetching
- `etf-stream`: Real-time ETF data streaming

### Subscription Management
- `create-checkout`: Stripe checkout creation
- `check-subscription`: Subscription validation
- `customer-portal`: Stripe customer portal

## Frontend Architecture

### Core Pages
- `/` - Main ETF rankings dashboard
- `/portfolio` - User portfolio management
- `/profile` - User profile and preferences
- `/auth` - Authentication flows
- `/ranking` - Historical ranking analysis
- `/scoring` - Scoring methodology explanation
- `/options` - Options analysis (placeholder)
- `/crypto` - Crypto analysis (placeholder)
- `/bots` - Trading bots (placeholder)

### Key Components

#### Dashboard Components
```typescript
// ETFTable.tsx - Main rankings table with card view
- Sortable columns (rank, ticker, name, performance, etc.)
- Card view modal with detailed ETF information
- Keyboard navigation (arrow keys)
- Trend signals (Buy/Sell/Hold/Neutral)
- Distribution history integration

// PerformanceChart.tsx - Price and performance charts
// ComparisonChart.tsx - ETF comparison visualization  
// DistributionHistory.tsx - Dividend timeline
// ScoringControls.tsx - Ranking preference controls
```

#### Admin Components
```typescript
// Located in /components/admin/
- ETFEditor.tsx - ETF data management
- DistributionEditor.tsx - Dividend data editing
- DataUpdater.tsx - Manual data updates
- DividendDataImport.tsx - CSV dividend import
- ETFDataImport.tsx - CSV ETF import
- Various test components for data validation
```

### Business Logic Libraries

#### Core Scoring (`/lib/scoring.ts`)
```typescript
interface ScoredETF extends ETF {
  normalizedReturn: number;
  normalizedYield: number; 
  normalizedVolume: number;
  normalizedAUM: number;
  normalizedExpenseRatio: number;
  normalizedVolatility: number;
  normalizedDrawdown: number;
  drip4w: number;
  drip13w: number;
  drip26w: number;
  drip52w: number;
  compositeScore: number;
  buySignal: boolean;
  sellSignal: boolean;
  holdSignal: boolean;
}

// Main scoring function
scoreETFsWithPrefs(etfs: ETF[], prefs: RankingPrefs): ScoredETF[]
```

#### DRIP Calculations (`/lib/drip.ts`)
- Dividend Reinvestment Plan performance calculations
- Multi-period analysis (4w, 13w, 26w, 52w)
- Tax-adjusted returns
- Currency conversion

#### Ranking Presets (`/lib/rankingPresets.ts`)
```typescript
interface RankingPrefs {
  // Core weights
  wYield: number;
  wDivStability: number;
  wRisk: number;
  wTotalReturn12m: number;
  wMomentum13w: number;
  wMomentum52w: number;
  wLiquidity: number;
  wFees: number;
  wSizeAge: number;
  
  // Modifiers
  capHomeBias: number;
  boostCanadian: number;
  penaltyHighVol: number;
  
  // Guardrails  
  aumMinUSD: number;
  volumeMinUSD: number;
  maxExpenseRatio: number;
}

// Presets: balanced, income_first, total_return
```

#### Cache Management (`/lib/cache.ts`, `/lib/cacheUtils.ts`)
- ETF data caching strategies
- Price cache management
- DRIP cache optimization

## Data Flow

### Real-time Updates
1. **Price Updates**: Multiple APIs (Polygon, EODHD, Yahoo Finance, Tiingo)
2. **Dividend Updates**: Automated fetching and processing
3. **DRIP Calculations**: Nightly batch processing
4. **Ranking Updates**: Weekly ranking persistence

### User Interactions
1. **Preference Changes**: Real-time re-scoring and ranking
2. **Portfolio Management**: CRUD operations with RLS
3. **ETF Analysis**: Dynamic chart rendering and data visualization

### Admin Workflows
1. **Data Import**: CSV-based bulk data operations
2. **Manual Updates**: Individual ETF/dividend editing
3. **System Monitoring**: Update logs and error tracking

## External API Integrations

### Financial Data Providers
- **Polygon.io**: Real-time quotes, historical data
- **EODHD**: Comprehensive market data
- **Tiingo**: Alternative data source
- **Yahoo Finance**: Backup price source
- **Alpha Vantage**: Additional market data

### Payment Processing  
- **Stripe**: Subscription management, checkout flows

## Security & Access Control

### Row Level Security (RLS)
- User data isolation (profiles, preferences, portfolios)
- Admin-only data management (ETF updates, user roles)
- Public data access (ETF data, rankings, prices)

### Authentication
- Supabase Auth integration
- Role-based access (admin, premium, subscriber, user)
- JWT-based API authorization

## Key Business Rules

### Scoring Algorithm
1. **DRIP Performance**: Primary ranking factor (4w=8, 13w=5, 26w=3, 52w=2 weights)
2. **Ladder-Delta Trend**: Buy/sell signal generation
3. **Multi-factor Scoring**: Return, yield, risk, stability, momentum
4. **Guardrails**: Minimum AUM, volume, maximum expense ratios

### Data Quality
- Multiple data source redundancy
- Automated validation and error logging
- Manual override capabilities for admins
- Cache invalidation strategies

## Deployment & Operations

### Environment
- Supabase hosted PostgreSQL
- Supabase Edge Functions (Deno runtime)  
- Automated daily data updates
- Real-time price synchronization

### Monitoring
- Update log tracking
- Error reporting and alerting
- Performance metrics collection

## Current State & Next Phase Considerations

### Completed Features
- Full ETF ranking system with DRIP calculations
- User authentication and portfolio management  
- Admin data management interface
- Real-time price integration
- Historical data analysis

### Potential Next Phase Areas
- Advanced portfolio analytics and optimization
- Options trading analysis integration
- Cryptocurrency ETF analysis
- Automated trading bot integration
- Enhanced mobile experience
- API rate limit optimization
- Performance monitoring dashboard
- Advanced charting and technical analysis
- Social features (sharing rankings, discussions)
- Backtesting capabilities