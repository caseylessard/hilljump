// Minimal stub for live price types
export interface LivePrice {
  ticker: string;
  price: number;
  drip4wPercent?: number;
  drip13wPercent?: number;
  drip26wPercent?: number;
  drip52wPercent?: number;
  drip4wDollar?: number;
  drip13wDollar?: number;
  drip26wDollar?: number;
  drip52wDollar?: number;
  totalReturn28dPercent?: number;
  changePercent?: number;
}