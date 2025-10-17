import { useEffect, useState } from "react";
import Navigation from "@/components/Navigation";
import Footer from "@/components/Footer";
import { LoadingScreen } from "@/components/LoadingScreen";
import { CreatePost } from "@/components/social/CreatePost";
import { PostCard } from "@/components/social/PostCard";
import { useSocialFeed } from "@/hooks/useSocialFeed";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";

const Home = () => {
  const [user, setUser] = useState<any>(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  
  const { posts, loading, createPost, addComment, toggleFollow } = useSocialFeed(user?.id || null);

  useEffect(() => {
    // Check authentication status
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
      setIsAuthenticated(!!session?.user);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
      setIsAuthenticated(!!session?.user);
    });

    return () => subscription.unsubscribe();
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen flex flex-col">
        <Navigation />
        <div className="flex-1 flex items-center justify-center">
          <LoadingScreen message="Loading feed..." />
        </div>
        <Footer />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col">
      <Navigation />
      
      <main className="flex-1 container mx-auto px-4 py-8">
        <div className="max-w-2xl mx-auto space-y-6">
          {/* Header */}
          <div className="text-center space-y-4 mb-8">
            <h1 className="text-4xl font-bold">Community Feed</h1>
            <p className="text-muted-foreground">
              Share insights, discuss strategies, and connect with fellow investors
            </p>
            {!isAuthenticated && (
              <div className="flex gap-4 justify-center">
                <Button asChild>
                  <Link to="/auth">Sign In to Post</Link>
                </Button>
              </div>
            )}
          </div>

          {/* Create Post */}
          {isAuthenticated && (
            <CreatePost onCreatePost={createPost} />
          )}

          {/* Posts Feed */}
          <div className="space-y-6">
            {posts.length === 0 ? (
              <div className="text-center py-12">
                <p className="text-muted-foreground">
                  No posts yet. Be the first to share something!
                </p>
              </div>
            ) : (
              posts.map((post) => (
                <PostCard
                  key={post.id}
                  post={post}
                  onAddComment={addComment}
                  onToggleFollow={toggleFollow}
                  isAuthenticated={isAuthenticated}
                />
              ))
            )}
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
};

export default Home;