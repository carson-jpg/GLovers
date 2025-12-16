import express from 'express';
import { body, validationResult } from 'express-validator';
import Payment from '../models/Payment.js';
import Subscription from '../models/Subscription.js';
import { protect } from '../middleware/auth.js';
import mpesaService from '../services/mpesaService.js';

const router = express.Router();

// @route   POST /api/payments
// @desc    Create a new payment
// @access  Private
router.post(
  '/',
  [
    protect,
    body('amount')
      .isNumeric()
      .withMessage('Amount must be a number'),
    body('phoneNumber')
      .matches(/^(0|254|\+254)?[17]\d{8}$/)
      .withMessage('Please provide a valid Kenyan phone number'),
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

    const { amount, phoneNumber, planType } = req.body;

    try {
      // Create payment record
      const payment = await Payment.create({
        userId: req.user.id,
        amount,
        phoneNumber,
        status: 'pending',
        metadata: {
          planType
        }
      });

      // Validate M-Pesa configuration before proceeding
      try {
        mpesaService.validateConfig();
      } catch (configError) {
        await Payment.findByIdAndUpdate(payment._id, {
          status: 'failed',
          'metadata.error': `Configuration error: ${configError.message}`
        });

        return res.status(500).json({
          success: false,
          message: 'Payment service configuration error',
          error: configError.message
        });
      }

      // Initiate STK Push
      const mpesaResponse = await mpesaService.initiateStkPush(phoneNumber, amount);

      if (mpesaResponse.success) {
        // Update payment with M-Pesa request IDs
        await Payment.findByIdAndUpdate(payment._id, {
          'metadata.checkoutRequestId': mpesaResponse.checkoutRequestId,
          'metadata.merchantRequestId': mpesaResponse.merchantRequestId
        });

        res.status(201).json({
          success: true,
          data: {
            paymentId: payment._id,
            checkoutRequestId: mpesaResponse.checkoutRequestId,
            merchantRequestId: mpesaResponse.merchantRequestId
          },
          message: 'STK push sent to your phone. Please complete the payment.'
        });
      } else {
        // Update payment status to failed
        const errorMessage = mpesaResponse.error?.message || 'Unknown error';
        const errorCode = mpesaResponse.error?.code || 'UNKNOWN_ERROR';
        
        await Payment.findByIdAndUpdate(payment._id, {
          status: 'failed',
          'metadata.error': errorMessage,
          'metadata.errorCode': errorCode
        });

        // Provide specific error messages based on error code
        let userMessage = 'Failed to initiate payment';
        if (errorCode === '404.001.03') {
          userMessage = 'Payment service configuration error. Please contact support.';
        } else if (errorMessage.includes('Invalid')) {
          userMessage = 'Invalid payment details. Please check your phone number and amount.';
        }

        res.status(400).json({
          success: false,
          message: userMessage,
          error: {
            code: errorCode,
            details: mpesaResponse.error
          }
        });
      }
    } catch (error) {
      console.error('Payment creation error:', error);
      
      // Update payment status to failed if it was created
      if (payment?._id) {
        await Payment.findByIdAndUpdate(payment._id, {
          status: 'failed',
          'metadata.error': error.message
        });
      }

      res.status(500).json({
        success: false,
        message: 'Server error'
      });
    }
  }
);

