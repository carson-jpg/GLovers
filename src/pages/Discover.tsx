import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { apiClient } from '@/integrations/api/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { useToast } from '@/hooks/use-toast';
import { 
  Heart, 
  MessageCircle, 
  ArrowLeft, 
  MapPin, 
  User, 
  Phone, 
  Video,
  Loader2,
  Users,
  MoreHorizontal,
  Share,
  Bookmark
} from 'lucide-react';

interface DiscoverPost {
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
    bio: string | null;
    gender: string;
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
  gender: string;
  bio: string | null;
}

export default function Discover() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  
  const [posts, setPosts] = useState<DiscoverPost[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [likedPosts, setLikedPosts] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (!loading && !user) {
      navigate('/auth');
    }
  }, [user, loading, navigate]);

  useEffect(() => {
    if (user) {
      fetchDiscoverPosts();
    }
  }, [user]);

  const fetchDiscoverPosts = async () => {
    try {
      setIsLoading(true);
      
      // Fetch all timeline posts for discovery
      const response = await apiClient.request('/timeline/posts');
      if (response.success) {
        setPosts(response.data || []);
        
        // Set initial liked posts for current user
        const userLikes = new Set<string>();
        response.data?.forEach((post: DiscoverPost) => {
          if (post.likes.includes(user?.id || '')) {
            userLikes.add(post._id);
          }
        });
        setLikedPosts(userLikes);
      } else {
        // Handle specific errors
        if (response.message?.includes('profile')) {
          toast({
            variant: 'destructive',
            title: 'Profile Required',
            description: 'Please create a profile to discover people',
          });
        } else {
          toast({
            variant: 'destructive',
            title: 'Error',
            description: response.message || 'Failed to load discover feed',
          });
        }
      }
    } catch (error: any) {
      console.error('Failed to fetch discover posts:', error);
      toast({
        variant: 'destructive',
        title: 'Error',
        description: error.message || 'Failed to load discover feed',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleLike = async (postId: string) => {
    try {
      const response = await apiClient.request(`/timeline/posts/${postId}/like`, {
        method: 'POST',
      });

      if (response.success) {
        // Update local state
        setPosts(prevPosts => 
          prevPosts.map(post => 
            post._id === postId 
              ? { ...post, likes: response.data.likes }
              : post
          )
        );

        // Update liked posts set
        setLikedPosts(prev => {
          const newSet = new Set(prev);
          if (newSet.has(postId)) {
            newSet.delete(postId);
          } else {
            newSet.add(postId);
          }
          return newSet;
        });
      }
    } catch (error) {
      console.error('Failed to like post:', error);
    }
  };

  const handleStartChat = async (userId: string) => {
    try {
      const response = await apiClient.createChat(userId);
      if (response.success && response.data?._id) {
        navigate(`/chat/${response.data._id}`);
      } else {
        console.error('Failed to create chat:', response);
      }
    } catch (error) {
      console.error('Failed to start chat:', error);
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

  const isLiked = (postId: string) => likedPosts.has(postId);

  if (loading || isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Navigation */}
      <nav className="border-b border-border bg-card/50 backdrop-blur-sm sticky top-0 z-50">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Heart className="w-7 h-7 text-primary" />
            <span className="text-xl font-display font-semibold">ConnectPlus</span>
          </div>
          <div className="flex items-center gap-4">
            <Link to="/">
              <Button variant="ghost" size="sm">
                <ArrowLeft className="w-4 h-4 mr-2" />
                Back
              </Button>
            </Link>
            <Link to="/profile">
              <Button variant="ghost" size="sm">
                <User className="w-4 h-4 mr-2" />
                Profile
              </Button>
            </Link>
            <Link to="/timeline">
              <Button variant="ghost" size="sm">
                My Timeline
              </Button>
            </Link>
          </div>
        </div>
      </nav>

      {/* Main Content */}
      <main className="container max-w-2xl mx-auto px-4 py-6">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-display font-semibold mb-2">Discover People</h1>
          <p className="text-muted-foreground">See what's happening in the community</p>
        </div>

        {posts.length === 0 ? (
          <Card className="border-border/50">
            <CardContent className="text-center py-12">
              <Users className="w-16 h-16 text-muted-foreground/30 mx-auto mb-4" />
              <h3 className="text-lg font-semibold mb-2">No compatible profiles found</h3>
              <p className="text-muted-foreground mb-4">
                There are no profiles from the opposite gender in your area yet.
              </p>
              <div className="space-y-2">
                <Link to="/timeline">
                  <Button variant="outline" className="mr-2">
                    <Heart className="w-4 h-4 mr-2" />
                    Create a Post
                  </Button>
                </Link>
                <Link to="/profile">
                  <Button>
                    <User className="w-4 h-4 mr-2" />
                    Update Profile
                  </Button>
                </Link>
              </div>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-6">
            {posts.map((post) => (
              <Card key={post._id} className="border-border/50 shadow-sm overflow-hidden">
                {/* User Profile Header - Facebook Style */}
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      <Avatar className="w-12 h-12 border-2 border-primary/10">
                        <AvatarImage 
                          src={post.profile.avatarUrl || ''} 
                          alt={post.profile.fullName} 
                        />
                        <AvatarFallback className="bg-primary/10 text-primary font-semibold">
                          {post.profile.fullName.split(' ').map(n => n[0]).join('')}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex-1">
                        <h3 className="font-semibold text-lg leading-tight">{post.profile.fullName}</h3>
                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                          <span className="capitalize">{post.profile.gender}</span>
                          {post.profile.location && (
                            <>
                              <span>•</span>
                              <div className="flex items-center gap-1">
                                <MapPin className="w-3 h-3" />
                                <span>{post.profile.location}</span>
                              </div>
                            </>
                          )}
                          <span>•</span>
                          <span>{formatDate(post.createdAt)}</span>
                        </div>
                        {post.profile.bio && (
                          <p className="text-sm text-muted-foreground mt-1 line-clamp-2">
                            {post.profile.bio}
                          </p>
                        )}
                      </div>
                    </div>
                    <Button variant="ghost" size="icon" className="text-muted-foreground">
                      <MoreHorizontal className="w-4 h-4" />
                    </Button>
                  </div>
                </CardHeader>

                {/* Post Image */}
                {post.imageUrl && (
                  <div className="relative">
                    <img 
                      src={post.imageUrl} 
                      alt={post.caption}
                      className="w-full h-auto max-h-[600px] object-cover"
                    />
                  </div>
                )}

                {/* Post Content */}
                <CardContent className="pt-4">
                  {post.caption && (
                    <p className="text-sm whitespace-pre-wrap mb-4 leading-relaxed">
                      {post.caption}
                    </p>
                  )}
                  
                  {/* Action Buttons */}
                  <div className="flex items-center justify-between py-2 border-b border-border/50">
                    <div className="flex items-center gap-4">
                      <Button 
                        variant="ghost" 
                        size="sm"
                        onClick={() => handleLike(post._id)}
                        className={`flex items-center gap-2 ${isLiked(post._id) ? 'text-red-500 hover:text-red-600' : 'text-muted-foreground hover:text-foreground'}`}
                      >
                        <Heart className={`w-4 h-4 ${isLiked(post._id) ? 'fill-current' : ''}`} />
                        <span className="text-sm">{post.likes.length}</span>
                      </Button>
                      
                      <Button variant="ghost" size="sm" className="flex items-center gap-2 text-muted-foreground hover:text-foreground">
                        <MessageCircle className="w-4 h-4" />
                        <span className="text-sm">{post.comments.length}</span>
                      </Button>
                    </div>
                    
                    <div className="flex items-center gap-2">
                      <Button variant="ghost" size="icon" className="text-muted-foreground hover:text-foreground">
                        <Share className="w-4 h-4" />
                      </Button>
                      <Button variant="ghost" size="icon" className="text-muted-foreground hover:text-foreground">
                        <Bookmark className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>

                  {/* Quick Actions */}
                  <div className="flex items-center gap-2 mt-3">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleStartChat(post.userId._id)}
                      className="flex-1"
                    >
                      <MessageCircle className="w-4 h-4 mr-2" />
                      Message
                    </Button>
                    <Button
                      variant="outline"
                      size="icon"
                      title="Voice Call"
                      onClick={() => {/* TODO: Implement voice call */}}
                    >
                      <Phone className="w-4 h-4" />
                    </Button>
                    <Button
                      variant="outline"
                      size="icon"
                      title="Video Call"
                      onClick={() => {/* TODO: Implement video call */}}
                    >
                      <Video className="w-4 h-4" />
                    </Button>
                  </div>

                  {/* Recent Comments */}
                  {post.comments.length > 0 && (
                    <div className="mt-4 pt-3 border-t border-border/50">
                      <div className="space-y-3">
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
                              <div className="bg-muted/50 rounded-lg px-3 py-2">
                                <div className="font-medium text-sm">{comment.profile.fullName}</div>
                                <div className="text-sm">{comment.content}</div>
                              </div>
                              <div className="flex items-center gap-4 mt-1 text-xs text-muted-foreground">
                                <span>{formatDate(comment.createdAt)}</span>
                                <Button variant="ghost" size="sm" className="h-auto p-0 text-xs">
                                  Like
                                </Button>
                                <Button variant="ghost" size="sm" className="h-auto p-0 text-xs">
                                  Reply
                                </Button>
                              </div>
                            </div>
                          </div>
                        ))}
                        {post.comments.length > 2 && (
                          <Button variant="ghost" size="sm" className="text-muted-foreground text-sm">
                            View all {post.comments.length} comments
                          </Button>
                        )}
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}