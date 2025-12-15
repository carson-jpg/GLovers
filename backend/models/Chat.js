import mongoose from 'mongoose';

const messageSchema = new mongoose.Schema({
  senderId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  content: {
    type: String,
    required: true,
    maxlength: 1000
  },
  type: {
    type: String,
    enum: ['text', 'image', 'system'],
    default: 'text'
  },
  timestamp: {
    type: Date,
    default: Date.now
  },
  readBy: [{
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    readAt: {
      type: Date,
      default: Date.now
    }
  }],
  // New fields for enhanced messaging
  deliveryStatus: {
    type: String,
    enum: ['sent', 'delivered', 'read'],
    default: 'sent'
  },
  deliveredTo: [{
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    deliveredAt: {
      type: Date,
      default: Date.now
    }
  }],
  isEdited: {
    type: Boolean,
    default: false
  },
  editedAt: {
    type: Date
  },
  isDeleted: {
    type: Boolean,
    default: false
  },
  deletedAt: {
    type: Date
  },
  // File attachment fields
  attachments: [{
    type: {
      type: String,
      enum: ['image', 'file', 'audio', 'video']
    },
    url: String,
    filename: String,
    size: Number,
    mimeType: String
  }]
});

const chatSchema = new mongoose.Schema({
  participants: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  }],
  lastMessage: {
    type: String,
    default: ''
  },
  lastMessageAt: {
    type: Date,
    default: Date.now
  },
  isActive: {
    type: Boolean,
    default: true
  },
  messages: [messageSchema],
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  },
  // Chat metadata
  chatType: {
    type: String,
    enum: ['direct', 'group'],
    default: 'direct'
  },
  chatName: {
    type: String
  },
  admin: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  // Settings
  settings: {
    notifications: {
      type: Boolean,
      default: true
    },
    soundEnabled: {
      type: Boolean,
      default: true
    },
    messageRetention: {
      type: Number,
      default: 365 // days
    }
  }
});

// Ensure participants are unique and sorted
chatSchema.pre('save', function(next) {
  this.participants = [...new Set(this.participants)].sort();
  this.updatedAt = Date.now();
  next();
});

// Update lastMessageAt when new message is added
chatSchema.pre('save', function(next) {
  if (this.isModified('messages')) {
    const lastMessage = this.messages[this.messages.length - 1];
    if (lastMessage && !lastMessage.isDeleted) {
      this.lastMessage = lastMessage.content;
      this.lastMessageAt = lastMessage.timestamp;
    }
  }
  next();
});

// Virtual for chat display name (if it's a direct chat)
chatSchema.virtual('displayName').get(function() {
  if (this.chatType === 'direct' && this.participants.length === 2) {
    return 'Direct Chat';
  }
  return this.chatName || 'Group Chat';
});

// Method to get unread message count for a user
chatSchema.methods.getUnreadCount = function(userId) {
  return this.messages.filter(message => {
    if (message.isDeleted || message.senderId.toString() === userId.toString()) {
      return false;
    }
    return !message.readBy.some(read => read.userId.toString() === userId.toString());
  }).length;
};

// Method to mark messages as read
chatSchema.methods.markMessagesAsRead = function(userId) {
  this.messages.forEach(message => {
    if (!message.isDeleted && message.senderId.toString() !== userId.toString()) {
      const alreadyRead = message.readBy.some(read => read.userId.toString() === userId.toString());
      if (!alreadyRead) {
        message.readBy.push({
          userId,
          readAt: new Date()
        });
      }
    }
  });
};

// Method to get messages for a specific user (with privacy filtering)
chatSchema.methods.getVisibleMessages = function(userId) {
  return this.messages.filter(message => {
    // Hide deleted messages from everyone except sender
    if (message.isDeleted) {
      return message.senderId.toString() === userId.toString();
    }
    return true;
  });
};

// Index for efficient queries
chatSchema.index({ participants: 1 });
chatSchema.index({ lastMessageAt: -1 });
chatSchema.index({ 'messages.senderId': 1 });
chatSchema.index({ 'messages.timestamp': -1 });
chatSchema.index({ chatType: 1 });

// Ensure virtuals are included in JSON
chatSchema.set('toJSON', { virtuals: true });
chatSchema.set('toObject', { virtuals: true });

const Chat = mongoose.model('Chat', chatSchema);

export default Chat;