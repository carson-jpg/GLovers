import { Server } from 'socket.io';
import jwt from 'jsonwebtoken';
import Chat from '../models/Chat.js';
import User from '../models/User.js';

class SocketService {
  constructor() {
    this.io = null;
    this.connectedUsers = new Map(); // userId -> socketId
    this.userSockets = new Map(); // socketId -> userId
    this.typingUsers = new Map(); // chatId -> Set of userIds
    this.userStatus = new Map(); // userId -> { status, lastSeen }
  }

  initialize(server) {
    this.io = new Server(server, {
      cors: {
        origin: [
          process.env.FRONTEND_URL,
          'https://g-lovers.vercel.app',
          'http://localhost:8080'
        ].filter(Boolean),
        credentials: true
      }
    });

    // Authentication middleware
    this.io.use(async (socket, next) => {
      try {
        const token = socket.handshake.auth.token;
        if (!token) {
          return next(new Error('Authentication error'));
        }

        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        const user = await User.findById(decoded.id);
        
        if (!user) {
          return next(new Error('User not found'));
        }

        socket.userId = user._id.toString();
        socket.user = user;
        next();
      } catch (error) {
        next(new Error('Authentication error'));
      }
    });

    this.io.on('connection', (socket) => {
      console.log(`User ${socket.userId} connected`);
      
      // Store user connection
      this.connectedUsers.set(socket.userId, socket.id);
      this.userSockets.set(socket.id, socket.userId);
      
      // Join user to their personal room
      socket.join(`user_${socket.userId}`);
      
      // Handle joining chat rooms - FIXED VERSION
      socket.on('join_chat', async (data) => {
        try {
          // Handle both string and object formats for chatId
          const chatId = typeof data === 'string' ? data : data.chatId;
          
          if (!chatId) {
            console.log('❌ Backend: No chatId provided');
            socket.emit('error', { message: 'Chat ID is required' });
            return;
          }
          
          console.log('🏠 Backend: User', socket.userId, 'joining chat:', chatId);
          const chat = await Chat.findById(chatId);
          if (!chat) {
            console.log('❌ Backend: Chat not found:', chatId);
            socket.emit('error', { message: 'Chat not found' });
            return;
          }

          // Check if user is participant
          const isParticipant = chat.participants.some(
            p => p.toString() === socket.userId
          );

          if (!isParticipant) {
            console.log('❌ Backend: Access denied for user:', socket.userId, 'in chat:', chatId);
            socket.emit('error', { message: 'Access denied' });
            return;
          }

          socket.join(`chat_${chatId}`);
          console.log('✅ Backend: User', socket.userId, 'joined chat room:', chatId);
          socket.emit('joined_chat', { chatId });
        } catch (error) {
          console.error('❌ Backend: Failed to join chat:', error);
          socket.emit('error', { message: 'Failed to join chat' });
        }
      });

      // Handle leaving chat rooms
      socket.on('leave_chat', (data) => {
        const { chatId } = data;
        socket.leave(`chat_${chatId}`);
        socket.emit('left_chat', { chatId });
      });

      // Handle sending messages
      socket.on('send_message', async (data) => {
        try {
          console.log('📤 Backend: Received send_message:', data);
          const { chatId, content, type = 'text' } = data;

          if (!content || content.trim() === '') {
            console.log('❌ Backend: Message content is required');
            socket.emit('error', { message: 'Message content is required' });
            return;
          }

          const chat = await Chat.findById(chatId);
          if (!chat) {
            console.log('❌ Backend: Chat not found:', chatId);
            socket.emit('error', { message: 'Chat not found' });
            return;
          }

          // Check if user is participant
          const isParticipant = chat.participants.some(
            p => p.toString() === socket.userId
          );

          if (!isParticipant) {
            console.log('❌ Backend: Access denied for user:', socket.userId);
            socket.emit('error', { message: 'Access denied' });
            return;
          }

          // Create new message
          const message = {
            senderId: socket.userId,
            content: content.trim(),
            type,
            timestamp: new Date()
          };

          // Add message to chat
          chat.messages.push(message);
          chat.lastMessage = message.content;
          chat.lastMessageAt = message.timestamp;
          await chat.save();

          // Broadcast message to all participants
          const messageData = {
            ...message,
            _id: chat.messages[chat.messages.length - 1]._id,
            sender: {
              _id: socket.user._id,
              email: socket.user.email
            }
          };

          console.log('📨 Backend: Broadcasting new_message to chat:', chatId, messageData);
          this.io.to(`chat_${chatId}`).emit('new_message', {
            chatId,
            message: messageData
          });

          // Send push notification to offline users
          this.sendPushNotification(chatId, messageData);

        } catch (error) {
          console.error('❌ Backend: Error sending message:', error);
          socket.emit('error', { message: 'Failed to send message' });
        }
      });

      // Handle typing indicators
      socket.on('typing_start', (data) => {
        this.addUserToTyping(socket.userId, data.chatId);
        socket.to(`chat_${data.chatId}`).emit('user_typing', {
          userId: socket.userId,
          chatId: data.chatId
        });
      });

      socket.on('typing_stop', (data) => {
        this.removeUserFromTyping(socket.userId, data.chatId);
        socket.to(`chat_${data.chatId}`).emit('user_stopped_typing', {
          userId: socket.userId,
          chatId: data.chatId
        });
      });

      // Handle message read status
      socket.on('mark_messages_read', async (data) => {
        try {
          const { chatId } = data;
          const chat = await Chat.findById(chatId);
          
          if (!chat) {
            socket.emit('error', { message: 'Chat not found' });
            return;
          }

          // Mark messages as read by current user
          chat.messages.forEach(message => {
            const alreadyRead = message.readBy.some(
              read => read.userId.toString() === socket.userId
            );
            
            if (!alreadyRead && message.senderId.toString() !== socket.userId) {
              message.readBy.push({
                userId: socket.userId,
                readAt: new Date()
              });
            }
          });

          await chat.save();

          // Notify other participants
          socket.to(`chat_${chatId}`).emit('messages_read', {
            chatId,
            userId: socket.userId
          });

        } catch (error) {
          socket.emit('error', { message: 'Failed to mark messages as read' });
        }
      });

      // Handle message editing
      socket.on('edit_message', async (data) => {
        try {
          const { chatId, messageId, newContent } = data;
          const chat = await Chat.findById(chatId);
          
          if (!chat) {
            socket.emit('error', { message: 'Chat not found' });
            return;
          }

          const message = chat.messages.id(messageId);
          if (!message || message.senderId.toString() !== socket.userId) {
            socket.emit('error', { message: 'Message not found or unauthorized' });
            return;
          }

          message.content = newContent.trim();
          message.isEdited = true;
          message.editedAt = new Date();
          await chat.save();

          this.io.to(`chat_${chatId}`).emit('message_edited', {
            chatId,
            messageId,
            newContent: message.content,
            editedAt: message.editedAt
          });
        } catch (error) {
          console.error('Error editing message:', error);
          socket.emit('error', { message: 'Failed to edit message' });
        }
      });

      // Handle message deletion
      socket.on('delete_message', async (data) => {
        try {
          const { chatId, messageId } = data;
          const chat = await Chat.findById(chatId);
          
          if (!chat) {
            socket.emit('error', { message: 'Chat not found' });
            return;
          }

          const message = chat.messages.id(messageId);
          if (!message || message.senderId.toString() !== socket.userId) {
            socket.emit('error', { message: 'Message not found or unauthorized' });
            return;
          }

          message.isDeleted = true;
          message.deletedAt = new Date();
          await chat.save();

          this.io.to(`chat_${chatId}`).emit('message_deleted', {
            chatId,
            messageId
          });
        } catch (error) {
          console.error('Error deleting message:', error);
          socket.emit('error', { message: 'Failed to delete message' });
        }
      });

      // Handle user presence
      socket.on('user_online', () => {
        this.sendToUser(socket.userId, 'user_status', {
          userId: socket.userId,
          status: 'online',
          lastSeen: new Date()
        });
      });

      socket.on('user_away', () => {
        this.sendToUser(socket.userId, 'user_status', {
          userId: socket.userId,
          status: 'away'
        });
      });

      // Handle message delivery status
      socket.on('message_delivered', async (data) => {
        try {
          const { chatId, messageId } = data;
          const chat = await Chat.findById(chatId);
          
          if (chat) {
            const message = chat.messages.id(messageId);
            if (message) {
              const alreadyDelivered = message.deliveredTo?.some(
                delivered => delivered.userId.toString() === socket.userId
              );
              
              if (!alreadyDelivered) {
                if (!message.deliveredTo) {
                  message.deliveredTo = [];
                }
                message.deliveryStatus = 'delivered';
                message.deliveredTo.push({
                  userId: socket.userId,
                  deliveredAt: new Date()
                });
                await chat.save();

                // Notify sender
                this.sendToUser(message.senderId.toString(), 'message_delivered', {
                  chatId,
                  messageId,
                  deliveredTo: socket.userId
                });
              }
            }
          }
        } catch (error) {
          console.error('Error updating delivery status:', error);
        }
      });

      // Handle connection state
      socket.on('get_connected_users', () => {
        const connectedUsersList = Array.from(this.connectedUsers.keys());
        socket.emit('connected_users', connectedUsersList);
      });

      // Handle chat participant updates
      socket.on('chat_participant_left', async (data) => {
        try {
          const { chatId } = data;
          const chat = await Chat.findById(chatId);
          
          if (chat) {
            chat.participants = chat.participants.filter(
              p => p.toString() !== socket.userId
            );
            await chat.save();

            socket.leave(`chat_${chatId}`);
            socket.to(`chat_${chatId}`).emit('participant_left', {
              chatId,
              userId: socket.userId
            });
          }
        } catch (error) {
          console.error('Error handling participant leave:', error);
        }
      });

      // Handle disconnection with enhanced logging
      socket.on('disconnect', (reason) => {
        console.log(`User ${socket.userId} disconnected: ${reason}`);
        this.connectedUsers.delete(socket.userId);
        this.userSockets.delete(socket.id);
        
        // Clear typing status
        this.clearUserTypingStatus(socket.userId);
        
        // Notify other users that this user is offline
        this.broadcastUserStatus(socket.userId, 'offline', new Date());
      });

      // Enhanced connection event
      socket.on('connection_confirmed', () => {
        console.log(`Connection confirmed for user ${socket.userId}`);
        this.broadcastUserStatus(socket.userId, 'online', new Date());
      });

      // Handle typing timeout cleanup
      socket.on('clear_typing', (data) => {
        const { chatId } = data;
        this.clearTypingForChat(chatId, socket.userId);
      });

      // Handle WebRTC call signaling
      socket.on('call_offer', async (data) => {
        const { recipientId, callId, offer, config } = data;
        try {
          // Send offer to recipient
          this.sendToUser(recipientId, 'incoming_call', {
            callId,
            from: socket.userId,
            offer,
            config
          });
        } catch (error) {
          console.error('Error sending call offer:', error);
          socket.emit('call_failed', { callId, reason: 'Failed to send call offer' });
        }
      });

      socket.on('call_answer', async (data) => {
        const { callId, answer } = data;
        try {
          // Find the original caller (you might want to store call initiator in a database)
          // For now, we'll send back to all connected users except the answerer
          socket.broadcast.emit('call_answered', { callId, answer });
        } catch (error) {
          console.error('Error sending call answer:', error);
          socket.emit('call_failed', { callId, reason: 'Failed to send call answer' });
        }
      });

      socket.on('ice_candidate', async (data) => {
        const { callId, candidate } = data;
        try {
          // Broadcast ICE candidate to all other users in the call
          socket.broadcast.emit('ice_candidate', { callId, candidate });
        } catch (error) {
          console.error('Error sending ICE candidate:', error);
        }
      });

      socket.on('end_call', async (data) => {
        const { callId } = data;
        try {
          // Notify all users that the call has ended
          socket.broadcast.emit('call_ended', { callId });
        } catch (error) {
          console.error('Error ending call:', error);
        }
      });

      socket.on('reject_call', async (data) => {
        const { callId, reason } = data;
        try {
          // Notify all users that the call was rejected
          socket.broadcast.emit('call_rejected', { callId, reason });
        } catch (error) {
          console.error('Error rejecting call:', error);
        }
      });
    });

    return this.io;
  }

