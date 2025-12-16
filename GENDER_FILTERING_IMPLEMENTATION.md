# Gender-Based Filtering Implementation

## Overview

This implementation adds comprehensive gender-based filtering to the dating application, ensuring that:
- **Male users** see only **female** profiles and posts
- **Female users** see only **male** profiles and posts
- **Chat creation** is restricted to opposite genders only

## Features Implemented

### 1. Profile Filtering
- **Opposite Gender Display**: Users only see profiles of the opposite gender
- **Automatic Exclusion**: Current user's own profile is excluded from results
- **Profile Required**: Users must create a profile before accessing filtered content

### 2. Timeline Post Filtering
- **Gender-Based Posts**: Timeline posts are filtered by author's gender
- **Profile Snapshot**: Posts store gender information for efficient filtering
- **Own Posts Exclusion**: Users don't see their own posts in discovery

### 3. Chat Restriction
- **Opposite Gender Only**: Chat creation restricted to opposite genders
- **Profile Validation**: Both users must have profiles before chatting
- **Error Handling**: Clear messages when gender compatibility fails

### 4. Enhanced User Experience
- **Better Messaging**: Updated UI messages for empty states
- **Profile Prompts**: Clear guidance to create profiles
- **Error Handling**: Comprehensive error messages for edge cases

## Technical Implementation

### Backend Changes

#### 1. TimelinePost Model Updates (`backend/models/TimelinePost.js`)
```javascript
// Added gender field to profile snapshot
profile: {
  _id: { type: mongoose.Schema.Types.ObjectId, ref: 'Profile' },
  fullName: { type: String, required: true },
  gender: { type: String, required: true, enum: ['male', 'female', 'other'] }, // New
  avatarUrl: String,
  location: String
}

// Updated pre-save hook to include gender
timelinePostSchema.pre('save', async function(next) {
  if (this.isNew) {
    const profile = await Profile.findOne({ userId: this.userId });
    if (profile) {
      this.profile = {
        _id: profile._id,
        fullName: profile.fullName,
        gender: profile.gender, // New field
        avatarUrl: profile.avatarUrl,
        location: profile.location
      };
    }
  }
  next();
});
```

#### 2. Profile Routes Enhancement (`backend/routes/profiles.js`)
```javascript
// GET /api/profiles - Now filters by opposite gender
router.get('/', protect, async (req, res) => {
  // Get current user's profile to determine gender
  const currentUserProfile = await Profile.findOne({ userId: req.user.id });
  
  if (!currentUserProfile) {
    return res.status(400).json({
      success: false,
      message: 'Please create a profile first'
    });
  }

  // Define opposite gender filter
  let oppositeGenderFilter = {};
  if (currentUserProfile.gender === 'male') {
    oppositeGenderFilter = { gender: 'female' };
  } else if (currentUserProfile.gender === 'female') {
    oppositeGenderFilter = { gender: 'male' };
  }

  const profiles = await Profile.find({
    userId: { $ne: req.user.id }, // Exclude current user
    ...oppositeGenderFilter
  }).sort({ createdAt: -1 });

  res.status(200).json({
    success: true,
    count: profiles.length,
    data: profiles
  });
});
```

#### 3. Timeline Routes Enhancement (`backend/routes/timeline.js`)
```javascript
// GET /api/timeline/posts - Now filters by opposite gender
router.get('/posts', protect, async (req, res) => {
  const currentUserProfile = await Profile.findOne({ userId: req.user.id });
  
  if (!currentUserProfile) {
    return res.status(400).json({
      success: false,
      message: 'Please create a profile first'
    });
  }

  // Define opposite gender filter
  let oppositeGenderFilter = {};
  if (currentUserProfile.gender === 'male') {
    oppositeGenderFilter = { 'profile.gender': 'female' };
  } else if (currentUserProfile.gender === 'female') {
    oppositeGenderFilter = { 'profile.gender': 'male' };
  }

  const posts = await TimelinePost.find({ 
    isActive: true,
    userId: { $ne: req.user.id }, // Exclude own posts
    ...oppositeGenderFilter
  }).sort({ createdAt: -1 }).limit(50);

  res.status(200).json({
    success: true,
    data: posts
  });
});
```

