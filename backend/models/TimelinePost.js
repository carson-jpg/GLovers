import mongoose from 'mongoose';

const commentSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  profile: {
    fullName: String,
    avatarUrl: String
  },
  content: {
    type: String,
    required: true,
    maxlength: 500
  }
}, {
  timestamps: true
});

const timelinePostSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  profile: {
    _id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Profile'
    },
    fullName: {
      type: String,
      required: true
    },
    avatarUrl: String,
    location: String
  },
  imageUrl: {
    type: String,
    required: true
  },
  caption: {
    type: String,
    maxlength: 500
  },
  likes: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }],
  comments: [commentSchema],
  isActive: {
    type: Boolean,
    default: true
  }
}, {
  timestamps: true
});

// Update profile snapshot when post is created
timelinePostSchema.pre('save', async function(next) {
  if (this.isNew) {
    try {
      // Get the latest profile data
      const Profile = mongoose.model('Profile');
      const profile = await Profile.findOne({ userId: this.userId });
      
      if (profile) {
        this.profile = {
          _id: profile._id,
          fullName: profile.fullName,
          avatarUrl: profile.avatarUrl,
          location: profile.location
        };
      }
    } catch (error) {
      console.error('Error fetching profile for timeline post:', error);
    }
  }
  next();
});

// Index for efficient queries
timelinePostSchema.index({ createdAt: -1 });
timelinePostSchema.index({ userId: 1, createdAt: -1 });
timelinePostSchema.index({ 'likes': 1 });

const TimelinePost = mongoose.model('TimelinePost', timelinePostSchema);

export default TimelinePost;