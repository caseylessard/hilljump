import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

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
  };
  comments?: Comment[];
  is_following?: boolean;
  comment_count?: number;
}

export interface Comment {
  id: string;
  post_id: string;
  user_id: string;
  content: string;
  created_at: string;
  profiles?: {
    username: string | null;
    first_name: string | null;
    last_name: string | null;
  };
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
      const { data: profilesData } = await supabase
        .from('profiles')
        .select('id, username, first_name, last_name')
        .in('id', postUserIds);

      // Fetch comments
      const { data: commentsData, error: commentsError } = await supabase
        .from('comments')
        .select('*')
        .order('created_at', { ascending: true });

      if (commentsError) throw commentsError;

      // Fetch profiles for comment authors
      const commentUserIds = commentsData?.map(c => c.user_id) || [];
      const { data: commentProfilesData } = await supabase
        .from('profiles')
        .select('id, username, first_name, last_name')
        .in('id', commentUserIds);

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

      // Combine data
      const postsWithComments = postsData?.map(post => ({
        ...post,
        profiles: profileMap.get(post.user_id) || null,
        comments: commentsData
          ?.filter(c => c.post_id === post.id)
          .map(c => ({
            ...c,
            profiles: commentProfileMap.get(c.user_id) || null,
          })) || [],
        is_following: followsData.some(f => f.post_id === post.id),
        comment_count: commentsData?.filter(c => c.post_id === post.id).length || 0,
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

  const addComment = async (postId: string, content: string) => {
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
        .insert({ post_id: postId, user_id: userId, content });

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
    refresh: loadPosts,
  };
};
