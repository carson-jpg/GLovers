import express from 'express';
import { body, validationResult } from 'express-validator';
import User from '../models/User.js';
import Subscription from '../models/Subscription.js';
import { protect } from '../middleware/auth.js';

const router = express.Router();

// Phone number validation regex patterns
const PHONE_PATTERNS = [
  /\+?\d{1,4}[-.\s]?\(?\d{1,3}\)?[-.\s]?\d{1,4}[-.\s]?\d{1,4}[-.\s]?\d{1,9}/g, // International format
  /\d{3}[-.\s]?\d{3}[-.\s]?\d{4}/g, // US format
  /\(\d{3}\)\s?\d{3}[-.\s]?\d{4}/g, // US format with parentheses
  /\+?\d{10,15}/g, // Simple 10-15 digit format
];

// @route   POST /api/phone/update
// @desc    Update user's phone number and visibility settings
// @access  Private
router.post(
  '/update',
  [
    protect,
    body('phoneNumber')
      .optional()
      .matches(/^\+?[1-9]\d{1,14}$/)
      .withMessage('Please provide a valid phone number'),
    body('phoneNumberVisibility')
      .optional()
      .isIn(['public', 'subscribers', 'private'])
      .withMessage('Visibility must be public, subscribers, or private')
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        errors: errors.array()
      });
    }

    const { phoneNumber, phoneNumberVisibility } = req.body;

    try {
      const updateData = {};
      if (phoneNumber !== undefined) updateData.phoneNumber = phoneNumber;
      if (phoneNumberVisibility !== undefined) updateData.phoneNumberVisibility = phoneNumberVisibility;

      const user = await User.findByIdAndUpdate(
        req.user.id,
        updateData,
        { new: true, runValidators: true }
      ).select('-password');

      if (!user) {
        return res.status(404).json({
          success: false,
          message: 'User not found'
        });
      }

      res.status(200).json({
        success: true,
        data: user
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

// @route   GET /api/phone/my-number
// @desc    Get current user's phone number (with visibility check)
// @access  Private
router.get('/my-number', protect, async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select('phoneNumber phoneNumberVisibility');
    
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    res.status(200).json({
      success: true,
      data: {
        phoneNumber: user.phoneNumber,
        visibility: user.phoneNumberVisibility
      }
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

// @route   GET /api/phone/:userId
// @desc    Get another user's phone number (with subscription verification)
// @access  Private
router.get('/:userId', protect, async (req, res) => {
  try {
    const { userId } = req.params;

    // Don't allow users to get their own phone number through this endpoint
    if (userId === req.user.id) {
      return res.status(400).json({
        success: false,
        message: 'Cannot request your own phone number'
      });
    }

    const targetUser = await User.findById(userId).select('phoneNumber phoneNumberVisibility');
    
    if (!targetUser) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    if (!targetUser.phoneNumber) {
      return res.status(404).json({
        success: false,
        message: 'User has not provided a phone number'
      });
    }

    // Check visibility settings
    if (targetUser.phoneNumberVisibility === 'private') {
      return res.status(403).json({
        success: false,
        message: 'This user has made their phone number private',
        requiresSubscription: false
      });
    }

    if (targetUser.phoneNumberVisibility === 'subscribers') {
      // Check if the requester has an active subscription
      const requesterSubscription = await Subscription.getActiveSubscription(req.user.id);
      
      if (!requesterSubscription) {
        return res.status(403).json({
          success: false,
          message: 'Phone number access requires an active subscription',
          requiresSubscription: true,
          subscriptionRequired: true
        });
      }
    }

    // If we get here, the user is authorized to see the phone number
    res.status(200).json({
      success: true,
      data: {
        phoneNumber: targetUser.phoneNumber,
        visibility: targetUser.phoneNumberVisibility
      }
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

// @route   POST /api/phone/detect-in-message
// @desc    Check if a message contains phone numbers and apply restrictions
// @access  Private
router.post('/detect-in-message', protect, async (req, res) => {
  try {
    const { message, chatId } = req.body;

    if (!message || typeof message !== 'string') {
      return res.status(400).json({
        success: false,
        message: 'Message content is required'
      });
    }

    // Check if the sender has an active subscription
    const senderSubscription = await Subscription.getActiveSubscription(req.user.id);
    
    // Detect phone numbers in the message
    const detectedNumbers = [];
    for (const pattern of PHONE_PATTERNS) {
      const matches = message.match(pattern);
      if (matches) {
        detectedNumbers.push(...matches);
      }
    }

    // Remove duplicates and filter out obviously non-phone numbers
    const uniqueNumbers = [...new Set(detectedNumbers)]
      .filter(number => number.replace(/\D/g, '').length >= 10)
      .map(number => number.trim());

    if (uniqueNumbers.length === 0) {
      return res.status(200).json({
        success: true,
        data: {
          containsPhoneNumbers: false,
          restricted: false,
          message: 'No phone numbers detected'
        }
      });
    }

    // If no subscription, restrict the message
    if (!senderSubscription) {
      // Replace phone numbers with a restriction message
      let restrictedMessage = message;
      uniqueNumbers.forEach(() => {
        restrictedMessage = restrictedMessage.replace(/\+?\d[\d\s\-\(\)]{8,}\d/g, '[Phone number - Subscribe to share]');
      });

      return res.status(200).json({
        success: true,
        data: {
          containsPhoneNumbers: true,
          restricted: true,
          originalMessage: message,
          restrictedMessage: restrictedMessage,
          subscriptionRequired: true,
          detectedNumbers: uniqueNumbers
        }
      });
    }

    // If user has subscription, allow the message but log it
    res.status(200).json({
      success: true,
      data: {
        containsPhoneNumbers: true,
        restricted: false,
        message: message,
        subscriptionVerified: true,
        detectedNumbers: uniqueNumbers
      }
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

// @route   POST /api/phone/request-access
// @desc    Request access to a user's phone number (for premium features)
// @access  Private
router.post('/request-access', protect, async (req, res) => {
  try {
    const { targetUserId } = req.body;

    if (!targetUserId) {
      return res.status(400).json({
        success: false,
        message: 'Target user ID is required'
      });
    }

    if (targetUserId === req.user.id) {
      return res.status(400).json({
        success: false,
        message: 'Cannot request access to your own phone number'
      });
    }

    const targetUser = await User.findById(targetUserId).select('phoneNumber phoneNumberVisibility');
    
    if (!targetUser) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    // Check current user's subscription status
    const requesterSubscription = await Subscription.getActiveSubscription(req.user.id);
    
    if (!requesterSubscription) {
      return res.status(403).json({
        success: false,
        message: 'An active subscription is required to request phone number access',
        subscriptionRequired: true
      });
    }

    // Check if target user's phone number is accessible
    if (!targetUser.phoneNumber) {
      return res.status(404).json({
        success: false,
        message: 'User has not provided a phone number'
      });
    }

    if (targetUser.phoneNumberVisibility === 'private') {
      return res.status(403).json({
        success: false,
        message: 'This user has made their phone number private'
      });
    }

    // Grant access
    res.status(200).json({
      success: true,
      data: {
        phoneNumber: targetUser.phoneNumber,
        message: 'Phone number access granted'
      }
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