  // Send push notification to offline users
  async sendPushNotification(chatId, messageData) {
    try {
      const chat = await Chat.findById(chatId).populate('participants');
      
      for (const participant of chat.participants) {
        const isOnline = this.connectedUsers.has(participant._id.toString());
        
        if (!isOnline && participant._id.toString() !== messageData.senderId) {
          // Here you would integrate with your push notification service
          // For now, we'll just log it
          console.log(`Push notification for user ${participant._id}: New message from ${messageData.sender.email}`);
        }
      }
    } catch (error) {
      console.error('Error sending push notification:', error);
    }
  }

  // Check if user is online
  isUserOnline(userId) {
    return this.connectedUsers.has(userId);
  }

  // Send notification to specific user
  sendToUser(userId, event, data) {
    this.io.to(`user_${userId}`).emit(event, data);
  }

  // Get connected users count
  getConnectedUsersCount() {
    return this.connectedUsers.size;
  }

  // Broadcast user status to all relevant users
  broadcastUserStatus(userId, status, lastSeen) {
    this.userStatus.set(userId, { status, lastSeen });
    
    // Notify all connected users about this user's status
    this.io.emit('user_status_changed', {
      userId,
      status,
      lastSeen
    });
  }

  // Clear user typing status across all chats
  clearUserTypingStatus(userId) {
    for (const [chatId, typingSet] of this.typingUsers.entries()) {
      if (typingSet.has(userId)) {
        typingSet.delete(userId);
        this.io.to(`chat_${chatId}`).emit('user_stopped_typing', {
          userId,
          chatId
        });
      }
    }
  }

