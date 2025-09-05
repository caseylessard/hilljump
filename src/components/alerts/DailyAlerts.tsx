import { useQuery } from "@tanstack/react-query";
import { fetchTodayAlerts } from "@/lib/useDailyAlerts";
import { Card } from "@/components/ui/card";

export default function DailyAlerts() {
  const { data, isLoading } = useQuery({
    queryKey: ["daily-alerts"],
    queryFn: fetchTodayAlerts,
    refetchOnWindowFocus: false,
  });

  if (isLoading) return <div className="p-4 text-sm">Loading alerts…</div>;
  if (!data || (data.equities.length === 0 && data.crypto.length === 0))
    return <div className="p-4 text-sm">No alerts for today yet.</div>;

  return (
    <div className="space-y-8">
      {data.equities.length > 0 && (
        <section>
          <h2 className="text-xl font-semibold mb-3">Today's Top Equity Alerts</h2>
          <div className="grid md:grid-cols-2 gap-4">
            {data.equities.map((a) => (
              <Card key={`eq-${a.rank_order}-${a.ticker}`} className="p-4">
                <div className="flex items-center justify-between">
                  <div className="text-lg font-bold">#{a.rank_order} — {a.ticker}</div>
                  <div className="text-xs text-muted-foreground">{a.exchange ?? ""}</div>
                </div>
                <div className="mt-1 text-sm">Price: ${a.price?.toFixed(2) ?? "—"}</div>
                <div className="mt-2 text-sm">
                  <span className="font-medium">Target:</span> {a.target_growth_pct?.toFixed(1)}%
                  <span className="ml-3 font-medium">Score:</span> {a.likelihood_of_win?.toFixed(2)}
                </div>
                <div className="mt-2 text-sm">
                  <span className="font-medium">Plan:</span> Entry {a.entry_price} • SL {a.stop_price} • TP1 {a.tp1_price} • TP2 {a.tp2_price}
                </div>
                <div className="mt-2 text-xs text-muted-foreground">
                  Gap {a.premarket_change_pct?.toFixed(1) ?? "—"}% • RelVol {a.rel_vol?.toFixed(2) ?? "—"}× • Float {(a.float_shares ?? 0) > 0 ? `${(a.float_shares!/1e6).toFixed(1)}M` : "—"} • News {a.news_recent_count ?? 0}
                </div>
              </Card>
            ))}
          </div>
        </section>
      )}

      {data.crypto.length > 0 && (
        <section>
          <h2 className="text-xl font-semibold mb-3">Today's Top Crypto Alerts</h2>
          <div className="grid md:grid-cols-2 gap-4">
            {data.crypto.map((c) => (
              <Card key={`cr-${c.rank_order}-${c.symbol}`} className="p-4">
                <div className="flex items-center justify-between">
                  <div className="text-lg font-bold">#{c.rank_order} — {c.symbol}</div>
                </div>
                <div className="mt-1 text-sm">Price: ${c.price?.toFixed(4) ?? "—"}</div>
                <div className="mt-2 text-sm">
                  <span className="font-medium">Target:</span> {c.target_growth_pct?.toFixed(1)}%
                  <span className="ml-3 font-medium">Score:</span> {c.likelihood_of_win?.toFixed(2)}
                </div>
                <div className="mt-2 text-sm">
                  <span className="font-medium">Plan:</span> Entry {c.entry_price} • SL {c.stop_price} • TP1 {c.tp1_price} • TP2 {c.tp2_price}
                </div>
                <div className="mt-2 text-xs text-muted-foreground">
                  24h {c.change_24h_pct?.toFixed(1) ?? "—"}% • RelVol {c.rel_vol?.toFixed(2) ?? "—"}× • News {c.news_recent_count ?? 0}
                </div>
              </Card>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}