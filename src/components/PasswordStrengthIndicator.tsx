// Password strength visual indicator
import { analyzePassword, PasswordStrength } from "@/hooks/usePasswordStrength";

interface PasswordStrengthIndicatorProps {
  password: string;
  show?: boolean;
}

const strengthColors: Record<PasswordStrength, string> = {
  weak: 'bg-red-500',
  fair: 'bg-yellow-500', 
  good: 'bg-blue-500',
  strong: 'bg-green-500'
};

const strengthText: Record<PasswordStrength, string> = {
  weak: 'Weak',
  fair: 'Fair',
  good: 'Good', 
  strong: 'Strong'
};

export const PasswordStrengthIndicator = ({ 
  password, 
  show = true 
}: PasswordStrengthIndicatorProps) => {
  if (!show || !password) return null;

  const analysis = analyzePassword(password);
  const { strength, feedback } = analysis;

  return (
    <div className="mt-2 space-y-2">
      <div className="flex items-center gap-2">
        <div className="flex-1 bg-muted rounded-full h-2">
          <div 
            className={`h-2 rounded-full transition-all duration-300 ${strengthColors[strength]}`}
            style={{ 
              width: `${Math.min((analysis.score / 8) * 100, 100)}%` 
            }}
          />
        </div>
        <span className={`text-xs font-medium ${
          strength === 'weak' ? 'text-red-600' :
          strength === 'fair' ? 'text-yellow-600' :
          strength === 'good' ? 'text-blue-600' :
          'text-green-600'
        }`}>
          {strengthText[strength]}
        </span>
      </div>
      
      {feedback.length > 0 && (
        <ul className="text-xs text-muted-foreground space-y-1">
          {feedback.slice(0, 3).map((item, index) => (
            <li key={index}>• {item}</li>
          ))}
        </ul>
      )}
    </div>
  );
};