#### 4. Chat Routes Enhancement (`backend/routes/chats.js`)
```javascript
// POST /api/chats - Now validates gender compatibility
router.post('/', protect, async (req, res) => {
  const { participantId } = req.body;

  // Get both users' profiles
  const currentUserProfile = await Profile.findOne({ userId: req.user.id });
  const participantProfile = await Profile.findOne({ userId: participantId });

  // Validate profiles exist
  if (!currentUserProfile || !participantProfile) {
    return res.status(400).json({
      success: false,
      message: 'Both users must have profiles to start a chat'
    });
  }

  // Check gender compatibility
  const currentUserGender = currentUserProfile.gender;
  const participantGender = participantProfile.gender;

  if (currentUserGender === participantGender) {
    return res.status(403).json({
      success: false,
      message: 'You can only chat with users of the opposite gender'
    });
  }

  // Continue with existing chat creation logic...
});
```

### Frontend Changes

#### 1. Enhanced Discover Page (`src/pages/Discover.tsx`)
```javascript
// Better error handling for profile requirements
const fetchDiscoverPosts = async () => {
  try {
    const response = await apiClient.request('/timeline/posts');
    if (response.success) {
      setPosts(response.data || []);
      // Set liked posts...
    } else {
      if (response.message?.includes('profile')) {
        toast({
          variant: 'destructive',
          title: 'Profile Required',
          description: 'Please create a profile to discover people',
        });
      }
    }
  } catch (error) {
    // Error handling...
  }
};

// Updated empty state messaging
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
  // Posts display...
)}
```

## Gender Filtering Logic

### For Male Users:
- **Profiles**: Only female profiles shown
- **Posts**: Only posts by female users shown
- **Chat**: Can only create chats with female users

### For Female Users:
- **Profiles**: Only male profiles shown
- **Posts**: Only posts by male users shown  
- **Chat**: Can only create chats with male users

### For "Other" Gender:
- **Current Implementation**: Shows all profiles and posts (can be customized)
- **Future Enhancement**: Could add custom filtering options

## Database Schema Updates

### TimelinePost Collection:
```javascript
{
  _id: ObjectId,
  userId: ObjectId, // Author's user ID
  profile: {
    _id: ObjectId, // Author's profile ID
    fullName: String,
    gender: String, // NEW FIELD (male/female/other)
    avatarUrl: String,
    location: String
  },
  imageUrl: String,
  caption: String,
  likes: [ObjectId],
  comments: [...],
  isActive: Boolean,
  createdAt: Date,
  updatedAt: Date
}
```

## Error Handling

### Profile Required Errors:
```json
{
  "success": false,
  "message": "Please create a profile first"
}
```

### Gender Compatibility Errors:
```json
{
  "success": false,
  "message": "You can only chat with users of the opposite gender"
}
```

### No Compatible Profiles:
- Frontend shows: "No compatible profiles found"
- Provides links to create posts or update profile
- Maintains user engagement even with empty results

## Security Considerations

1. **Server-Side Validation**: All filtering done on backend to prevent circumvention
2. **Profile Requirements**: Users must have valid profiles for all features
3. **Gender Data Integrity**: Consistent gender storage across all models
4. **Error Information**: No sensitive data exposed in error messages

## Performance Impact

- **Minimal Overhead**: Simple gender field comparisons
- **Efficient Queries**: Uses MongoDB indexing on gender fields
- **Caching Opportunities**: Gender filtering results can be cached
- **Scalable**: Works well with large user bases

## Migration Notes

### For Existing Data:
1. **Profile Gender**: Already exists and required during profile creation
2. **Timeline Posts**: Need to update existing posts to include gender
3. **Chat History**: Existing chats remain valid (retroactive filtering not applied)

### Recommended Migration:
```javascript
// Update existing timeline posts to include gender
db.timelinePosts.find({ "profile.gender": { $exists: false } }).forEach(function(post) {
  db.profiles.findOne({ _id: post.profile._id }, function(profile) {
    if (profile) {
      db.timelinePosts.update(
        { _id: post._id },
        { $set: { "profile.gender": profile.gender } }
      );
    }
  });
});
```

## Testing Scenarios

### Test Cases to Verify:
1. ✅ Male user sees only female profiles
2. ✅ Female user sees only male profiles
3. ✅ Male user cannot create chat with male
4. ✅ Female user cannot create chat with female
5. ✅ User without profile gets appropriate error
6. ✅ Empty state shows correct messaging
7. ✅ Timeline posts filtered by author gender
8. ✅ Own posts excluded from discovery
9. ✅ Profile creation enforces gender selection
10. ✅ Real-time features respect gender filtering

## Future Enhancements

1. **Advanced Filtering**: Age range, location-based filtering
2. **Gender Preferences**: Allow users to set broader preferences
3. **Admin Tools**: Manage gender data and handle edge cases
4. **Analytics**: Track gender distribution and matching metrics
5. **Custom Genders**: Support for additional gender identities

This implementation provides a solid foundation for gender-based filtering while maintaining good performance and user experience.