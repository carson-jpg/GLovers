import Chat from '../models/Chat.js';
import mongoose from 'mongoose';

// Message optimization service for handling large-scale message storage and retrieval
class MessageOptimizationService {
  constructor() {
    this.CACHE_TTL = 5 * 60 * 1000; // 5 minutes
    this.ARCHIVE_THRESHOLD_DAYS = 90; // Archive messages older than 90 days
    this.PAGE_SIZE = 50;
  }

  // Optimized chat listing with pagination and caching
  async getUserChatsOptimized(userId, page = 1, limit = 20) {
    try {
      const skip = (page - 1) * limit;
      
      // Use aggregation for efficient chat retrieval
      const chats = await Chat.aggregate([
        // Match chats where user is participant
        { $match: { 
          participants: new mongoose.Types.ObjectId(userId),
          isActive: true 
        }},
        
        // Unwind messages to work with the latest message
        { $unwind: '$messages' },
        
        // Sort by message timestamp descending
        { $sort: { 'messages.timestamp': -1 } },
        
        // Group back by chat, keeping only the latest message
        { $group: {
          _id: '$_id',
          participants: { $first: '$participants' },
          lastMessage: { $first: '$messages.content' },
          lastMessageAt: { $first: '$messages.timestamp' },
          lastMessageSender: { $first: '$messages.senderId' },
          chatType: { $first: '$chatType' },
          chatName: { $first: '$chatName' },
          createdAt: { $first: '$createdAt' },
          messageCount: { $sum: 1 },
          unreadCount: {
            $sum: {
              $cond: [
                {
                  $and: [
                    { $ne: ['$messages.senderId', new mongoose.Types.ObjectId(userId)] },
                    {
                      $not: {
                        $in: [new mongoose.Types.ObjectId(userId), '$messages.readBy.userId']
                      }
                    }
                  ]
                },
                1,
                0
              ]
            }
          }
        }},
        
        // Sort by last message time
        { $sort: { lastMessageAt: -1 } },
        
        // Pagination
        { $skip: skip },
        { $limit: limit },
        
        // Populate participant details
        {
          $lookup: {
            from: 'users',
            localField: 'participants',
            foreignField: '_id',
            as: 'participantDetails'
          }
        },
        
        // Shape the final result
        {
          $project: {
            _id: 1,
            participants: {
              $map: {
                input: '$participantDetails',
                as: 'participant',
                in: {
                  _id: '$$participant._id',
                  email: '$$participant.email'
                }
              }
            },
            lastMessage: 1,
            lastMessageAt: 1,
            lastMessageSender: 1,
            chatType: 1,
            chatName: 1,
            createdAt: 1,
            messageCount: 1,
            unreadCount: 1,
            isArchived: {
              $lt: ['$lastMessageAt', new Date(Date.now() - this.ARCHIVE_THRESHOLD_DAYS * 24 * 60 * 60 * 1000)]
            }
          }
        }
      ]);

      // Get total count for pagination
      const totalChats = await Chat.countDocuments({
        participants: userId,
        isActive: true
      });

      return {
        success: true,
        data: {
          chats,
          pagination: {
            page,
            limit,
            total: totalChats,
            pages: Math.ceil(totalChats / limit),
            hasNext: page * limit < totalChats,
            hasPrev: page > 1
          }
        }
      };
    } catch (error) {
      console.error('Error getting optimized user chats:', error);
      throw error;
    }
  }

