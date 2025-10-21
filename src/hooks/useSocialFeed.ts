import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

export interface Comment {
  id: string;
  post_id: string;
  user_id: string;
  content: string;
  created_at: string;
  parent_comment_id: string | null;
  profiles?: {
    username: string | null;
    first_name: string | null;
    last_name: string | null;
    avatar_url: string | null;
  };
  replies?: Comment[];
}

export interface Post {
  id: string;
  user_id: string;
  content: string;
  created_at: string;
  updated_at: string;
  profiles?: {
    username: string | null;
    first_name: string | null;
    last_name: string | null;
    avatar_url: string | null;
  };
  comments?: Comment[];
  is_following?: boolean;
  comment_count?: number;
  like_count?: number;
  is_liked?: boolean;
}

export const useSocialFeed = (userId: string | null) => {
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  const loadPosts = async () => {
    try {
      setLoading(true);
      
      // Fetch posts
      const { data: postsData, error: postsError } = await supabase
        .from('posts')
        .select('*')
        .order('created_at', { ascending: false });

      if (postsError) throw postsError;

      // Fetch profiles for post authors
      const postUserIds = postsData?.map(p => p.user_id) || [];
      const profilesData = postUserIds.length > 0 
        ? (await supabase
            .from('profiles')
            .select('id, username, first_name, last_name, avatar_url')
            .in('id', postUserIds)).data
        : [];

      // Fetch comments
      const { data: commentsData, error: commentsError } = await supabase
        .from('comments')
        .select('*')
        .order('created_at', { ascending: true });

      if (commentsError) throw commentsError;

      // Fetch profiles for comment authors
      const commentUserIds = commentsData?.map(c => c.user_id) || [];
      const commentProfilesData = commentUserIds.length > 0
        ? (await supabase
            .from('profiles')
            .select('id, username, first_name, last_name, avatar_url')
            .in('id', commentUserIds)).data
        : [];

      // Fetch all likes
      const { data: allLikesData } = await supabase
        .from('post_likes')
        .select('post_id, user_id');

      // Fetch follows if user is logged in
      let followsData: any[] = [];
      if (userId) {
        const { data, error: followsError } = await supabase
          .from('post_follows')
          .select('post_id')
          .eq('user_id', userId);
        
        if (!followsError && data) {
          followsData = data;
        }
      }

      // Create profile lookup maps
      const profileMap = new Map(profilesData?.map(p => [p.id, p]) || []);
      const commentProfileMap = new Map(commentProfilesData?.map(p => [p.id, p]) || []);

      // Create likes count map
      const likeCountMap = new Map<string, number>();
      allLikesData?.forEach((like: any) => {
        likeCountMap.set(like.post_id, (likeCountMap.get(like.post_id) || 0) + 1);
      });

      // Create user likes set
      const userLikes = new Set(
        allLikesData?.filter((like: any) => like.user_id === userId).map((like: any) => like.post_id) || []
      );

      // Organize comments into threaded structure
      const organizeComments = (postId: string): Comment[] => {
        const postComments = commentsData?.filter(c => c.post_id === postId) || [];
        const topLevel = postComments.filter(c => !c.parent_comment_id);
        return topLevel.map(comment => ({
          ...comment,
          profiles: commentProfileMap.get(comment.user_id) || null,
          replies: postComments
            .filter(c => c.parent_comment_id === comment.id)
            .map(reply => ({
              ...reply,
              profiles: commentProfileMap.get(reply.user_id) || null,
              replies: []
            }))
        }));
      };

      // Combine data
      const postsWithComments = postsData?.map(post => ({
        ...post,
        profiles: profileMap.get(post.user_id) || null,
        comments: organizeComments(post.id),
        is_following: followsData.some(f => f.post_id === post.id),
        comment_count: commentsData?.filter(c => c.post_id === post.id).length || 0,
        like_count: likeCountMap.get(post.id) || 0,
        is_liked: userLikes.has(post.id)
      })) || [];

      setPosts(postsWithComments);
    } catch (error) {
      console.error('Error loading posts:', error);
      toast({
        title: 'Error',
        description: 'Failed to load posts',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadPosts();

    // Subscribe to real-time updates
    const postsChannel = supabase
      .channel('posts-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'posts' }, () => {
        loadPosts();
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'comments' }, () => {
        loadPosts();
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'post_likes' }, () => {
        loadPosts();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(postsChannel);
    };
  }, [userId]);

  const createPost = async (content: string) => {
    if (!userId) {
      toast({
        title: 'Error',
        description: 'You must be logged in to post',
        variant: 'destructive',
      });
      return;
    }

    try {
      const { error } = await supabase
        .from('posts')
        .insert({ user_id: userId, content });

      if (error) throw error;

      toast({
        title: 'Success',
        description: 'Post created successfully',
      });
    } catch (error) {
      console.error('Error creating post:', error);
      toast({
        title: 'Error',
        description: 'Failed to create post',
        variant: 'destructive',
      });
    }
  };

  const toggleLike = async (postId: string, isLiked: boolean) => {
    if (!userId) {
      toast({ title: "Sign in required", description: "Please sign in to like posts", variant: "destructive" });
      return;
    }

    try {
      if (isLiked) {
        const { error } = await supabase
          .from('post_likes')
          .delete()
          .eq('post_id', postId)
          .eq('user_id', userId);

        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('post_likes')
          .insert({ post_id: postId, user_id: userId });

        if (error) throw error;
      }

      await loadPosts();
    } catch (error: any) {
      console.error('Error toggling like:', error);
      toast({ title: "Failed to update like", description: error.message, variant: "destructive" });
    }
  };

  const addComment = async (postId: string, content: string, parentCommentId: string | null = null) => {
    if (!userId) {
      toast({
        title: 'Error',
        description: 'You must be logged in to comment',
        variant: 'destructive',
      });
      return;
    }

    try {
      const { error } = await supabase
        .from('comments')
        .insert({ post_id: postId, user_id: userId, content, parent_comment_id: parentCommentId });

      if (error) throw error;

      toast({
        title: 'Success',
        description: 'Comment added successfully',
      });
    } catch (error) {
      console.error('Error adding comment:', error);
      toast({
        title: 'Error',
        description: 'Failed to add comment',
        variant: 'destructive',
      });
    }
  };

  const toggleFollow = async (postId: string, isFollowing: boolean) => {
    if (!userId) {
      toast({
        title: 'Error',
        description: 'You must be logged in to follow posts',
        variant: 'destructive',
      });
      return;
    }

    try {
      if (isFollowing) {
        const { error } = await supabase
          .from('post_follows')
          .delete()
          .eq('post_id', postId)
          .eq('user_id', userId);

        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('post_follows')
          .insert({ post_id: postId, user_id: userId });

        if (error) throw error;
      }

      // Update local state
      setPosts(posts.map(p => 
        p.id === postId ? { ...p, is_following: !isFollowing } : p
      ));

      toast({
        title: 'Success',
        description: isFollowing ? 'Unfollowed post' : 'Following post',
      });
    } catch (error) {
      console.error('Error toggling follow:', error);
      toast({
        title: 'Error',
        description: 'Failed to update follow status',
        variant: 'destructive',
      });
    }
  };

  return {
    posts,
    loading,
    createPost,
    addComment,
    toggleFollow,
    toggleLike,
    refresh: loadPosts,
  };
};