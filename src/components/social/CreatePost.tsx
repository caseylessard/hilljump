import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Send } from 'lucide-react';

interface CreatePostProps {
  onCreatePost: (content: string) => void;
}

export function CreatePost({ onCreatePost }: CreatePostProps) {
  const [content, setContent] = useState('');

  const handleSubmit = () => {
    if (content.trim()) {
      onCreatePost(content);
      setContent('');
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Create a Post</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <Textarea
          placeholder="What's on your mind?"
          value={content}
          onChange={(e) => setContent(e.target.value)}
          className="min-h-[120px]"
        />
        <Button 
          onClick={handleSubmit} 
          disabled={!content.trim()}
          className="w-full"
        >
          <Send className="w-4 h-4 mr-2" />
          Post
        </Button>
      </CardContent>
    </Card>
  );
}