  // Optimized message retrieval with pagination and virtual scrolling support
  async getChatMessagesOptimized(chatId, userId, options = {}) {
    try {
      const {
        page = 1,
        limit = this.PAGE_SIZE,
        before, // Get messages before this message ID
        after, // Get messages after this message ID
        includeDeleted = false
      } = options;

      const skip = (page - 1) * limit;
      const chat = await Chat.findById(chatId);
      
      if (!chat) {
        throw new Error('Chat not found');
      }

      // Check if user is participant
      const isParticipant = chat.participants.some(p => p.toString() === userId);
      if (!isParticipant) {
        throw new Error('Access denied');
      }

      let query = {};
      let sort = { timestamp: -1 }; // Default: newest first

      // Handle pagination based on message ID
      if (before) {
        const beforeMessage = chat.messages.id(before);
        if (beforeMessage) {
          query.timestamp = { $lt: beforeMessage.timestamp };
        }
        sort = { timestamp: -1 };
      } else if (after) {
        const afterMessage = chat.messages.id(after);
        if (afterMessage) {
          query.timestamp = { $gt: afterMessage.timestamp };
        }
        sort = { timestamp: 1 };
      }

      // Filter deleted messages if not included
      if (!includeDeleted) {
        query.isDeleted = { $ne: true };
      }

      // Get messages with optimized query
      const messages = chat.messages
        .filter(message => {
          // Apply filters
          if (query.timestamp && message.timestamp <= query.timestamp.$lt) return false;
          if (query.timestamp && message.timestamp >= query.timestamp.$gt) return false;
          if (!includeDeleted && message.isDeleted) return false;
          return true;
        })
        .sort((a, b) => {
          if (sort.timestamp === -1) {
            return new Date(b.timestamp) - new Date(a.timestamp);
          } else {
            return new Date(a.timestamp) - new Date(b.timestamp);
          }
        })
        .slice(skip, skip + limit)
        .map(message => ({
          _id: message._id,
          senderId: message.senderId,
          content: message.isDeleted ? 'Message deleted' : message.content,
          type: message.type,
          timestamp: message.timestamp,
          readBy: includeDeleted ? message.readBy : message.readBy.filter(read => !message.isDeleted),
          deliveryStatus: message.deliveryStatus || 'sent',
          deliveredTo: message.deliveredTo || [],
          isEdited: message.isEdited || false,
          editedAt: message.editedAt,
          isDeleted: message.isDeleted || false,
          deletedAt: message.deletedAt,
          attachments: message.attachments || []
        }));

      // Populate sender information
      const populatedMessages = await Chat.populate(messages, {
        path: 'senderId',
        select: 'email'
      });

      // Get message statistics
      const totalMessages = chat.messages.filter(msg => !includeDeleted || !msg.isDeleted).length;
      const unreadCount = chat.messages.filter(message => {
        if (message.isDeleted || message.senderId.toString() === userId) return false;
        return !message.readBy.some(read => read.userId.toString() === userId);
      }).length;

      return {
        success: true,
        data: {
          messages: populatedMessages,
          pagination: {
            page,
            limit,
            total: totalMessages,
            pages: Math.ceil(totalMessages / limit),
            hasNext: page * limit < totalMessages,
            hasPrev: page > 1
          },
          statistics: {
            totalMessages,
            unreadCount,
            archived: chat.messages.filter(msg => 
              msg.timestamp < new Date(Date.now() - this.ARCHIVE_THRESHOLD_DAYS * 24 * 60 * 60 * 1000)
            ).length
          }
        }
      };
    } catch (error) {
      console.error('Error getting optimized chat messages:', error);
      throw error;
    }
  }

  // Message search with full-text search and pagination
  async searchMessages(chatId, userId, searchTerm, options = {}) {
    try {
      const { page = 1, limit = 20 } = options;
      const skip = (page - 1) * limit;

      const chat = await Chat.findById(chatId);
      if (!chat) {
        throw new Error('Chat not found');
      }

      // Check if user is participant
      const isParticipant = chat.participants.some(p => p.toString() === userId);
      if (!isParticipant) {
        throw new Error('Access denied');
      }

      // Search in message content (case-insensitive)
      const searchRegex = new RegExp(searchTerm, 'i');
      const matchingMessages = chat.messages.filter(message => 
        !message.isDeleted && searchRegex.test(message.content)
      );

      // Sort by relevance (most recent first) and apply pagination
      const paginatedMessages = matchingMessages
        .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
        .slice(skip, skip + limit)
        .map(message => ({
          _id: message._id,
          senderId: message.senderId,
          content: message.content,
          type: message.type,
          timestamp: message.timestamp,
          readBy: message.readBy,
          isEdited: message.isEdited || false,
          editedAt: message.editedAt
        }));

      // Populate sender information
      const populatedMessages = await Chat.populate(paginatedMessages, {
        path: 'senderId',
        select: 'email'
      });

      // Highlight search terms
      const highlightedMessages = populatedMessages.map(message => ({
        ...message,
        highlightedContent: message.content.replace(
          searchRegex,
          `<mark>$&</mark>`
        )
      }));

      return {
        success: true,
        data: {
          messages: highlightedMessages,
          pagination: {
            page,
            limit,
            total: matchingMessages.length,
            pages: Math.ceil(matchingMessages.length / limit),
            hasNext: page * limit < matchingMessages.length,
            hasPrev: page > 1
          },
          searchTerm
        }
      };
    } catch (error) {
      console.error('Error searching messages:', error);
      throw error;
    }
  }

