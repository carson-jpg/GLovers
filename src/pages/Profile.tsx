import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { apiClient } from '@/integrations/api/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { useToast } from '@/hooks/use-toast';
import { Heart, Loader2, ArrowLeft, Upload, X, Edit, Save, Camera } from 'lucide-react';
import { Link } from 'react-router-dom';
import { z } from 'zod';

const profileSchema = z.object({
  fullName: z.string().min(2, 'Name must be at least 2 characters').max(100),
  location: z.string().max(100).optional(),
  bio: z.string().max(500).optional(),
  interests: z.string().max(500).optional(),
});

interface Profile {
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

export default function Profile() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  
  const [profile, setProfile] = useState<Profile | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  
  // Edit form state
  const [fullName, setFullName] = useState('');
  const [location, setLocation] = useState('');
  const [bio, setBio] = useState('');
  const [interests, setInterests] = useState('');
  
  // Photo upload state
  const [selectedPhoto, setSelectedPhoto] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (!loading && !user) {
      navigate('/auth');
    }
  }, [user, loading, navigate]);

  useEffect(() => {
    if (user) {
      fetchProfile();
    }
  }, [user]);

  const fetchProfile = async () => {
    try {
      setIsLoading(true);
      const response = await apiClient.getMyProfile();
      
      if (response.success && response.data) {
        const profileData = response.data;
        setProfile(profileData);
        
        // Populate form fields
        setFullName(profileData.fullName || '');
        setLocation(profileData.location || '');
        setBio(profileData.bio || '');
        setInterests(profileData.interests?.join(', ') || '');
      }
    } catch (error) {
      console.error('Failed to fetch profile:', error);
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'Failed to load profile',
      });
      navigate('/create-profile');
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

      // Validate file size (5MB limit)
      if (file.size > 5 * 1024 * 1024) {
        toast({
          variant: 'destructive',
          title: 'File too large',
          description: 'Please select an image smaller than 5MB.',
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

  const uploadPhoto = async () => {
    if (!selectedPhoto) return;
    
    try {
      setIsUploading(true);
      await apiClient.uploadAvatar(selectedPhoto);
      
      toast({
        title: 'Photo uploaded!',
        description: 'Your profile photo has been updated.',
      });
      
      // Refresh profile data
      await fetchProfile();
      removePhoto();
    } catch (error) {
      console.error('Photo upload failed:', error);
      toast({
        variant: 'destructive',
        title: 'Upload failed',
        description: 'Failed to upload photo. Please try again.',
      });
    } finally {
      setIsUploading(false);
    }
  };

  const handleSave = async () => {
    try {
      const validatedData = profileSchema.parse({
        fullName,
        location: location || undefined,
        bio: bio || undefined,
        interests: interests || undefined,
      });
      
      setErrors({});
      setIsSaving(true);

      const interestsArray = interests
        ? interests.split(',').map(i => i.trim()).filter(Boolean)
        : [];

      const profileData = {
        fullName: validatedData.fullName,
        location: validatedData.location,
        bio: validatedData.bio,
        interests: interestsArray,
      };

      const response = await apiClient.updateProfile(profileData);

      if (response.success) {
        setProfile(response.data);
        setIsEditing(false);
        toast({
          title: 'Profile updated!',
          description: 'Your profile has been saved.',
        });
      } else {
        toast({
          variant: 'destructive',
          title: 'Error updating profile',
          description: response.message || 'Something went wrong',
        });
      }
    } catch (err) {
      if (err instanceof z.ZodError) {
        const newErrors: Record<string, string> = {};
        err.errors.forEach((e) => {
          if (e.path[0]) {
            newErrors[e.path[0] as string] = e.message;
          }
        });
        setErrors(newErrors);
      } else {
        toast({
          variant: 'destructive',
          title: 'Error updating profile',
          description: 'An unexpected error occurred',
        });
      }
    } finally {
      setIsSaving(false);
    }
  };

  const handleCancel = () => {
    if (profile) {
      setFullName(profile.fullName || '');
      setLocation(profile.location || '');
      setBio(profile.bio || '');
      setInterests(profile.interests?.join(', ') || '');
    }
    setIsEditing(false);
    setErrors({});
  };

  if (loading || isLoading) {
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
          <p className="text-muted-foreground mb-4">No profile found</p>
          <Link to="/create-profile">
            <Button>Create Profile</Button>
          </Link>
        </div>
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
          
          <div className="flex gap-2">
            {!isEditing ? (
              <Button onClick={() => setIsEditing(true)}>
                <Edit className="w-4 h-4 mr-2" />
                Edit Profile
              </Button>
            ) : (
              <div className="flex gap-2">
                <Button variant="outline" onClick={handleCancel}>
                  Cancel
                </Button>
                <Button onClick={handleSave} disabled={isSaving}>
                  {isSaving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Save className="w-4 h-4 mr-2" />}
                  Save Changes
                </Button>
              </div>
            )}
          </div>
        </div>

        <div className="grid lg:grid-cols-3 gap-8">
          {/* Profile Info Card */}
          <div className="lg:col-span-2">
            <Card className="border-border/50 shadow-lg">
              <CardHeader>
                <CardTitle>Profile Information</CardTitle>
                <CardDescription>
                  {isEditing ? 'Update your profile details' : 'Your profile information'}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                {isEditing ? (
                  <>
                    <div className="space-y-2">
                      <Label htmlFor="fullName">Full Name *</Label>
                      <Input
                        id="fullName"
                        placeholder="Your full name"
                        value={fullName}
                        onChange={(e) => setFullName(e.target.value)}
                        required
                      />
                      {errors.fullName && <p className="text-sm text-destructive">{errors.fullName}</p>}
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label>Age</Label>
                        <div className="text-sm text-muted-foreground">{profile.age} years old</div>
                      </div>
                      <div className="space-y-2">
                        <Label>Gender</Label>
                        <div className="text-sm text-muted-foreground capitalize">{profile.gender}</div>
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="location">Location</Label>
                      <Input
                        id="location"
                        placeholder="e.g., Nairobi, Kenya"
                        value={location}
                        onChange={(e) => setLocation(e.target.value)}
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="bio">About You</Label>
                      <Textarea
                        id="bio"
                        placeholder="Tell others about yourself..."
                        value={bio}
                        onChange={(e) => setBio(e.target.value)}
                        rows={4}
                      />
                      <p className="text-xs text-muted-foreground">{bio.length}/500 characters</p>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="interests">Interests</Label>
                      <Input
                        id="interests"
                        placeholder="e.g., Music, Travel, Movies (comma-separated)"
                        value={interests}
                        onChange={(e) => setInterests(e.target.value)}
                      />
                      <p className="text-xs text-muted-foreground">Separate interests with commas</p>
                    </div>
                  </>
                ) : (
                  <>
                    <div className="space-y-4">
                      <div>
                        <Label className="text-sm font-medium text-muted-foreground">Full Name</Label>
                        <p className="text-lg">{profile.fullName}</p>
                      </div>
                      
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <Label className="text-sm font-medium text-muted-foreground">Age</Label>
                          <p>{profile.age} years old</p>
                        </div>
                        <div>
                          <Label className="text-sm font-medium text-muted-foreground">Gender</Label>
                          <p className="capitalize">{profile.gender}</p>
                        </div>
                      </div>
                      
                      {profile.location && (
                        <div>
                          <Label className="text-sm font-medium text-muted-foreground">Location</Label>
                          <p>{profile.location}</p>
                        </div>
                      )}
                      
                      {profile.bio && (
                        <div>
                          <Label className="text-sm font-medium text-muted-foreground">About</Label>
                          <p className="whitespace-pre-wrap">{profile.bio}</p>
                        </div>
                      )}
                      
                      {profile.interests && profile.interests.length > 0 && (
                        <div>
                          <Label className="text-sm font-medium text-muted-foreground">Interests</Label>
                          <div className="flex flex-wrap gap-2 mt-1">
                            {profile.interests.map((interest, index) => (
                              <span
                                key={index}
                                className="px-2 py-1 bg-primary/10 text-primary text-sm rounded-full"
                              >
                                {interest}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  </>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Photo Section */}
          <div>
            <Card className="border-border/50 shadow-lg">
              <CardHeader>
                <CardTitle>Profile Photo</CardTitle>
                <CardDescription>
                  {isEditing ? 'Upload a new photo' : 'Your profile picture'}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="flex justify-center">
                    <Avatar className="w-32 h-32">
                      <AvatarImage 
                        src={photoPreview || profile.avatarUrl || ''} 
                        alt={profile.fullName} 
                      />
                      <AvatarFallback className="text-2xl">
                        {profile.fullName.split(' ').map(n => n[0]).join('')}
                      </AvatarFallback>
                    </Avatar>
                  </div>
                  
                  {isEditing && (
                    <>
                      <div className="space-y-2">
                        <input
                          id="photo-upload"
                          type="file"
                          accept="image/*"
                          onChange={handlePhotoChange}
                          className="hidden"
                        />
                        <div className="flex gap-2">
                          <Button
                            type="button"
                            variant="outline"
                            onClick={() => document.getElementById('photo-upload')?.click()}
                            className="flex-1"
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
                        <p className="text-xs text-muted-foreground text-center">
                          JPG, PNG up to 5MB
                        </p>
                      </div>
                      
                      {selectedPhoto && (
                        <Button 
                          onClick={uploadPhoto} 
                          disabled={isUploading}
                          className="w-full"
                        >
                          {isUploading ? (
                            <Loader2 className="w-4 h-4 animate-spin mr-2" />
                          ) : (
                            <Upload className="w-4 h-4 mr-2" />
                          )}
                          Upload Photo
                        </Button>
                      )}
                    </>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}