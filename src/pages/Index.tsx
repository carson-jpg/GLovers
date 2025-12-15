import { useEffect, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { apiClient } from '@/integrations/api/client';
import { Button } from '@/components/ui/button';
import { Heart, Users, Shield, Crown, Loader2, LogOut, MessageCircle, Phone, Video, User, ImageIcon, Compass } from 'lucide-react';

interface Profile {
  _id: string;
  userId: {
    _id: string;
    email: string;
  };
  fullName: string;
  gender: string;
  location: string | null;
  bio: string | null;
  avatarUrl: string | null;
}

export default function Index() {
  const { user, loading, signOut } = useAuth();
  const navigate = useNavigate();
  const [hasProfile, setHasProfile] = useState<boolean | null>(null);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [loadingProfiles, setLoadingProfiles] = useState(false);

  useEffect(() => {
    if (!loading && user) {
      checkProfile();
      fetchProfiles();
    }
  }, [user, loading]);

  const checkProfile = async () => {
    if (!user) return;
    
    try {
      const response = await apiClient.getMyProfile();
      setHasProfile(!!response.data);
    } catch (error) {
      // If user doesn't have a profile, API will return an error
      setHasProfile(false);
    }
  };

  const fetchProfiles = async () => {
    setLoadingProfiles(true);
    try {
      const response = await apiClient.getAllProfiles();
      setProfiles(response.data || []);
    } catch (error) {
      console.error('Failed to fetch profiles:', error);
      setProfiles([]);
    }
    setLoadingProfiles(false);
  };

  const handleStartChat = async (profileId: string) => {
    try {
      // Create or get the chat first
      const response = await apiClient.createChat(profileId);
      if (response.success && response.data?._id) {
        navigate(`/chat/${response.data._id}`);
      } else {
        console.error('Failed to create chat:', response);
      }
    } catch (error) {
      console.error('Failed to start chat:', error);
    }
  };

  // Not logged in - show landing page
  if (!loading && !user) {
    return (
      <div className="min-h-screen bg-background">
        {/* Hero Section */}
        <header className="relative overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-background to-accent/10" />
          
          <nav className="relative z-10 container mx-auto px-4 py-6 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Heart className="w-8 h-8 text-primary" />
              <span className="text-2xl font-display font-semibold">ConnectPlus</span>
            </div>
            <div className="flex items-center gap-4">
              <Link to="/auth">
                <Button variant="ghost">Sign In</Button>
              </Link>
              <Link to="/auth">
                <Button>Get Started</Button>
              </Link>
            </div>
          </nav>

          <div className="relative z-10 container mx-auto px-4 py-24 text-center">
            <h1 className="text-5xl md:text-6xl font-display font-semibold text-foreground mb-6 animate-fade-in">
              Find Your <span className="text-primary">Perfect Match</span>
            </h1>
            <p className="text-xl text-muted-foreground max-w-2xl mx-auto mb-8 animate-fade-in" style={{ animationDelay: '0.1s' }}>
              Connect with genuine people looking for meaningful relationships. 
              Safe, secure, and designed for the Kenyan community.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center animate-fade-in" style={{ animationDelay: '0.2s' }}>
              <Link to="/auth">
                <Button size="lg" className="text-lg px-8">
                  <Heart className="w-5 h-5 mr-2" />
                  Start Your Journey
                </Button>
              </Link>
            </div>
          </div>
        </header>

        {/* Features Section */}
        <section className="py-24 bg-secondary/30">
          <div className="container mx-auto px-4">
            <h2 className="text-3xl font-display font-semibold text-center mb-16">
              Why Choose ConnectPlus?
            </h2>
            <div className="grid md:grid-cols-3 gap-8">
              <FeatureCard
                icon={<Shield className="w-8 h-8" />}
                title="Safe & Secure"
                description="Your privacy is our priority. All data is encrypted and profiles are verified."
              />
              <FeatureCard
                icon={<Users className="w-8 h-8" />}
                title="Real Connections"
                description="Connect with genuine people looking for meaningful relationships."
              />
              <FeatureCard
                icon={<Crown className="w-8 h-8" />}
                title="Premium Features"
                description="Unlock unlimited messaging and profile views with affordable plans."
              />
            </div>
          </div>
        </section>

        {/* Pricing Preview */}
        <section className="py-24">
          <div className="container mx-auto px-4 text-center">
            <h2 className="text-3xl font-display font-semibold mb-4">
              Affordable Plans
            </h2>
            <p className="text-muted-foreground mb-12 max-w-xl mx-auto">
              Choose a plan that works for you. Pay easily with M-Pesa.
            </p>
            <div className="grid md:grid-cols-2 gap-8 max-w-2xl mx-auto">
              <PricingCard
                title="Weekly"
                price="KES 200"
                period="7 days"
                features={['Unlimited messaging', 'View all profiles', 'Priority support']}
              />
              <PricingCard
                title="Monthly"
                price="KES 400"
                period="30 days"
                features={['Unlimited messaging', 'View all profiles', 'Priority support', 'Best value']}
                highlighted
              />
            </div>
          </div>
        </section>

        {/* Footer */}
        <footer className="py-12 border-t border-border">
          <div className="container mx-auto px-4 text-center">
            <div className="flex items-center justify-center gap-2 mb-4">
              <Heart className="w-6 h-6 text-primary" />
              <span className="text-xl font-display font-semibold">ConnectPlus</span>
            </div>
            <p className="text-sm text-muted-foreground">
              © 2024 ConnectPlus. All rights reserved. 18+ only.
            </p>
          </div>
        </footer>
      </div>
    );
  }

  // Loading state
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  // Logged in - show dashboard
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
            {hasProfile === false && (
              <Link to="/create-profile">
                <Button size="sm">Complete Profile</Button>
              </Link>
            )}
            <Link to="/profile">
              <Button variant="ghost" size="sm">
                <User className="w-4 h-4 mr-2" />
                Profile
              </Button>
            </Link>
            <Link to="/discover">
              <Button variant="ghost" size="sm">
                <Compass className="w-4 h-4 mr-2" />
                Discover
              </Button>
            </Link>
            <Link to="/timeline">
              <Button variant="ghost" size="sm">
                <ImageIcon className="w-4 h-4 mr-2" />
                Timeline
              </Button>
            </Link>
            <Link to="/inbox">
              <Button variant="ghost" size="sm">
                <MessageCircle className="w-4 h-4 mr-2" />
                Inbox
              </Button>
            </Link>
            <Link to="/subscription">
              <Button variant="outline" size="sm">
                <Crown className="w-4 h-4 mr-2" />
                Subscribe
              </Button>
            </Link>
            <Button variant="ghost" size="sm" onClick={signOut}>
              <LogOut className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </nav>

      {/* Main Content */}
      <main className="container mx-auto px-4 py-8">
        {hasProfile === false && (
          <div className="mb-8 p-6 rounded-xl bg-accent/50 border border-accent-foreground/10">
            <h2 className="text-lg font-semibold mb-2">Complete Your Profile</h2>
            <p className="text-muted-foreground mb-4">
              Create your profile to start connecting with others.
            </p>
            <Link to="/create-profile">
              <Button>Create Profile</Button>
            </Link>
          </div>
        )}

        <div className="mb-8">
          <h1 className="text-3xl font-display font-semibold mb-2">Discover People</h1>
          <p className="text-muted-foreground">Find your perfect match</p>
        </div>

        {loadingProfiles ? (
          <div className="flex justify-center py-12">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
          </div>
        ) : profiles.length > 0 ? (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {profiles.map((profile) => (
              <ProfileCard key={profile._id} profile={profile} onStartChat={handleStartChat} />
            ))}
          </div>
        ) : (
          <div className="text-center py-12">
            <Users className="w-16 h-16 text-muted-foreground/30 mx-auto mb-4" />
            <h3 className="text-lg font-semibold mb-2">No profiles yet</h3>
            <p className="text-muted-foreground">Be the first to create your profile!</p>
          </div>
        )}
      </main>
    </div>
  );
}