  // Clear typing for specific chat
  clearTypingForChat(chatId, userId) {
    const typingSet = this.typingUsers.get(chatId);
    if (typingSet && typingSet.has(userId)) {
      typingSet.delete(userId);
      this.io.to(`chat_${chatId}`).emit('user_stopped_typing', {
        userId,
        chatId
      });
    }
  }

  // Get user status
  getUserStatus(userId) {
    return this.userStatus.get(userId) || { status: 'offline', lastSeen: null };
  }

  // Get all connected users
  getAllConnectedUsers() {
    return Array.from(this.connectedUsers.keys());
  }

  // Check if user is typing in a specific chat
  isUserTyping(userId, chatId) {
    const typingSet = this.typingUsers.get(chatId);
    return typingSet ? typingSet.has(userId) : false;
  }

  // Add user to typing set
  addUserToTyping(userId, chatId) {
    if (!this.typingUsers.has(chatId)) {
      this.typingUsers.set(chatId, new Set());
    }
    this.typingUsers.get(chatId).add(userId);
  }

  // Remove user from typing set
  removeUserFromTyping(userId, chatId) {
    const typingSet = this.typingUsers.get(chatId);
    if (typingSet) {
      typingSet.delete(userId);
      if (typingSet.size === 0) {
        this.typingUsers.delete(chatId);
      }
    }
  }
}

export default new SocketService();