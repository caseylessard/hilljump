import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Upload, Loader2 } from 'lucide-react';

interface AvatarUploadProps {
  userId: string;
  avatarUrl: string | null;
  onAvatarUpdate: (url: string) => void;
  initials: string;
}

export function AvatarUpload({ userId, avatarUrl, onAvatarUpdate, initials }: AvatarUploadProps) {
  const [uploading, setUploading] = useState(false);
  const { toast } = useToast();

  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    try {
      const file = event.target.files?.[0];
      if (!file) return;

      // Validate file type
      if (!file.type.startsWith('image/')) {
        toast({
          title: 'Invalid file type',
          description: 'Please upload an image file (JPG, PNG, WEBP)',
          variant: 'destructive',
        });
        return;
      }

      // Validate file size (max 2MB)
      if (file.size > 2 * 1024 * 1024) {
        toast({
          title: 'File too large',
          description: 'Please upload an image smaller than 2MB',
          variant: 'destructive',
        });
        return;
      }

      setUploading(true);

      // Delete old avatar if exists
      if (avatarUrl) {
        const oldPath = avatarUrl.split('/').pop();
        if (oldPath) {
          await supabase.storage.from('avatars').remove([`${userId}/${oldPath}`]);
        }
      }

      // Upload new avatar
      const fileExt = file.name.split('.').pop();
      const fileName = `${Date.now()}.${fileExt}`;
      const filePath = `${userId}/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(filePath, file, {
          cacheControl: '3600',
          upsert: true,
        });

      if (uploadError) throw uploadError;

      // Get public URL
      const { data: { publicUrl } } = supabase.storage
        .from('avatars')
        .getPublicUrl(filePath);

      // Update profile with new avatar URL
      const { error: updateError } = await supabase
        .from('profiles')
        .update({ avatar_url: publicUrl })
        .eq('id', userId);

      if (updateError) throw updateError;

      onAvatarUpdate(publicUrl);
      
      toast({
        title: 'Avatar updated',
        description: 'Your profile picture has been updated successfully',
      });
    } catch (error: any) {
      toast({
        title: 'Upload failed',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="flex flex-col items-center gap-3">
      <Avatar className="w-24 h-24">
        <AvatarImage src={avatarUrl || undefined} alt="Profile picture" />
        <AvatarFallback className="text-2xl">{initials}</AvatarFallback>
      </Avatar>
      
      <div className="flex flex-col items-center gap-2">
        <Button
          variant="outline"
          size="sm"
          disabled={uploading}
          onClick={() => document.getElementById('avatar-upload')?.click()}
        >
          {uploading ? (
            <>
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              Uploading...
            </>
          ) : (
            <>
              <Upload className="w-4 h-4 mr-2" />
              Upload Photo
            </>
          )}
        </Button>
        <input
          id="avatar-upload"
          type="file"
          accept="image/*"
          className="hidden"
          onChange={handleFileChange}
          disabled={uploading}
        />
        <p className="text-xs text-muted-foreground">JPG, PNG or WEBP (max 2MB)</p>
      </div>
    </div>
  );
}
