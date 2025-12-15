import express from 'express';
import { body, validationResult } from 'express-validator';
import multer from 'multer';
import Profile from '../models/Profile.js';
import { protect } from '../middleware/auth.js';
import { uploadImage } from '../services/cloudinaryService.js';

const router = express.Router();

// Configure multer for memory storage
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB limit
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

// @route   POST /api/profiles
// @desc    Create a new profile
// @access  Private
router.post(
  '/',
  [
    protect,
    body('fullName')
      .trim()
      .isLength({ min: 2, max: 100 })
      .withMessage('Full name must be between 2 and 100 characters'),
    body('dateOfBirth')
      .isISO8601()
      .withMessage('Please provide a valid date'),
    body('gender')
      .isIn(['male', 'female', 'other'])
      .withMessage('Please select a valid gender'),
    body('location')
      .optional()
      .trim()
      .isLength({ max: 100 })
      .withMessage('Location must be less than 100 characters'),
    body('bio')
      .optional()
      .trim()
      .isLength({ max: 500 })
      .withMessage('Bio must be less than 500 characters'),
    body('interests')
      .optional()
      .isArray()
      .withMessage('Interests must be an array')
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        errors: errors.array()
      });
    }

    const { fullName, dateOfBirth, gender, location, bio, interests, avatarUrl } = req.body;

    try {
      // Check if profile already exists
      const existingProfile = await Profile.findOne({ userId: req.user.id });
      if (existingProfile) {
        return res.status(400).json({
          success: false,
          message: 'Profile already exists for this user'
        });
      }

      // Calculate age
      const birthDate = new Date(dateOfBirth);
      const today = new Date();
      const age = today.getFullYear() - birthDate.getFullYear();
      const monthDiff = today.getMonth() - birthDate.getMonth();

      if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
        age--;
      }

      if (age < 18) {
        return res.status(400).json({
          success: false,
          message: 'You must be 18 or older to create a profile'
        });
      }

      const profile = await Profile.create({
        userId: req.user.id,
        fullName,
        dateOfBirth,
        gender,
        location,
        bio,
        interests,
        avatarUrl
      });

      res.status(201).json({
        success: true,
        data: profile
      });
    } catch (error) {
      console.error(error);
      res.status(500).json({
        success: false,
        message: 'Server error'
      });
    }
  }
);

// @route   GET /api/profiles/me
// @desc    Get current user's profile
// @access  Private
router.get('/me', protect, async (req, res) => {
  try {
    const profile = await Profile.findOne({ userId: req.user.id });

    if (!profile) {
      return res.status(404).json({
        success: false,
        message: 'Profile not found'
      });
    }

    res.status(200).json({
      success: true,
      data: profile
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

// @route   PUT /api/profiles/me
// @desc    Update current user's profile
// @access  Private
router.put(
  '/me',
  [
    protect,
    body('fullName')
      .optional()
      .trim()
      .isLength({ min: 2, max: 100 })
      .withMessage('Full name must be between 2 and 100 characters'),
    body('location')
      .optional()
      .trim()
      .isLength({ max: 100 })
      .withMessage('Location must be less than 100 characters'),
    body('bio')
      .optional()
      .trim()
      .isLength({ max: 500 })
      .withMessage('Bio must be less than 500 characters'),
    body('interests')
      .optional()
      .isArray()
      .withMessage('Interests must be an array')
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        errors: errors.array()
      });
    }

    try {
      const profile = await Profile.findOne({ userId: req.user.id });

      if (!profile) {
        return res.status(404).json({
          success: false,
          message: 'Profile not found'
        });
      }

      const allowedUpdates = ['fullName', 'location', 'bio', 'interests', 'avatarUrl'];
      const updates = {};

      allowedUpdates.forEach(field => {
        if (req.body[field] !== undefined) {
          updates[field] = req.body[field];
        }
      });

      Object.assign(profile, updates);
      await profile.save();

      res.status(200).json({
        success: true,
        data: profile
      });
    } catch (error) {
      console.error(error);
      res.status(500).json({
        success: false,
        message: 'Server error'
      });
    }
  }
);

// @route   GET /api/profiles
// @desc    Get all profiles (for browsing)
// @access  Private
router.get('/', protect, async (req, res) => {
  try {
    const profiles = await Profile.find({})
      .populate('userId', 'email')
      .sort({ createdAt: -1 });

    res.status(200).json({
      success: true,
      count: profiles.length,
      data: profiles
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

// @route   GET /api/profiles/:userId
// @desc    Get profile by user ID (public view)
// @access  Private
router.get('/:userId', protect, async (req, res) => {
  try {
    const { userId } = req.params;

    const profile = await Profile.findOne({ userId })
      .populate('userId', 'email');

    if (!profile) {
      return res.status(404).json({
        success: false,
        message: 'Profile not found'
      });
    }

    res.status(200).json({
      success: true,
      data: profile
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

// @route   POST /api/profiles/avatar
// @desc    Upload avatar image
// @access  Private
router.post('/avatar', protect, upload.single('avatar'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: 'No image file provided'
      });
    }

    // Upload to Cloudinary
    const uploadResult = await uploadImage(req.file.buffer);
    
    // Update profile with new avatar URL
    const profile = await Profile.findOne({ userId: req.user.id });
    
    if (!profile) {
      return res.status(404).json({
        success: false,
        message: 'Profile not found'
      });
    }

    profile.avatarUrl = uploadResult.secure_url;
    await profile.save();

    res.status(200).json({
      success: true,
      data: {
        avatarUrl: uploadResult.secure_url,
        publicId: uploadResult.public_id
      }
    });
  } catch (error) {
    console.error('Avatar upload error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to upload avatar'
    });
  }
});

export default router;
