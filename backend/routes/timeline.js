import express from 'express';
import { body, validationResult } from 'express-validator';
import multer from 'multer';
import TimelinePost from '../models/TimelinePost.js';
import Profile from '../models/Profile.js';
import { protect } from '../middleware/auth.js';
import { uploadImage } from '../services/cloudinaryService.js';

const router = express.Router();

// Configure multer for memory storage
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit for timeline photos
  },
  fileFilter: (req, file, cb) => {
    // Check if file is an image
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Only image files are allowed'), false);
    }
  },
});

// @route   GET /api/timeline/posts
// @desc    Get timeline posts - user's own posts plus opposite gender posts
// @access  Private
router.get('/posts', protect, async (req, res) => {
  try {
    // Get current user's profile to determine their gender
    const currentUserProfile = await Profile.findOne({ userId: req.user.id });
    
    if (!currentUserProfile) {
      return res.status(400).json({
        success: false,
        message: 'Please create a profile first'
      });
    }

    // Build filter to show user's own posts plus opposite gender posts
    let genderFilter = {};
    if (currentUserProfile.gender === 'male') {
      genderFilter = {
        $or: [
          { userId: req.user.id }, // User's own posts
          { 'profile.gender': 'female' } // Opposite gender posts
        ]
      };
    } else if (currentUserProfile.gender === 'female') {
      genderFilter = {
        $or: [
          { userId: req.user.id }, // User's own posts
          { 'profile.gender': 'male' } // Opposite gender posts
        ]
      };
    }
    // If gender is 'other', show all posts

    const posts = await TimelinePost.find({
      isActive: true,
      ...genderFilter
    })
      .populate('userId', 'email')
      .sort({ createdAt: -1 })
      .limit(50);

    res.status(200).json({
      success: true,
      data: posts
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

// @route   POST /api/timeline/posts
// @desc    Create a new timeline post
// @access  Private
router.post(
  '/posts',
  [
    protect,
    upload.single('image'),
    body('caption')
      .optional()
      .trim()
      .isLength({ max: 500 })
      .withMessage('Caption must be less than 500 characters')
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        errors: errors.array()
      });
    }

    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: 'Image file is required'
      });
    }

    const { caption } = req.body;

    try {
      // Check if Cloudinary is configured
      if (!process.env.CLOUDINARY_CLOUD_NAME || !process.env.CLOUDINARY_API_KEY || !process.env.CLOUDINARY_API_SECRET) {
        return res.status(500).json({
          success: false,
          message: 'Image upload service not configured. Please contact administrator.'
        });
      }

      // Upload image to Cloudinary
      const uploadResult = await uploadImage(req.file.buffer);
      
      // Get user's profile for snapshot
      const profile = await Profile.findOne({ userId: req.user.id });
      
      if (!profile) {
        return res.status(400).json({
          success: false,
          message: 'Profile not found. Please create your profile first.'
        });
      }

      // Create timeline post
      const post = await TimelinePost.create({
        userId: req.user.id,
        profile: {
          _id: profile._id,
          fullName: profile.fullName,
          avatarUrl: profile.avatarUrl,
          location: profile.location
        },
        imageUrl: uploadResult.secure_url,
        caption: caption?.trim() || ''
      });

      // Populate the response
      await post.populate('userId', 'email');

      res.status(201).json({
        success: true,
        data: post
      });
    } catch (error) {
      console.error('Timeline post creation error:', error);
      
      // Provide specific error messages based on error type
      let errorMessage = 'Failed to create post';
      if (error.message && error.message.includes('Cloudinary')) {
        errorMessage = 'Image upload failed. Please try again with a different image.';
      } else if (error.message && error.message.includes('profile')) {
        errorMessage = 'Profile information is required. Please complete your profile.';
      }
      
      res.status(500).json({
        success: false,
        message: errorMessage,
        error: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  }
);

// @route   POST /api/timeline/posts/:postId/like
// @desc    Like/unlike a timeline post
// @access  Private
router.post('/posts/:postId/like', protect, async (req, res) => {
  try {
    const { postId } = req.params;

    const post = await TimelinePost.findById(postId);

    if (!post) {
      return res.status(404).json({
        success: false,
        message: 'Post not found'
      });
    }

    const userId = req.user.id;
    const isLiked = post.likes.includes(userId);

    if (isLiked) {
      // Unlike the post
      post.likes = post.likes.filter(id => id.toString() !== userId);
    } else {
      // Like the post
      post.likes.push(userId);
    }

    await post.save();

    res.status(200).json({
      success: true,
      data: {
        likes: post.likes,
        isLiked: !isLiked
      }
    });
  } catch (error) {
    console.error('Like post error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to like post'
    });
  }
});

// @route   POST /api/timeline/posts/:postId/comments
// @desc    Add a comment to a timeline post
// @access  Private
router.post(
  '/posts/:postId/comments',
  [
    protect,
    body('content')
      .trim()
      .isLength({ min: 1, max: 500 })
      .withMessage('Comment must be between 1 and 500 characters')
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        errors: errors.array()
      });
    }

    const { postId } = req.params;
    const { content } = req.body;

    try {
      const post = await TimelinePost.findById(postId);

      if (!post) {
        return res.status(404).json({
          success: false,
          message: 'Post not found'
        });
      }

      // Get user's profile for comment
      const profile = await Profile.findOne({ userId: req.user.id });
      
      if (!profile) {
        return res.status(400).json({
          success: false,
          message: 'Profile not found'
        });
      }

      const comment = {
        userId: req.user.id,
        profile: {
          fullName: profile.fullName,
          avatarUrl: profile.avatarUrl
        },
        content: content.trim()
      };

      post.comments.push(comment);
      await post.save();

      // Get the newly added comment
      const newComment = post.comments[post.comments.length - 1];

      res.status(201).json({
        success: true,
        data: newComment
      });
    } catch (error) {
      console.error('Add comment error:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to add comment'
      });
    }
  }
);

// @route   DELETE /api/timeline/posts/:postId
// @desc    Delete a timeline post
// @access  Private
router.delete('/posts/:postId', protect, async (req, res) => {
  try {
    const { postId } = req.params;

    const post = await TimelinePost.findById(postId);

    if (!post) {
      return res.status(404).json({
        success: false,
        message: 'Post not found'
      });
    }

    // Check if user owns the post
    if (post.userId.toString() !== req.user.id) {
      return res.status(403).json({
        success: false,
        message: 'Access denied'
      });
    }

    // Soft delete
    post.isActive = false;
    await post.save();

    res.status(200).json({
      success: true,
      message: 'Post deleted successfully'
    });
  } catch (error) {
    console.error('Delete post error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete post'
    });
  }
});

// @route   GET /api/timeline/posts/my
// @desc    Get current user's timeline posts
// @access  Private
router.get('/posts/my', protect, async (req, res) => {
  try {
    const posts = await TimelinePost.find({
      userId: req.user.id,
      isActive: true
    })
      .sort({ createdAt: -1 });

    res.status(200).json({
      success: true,
      data: posts
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

// @route   GET /api/timeline/posts/user/:userId
// @desc    Get timeline posts by user ID
// @access  Private
router.get('/posts/user/:userId', protect, async (req, res) => {
  try {
    const { userId } = req.params;

    const posts = await TimelinePost.find({
      userId: userId,
      isActive: true
    })
      .sort({ createdAt: -1 });

    res.status(200).json({
      success: true,
      data: posts
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

export default router;