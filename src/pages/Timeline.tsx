import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { apiClient } from '@/integrations/api/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { useToast } from '@/hooks/use-toast';
import { Heart, Loader2, ArrowLeft, Upload, X, Camera, Image as ImageIcon, MessageCircle } from 'lucide-react';
import { Link } from 'react-router-dom';

interface TimelinePost {
  _id: string;
  userId: {
    _id: string;
    email: string;
  };
  profile: {
    _id: string;
    fullName: string;
    avatarUrl: string | null;
    location: string | null;
  };
  imageUrl: string;
  caption: string;
  likes: string[];
  comments: Array<{
    _id: string;
    userId: string;
    profile: {
      fullName: string;
      avatarUrl: string | null;
    };
    content: string;
    createdAt: string;
  }>;
  createdAt: string;
}

interface Profile {
  _id: string;
  fullName: string;
  avatarUrl: string | null;
  location: string | null;
}

export default function Timeline() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  
  const [posts, setPosts] = useState<TimelinePost[]>([]);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedPhoto, setSelectedPhoto] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [caption, setCaption] = useState('');
  const [isUploading, setIsUploading] = useState(false);
  const [showUploadForm, setShowUploadForm] = useState(false);

  useEffect(() => {
    if (!loading && !user) {
      navigate('/auth');
    }
  }, [user, loading, navigate]);

  useEffect(() => {
    if (user) {
      fetchData();
    }
  }, [user]);

  const fetchData = async () => {
    try {
      setIsLoading(true);
      
      // Fetch timeline posts
      const postsResponse = await apiClient.request('/timeline/posts');
      if (postsResponse.success) {
        setPosts(postsResponse.data || []);
      }
      
      // Fetch profiles for user selection
      const profilesResponse = await apiClient.getAllProfiles();
      if (profilesResponse.success) {
        setProfiles(profilesResponse.data || []);
      }
    } catch (error) {
      console.error('Failed to fetch timeline data:', error);
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'Failed to load timeline',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handlePhotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      // Validate file type
      if (!file.type.startsWith('image/')) {
        toast({
          variant: 'destructive',
          title: 'Invalid file type',
          description: 'Please select an image file.',
        });
        return;
      }

      // Validate file size (10MB limit for timeline photos)
      if (file.size > 10 * 1024 * 1024) {
        toast({
          variant: 'destructive',
          title: 'File too large',
          description: 'Please select an image smaller than 10MB.',
        });
        return;
      }

      setSelectedPhoto(file);
      
      // Create preview
      const reader = new FileReader();
      reader.onload = (e) => {
        setPhotoPreview(e.target?.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const removePhoto = () => {
    setSelectedPhoto(null);
    setPhotoPreview(null);
  };

  const uploadPost = async () => {
    if (!selectedPhoto || !caption.trim()) {
      toast({
        variant: 'destructive',
        title: 'Missing information',
        description: 'Please select a photo and add a caption.',
      });
      return;
    }

    try {
      setIsUploading(true);
      
      const formData = new FormData();
      formData.append('image', selectedPhoto);
      formData.append('caption', caption.trim());

      const response = await apiClient.request('/timeline/posts', {
        method: 'POST',
        body: formData,
      });

      if (response.success) {
        toast({
          title: 'Post shared!',
          description: 'Your photo has been posted to the timeline.',
        });
        
        // Reset form
        setSelectedPhoto(null);
        setPhotoPreview(null);
        setCaption('');
        setShowUploadForm(false);
        
        // Refresh posts
        await fetchData();
      } else {
        toast({
          variant: 'destructive',
          title: 'Error',
          description: response.message || 'Failed to create post',
        });
      }
    } catch (error) {
      console.error('Post creation failed:', error);
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'Failed to create post. Please try again.',
      });
    } finally {
      setIsUploading(false);
    }
  };

  const handleLike = async (postId: string) => {
    try {
      const response = await apiClient.request(`/timeline/posts/${postId}/like`, {
        method: 'POST',
      });

      if (response.success) {
        // Update the post in the local state
        setPosts(prevPosts => 
          prevPosts.map(post => 
            post._id === postId 
              ? { ...post, likes: response.data.likes }
              : post
          )
        );
      }
    } catch (error) {
      console.error('Failed to like post:', error);
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000);
    
    if (diffInSeconds < 60) return 'Just now';
    if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)}m ago`;
    if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)}h ago`;
    if (diffInSeconds < 604800) return `${Math.floor(diffInSeconds / 86400)}d ago`;
    
    return date.toLocaleDateString();
  };

  if (loading || isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background py-12 px-4">
      <div className="container max-w-4xl mx-auto">
        <div className="flex items-center justify-between mb-8">
          <Link to="/" className="inline-flex items-center gap-2 text-muted-foreground hover:text-foreground">
            <ArrowLeft className="w-4 h-4" />
            Back to home
          </Link>
          
          <Button onClick={() => setShowUploadForm(!showUploadForm)}>
            <Upload className="w-4 h-4 mr-2" />
            Share Photo
          </Button>
        </div>

        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-primary/10 mb-4">
            <ImageIcon className="w-8 h-8 text-primary" />
          </div>
          <h1 className="text-3xl font-display font-semibold">Timeline</h1>
          <p className="text-muted-foreground mt-2">See what's happening in the community</p>
        </div>

        {/* Upload Form */}
        {showUploadForm && (
          <Card className="mb-8 border-border/50 shadow-lg">
            <CardHeader>
              <CardTitle>Share a Photo</CardTitle>
              <CardDescription>Upload a photo to share with the community</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Photo</label>
                <div className="flex items-center gap-4">
                  <div className="w-32 h-32 rounded-lg bg-secondary flex items-center justify-center overflow-hidden border-2 border-dashed border-border">
                    {photoPreview ? (
                      <img src={photoPreview} alt="Preview" className="w-full h-full object-cover" />
                    ) : (
                      <Camera className="w-8 h-8 text-muted-foreground" />
                    )}
                  </div>
                  <div className="flex-1">
                    <input
                      id="timeline-photo"
                      type="file"
                      accept="image/*"
                      onChange={handlePhotoChange}
                      className="hidden"
                    />
                    <div className="flex gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => document.getElementById('timeline-photo')?.click()}
                      >
                        <Camera className="w-4 h-4 mr-2" />
                        Choose Photo
                      </Button>
                      {selectedPhoto && (
                        <Button
                          type="button"
                          variant="outline"
                          size="icon"
                          onClick={removePhoto}
                        >
                          <X className="w-4 h-4" />
                        </Button>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">
                      JPG, PNG up to 10MB
                    </p>
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">Caption</label>
                <textarea
                  placeholder="What's on your mind?"
                  value={caption}
                  onChange={(e) => setCaption(e.target.value)}
                  className="w-full p-3 border border-border rounded-md resize-none focus:outline-none focus:ring-2 focus:ring-primary"
                  rows={3}
                  maxLength={500}
                />
                <p className="text-xs text-muted-foreground">{caption.length}/500 characters</p>
              </div>

              <div className="flex gap-2">
                <Button 
                  onClick={uploadPost} 
                  disabled={isUploading || !selectedPhoto || !caption.trim()}
                  className="flex-1"
                >
                  {isUploading ? (
                    <Loader2 className="w-4 h-4 animate-spin mr-2" />
                  ) : (
                    <Upload className="w-4 h-4 mr-2" />
                  )}
                  Share Post
                </Button>
                <Button 
                  variant="outline" 
                  onClick={() => {
                    setShowUploadForm(false);
                    removePhoto();
                    setCaption('');
                  }}
                >
                  Cancel
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Timeline Posts */}
        <div className="space-y-6">
          {posts.length === 0 ? (
            <Card className="border-border/50">
              <CardContent className="text-center py-12">
                <ImageIcon className="w-16 h-16 text-muted-foreground/30 mx-auto mb-4" />
                <h3 className="text-lg font-semibold mb-2">No posts yet</h3>
                <p className="text-muted-foreground">Be the first to share a photo!</p>
              </CardContent>
            </Card>
          ) : (
            posts.map((post) => (
              <Card key={post._id} className="border-border/50 shadow-lg">
                <CardHeader>
                  <div className="flex items-center gap-3">
                    <Avatar className="w-12 h-12">
                      <AvatarImage 
                        src={post.profile.avatarUrl || ''} 
                        alt={post.profile.fullName} 
                      />
                      <AvatarFallback>
                        {post.profile.fullName.split(' ').map(n => n[0]).join('')}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1">
                      <div className="font-semibold">{post.profile.fullName}</div>
                      <div className="text-sm text-muted-foreground">
                        {post.profile.location && `${post.profile.location} • `}
                        {formatDate(post.createdAt)}
                      </div>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  {post.imageUrl && (
                    <div className="rounded-lg overflow-hidden">
                      <img 
                        src={post.imageUrl} 
                        alt={post.caption}
                        className="w-full h-auto max-h-96 object-cover"
                      />
                    </div>
                  )}
                  
                  {post.caption && (
                    <p className="text-sm whitespace-pre-wrap">{post.caption}</p>
                  )}
                  
                  <div className="flex items-center gap-4 pt-2 border-t border-border">
                    <Button 
                      variant="ghost" 
                      size="sm"
                      onClick={() => handleLike(post._id)}
                      className="flex items-center gap-2"
                    >
                      <Heart className={`w-4 h-4 ${post.likes.includes(user?.id || '') ? 'fill-red-500 text-red-500' : ''}`} />
                      {post.likes.length} {post.likes.length === 1 ? 'like' : 'likes'}
                    </Button>
                    
                    <Button variant="ghost" size="sm" className="flex items-center gap-2">
                      <MessageCircle className="w-4 h-4" />
                      {post.comments.length} {post.comments.length === 1 ? 'comment' : 'comments'}
                    </Button>
                  </div>
                  
                  {post.comments.length > 0 && (
                    <div className="space-y-2 pt-2 border-t border-border">
                      {post.comments.slice(0, 2).map((comment) => (
                        <div key={comment._id} className="flex gap-2">
                          <Avatar className="w-8 h-8">
                            <AvatarImage 
                              src={comment.profile.avatarUrl || ''} 
                              alt={comment.profile.fullName} 
                            />
                            <AvatarFallback className="text-xs">
                              {comment.profile.fullName.split(' ').map(n => n[0]).join('')}
                            </AvatarFallback>
                          </Avatar>
                          <div className="flex-1">
                            <div className="bg-muted rounded-lg p-2">
                              <div className="font-medium text-sm">{comment.profile.fullName}</div>
                              <div className="text-sm">{comment.content}</div>
                            </div>
                            <div className="text-xs text-muted-foreground mt-1">
                              {formatDate(comment.createdAt)}
                            </div>
                          </div>
                        </div>
                      ))}
                      {post.comments.length > 2 && (
                        <Button variant="ghost" size="sm" className="text-muted-foreground">
                          View all {post.comments.length} comments
                        </Button>
                      )}
                    </div>
                  )}
                </CardContent>
              </Card>
            ))
          )}
        </div>
      </div>
    </div>
  );
}