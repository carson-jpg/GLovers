import express from 'express';
import { body, validationResult } from 'express-validator';
import Subscription from '../models/Subscription.js';
import { protect } from '../middleware/auth.js';

const router = express.Router();

// @route   POST /api/subscriptions
// @desc    Create a new subscription
// @access  Private
router.post(
  '/',
  [
    protect,
    body('planType')
      .isIn(['weekly', 'monthly'])
      .withMessage('Plan type must be either weekly or monthly')
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        errors: errors.array()
      });
    }

    const { planType } = req.body;

    try {
      // Check if user already has an active subscription
      const existingSubscription = await Subscription.findOne({
        userId: req.user.id,
        isActive: true,
        endDate: { $gte: new Date() }
      });

      if (existingSubscription) {
        return res.status(400).json({
          success: false,
          message: 'You already have an active subscription'
        });
      }

      // Set plan details
      const planDetails = {
        weekly: { amount: 200, duration: 7 },
        monthly: { amount: 400, duration: 30 }
      };

      const plan = planDetails[planType];
      if (!plan) {
        return res.status(400).json({
          success: false,
          message: 'Invalid plan type'
        });
      }

      const startDate = new Date();
      const endDate = new Date();
      endDate.setDate(endDate.getDate() + plan.duration);

      const subscription = await Subscription.create({
        userId: req.user.id,
        planType,
        amount: plan.amount,
        startDate,
        endDate,
        isActive: true
      });

      res.status(201).json({
        success: true,
        data: subscription
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

// @route   GET /api/subscriptions/me
// @desc    Get current user's subscription
// @access  Private
router.get('/me', protect, async (req, res) => {
  try {
    const subscription = await Subscription.getActiveSubscription(req.user.id);

    res.status(200).json({
      success: true,
      data: subscription
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

// @route   GET /api/subscriptions
// @desc    Get all subscriptions (for admin)
// @access  Private
router.get('/', protect, async (req, res) => {
  try {
    const subscriptions = await Subscription.find({})
      .populate('userId', 'email')
      .sort({ createdAt: -1 });

    res.status(200).json({
      success: true,
      count: subscriptions.length,
      data: subscriptions
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
