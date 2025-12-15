import express from 'express';
import { body, query, param, validationResult } from 'express-validator';
import Chat from '../models/Chat.js';
import User from '../models/User.js';
import { protect } from '../middleware/auth.js';
import messageOptimizationService from '../services/messageOptimizationService.js';

const router = express.Router();

// @route   GET /api/chats/optimized
// @desc    Get user's chats with optimized queries and pagination
// @access  Private
router.get('/optimized', protect, async (req, res) => {
  try {
    const { page = 1, limit = 20 } = req.query;
    
    const result = await messageOptimizationService.getUserChatsOptimized(
      req.user.id,
      parseInt(page),
      parseInt(limit)
    );

    res.status(200).json(result);
  } catch (error) {
    console.error(error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

// @route   GET /api/chats/:chatId/messages/optimized
// @desc    Get chat messages with optimized pagination
// @access  Private
router.get(
  '/:chatId/messages/optimized',
  [
    protect,
    param('chatId').isMongoId().withMessage('Valid chat ID is required'),
    query('page').optional().isInt({ min: 1 }).withMessage('Page must be a positive integer'),
    query('limit').optional().isInt({ min: 1, max: 100 }).withMessage('Limit must be between 1 and 100'),
    query('before').optional().isMongoId().withMessage('Before must be a valid message ID'),
    query('after').optional().isMongoId().withMessage('After must be a valid message ID')
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
      const { chatId } = req.params;
      const { page, limit, before, after, includeDeleted } = req.query;

      const result = await messageOptimizationService.getChatMessagesOptimized(
        chatId,
        req.user.id,
        {
          page: parseInt(page) || 1,
          limit: parseInt(limit) || 50,
          before,
          after,
          includeDeleted: includeDeleted === 'true'
        }
      );

      res.status(200).json(result);
    } catch (error) {
      console.error(error);
      const status = error.message === 'Chat not found' ? 404 :
                    error.message === 'Access denied' ? 403 : 500;
      res.status(status).json({
        success: false,
        message: error.message
      });
    }
  }
);

// @route   GET /api/chats/:chatId/search
// @desc    Search messages in a chat
// @access  Private
router.get(
  '/:chatId/search',
  [
    protect,
    param('chatId').isMongoId().withMessage('Valid chat ID is required'),
    query('q').notEmpty().withMessage('Search query is required'),
    query('page').optional().isInt({ min: 1 }).withMessage('Page must be a positive integer'),
    query('limit').optional().isInt({ min: 1, max: 50 }).withMessage('Limit must be between 1 and 50')
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
      const { chatId } = req.params;
      const { q: searchTerm, page, limit } = req.query;

      const result = await messageOptimizationService.searchMessages(
        chatId,
        req.user.id,
        searchTerm,
        {
          page: parseInt(page) || 1,
          limit: parseInt(limit) || 20
        }
      );

      res.status(200).json(result);
    } catch (error) {
      console.error(error);
      const status = error.message === 'Chat not found' ? 404 :
                    error.message === 'Access denied' ? 403 : 500;
      res.status(status).json({
        success: false,
        message: error.message
      });
    }
  }
);

// @route   POST /api/chats/:chatId/archive
// @desc    Archive old messages in a chat
// @access  Private
router.post(
  '/:chatId/archive',
  [
    protect,
    param('chatId').isMongoId().withMessage('Valid chat ID is required'),
    body('daysOld').optional().isInt({ min: 1 }).withMessage('Days old must be a positive integer')
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
      const { chatId } = req.params;
      const { daysOld } = req.body;

      const result = await messageOptimizationService.archiveOldMessages(
        chatId,
        parseInt(daysOld) || 90
      );

      res.status(200).json(result);
    } catch (error) {
      console.error(error);
      const status = error.message === 'Chat not found' ? 404 : 500;
      res.status(status).json({
        success: false,
        message: error.message
      });
    }
  }
);

// @route   GET /api/chats/:chatId/statistics
// @desc    Get chat statistics for monitoring
// @access  Private
router.get('/:chatId/statistics', protect, async (req, res) => {
  try {
    const { chatId } = req.params;

    const result = await messageOptimizationService.getChatStatistics(chatId);

    res.status(200).json(result);
  } catch (error) {
    console.error(error);
    const status = error.message === 'Chat not found' ? 404 : 500;
    res.status(status).json({
      success: false,
      message: error.message
    });
  }
});

// @route   POST /api/chats/cleanup
// @desc    Clean up old deleted messages across all chats
// @access  Private (Admin only)
router.post(
  '/cleanup',
  [
    protect,
    body('retentionDays').optional().isInt({ min: 1 }).withMessage('Retention days must be a positive integer')
  ],
  async (req, res) => {
    try {
      // Check if user is admin (you might want to add role-based access control)
      // For now, we'll allow any authenticated user to trigger cleanup
      
      const { retentionDays } = req.body;

      const result = await messageOptimizationService.cleanupDeletedMessages(
        parseInt(retentionDays) || 30
      );

      res.status(200).json(result);
    } catch (error) {
      console.error(error);
      res.status(500).json({
        success: false,
        message: 'Failed to cleanup deleted messages'
      });
    }
  }
);

// @route   GET /api/chats/:chatId/messages/virtual-scroll
// @desc    Get messages for virtual scrolling (bidirectional pagination)
// @access  Private
router.get(
  '/:chatId/messages/virtual-scroll',
  [
    protect,
    param('chatId').isMongoId().withMessage('Valid chat ID is required'),
    query('anchor').optional().isMongoId().withMessage('Anchor must be a valid message ID'),
    query('direction').optional().isIn(['before', 'after', 'both']).withMessage('Direction must be before, after, or both'),
    query('limit').optional().isInt({ min: 1, max: 100 }).withMessage('Limit must be between 1 and 100')
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
      const { chatId } = req.params;
      const { anchor, direction = 'both', limit = 50 } = req.query;

      const chat = await Chat.findById(chatId);
      if (!chat) {
        return res.status(404).json({
          success: false,
          message: 'Chat not found'
        });
      }

      // Check if user is participant
      const isParticipant = chat.participants.some(p => p.toString() === req.user.id);
      if (!isParticipant) {
        return res.status(403).json({
          success: false,
          message: 'Access denied'
        });
      }

      let messages = [];
      const anchorMessage = anchor ? chat.messages.id(anchor) : null;
      const limitNum = parseInt(limit);

      if (direction === 'both' && anchorMessage) {
        // Get messages both before and after anchor
        const anchorIndex = chat.messages.findIndex(m => m._id.toString() === anchor);
        const beforeMessages = chat.messages
          .slice(Math.max(0, anchorIndex - limitNum), anchorIndex)
          .reverse();
        const afterMessages = chat.messages
          .slice(anchorIndex + 1, anchorIndex + 1 + limitNum);

        messages = [...beforeMessages, anchorMessage, ...afterMessages];
      } else if (direction === 'before' && anchorMessage) {
        const anchorIndex = chat.messages.findIndex(m => m._id.toString() === anchor);
        messages = chat.messages
          .slice(Math.max(0, anchorIndex - limitNum), anchorIndex)
          .reverse();
      } else if (direction === 'after' && anchorMessage) {
        const anchorIndex = chat.messages.findIndex(m => m._id.toString() === anchor);
        messages = chat.messages.slice(anchorIndex + 1, anchorIndex + 1 + limitNum);
      } else {
        // Get latest messages if no anchor
        messages = chat.messages
          .filter(msg => !msg.isDeleted)
          .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
          .slice(0, limitNum);
      }

      // Transform messages for client
      const transformedMessages = messages.map(message => ({
        _id: message._id,
        senderId: message.senderId,
        content: message.isDeleted ? 'Message deleted' : message.content,
        type: message.type,
        timestamp: message.timestamp,
        readBy: message.readBy,
        deliveryStatus: message.deliveryStatus || 'sent',
        deliveredTo: message.deliveredTo || [],
        isEdited: message.isEdited || false,
        editedAt: message.editedAt,
        isDeleted: message.isDeleted || false,
        deletedAt: message.deletedAt,
        attachments: message.attachments || []
      }));

      // Populate sender information
      const populatedMessages = await Chat.populate(transformedMessages, {
        path: 'senderId',
        select: 'email'
      });

      // Calculate pagination info
      let hasMoreBefore = false;
      let hasMoreAfter = false;
      
      if (anchorMessage) {
        const anchorIndex = chat.messages.findIndex(m => m._id.toString() === anchor);
        hasMoreBefore = anchorIndex > limitNum;
        hasMoreAfter = (chat.messages.length - anchorIndex - 1) > limitNum;
      }

      res.status(200).json({
        success: true,
        data: {
          messages: populatedMessages,
          hasMoreBefore,
          hasMoreAfter,
          anchorMessageId: anchor || null
        }
      });
    } catch (error) {
      console.error(error);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch messages for virtual scrolling'
      });
    }
  }
);

export default router;