// @route   GET /api/payments
// @desc    Get all payments for user
// @access  Private
router.get('/', protect, async (req, res) => {
  try {
    const payments = await Payment.find({ userId: req.user.id })
      .populate('subscriptionId')
      .sort({ createdAt: -1 });

    res.status(200).json({
      success: true,
      count: payments.length,
      data: payments
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

// @route   GET /api/payments/:id
// @desc    Get a specific payment
// @access  Private
router.get('/:id', protect, async (req, res) => {
  try {
    const payment = await Payment.findById(req.params.id)
      .populate('subscriptionId')
      .populate('userId', 'email');

    if (!payment) {
      return res.status(404).json({
        success: false,
        message: 'Payment not found'
      });
    }

    // Check if payment belongs to user (unless admin)
    if (payment.userId._id.toString() !== req.user.id) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to access this payment'
      });
    }

    res.status(200).json({
      success: true,
      data: payment
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

// @route   POST /api/payments/check-status
// @desc    Check payment status
// @access  Private
router.post('/check-status', protect, async (req, res) => {
  const { checkoutRequestId } = req.body;

  if (!checkoutRequestId) {
    return res.status(400).json({
      success: false,
      message: 'Checkout request ID is required'
    });
  }

  try {
    const payment = await Payment.findOne({
      userId: req.user.id,
      'metadata.checkoutRequestId': checkoutRequestId
    });

    if (!payment) {
      return res.status(404).json({
        success: false,
        message: 'Payment not found'
      });
    }

    // Check status with M-Pesa
    const statusResponse = await mpesaService.checkPaymentStatus(checkoutRequestId);

    if (statusResponse.success && statusResponse.data.ResultCode === 0) {
      // Payment successful
      await Payment.findByIdAndUpdate(payment._id, {
        status: 'completed',
        transactionCode: statusResponse.data.MpesaReceiptNumber
      });

      // Create subscription if not exists
      let subscription = await Subscription.findOne({
        userId: req.user.id,
        isActive: true,
        endDate: { $gte: new Date() }
      });

      if (!subscription) {
        const planDetails = {
          weekly: { duration: 7 },
          monthly: { duration: 30 }
        };

        const plan = planDetails[payment.metadata.planType];
        const startDate = new Date();
        const endDate = new Date();
        endDate.setDate(endDate.getDate() + plan.duration);

        subscription = await Subscription.create({
          userId: req.user.id,
          planType: payment.metadata.planType,
          amount: payment.amount,
          startDate,
          endDate,
          isActive: true
        });

        // Update payment with subscription ID
        await Payment.findByIdAndUpdate(payment._id, {
          subscriptionId: subscription._id
        });
      }

      res.status(200).json({
        success: true,
        message: 'Payment completed successfully',
        paymentStatus: 'completed',
        subscription
      });
    } else if (statusResponse.data.ResultCode === 1032) {
      // Payment cancelled by user
      await Payment.findByIdAndUpdate(payment._id, {
        status: 'cancelled'
      });

      res.status(200).json({
        success: false,
        message: 'Payment was cancelled',
        paymentStatus: 'cancelled'
      });
    } else {
      // Payment failed or pending
      res.status(200).json({
        success: false,
        message: statusResponse.data.ResultDesc || 'Payment pending',
        paymentStatus: payment.status
      });
    }
  } catch (error) {
    console.error('Status check error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to check payment status'
    });
  }
});

// @route   POST /api/payments/callback
// @desc    M-Pesa callback URL
// @access  Public (called by M-Pesa)
router.post('/callback', async (req, res) => {
  console.log('🔔 M-Pesa Callback Received');
  
  try {
    const callbackData = req.body;
    
    console.log('📨 Callback data structure:', {
      hasBody: !!callbackData.Body,
      hasStkCallback: !!callbackData.Body?.stkCallback,
      resultCode: callbackData.Body?.stkCallback?.ResultCode,
      resultDesc: callbackData.Body?.stkCallback?.ResultDesc
    });

    const result = mpesaService.processCallback(callbackData);

    console.log('📊 Callback processing result:', {
      success: result.success,
      resultCode: result.resultCode,
      resultDesc: result.resultDesc,
      checkoutRequestId: result.checkoutRequestId,
      transactionId: result.transactionId,
      hasError: !!result.error
    });

    if (result.checkoutRequestId) {
      console.log('🔍 Looking for payment with checkoutRequestId:', result.checkoutRequestId);
      
      const payment = await Payment.findOne({
        'metadata.checkoutRequestId': result.checkoutRequestId
      });

      if (payment) {
        console.log('💳 Payment found:', {
          paymentId: payment._id,
          userId: payment.userId,
          currentStatus: payment.status,
          amount: payment.amount
        });

        if (result.success) {
          // Payment successful
          console.log('✅ Processing successful payment...');
          
          await Payment.findByIdAndUpdate(payment._id, {
            status: 'completed',
            transactionCode: result.transactionId
          });

          // Create subscription
          const planDetails = {
            weekly: { duration: 7 },
            monthly: { duration: 30 }
          };

          const plan = planDetails[payment.metadata.planType];
          const startDate = new Date();
          const endDate = new Date();
          endDate.setDate(endDate.getDate() + plan.duration);

          const subscription = await Subscription.create({
            userId: payment.userId,
            planType: payment.metadata.planType,
            amount: payment.amount,
            startDate,
            endDate,
            isActive: true
          });

          // Update payment with subscription ID
          await Payment.findByIdAndUpdate(payment._id, {
            subscriptionId: subscription._id
          });

          console.log(`🎉 Payment completed for user ${payment.userId} - Transaction: ${result.transactionId}`);
        } else {
          // Payment failed
          console.log('❌ Processing failed payment...', {
            resultCode: result.resultCode,
            resultDesc: result.resultDesc
          });
          
          await Payment.findByIdAndUpdate(payment._id, {
            status: 'failed',
            'metadata.callbackResult': result
          });

          console.log(`💔 Payment failed for user ${payment.userId}: ${result.resultDesc} (Code: ${result.resultCode})`);
        }
      } else {
        console.error('❌ Payment not found for checkoutRequestId:', result.checkoutRequestId);
      }
    } else {
      console.error('❌ No checkoutRequestId in callback result:', result);
    }

    console.log('✅ Callback processing completed');
    res.status(200).json({ success: true });
  } catch (error) {
    console.error('💥 Callback error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

export default router;