function FeatureCard({ icon, title, description }: { icon: React.ReactNode; title: string; description: string }) {
  return (
    <div className="text-center p-8 rounded-xl bg-card border border-border/50 hover:border-primary/20 transition-colors">
      <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-primary/10 text-primary mb-4">
        {icon}
      </div>
      <h3 className="text-xl font-semibold mb-2">{title}</h3>
      <p className="text-muted-foreground">{description}</p>
    </div>
  );
}

function PricingCard({ 
  title, 
  price, 
  period, 
  features, 
  highlighted = false 
}: { 
  title: string; 
  price: string; 
  period: string; 
  features: string[]; 
  highlighted?: boolean;
}) {
  return (
    <div className={`p-8 rounded-xl border ${highlighted ? 'border-primary bg-primary/5' : 'border-border bg-card'}`}>
      {highlighted && (
        <span className="inline-block px-3 py-1 text-xs font-medium bg-primary text-primary-foreground rounded-full mb-4">
          Best Value
        </span>
      )}
      <h3 className="text-xl font-semibold mb-2">{title}</h3>
      <div className="mb-4">
        <span className="text-3xl font-bold">{price}</span>
        <span className="text-muted-foreground"> / {period}</span>
      </div>
      <ul className="space-y-2 mb-6">
        {features.map((feature, i) => (
          <li key={i} className="flex items-center gap-2 text-sm">
            <Heart className="w-4 h-4 text-primary" />
            {feature}
          </li>
        ))}
      </ul>
      <Link to="/auth">
        <Button className="w-full" variant={highlighted ? 'default' : 'outline'}>
          Get Started
        </Button>
      </Link>
    </div>
  );
}

