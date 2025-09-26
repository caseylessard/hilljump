import { Button } from "@/components/ui/button";
import { useUserProfile } from "@/hooks/useUserProfile";
import { User } from "lucide-react";

function flagEmoji(country: 'US' | 'CA' | undefined) {
  return country === 'US' ? '🇺🇸' : '🇨🇦';
}

export const UserBadge = () => {
  const { userId, profile, loading } = useUserProfile();

  if (loading) {
    return (
      <Button variant="ghost" disabled>
        …
      </Button>
    );
  }

  if (!userId) {
    return (
      <Button variant="ghost" size="icon" asChild>
        <a href="/auth" aria-label="Sign in">
          <User className="h-5 w-5" />
        </a>
      </Button>
    );
  }

  const flag = flagEmoji(profile?.country as any);

  return (
    <Button variant="ghost" size="icon" asChild>
      <a href="/profile" aria-label="Profile">
        <div className="relative">
          <User className="h-5 w-5" />
          <span className="absolute -top-1 -right-1 text-xs" aria-hidden>{flag}</span>
        </div>
      </a>
    </Button>
  );
};
