import { Slider } from "@/components/ui/slider";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useEffect, useMemo, useState } from "react";

export type WeightState = { r: number; y: number; k: number };

type Props = {
  onChange: (weights: { return: number; yield: number; risk: number }) => void;
};

export const ScoringControls = ({ onChange }: Props) => {
  const [w, setW] = useState<WeightState>({ r: 60, y: 20, k: 20 });

  const normalized = useMemo(() => {
    const sum = Math.max(1, w.r + w.y + w.k);
    return { return: w.r / sum, yield: w.y / sum, risk: w.k / sum };
  }, [w]);

  // propagate up
  useEffect(() => onChange(normalized), [normalized, onChange]);

  return (
    <Card className="p-4">
      <div className="grid gap-4">
        <div className="flex items-center justify-between">
          <span className="text-sm font-medium">Total Return Priority</span>
          <Badge variant="secondary">{Math.round(normalized.return * 100)}%</Badge>
        </div>
        <Slider value={[w.r]} onValueChange={([v]) => setW(prev => ({ ...prev, r: v }))} min={0} max={100} step={1} />

        <div className="flex items-center justify-between pt-2">
          <span className="text-sm font-medium">Yield Emphasis</span>
          <Badge variant="secondary">{Math.round(normalized.yield * 100)}%</Badge>
        </div>
        <Slider value={[w.y]} onValueChange={([v]) => setW(prev => ({ ...prev, y: v }))} min={0} max={100} step={1} />

        <div className="flex items-center justify-between pt-2">
          <span className="text-sm font-medium">Risk Devaluation</span>
          <Badge variant="secondary">{Math.round(normalized.risk * 100)}%</Badge>
        </div>
        <Slider value={[w.k]} onValueChange={([v]) => setW(prev => ({ ...prev, k: v }))} min={0} max={100} step={1} />
      </div>
      <div className="pt-4">
        <Button variant="hero" asChild>
          <a href="#ranking">Adjust Scoring</a>
        </Button>
      </div>
    </Card>
  );
};
