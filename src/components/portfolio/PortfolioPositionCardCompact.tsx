import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";

interface PortfolioPositionCardCompactProps {
  position: any;
  index: number;
  price: number;
  isEditing: boolean;
  editShares: number;
  dripDisplay: {
    text: string;
    variant: 'default' | 'destructive' | 'secondary';
    className: string;
  };
  dripRawScore: number;
  actualRank: number | null;
  aiRec: any;
  aiAdviceLoading: boolean;
  profileId?: string;
  onStartEdit: () => void;
  onSaveEdit: () => void;
  onCancelEdit: () => void;
  onRemove: () => void;
  onSharesChange: (shares: number) => void;
}

export function PortfolioPositionCardCompact({
  position,
  price,
  isEditing,
  editShares,
  dripDisplay,
  dripRawScore,
  actualRank,
  aiRec,
  aiAdviceLoading,
  profileId,
  onStartEdit,
  onSaveEdit,
  onCancelEdit,
  onRemove,
  onSharesChange,
}: PortfolioPositionCardCompactProps) {
  const value = position.isRecommendation ? position.currentValue : position.shares * price;
  const shares = position.isRecommendation ? position.shares : position.shares;

  return (
    <Card className={position.isRecommendation ? 'bg-blue-50 border-blue-200 dark:bg-blue-950/20 dark:border-blue-800/50' : ''}>
      <CardContent className="p-3 space-y-2">
        {/* Header Row: Rank, Ticker, DRIP */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="text-sm font-bold px-2 py-0.5">
              {actualRank ? `#${actualRank}` : 'N/A'}
            </Badge>
            <span className="font-bold">{profileId ? position.ticker : (position.isRecommendation ? "SIGN IN" : position.ticker)}</span>
            {position.isRecommendation && (
              <Badge variant="outline" className="text-xs border-blue-500 text-blue-600 dark:text-blue-400 px-1.5 py-0">
                AI
              </Badge>
            )}
          </div>
          
          <Badge className={`${dripDisplay.className} text-xs px-2`}>
            {dripDisplay.text}
          </Badge>
        </div>

        {/* Data Grid */}
        <div className="grid grid-cols-3 gap-2 text-xs">
          <div>
            <div className="text-muted-foreground">Shares</div>
            {isEditing && !position.isRecommendation ? (
              <Input
                type="number"
                value={editShares}
                onChange={(e) => onSharesChange(Number(e.target.value))}
                className="h-7 text-xs mt-0.5"
              />
            ) : (
              <div className="font-medium">{shares.toLocaleString()}</div>
            )}
          </div>
          <div>
            <div className="text-muted-foreground">Price</div>
            <div className="font-medium">${price.toFixed(2)}</div>
          </div>
          <div>
            <div className="text-muted-foreground">Value</div>
            <div className="font-medium">${value.toLocaleString()}</div>
          </div>
        </div>

        {/* AI Recommendation Row */}
        {(position.isRecommendation || aiRec) && (
          <div className="pt-2 border-t">
            {position.isRecommendation ? (
              <div className="flex items-center justify-between text-xs">
                <span className="text-blue-600 dark:text-blue-400 font-medium">
                  💡 {profileId ? `$${value.toLocaleString()}` : "***"}
                </span>
                <Badge variant="outline" className="text-xs border-blue-500">
                  {profileId ? "ADD" : "***"}
                </Badge>
              </div>
            ) : aiAdviceLoading ? (
              <div className="text-muted-foreground text-xs">Loading AI...</div>
            ) : aiRec ? (
              <div className="flex items-center justify-between text-xs">
                <div className="flex items-center gap-1">
                  <span>
                    {aiRec.action === 'INCREASE' && '↗️'}
                    {aiRec.action === 'DECREASE' && '↘️'}
                    {aiRec.action === 'SELL' && '❌'}
                    {aiRec.action === 'HOLD' && '➡️'}
                  </span>
                  <span className="font-medium">${aiRec.targetValue.toLocaleString()}</span>
                </div>
                <Badge 
                  variant={aiRec.action === 'INCREASE' ? 'default' : 
                          aiRec.action === 'DECREASE' || aiRec.action === 'SELL' ? 'destructive' : 'outline'}
                  className={`text-xs px-1.5 ${
                    aiRec.action === 'INCREASE' ? 'bg-green-600 text-white' :
                    aiRec.action === 'DECREASE' || aiRec.action === 'SELL' ? 'bg-red-600 text-white' : ''
                  }`}
                >
                  {aiRec.action}
                </Badge>
              </div>
            ) : null}
          </div>
        )}

        {/* Actions */}
        {!position.isRecommendation && (
          <div className="flex gap-1.5 pt-2 border-t">
            {isEditing ? (
              <>
                <Button size="sm" onClick={onSaveEdit} className="flex-1 h-7 text-xs">
                  Save
                </Button>
                <Button size="sm" variant="outline" onClick={onCancelEdit} className="flex-1 h-7 text-xs">
                  Cancel
                </Button>
              </>
            ) : (
              <>
                <Button size="sm" variant="outline" onClick={onStartEdit} className="flex-1 h-7 text-xs">
                  Edit
                </Button>
                <Button size="sm" variant="destructive" onClick={onRemove} className="flex-1 h-7 text-xs">
                  Delete
                </Button>
              </>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