function ProfileCard({ profile, onStartChat }: { profile: Profile; onStartChat: (profileId: string) => void }) {
  const navigate = useNavigate();
  
  const handleCardClick = () => {
    // Navigate to public profile view
    navigate(`/profile/${profile.userId._id}`);
  };

  return (
    <div className="rounded-xl border border-border bg-card overflow-hidden hover:border-primary/30 transition-colors cursor-pointer" onClick={handleCardClick}>
      <div className="aspect-square bg-secondary flex items-center justify-center">
        {profile.avatarUrl ? (
          <img src={profile.avatarUrl} alt={profile.fullName} className="w-full h-full object-cover" />
        ) : (
          <Users className="w-16 h-16 text-muted-foreground/30" />
        )}
      </div>
      <div className="p-4">
        <h3 className="font-semibold text-lg">{profile.fullName}</h3>
        <p className="text-sm text-muted-foreground capitalize">{profile.gender}</p>
        {profile.location && (
          <p className="text-sm text-muted-foreground">{profile.location}</p>
        )}
        {profile.bio && (
          <p className="text-sm text-muted-foreground mt-2 line-clamp-2">{profile.bio}</p>
        )}
        
        {/* Action Buttons */}
        <div className="flex gap-2 mt-4">
          <Button
            size="sm"
            className="flex-1"
            onClick={(e) => {
              e.stopPropagation(); // Prevent card click
              onStartChat(profile.userId._id);
            }}
          >
            <MessageCircle className="w-4 h-4 mr-2" />
            Chat
          </Button>
          <Button
            variant="outline"
            size="icon"
            title="Voice Call"
            onClick={(e) => e.stopPropagation()}
          >
            <Phone className="w-4 h-4" />
          </Button>
          <Button
            variant="outline"
            size="icon"
            title="Video Call"
            onClick={(e) => e.stopPropagation()}
          >
            <Video className="w-4 h-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}