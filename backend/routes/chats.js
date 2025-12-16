import express from 'express';
import { body, validationResult } from 'express-validator';
import Chat from '../models/Chat.js';
import User from '../models/User.js';
import Profile from '../models/Profile.js';
import Subscription from '../models/Subscription.js';
import { protect } from '../middleware/auth.js';

const router = express.Router();

// Phone number detection patterns
const PHONE_PATTERNS = [
  /\+?\d{1,4}[-.\s]?\(?\d{1,3}\)?[-.\s]?\d{1,4}[-.\s]?\d{1,4}[-.\s]?\d{1,9}/g, // International format
  /\d{3}[-.\s]?\d{3}[-.\s]?\d{4}/g, // US format
  /\(\d{3}\)\s?\d{3}[-.\s]?\d{4}/g, // US format with parentheses
  /\+?\d{10,15}/g, // Simple 10-15 digit format
];

// Function to detect phone numbers in text
function containsPhoneNumber(text) {
  if (!text || typeof text !== 'string') return false;
  
  for (const pattern of PHONE_PATTERNS) {
    const matches = text.match(pattern);
    if (matches) {
      // Filter out obviously non-phone numbers
      const validNumbers = matches.filter(number =>
        number.replace(/\D/g, '').length >= 10
      );
      if (validNumbers.length > 0) return true;
    }
  }
  return false;
}

// Function to check if user has active subscription
async function hasActiveSubscription(userId) {
  try {
    const subscription = await Subscription.getActiveSubscription(userId);
    return subscription !== null;
  } catch (error) {
    console.error('Error checking subscription:', error);
    return false;
  }
}

// Function to check and increment message count for free users
async function checkMessageLimit(userId) {
  try {
    const user = await User.findById(userId);
    if (!user) return false;

    // If user has subscription, no limits
    const hasSubscription = await hasActiveSubscription(userId);
    if (hasSubscription) return true;

    // Check if user has reached the free message limit
    if (user.freeMessageCount >= user.freeMessageLimit) {
      return false;
    }

    // Increment message count
    user.freeMessageCount += 1;
    await user.save();

    return true;
  } catch (error) {
    console.error('Error checking message limit:', error);
    return false;
  }
}

