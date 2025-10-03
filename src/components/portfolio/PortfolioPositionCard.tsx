import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";

interface PortfolioPositionCardProps {
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

export function PortfolioPositionCard({
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
}: PortfolioPositionCardProps) {
  const value = position.isRecommendation ? position.currentValue : position.shares * price;
  const shares = position.isRecommendation ? position.shares : position.shares;

  return (
    <Card className={position.isRecommendation ? 'bg-blue-50 border-blue-200 dark:bg-blue-950/20 dark:border-blue-800/50' : ''}>
      <CardContent className="p-4 space-y-3">
        {/* Header: Rank & Ticker */}
        <div className="flex items-start justify-between">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <Badge variant="outline" className="text-lg font-bold">
                {actualRank ? `#${actualRank}` : 'N/A'}
              </Badge>
              <span className="font-bold text-lg">{profileId ? position.ticker : (position.isRecommendation ? "SIGN IN" : position.ticker)}</span>
            </div>
            {position.isRecommendation && (
              <Badge variant="outline" className="text-xs border-blue-500 text-blue-600 dark:text-blue-400">
                {profileId ? "AI Suggestion" : "***"}
              </Badge>
            )}
          </div>
          
          {/* DRIP Signal */}
          <div className="flex flex-col items-end gap-1">
            <Badge className={dripDisplay.className}>
              {dripDisplay.text}
            </Badge>
            <span className="text-xs text-muted-foreground">
              {dripRawScore.toFixed(4)}
            </span>
          </div>
        </div>

        {/* Position Details */}
        <div className="grid grid-cols-2 gap-3 text-sm">
          <div>
            <div className="text-muted-foreground">Shares</div>
            {isEditing && !position.isRecommendation ? (
              <Input
                type="number"
                value={editShares}
                onChange={(e) => onSharesChange(Number(e.target.value))}
                className="h-8 mt-1"
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
            <div className="text-muted-foreground">Current Value</div>
            <div className="font-medium">${value.toLocaleString()}</div>
          </div>
          <div>
            <div className="text-muted-foreground">AI Target Value</div>
            {position.isRecommendation ? (
              <div className="space-y-1">
                <div className="font-medium text-blue-600 dark:text-blue-400">
                  💡 {profileId ? `$${value.toLocaleString()}` : "***"}
                </div>
                <Badge variant="outline" className="text-xs border-blue-500">
                  {profileId ? "ADD" : "***"}
                </Badge>
              </div>
            ) : aiAdviceLoading ? (
              <div className="text-muted-foreground text-sm">Loading...</div>
            ) : aiRec ? (
              <div className="space-y-1">
                <div className="font-medium">
                  {aiRec.action === 'INCREASE' && '↗️'}
                  {aiRec.action === 'DECREASE' && '↘️'}
                  {aiRec.action === 'SELL' && '❌'}
                  {aiRec.action === 'HOLD' && '➡️'} ${aiRec.targetValue.toLocaleString()}
                </div>
                <div className="text-xs text-muted-foreground">
                  {aiRec.targetShares} shares
                </div>
                <Badge 
                  variant={aiRec.action === 'INCREASE' ? 'default' : 
                          aiRec.action === 'DECREASE' || aiRec.action === 'SELL' ? 'destructive' : 'outline'}
                  className={`text-xs ${
                    aiRec.action === 'INCREASE' ? 'bg-green-600 text-white' :
                    aiRec.action === 'DECREASE' || aiRec.action === 'SELL' ? 'bg-red-600 text-white' : ''
                  }`}
                >
                  {aiRec.action}
                </Badge>
                <div className="text-xs text-muted-foreground mt-1" title={aiRec.reason}>
                  {aiRec.confidence}% confidence
                </div>
              </div>
            ) : (
              <div className="text-muted-foreground text-sm">-</div>
            )}
          </div>
        </div>

        {/* Actions */}
        {position.isRecommendation ? (
          <div className="text-sm text-muted-foreground pt-2 border-t">
            {profileId ? "AI Recommendation" : "***"}
          </div>
        ) : (
          <div className="flex gap-2 pt-2 border-t">
            {isEditing ? (
              <>
                <Button
                  size="sm"
                  onClick={onSaveEdit}
                  className="flex-1"
                >
                  Save
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={onCancelEdit}
                  className="flex-1"
                >
                  Cancel
                </Button>
              </>
            ) : (
              <>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={onStartEdit}
                  className="flex-1"
                >
                  Edit
                </Button>
                <Button
                  size="sm"
                  variant="destructive"
                  onClick={onRemove}
                  className="flex-1"
                >
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
