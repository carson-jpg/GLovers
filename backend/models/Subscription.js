import mongoose from 'mongoose';

const subscriptionSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  planType: {
    type: String,
    required: true,
    enum: ['weekly', 'monthly']
  },
  amount: {
    type: Number,
    required: true
  },
  startDate: {
    type: Date,
    default: Date.now
  },
  endDate: {
    type: Date,
    required: true
  },
  isActive: {
    type: Boolean,
    default: true
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

// Index for efficient queries
subscriptionSchema.index({ userId: 1, isActive: 1, endDate: -1 });

// Method to check if subscription is still valid
subscriptionSchema.methods.isValid = function() {
  return this.isActive && new Date() < this.endDate;
};

// Static method to get active subscription for a user
subscriptionSchema.statics.getActiveSubscription = async function(userId) {
  return await this.findOne({
    userId,
    isActive: true,
    endDate: { $gte: new Date() }
  }).sort({ endDate: -1 });
};

// Automatically deactivate expired subscriptions
subscriptionSchema.pre('save', function(next) {
  if (new Date() >= this.endDate) {
    this.isActive = false;
  }
  next();
});

const Subscription = mongoose.model('Subscription', subscriptionSchema);

export default Subscription;
