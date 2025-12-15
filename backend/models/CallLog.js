import mongoose from 'mongoose';

const callLogSchema = new mongoose.Schema({
  chatId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Chat',
    required: true
  },
  callerId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  recipientId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  callType: {
    type: String,
    enum: ['voice', 'video'],
    required: true
  },
  direction: {
    type: String,
    enum: ['outgoing', 'incoming'],
    required: true
  },
  status: {
    type: String,
    enum: ['completed', 'missed', 'rejected', 'failed', 'busy'],
    default: 'completed'
  },
  startTime: {
    type: Date,
    default: Date.now
  },
  endTime: {
    type: Date
  },
  duration: {
    type: Number, // duration in seconds
    default: 0
  },
  // Additional call metadata
  callId: {
    type: String, // WebRTC call ID for tracking
    unique: true,
    sparse: true
  },
  reason: {
    type: String, // Reason for failed/missed calls
    enum: ['no-answer', 'declined', 'busy', 'network-error', 'timeout', null],
    default: null
  },
  // Call quality metrics (optional)
  quality: {
    audioQuality: {
      type: Number,
      min: 1,
      max: 5
    },
    videoQuality: {
      type: Number,
      min: 1,
      max: 5
    },
    connectionStability: {
      type: Number,
      min: 1,
      max: 5
    }
  }
}, {
  timestamps: true
});

// Index for efficient queries
callLogSchema.index({ callerId: 1, createdAt: -1 });
callLogSchema.index({ recipientId: 1, createdAt: -1 });
callLogSchema.index({ chatId: 1, createdAt: -1 });
callLogSchema.index({ status: 1 });
callLogSchema.index({ callType: 1 });
callLogSchema.index({ direction: 1 });

// Virtual for formatted duration
callLogSchema.virtual('formattedDuration').get(function() {
  if (!this.duration || this.duration === 0) return null;
  
  const minutes = Math.floor(this.duration / 60);
  const seconds = this.duration % 60;
  
  if (minutes === 0) {
    return `${seconds}s`;
  } else if (seconds === 0) {
    return `${minutes}m`;
  } else {
    return `${minutes}m ${seconds}s`;
  }
});

// Method to calculate call duration
callLogSchema.methods.calculateDuration = function() {
  if (this.endTime && this.startTime) {
    this.duration = Math.floor((this.endTime.getTime() - this.startTime.getTime()) / 1000);
  }
  return this.duration;
};

// Static method to get call logs for a user
callLogSchema.statics.getUserCallLogs = function(userId, options = {}) {
  const { limit = 50, skip = 0, status, callType, direction } = options;
  
  let query = {
    $or: [
      { callerId: userId },
      { recipientId: userId }
    ]
  };
  
  // Add filters if provided
  if (status) query.status = status;
  if (callType) query.callType = callType;
  if (direction) query.direction = direction;
  
  return this.find(query)
    .populate('callerId', 'email')
    .populate('recipientId', 'email')
    .populate('chatId', 'participants')
    .sort({ createdAt: -1 })
    .limit(limit)
    .skip(skip);
};

// Static method to get call statistics for a user
callLogSchema.statics.getUserCallStats = function(userId) {
  return this.aggregate([
    {
      $match: {
        $or: [
          { callerId: mongoose.Types.ObjectId(userId) },
          { recipientId: mongoose.Types.ObjectId(userId) }
        ]
      }
    },
    {
      $group: {
        _id: {
          userId: {
            $cond: [
              { $eq: ['$callerId', mongoose.Types.ObjectId(userId)] },
              '$recipientId',
              '$callerId'
            ]
          },
          status: '$status'
        },
        count: { $sum: 1 },
        totalDuration: { $sum: '$duration' },
        lastCall: { $max: '$createdAt' }
      }
    },
    {
      $group: {
        _id: '$_id.userId',
        totalCalls: { $sum: '$count' },
        completedCalls: {
          $sum: {
            $cond: [{ $eq: ['$_id.status', 'completed'] }, '$count', 0]
          }
        },
        missedCalls: {
          $sum: {
            $cond: [{ $eq: ['$_id.status', 'missed'] }, '$count', 0]
          }
        },
        totalDuration: { $sum: '$totalDuration' },
        lastCall: { $max: '$lastCall' }
      }
    }
  ]);
};

// Pre-save middleware to calculate duration
callLogSchema.pre('save', function(next) {
  if (this.isModified('endTime') && this.startTime && this.endTime) {
    this.calculateDuration();
  }
  next();
});

// Ensure virtuals are included in JSON
callLogSchema.set('toJSON', { virtuals: true });
callLogSchema.set('toObject', { virtuals: true });

const CallLog = mongoose.model('CallLog', callLogSchema);

export default CallLog;