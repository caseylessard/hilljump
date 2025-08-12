import { Button } from "@/components/ui/button";
import { useUserProfile } from "@/hooks/useUserProfile";

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
      <Button variant="ghost" asChild>
        <a href="/auth">Profile</a>
      </Button>
    );
  }

  const name = profile?.first_name?.trim() || 'Account';
  const flag = flagEmoji(profile?.country as any);

  return (
    <Button variant="ghost" asChild>
      <a href="/profile" aria-label="Profile">
        <span className="mr-1" aria-hidden>{flag}</span>
        <span>{name}</span>
      </a>
    </Button>
  );
};
