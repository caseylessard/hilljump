import { useState } from 'react';
import { Card, CardContent, CardFooter, CardHeader } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { MessageSquare, Bell, BellOff } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import type { Post } from '@/hooks/useSocialFeed';

interface PostCardProps {
  post: Post;
  onAddComment: (postId: string, content: string) => void;
  onToggleFollow: (postId: string, isFollowing: boolean) => void;
  isAuthenticated: boolean;
}

export function PostCard({ post, onAddComment, onToggleFollow, isAuthenticated }: PostCardProps) {
  const [showComments, setShowComments] = useState(false);
  const [commentText, setCommentText] = useState('');

  const handleAddComment = () => {
    if (commentText.trim()) {
      onAddComment(post.id, commentText);
      setCommentText('');
    }
  };

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

  return (
    <Card className="w-full">
      <CardHeader>
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <Avatar>
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
        <p className="whitespace-pre-wrap">{post.content}</p>
      </CardContent>

      <CardFooter className="flex-col gap-4">
        <div className="flex items-center gap-4 w-full">
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
            <div className="space-y-3">
              {post.comments?.map((comment) => (
                <div key={comment.id} className="flex gap-3 pl-4 border-l-2 border-muted">
                  <Avatar className="w-8 h-8">
                    <AvatarFallback className="text-xs">
                      {getInitials(comment.profiles)}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <p className="font-medium text-sm">{getDisplayName(comment.profiles)}</p>
                      <p className="text-xs text-muted-foreground">
                        {formatDistanceToNow(new Date(comment.created_at), { addSuffix: true })}
                      </p>
                    </div>
                    <p className="text-sm mt-1">{comment.content}</p>
                  </div>
                </div>
              ))}
            </div>

            {/* Add comment */}
            {isAuthenticated && (
              <div className="flex gap-2">
                <Textarea
                  placeholder="Write a comment..."
                  value={commentText}
                  onChange={(e) => setCommentText(e.target.value)}
                  className="min-h-[60px]"
                />
                <Button onClick={handleAddComment} disabled={!commentText.trim()}>
                  Post
                </Button>
              </div>
            )}
          </div>
        )}
      </CardFooter>
    </Card>
  );
}
