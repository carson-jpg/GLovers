import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { apiClient } from '@/integrations/api/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { useToast } from '@/hooks/use-toast';
import { Heart, ArrowLeft, MessageCircle, Phone, Video, Image as ImageIcon, Loader2 } from 'lucide-react';
import { Link } from 'react-router-dom';

interface PublicProfile {
  _id: string;
  fullName: string;
  dateOfBirth: string;
  gender: string;
  location: string | null;
  bio: string | null;
  interests: string[];
  avatarUrl: string | null;
  age: number;
  createdAt: string;
}

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

export default function PublicProfile() {
  const { userId } = useParams<{ userId: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { toast } = useToast();
  
  const [profile, setProfile] = useState<PublicProfile | null>(null);
  const [posts, setPosts] = useState<TimelinePost[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isStartingChat, setIsStartingChat] = useState(false);

  useEffect(() => {
    if (!userId) {
      navigate('/');
      return;
    }

    if (user && user.id === userId) {
      // If viewing own profile, redirect to profile page
      navigate('/profile');
      return;
    }

    fetchProfileData();
  }, [userId, user, navigate]);

  const fetchProfileData = async () => {
    try {
      setIsLoading(true);
      
      // Fetch profile
      const profileResponse = await apiClient.request(`/profiles/${userId}`);
      if (profileResponse.success) {
        setProfile(profileResponse.data);
      } else {
        toast({
          variant: 'destructive',
          title: 'Profile not found',
          description: 'This user profile could not be found.',
        });
        navigate('/');
        return;
      }
      
      // Fetch user's timeline posts
      const postsResponse = await apiClient.request(`/timeline/posts/user/${userId}`);
      if (postsResponse.success) {
        setPosts(postsResponse.data || []);
      }
    } catch (error) {
      console.error('Failed to fetch profile data:', error);
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'Failed to load profile',
      });
      navigate('/');
    } finally {
      setIsLoading(false);
    }
  };

  const handleStartChat = async () => {
    if (!userId) return;
    
    try {
      setIsStartingChat(true);
      const response = await apiClient.createChat(userId);
      
      if (response.success && response.data?._id) {
        navigate(`/chat/${response.data._id}`);
      } else {
        toast({
          variant: 'destructive',
          title: 'Error',
          description: 'Failed to start chat',
        });
      }
    } catch (error) {
      console.error('Failed to start chat:', error);
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'Failed to start chat',
      });
    } finally {
      setIsStartingChat(false);
    }
  };

  const handleLike = async (postId: string) => {
    try {
      const response = await apiClient.request(`/timeline/posts/${postId}/like`, {
        method: 'POST',
      });

      if (response.success) {
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

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center">
          <p className="text-muted-foreground mb-4">Profile not found</p>
          <Link to="/">
            <Button>Go Home</Button>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background py-12 px-4">
      <div className="container max-w-4xl mx-auto">
        <div className="flex items-center justify-between mb-8">
          <Button variant="ghost" onClick={() => navigate(-1)}>
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back
          </Button>
          
          <Button onClick={handleStartChat} disabled={isStartingChat}>
            {isStartingChat ? (
              <Loader2 className="w-4 h-4 animate-spin mr-2" />
            ) : (
              <MessageCircle className="w-4 h-4 mr-2" />
            )}
            Start Chat
          </Button>
        </div>

        {/* Profile Header */}
        <Card className="mb-8 border-border/50 shadow-lg">
          <CardHeader>
            <div className="flex flex-col md:flex-row gap-6 items-start md:items-center">
              <Avatar className="w-32 h-32">
                <AvatarImage 
                  src={profile.avatarUrl || ''} 
                  alt={profile.fullName} 
                />
                <AvatarFallback className="text-3xl">
                  {profile.fullName.split(' ').map(n => n[0]).join('')}
                </AvatarFallback>
              </Avatar>
              
              <div className="flex-1">
                <h1 className="text-3xl font-display font-semibold mb-2">{profile.fullName}</h1>
                <div className="flex flex-wrap gap-4 text-muted-foreground mb-4">
                  <span>{profile.age} years old</span>
                  <span className="capitalize">{profile.gender}</span>
                  {profile.location && <span>{profile.location}</span>}
                </div>
                
                {/* Action Buttons */}
                <div className="flex gap-2">
                  <Button onClick={handleStartChat} disabled={isStartingChat}>
                    <MessageCircle className="w-4 h-4 mr-2" />
                    Chat
                  </Button>
                  <Button variant="outline">
                    <Phone className="w-4 h-4 mr-2" />
                    Call
                  </Button>
                  <Button variant="outline">
                    <Video className="w-4 h-4 mr-2" />
                    Video
                  </Button>
                </div>
              </div>
            </div>
          </CardHeader>
          
          {profile.bio && (
            <CardContent>
              <div className="mb-4">
                <h3 className="font-semibold mb-2">About</h3>
                <p className="text-muted-foreground whitespace-pre-wrap">{profile.bio}</p>
              </div>
              
              {profile.interests && profile.interests.length > 0 && (
                <div>
                  <h3 className="font-semibold mb-2">Interests</h3>
                  <div className="flex flex-wrap gap-2">
                    {profile.interests.map((interest, index) => (
                      <span
                        key={index}
                        className="px-3 py-1 bg-primary/10 text-primary text-sm rounded-full"
                      >
                        {interest}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </CardContent>
          )}
        </Card>

        {/* Timeline Posts */}
        <div>
          <div className="flex items-center gap-2 mb-6">
            <ImageIcon className="w-6 h-6 text-primary" />
            <h2 className="text-2xl font-display font-semibold">Photos & Posts</h2>
          </div>
          
          {posts.length === 0 ? (
            <Card className="border-border/50">
              <CardContent className="text-center py-12">
                <ImageIcon className="w-16 h-16 text-muted-foreground/30 mx-auto mb-4" />
                <h3 className="text-lg font-semibold mb-2">No posts yet</h3>
                <p className="text-muted-foreground">{profile.fullName} hasn't shared any photos yet.</p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-6">
              {posts.map((post) => (
                <Card key={post._id} className="border-border/50 shadow-lg">
                  <CardHeader>
                    <div className="flex items-center gap-3">
                      <Avatar className="w-10 h-10">
                        <AvatarImage 
                          src={post.profile.avatarUrl || ''} 
                          alt={post.profile.fullName} 
                        />
                        <AvatarFallback className="text-sm">
                          {post.profile.fullName.split(' ').map(n => n[0]).join('')}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex-1">
                        <div className="font-semibold">{post.profile.fullName}</div>
                        <div className="text-sm text-muted-foreground">
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
                      
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <MessageCircle className="w-4 h-4" />
                        {post.comments.length} {post.comments.length === 1 ? 'comment' : 'comments'}
                      </div>
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
                          <div className="text-sm text-muted-foreground">
                            View all {post.comments.length} comments
                          </div>
                        )}
                      </div>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}