// @route   GET /api/chats
// @desc    Get user's chats
// @access  Private
router.get('/', protect, async (req, res) => {
  try {
    const chats = await Chat.find({
      participants: req.user.id,
      isActive: true
    })
      .populate('participants', 'email')
      .populate('messages.senderId', 'email')
      .sort({ lastMessageAt: -1 });

    // Transform chats to match socket message format
    const transformedChats = chats.map(chat => ({
      ...chat.toObject(),
      messages: chat.messages.map(message => ({
        ...message.toObject(),
        sender: message.senderId ? {
          _id: message.senderId._id,
          email: message.senderId.email
        } : null
      }))
    }));

    res.status(200).json({
      success: true,
      data: transformedChats
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

// @route   POST /api/chats
// @desc    Create a new chat
// @access  Private
router.post(
  '/',
  [
    protect,
    body('participantId')
      .isMongoId()
      .withMessage('Valid participant ID is required')
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        errors: errors.array()
      });
    }

    const { participantId } = req.body;

    try {
      // Check if participant exists
      const participant = await User.findById(participantId);
      if (!participant) {
        return res.status(404).json({
          success: false,
          message: 'Participant not found'
        });
      }

      // Get both users' profiles to check gender compatibility
      const currentUserProfile = await Profile.findOne({ userId: req.user.id });
      const participantProfile = await Profile.findOne({ userId: participantId });

      if (!currentUserProfile) {
        return res.status(400).json({
          success: false,
          message: 'Please create a profile first'
        });
      }

      if (!participantProfile) {
        return res.status(400).json({
          success: false,
          message: 'Participant has not created a profile yet'
        });
      }

      // Check gender compatibility (only allow opposite gender chats)
      const currentUserGender = currentUserProfile.gender;
      const participantGender = participantProfile.gender;

      if (currentUserGender === participantGender) {
        return res.status(403).json({
          success: false,
          message: 'You can only chat with users of the opposite gender'
        });
      }

      // Check if chat already exists
      const existingChat = await Chat.findOne({
        participants: { $all: [req.user.id, participantId] },
        isActive: true
      });

      if (existingChat) {
        return res.status(400).json({
          success: false,
          message: 'Chat already exists with this user'
        });
      }

      // Create new chat
      const chat = await Chat.create({
        participants: [req.user.id, participantId]
      });

      // Populate the response
      await chat.populate('participants', 'email');

      res.status(201).json({
        success: true,
        data: chat
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

// @route   GET /api/chats/:chatId
// @desc    Get specific chat with messages
// @access  Private
router.get('/:chatId', protect, async (req, res) => {
  try {
    // Validate that chatId is a valid MongoDB ObjectId
    const { Types } = await import('mongoose');
    if (!Types.ObjectId.isValid(req.params.chatId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid chat ID format'
      });
    }

    const chat = await Chat.findById(req.params.chatId)
      .populate('participants', 'email')
      .populate('messages.senderId', 'email');

    if (!chat) {
      return res.status(404).json({
        success: false,
        message: 'Chat not found'
      });
    }

    // Check if user is participant
    const isParticipant = chat.participants.some(
      p => p._id.toString() === req.user.id
    );

    if (!isParticipant) {
      return res.status(403).json({
        success: false,
        message: 'Access denied'
      });
    }

    // Transform messages to match socket message format
    const transformedChat = {
      ...chat.toObject(),
      messages: chat.messages.map(message => ({
        ...message.toObject(),
        sender: message.senderId ? {
          _id: message.senderId._id,
          email: message.senderId.email
        } : null
      }))
    };

    res.status(200).json({
      success: true,
      data: transformedChat
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

// @route   POST /api/chats/:chatId/messages
// @desc    Send a message in a chat
// @access  Private
router.post(
  '/:chatId/messages',
  [
    protect,
    body('content')
      .trim()
      .isLength({ min: 1, max: 1000 })
      .withMessage('Message content must be between 1 and 1000 characters'),
    body('type')
      .optional()
      .isIn(['text', 'image', 'system'])
      .withMessage('Invalid message type')
  ],
  async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        errors: errors.array()
      });
    }

    const { content, type = 'text' } = req.body;

    try {
      // Validate that chatId is a valid MongoDB ObjectId
      const { Types } = await import('mongoose');
      if (!Types.ObjectId.isValid(req.params.chatId)) {
        return res.status(400).json({
          success: false,
          message: 'Invalid chat ID format'
        });
      }

      const chat = await Chat.findById(req.params.chatId);

      if (!chat) {
        return res.status(404).json({
          success: false,
          message: 'Chat not found'
        });
      }

      // Check if user is participant
      const isParticipant = chat.participants.some(
        p => p.toString() === req.user.id
      );

      if (!isParticipant) {
        return res.status(403).json({
          success: false,
          message: 'Access denied'
        });
      }

      // Check message limit for free users
      const canSendMessage = await checkMessageLimit(req.user.id);
      if (!canSendMessage) {
        return res.status(403).json({
          success: false,
          message: 'You have reached the free message limit. Please subscribe to continue chatting.',
          restricted: true,
          subscriptionRequired: true,
          messageLimitReached: true
        });
      }

      // Check if message contains phone numbers and user has subscription
      if (containsPhoneNumber(content)) {
        const userHasSubscription = await hasActiveSubscription(req.user.id);
        
        if (!userHasSubscription) {
          return res.status(403).json({
            success: false,
            message: 'Sharing phone numbers is not allowed. Please subscribe to send messages containing phone numbers.',
            restricted: true,
            subscriptionRequired: true
          });
        }
      }

      // Create new message
      const message = {
        senderId: req.user.id,
        content: content.trim(),
        type,
        timestamp: new Date()
      };

      chat.messages.push(message);
      chat.lastMessage = message.content;
      chat.lastMessageAt = message.timestamp;
      await chat.save();

      // Populate the response
      await chat.populate('messages.senderId', 'email');

      const newMessage = chat.messages[chat.messages.length - 1];

      res.status(201).json({
        success: true,
        data: newMessage
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

// @route   PUT /api/chats/:chatId/messages/:messageId/read
// @desc    Mark message as read
// @access  Private
router.put('/:chatId/messages/:messageId/read', protect, async (req, res) => {
  try {
    // Validate that chatId is a valid MongoDB ObjectId
    const { Types } = await import('mongoose');
    if (!Types.ObjectId.isValid(req.params.chatId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid chat ID format'
      });
    }

    // Validate that messageId is a valid MongoDB ObjectId
    if (!Types.ObjectId.isValid(req.params.messageId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid message ID format'
      });
    }

    const chat = await Chat.findById(req.params.chatId);

    if (!chat) {
      return res.status(404).json({
        success: false,
        message: 'Chat not found'
      });
    }

    // Check if user is participant
    const isParticipant = chat.participants.some(
      p => p.toString() === req.user.id
    );

    if (!isParticipant) {
      return res.status(403).json({
        success: false,
        message: 'Access denied'
      });
    }

    // Find and mark message as read
    const message = chat.messages.id(req.params.messageId);
    if (!message) {
      return res.status(404).json({
        success: false,
        message: 'Message not found'
      });
    }

    // Add user to readBy if not already there
    const alreadyRead = message.readBy.some(
      read => read.userId.toString() === req.user.id
    );

    if (!alreadyRead) {
      message.readBy.push({
        userId: req.user.id,
        readAt: new Date()
      });
      await chat.save();
    }

    res.status(200).json({
      success: true,
      data: message
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

// @route   GET /api/chats/:chatId/messages
// @desc    Get messages for a chat
// @access  Private
router.get('/:chatId/messages', protect, async (req, res) => {
  try {
    const { page = 1, limit = 50 } = req.query;
    const skip = (page - 1) * limit;

    // Validate that chatId is a valid MongoDB ObjectId
    const { Types } = await import('mongoose');
    if (!Types.ObjectId.isValid(req.params.chatId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid chat ID format'
      });
    }

    const chat = await Chat.findById(req.params.chatId)
      .populate('messages.senderId', 'email')
      .populate('participants', 'email');

    if (!chat) {
      return res.status(404).json({
        success: false,
        message: 'Chat not found'
      });
    }

    // Check if user is participant
    const isParticipant = chat.participants.some(
      p => p._id.toString() === req.user.id
    );

    if (!isParticipant) {
      return res.status(403).json({
        success: false,
        message: 'Access denied'
      });
    }

    // Get messages with pagination
    const messages = chat.messages
      .sort((a, b) => b.timestamp - a.timestamp)
      .slice(skip, skip + parseInt(limit))
      .reverse();

    // Transform messages to match socket message format
    const transformedMessages = messages.map(message => ({
      ...message.toObject(),
      sender: message.senderId ? {
        _id: message.senderId._id,
        email: message.senderId.email
      } : null
    }));

    res.status(200).json({
      success: true,
      data: {
        messages: transformedMessages,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total: chat.messages.length,
          pages: Math.ceil(chat.messages.length / limit)
        }
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

// @route   DELETE /api/chats/:chatId
// @desc    Leave/deactivate a chat
// @access  Private
router.delete('/:chatId', protect, async (req, res) => {
  try {
    // Validate that chatId is a valid MongoDB ObjectId
    const { Types } = await import('mongoose');
    if (!Types.ObjectId.isValid(req.params.chatId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid chat ID format'
      });
    }

    const chat = await Chat.findById(req.params.chatId);

    if (!chat) {
      return res.status(404).json({
        success: false,
        message: 'Chat not found'
      });
    }

    // Check if user is participant
    const isParticipant = chat.participants.some(
      p => p.toString() === req.user.id
    );

    if (!isParticipant) {
      return res.status(403).json({
        success: false,
        message: 'Access denied'
      });
    }

    // Deactivate chat
    chat.isActive = false;
    await chat.save();

    res.status(200).json({
      success: true,
      message: 'Chat left successfully'
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