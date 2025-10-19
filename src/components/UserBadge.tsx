import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
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
  
  const getInitials = () => {
    if (profile?.username) return profile.username.substring(0, 2).toUpperCase();
    if (profile?.first_name) return profile.first_name.substring(0, 1).toUpperCase();
    return 'U';
  };

  return (
    <Button variant="ghost" size="icon" asChild className="relative">
      <a href="/profile" aria-label="Profile">
        <Avatar className="h-8 w-8">
          <AvatarImage src={profile?.avatar_url || undefined} alt="Profile picture" />
          <AvatarFallback>
            <User className="h-4 w-4" />
          </AvatarFallback>
        </Avatar>
        <span className="absolute -top-1 -right-1 text-xs" aria-hidden>{flag}</span>
      </a>
    </Button>
  );
};
