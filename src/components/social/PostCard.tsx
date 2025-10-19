import { useState } from 'react';
import { Card, CardContent, CardFooter, CardHeader } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { MessageSquare, Bell, BellOff, Heart, Flag } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import type { Post, Comment } from '@/hooks/useSocialFeed';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

interface PostCardProps {
  post: Post;
  onAddComment: (postId: string, content: string, parentCommentId?: string | null) => void;
  onToggleFollow: (postId: string, isFollowing: boolean) => void;
  onToggleLike: (postId: string, isLiked: boolean) => void;
  isAuthenticated: boolean;
  showFullContent?: boolean;
}

export function PostCard({ post, onAddComment, onToggleFollow, onToggleLike, isAuthenticated, showFullContent = true }: PostCardProps) {
  const [showComments, setShowComments] = useState(false);
  const [commentText, setCommentText] = useState('');
  const [replyTo, setReplyTo] = useState<{ commentId: string; username: string } | null>(null);
  const [showFlagDialog, setShowFlagDialog] = useState(false);
  const [flagCommentId, setFlagCommentId] = useState<string | null>(null);
  const [flagReason, setFlagReason] = useState('');
  const { toast } = useToast();

  const getDisplayName = (profile: any) => {
    if (profile?.username) return profile.username;
    if (profile?.first_name || profile?.last_name) {
      return `${profile.first_name || ''} ${profile.last_name || ''}`.trim();
    }
    return 'Anonymous';
  };

  const getInitials = (profile: any) => {
    const name = getDisplayName(profile);
    return name.substring(0, 2).toUpperCase();
  };

  const handleAddComment = () => {
    if (commentText.trim()) {
      onAddComment(post.id, commentText, replyTo?.commentId || null);
      setCommentText('');
      setReplyTo(null);
    }
  };

  const handleFlagComment = async () => {
    if (!flagCommentId) return;
    
    try {
      const { error } = await supabase
        .from('comment_flags')
        .insert({
          comment_id: flagCommentId,
          user_id: (await supabase.auth.getUser()).data.user?.id,
          reason: flagReason,
        });

      if (error) throw error;

      toast({
        title: "Comment flagged",
        description: "Thank you for reporting. Admins will review this content.",
      });
      
      setShowFlagDialog(false);
      setFlagCommentId(null);
      setFlagReason('');
    } catch (error: any) {
      toast({
        title: "Failed to flag comment",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const renderComment = (comment: Comment, isReply = false) => (
    <div key={comment.id} className={`${isReply ? 'ml-8 mt-2' : 'mt-4'} flex gap-3`}>
      <Avatar className="w-8 h-8">
        <AvatarImage src={comment.profiles?.avatar_url || undefined} alt="User avatar" />
        <AvatarFallback>{getInitials(comment.profiles)}</AvatarFallback>
      </Avatar>
      <div className="flex-1">
        <div className="flex items-center gap-2">
          <span className="font-semibold text-sm">{getDisplayName(comment.profiles)}</span>
          <span className="text-xs text-muted-foreground">
            {formatDistanceToNow(new Date(comment.created_at), { addSuffix: true })}
          </span>
        </div>
        <p className="text-sm mt-1">{comment.content}</p>
        {isAuthenticated && !isReply && (
          <div className="flex gap-3 mt-1">
            <button
              onClick={() => setReplyTo({ commentId: comment.id, username: getDisplayName(comment.profiles) })}
              className="text-xs text-primary hover:underline"
            >
              Reply
            </button>
            <button
              onClick={() => {
                setFlagCommentId(comment.id);
                setShowFlagDialog(true);
              }}
              className="text-xs text-muted-foreground hover:text-destructive flex items-center gap-1"
            >
              <Flag className="h-3 w-3" />
              Flag
            </button>
          </div>
        )}
        {comment.replies && comment.replies.length > 0 && (
          <div className="mt-2">
            {comment.replies.map((reply) => renderComment(reply, true))}
          </div>
        )}
      </div>
    </div>
  );

  const truncatedContent = showFullContent ? post.content : post.content.split('\n')[0];

  return (
    <Card className="w-full">
      <CardHeader>
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <Avatar>
              <AvatarImage src={post.profiles?.avatar_url || undefined} alt="User avatar" />
              <AvatarFallback>{getInitials(post.profiles)}</AvatarFallback>
            </Avatar>
            <div>
              <p className="font-semibold">{getDisplayName(post.profiles)}</p>
              <p className="text-sm text-muted-foreground">
                {formatDistanceToNow(new Date(post.created_at), { addSuffix: true })}
              </p>
            </div>
          </div>
          {isAuthenticated && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onToggleFollow(post.id, post.is_following || false)}
            >
              {post.is_following ? (
                <>
                  <BellOff className="w-4 h-4 mr-2" />
                  Unfollow
                </>
              ) : (
                <>
                  <Bell className="w-4 h-4 mr-2" />
                  Follow
                </>
              )}
            </Button>
          )}
        </div>
      </CardHeader>
      
      <CardContent>
        <p className="whitespace-pre-wrap">{truncatedContent}</p>
        {!showFullContent && post.content.split('\n').length > 1 && (
          <span className="text-muted-foreground text-sm">...</span>
        )}
      </CardContent>

      <CardFooter className="flex-col gap-4">
        <div className="flex items-center gap-4 w-full">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onToggleLike(post.id, post.is_liked || false)}
            disabled={!isAuthenticated}
          >
            <Heart className={`w-4 h-4 mr-2 ${post.is_liked ? 'fill-current text-red-500' : ''}`} />
            {post.like_count || 0}
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setShowComments(!showComments)}
          >
            <MessageSquare className="w-4 h-4 mr-2" />
            {post.comment_count} {post.comment_count === 1 ? 'Comment' : 'Comments'}
          </Button>
        </div>

        {showComments && (
          <div className="w-full space-y-4">
            {/* Comments list */}
            {post.comments && post.comments.length > 0 && (
              <div className="space-y-2">
                {post.comments.map((comment) => renderComment(comment))}
              </div>
            )}

            {/* Add comment */}
            {isAuthenticated && (
              <div className="space-y-2">
                {replyTo && (
                  <div className="text-sm text-muted-foreground">
                    Replying to {replyTo.username}
                    <button
                      onClick={() => setReplyTo(null)}
                      className="ml-2 text-primary hover:underline"
                    >
                      Cancel
                    </button>
                  </div>
                )}
                <div className="flex gap-2">
                  <Textarea
                    placeholder={replyTo ? `Reply to ${replyTo.username}...` : "Write a comment..."}
                    value={commentText}
                    onChange={(e) => setCommentText(e.target.value)}
                    className="min-h-[60px]"
                  />
                  <Button onClick={handleAddComment} disabled={!commentText.trim()}>
                    Post
                  </Button>
                </div>
              </div>
            )}
          </div>
        )}
      </CardFooter>

      <Dialog open={showFlagDialog} onOpenChange={setShowFlagDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Flag Comment</DialogTitle>
            <DialogDescription>
              Report this comment to admins for review. Please describe why this content is inappropriate.
            </DialogDescription>
          </DialogHeader>
          <Textarea
            placeholder="Reason for flagging (optional)..."
            value={flagReason}
            onChange={(e) => setFlagReason(e.target.value)}
            className="min-h-[100px]"
          />
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setShowFlagDialog(false);
                setFlagCommentId(null);
                setFlagReason('');
              }}
            >
              Cancel
            </Button>
            <Button onClick={handleFlagComment} variant="destructive">
              <Flag className="h-4 w-4 mr-2" />
              Flag Comment
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}