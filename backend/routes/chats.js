import express from 'express';
import { body, validationResult } from 'express-validator';
import Chat from '../models/Chat.js';
import User from '../models/User.js';
import { protect } from '../middleware/auth.js';

const router = express.Router();

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

    res.status(200).json({
      success: true,
      data: chats
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

    res.status(200).json({
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
      .slice(skip, skip + parseInt(limit));

    res.status(200).json({
      success: true,
      data: {
        messages: messages.reverse(),
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