  // Archive old messages to improve performance
  async archiveOldMessages(chatId, daysOld = this.ARCHIVE_THRESHOLD_DAYS) {
    try {
      const cutoffDate = new Date(Date.now() - daysOld * 24 * 60 * 60 * 1000);
      
      const chat = await Chat.findById(chatId);
      if (!chat) {
        throw new Error('Chat not found');
      }

      // Move old messages to a separate collection or mark them as archived
      const oldMessages = chat.messages.filter(message => 
        message.timestamp < cutoffDate && !message.isDeleted
      );

      if (oldMessages.length === 0) {
        return { success: true, message: 'No messages to archive' };
      }

      // Here you would typically move messages to an archive collection
      // For now, we'll just mark them as archived
      oldMessages.forEach(message => {
        message.isArchived = true;
        message.archivedAt = new Date();
      });

      await chat.save();

      return {
        success: true,
        message: `Archived ${oldMessages.length} messages`,
        archivedCount: oldMessages.length
      };
    } catch (error) {
      console.error('Error archiving messages:', error);
      throw error;
    }
  }

  // Clean up soft-deleted messages older than retention period
  async cleanupDeletedMessages(retentionDays = 30) {
    try {
      const cutoffDate = new Date(Date.now() - retentionDays * 24 * 60 * 60 * 1000);
      
      // Find chats with soft-deleted messages older than retention period
      const chatsToCleanup = await Chat.find({
        'messages.isDeleted': true,
        'messages.deletedAt': { $lt: cutoffDate }
      });

      let totalCleaned = 0;

      for (const chat of chatsToCleanup) {
        // Remove soft-deleted messages that are older than retention period
        const initialCount = chat.messages.length;
        chat.messages = chat.messages.filter(message => 
          !(message.isDeleted && message.deletedAt && message.deletedAt < cutoffDate)
        );
        const cleanedCount = initialCount - chat.messages.length;
        totalCleaned += cleanedCount;

        if (cleanedCount > 0) {
          await chat.save();
        }
      }

      return {
        success: true,
        message: `Cleaned up ${totalCleaned} old deleted messages`,
        cleanedCount: totalCleaned,
        chatsProcessed: chatsToCleanup.length
      };
    } catch (error) {
      console.error('Error cleaning up deleted messages:', error);
      throw error;
    }
  }

  // Get chat statistics for monitoring and optimization
  async getChatStatistics(chatId) {
    try {
      const chat = await Chat.findById(chatId);
      if (!chat) {
        throw new Error('Chat not found');
      }

      const now = new Date();
      const dayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
      const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      const monthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

      const stats = {
        totalMessages: chat.messages.length,
        activeMessages: chat.messages.filter(msg => !msg.isDeleted).length,
        deletedMessages: chat.messages.filter(msg => msg.isDeleted).length,
        editedMessages: chat.messages.filter(msg => msg.isEdited).length,
        messagesLast24h: chat.messages.filter(msg => msg.timestamp > dayAgo).length,
        messagesLastWeek: chat.messages.filter(msg => msg.timestamp > weekAgo).length,
        messagesLastMonth: chat.messages.filter(msg => msg.timestamp > monthAgo).length,
        averageMessageLength: chat.messages
          .filter(msg => !msg.isDeleted)
          .reduce((sum, msg) => sum + msg.content.length, 0) / Math.max(chat.messages.filter(msg => !msg.isDeleted).length, 1),
        fileAttachments: chat.messages.filter(msg => msg.attachments && msg.attachments.length > 0).length,
        storageUsed: chat.messages
          .filter(msg => msg.attachments)
          .reduce((sum, msg) => sum + (msg.attachments?.reduce((attSum, att) => attSum + (att.size || 0), 0) || 0), 0)
      };

      return {
        success: true,
        data: stats
      };
    } catch (error) {
      console.error('Error getting chat statistics:', error);
      throw error;
    }
  }
}

export default new MessageOptimizationService();