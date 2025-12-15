import express from 'express';
import { protect } from '../middleware/auth.js';
import CallLog from '../models/CallLog.js';
import Chat from '../models/Chat.js';
import User from '../models/User.js';

const router = express.Router();

// @route   GET /api/calls
// @desc    Get user's call logs
// @access  Private
router.get('/', protect, async (req, res) => {
  try {
    const userId = req.user.id;
    
    // Get call logs for the current user
    const callLogs = await CallLog.find({
      $or: [
        { callerId: userId },
        { recipientId: userId }
      ]
    })
    .populate('callerId', 'email')
    .populate('recipientId', 'email')
    .populate('chatId', 'participants')
    .sort({ createdAt: -1 })
    .limit(100); // Limit to recent 100 calls

    // Transform the data to match the expected frontend format
    const transformedLogs = callLogs.map(callLog => {
      const otherUser = callLog.callerId.toString() === userId 
        ? callLog.recipientId 
        : callLog.callerId;
      
      // Find the chat between these users
      const chat = callLog.chatId;
      
      return {
        id: callLog._id.toString(),
        chatId: callLog.chatId._id.toString(),
        participantId: otherUser._id.toString(),
        participantEmail: otherUser.email,
        type: callLog.callType,
        direction: callLog.direction,
        status: callLog.status,
        timestamp: callLog.createdAt.toISOString(),
        duration: callLog.duration || undefined,
        callId: callLog.callId || undefined,
        reason: callLog.reason || undefined
      };
    });

    res.status(200).json({
      success: true,
      data: transformedLogs
    });
  } catch (error) {
    console.error('Error fetching call logs:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch call logs'
    });
  }
});

// @route   POST /api/calls
// @desc    Log a new call
// @access  Private
router.post('/', protect, async (req, res) => {
  try {
    const { chatId, participantId, callType, direction, status, duration, callId, reason } = req.body;
    const userId = req.user.id;

    // Validate required fields
    if (!chatId || !participantId || !callType || !direction || !status) {
      return res.status(400).json({
        success: false,
        message: 'Missing required fields'
      });
    }

    // Verify that the chat exists and user is a participant
    const chat = await Chat.findById(chatId);
    if (!chat) {
      return res.status(404).json({
        success: false,
        message: 'Chat not found'
      });
    }

    // Verify user is a participant in the chat
    if (!chat.participants.some(p => p.toString() === userId)) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to log calls for this chat'
      });
    }

    // Verify the participant is also in the chat
    if (!chat.participants.some(p => p.toString() === participantId)) {
      return res.status(400).json({
        success: false,
        message: 'Participant not found in chat'
      });
    }

    // Determine caller and recipient based on direction
    const callerId = direction === 'outgoing' ? userId : participantId;
    const recipientId = direction === 'outgoing' ? participantId : userId;

    // Create new call log
    const newCallLog = new CallLog({
      chatId,
      callerId,
      recipientId,
      callType,
      direction,
      status,
      callId,
      reason,
      startTime: new Date(),
      endTime: status === 'completed' ? new Date() : undefined,
      duration: duration || 0
    });

    // Calculate duration if call was completed
    if (status === 'completed' && duration) {
      newCallLog.duration = duration;
    }

    await newCallLog.save();

    // Populate the saved call log for response
    await newCallLog.populate(['callerId', 'recipientId', 'chatId']);

    // Transform for response
    const otherUser = newCallLog.callerId.toString() === userId 
      ? newCallLog.recipientId 
      : newCallLog.callerId;

    const responseData = {
      id: newCallLog._id.toString(),
      chatId: newCallLog.chatId._id.toString(),
      participantId: otherUser._id.toString(),
      participantEmail: otherUser.email,
      type: newCallLog.callType,
      direction: newCallLog.direction,
      status: newCallLog.status,
      timestamp: newCallLog.createdAt.toISOString(),
      duration: newCallLog.duration || undefined,
      callId: newCallLog.callId || undefined,
      reason: newCallLog.reason || undefined
    };

    res.status(201).json({
      success: true,
      data: responseData
    });
  } catch (error) {
    console.error('Error creating call log:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create call log'
    });
  }
});

// @route   GET /api/calls/:chatId
// @desc    Get call logs for a specific chat
// @access  Private
router.get('/:chatId', protect, async (req, res) => {
  try {
    const { chatId } = req.params;
    const userId = req.user.id;

    // Verify the chat exists and user is a participant
    const chat = await Chat.findById(chatId);
    if (!chat) {
      return res.status(404).json({
        success: false,
        message: 'Chat not found'
      });
    }

    // Verify user is a participant in the chat
    if (!chat.participants.some(p => p.toString() === userId)) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to view calls for this chat'
      });
    }

    // Get call logs for this chat
    const callLogs = await CallLog.find({ chatId })
      .populate('callerId', 'email')
      .populate('recipientId', 'email')
      .sort({ createdAt: -1 });

    // Transform the data
    const transformedLogs = callLogs.map(callLog => {
      const otherUser = callLog.callerId.toString() === userId 
        ? callLog.recipientId 
        : callLog.callerId;
      
      return {
        id: callLog._id.toString(),
        chatId: callLog.chatId.toString(),
        participantId: otherUser._id.toString(),
        participantEmail: otherUser.email,
        type: callLog.callType,
        direction: callLog.direction,
        status: callLog.status,
        timestamp: callLog.createdAt.toISOString(),
        duration: callLog.duration || undefined,
        callId: callLog.callId || undefined,
        reason: callLog.reason || undefined
      };
    });

    res.status(200).json({
      success: true,
      data: transformedLogs
    });
  } catch (error) {
    console.error('Error fetching chat call logs:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch call logs'
    });
  }
});

// @route   PUT /api/calls/:id
// @desc    Update a call log (e.g., mark as completed with duration)
// @access  Private
router.put('/:id', protect, async (req, res) => {
  try {
    const { id } = req.params;
    const { status, duration, endTime, reason } = req.body;
    const userId = req.user.id;

    // Find the call log
    const callLog = await CallLog.findById(id);
    if (!callLog) {
      return res.status(404).json({
        success: false,
        message: 'Call log not found'
      });
    }

    // Verify user is involved in this call
    if (callLog.callerId.toString() !== userId && callLog.recipientId.toString() !== userId) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to update this call log'
      });
    }

    // Update fields
    if (status) callLog.status = status;
    if (reason) callLog.reason = reason;
    
    if (endTime) {
      callLog.endTime = new Date(endTime);
    } else if (status === 'completed') {
      callLog.endTime = new Date();
    }

    if (duration !== undefined) {
      callLog.duration = duration;
    } else if (callLog.endTime && callLog.startTime) {
      callLog.calculateDuration();
    }

    await callLog.save();
    await callLog.populate(['callerId', 'recipientId', 'chatId']);

    // Transform for response
    const otherUser = callLog.callerId.toString() === userId 
      ? callLog.recipientId 
      : callLog.callerId;

    const responseData = {
      id: callLog._id.toString(),
      chatId: callLog.chatId._id.toString(),
      participantId: otherUser._id.toString(),
      participantEmail: otherUser.email,
      type: callLog.callType,
      direction: callLog.direction,
      status: callLog.status,
      timestamp: callLog.createdAt.toISOString(),
      duration: callLog.duration || undefined,
      callId: callLog.callId || undefined,
      reason: callLog.reason || undefined
    };

    res.status(200).json({
      success: true,
      data: responseData
    });
  } catch (error) {
    console.error('Error updating call log:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update call log'
    });
  }
});

// @route   DELETE /api/calls/:id
// @desc    Delete a call log
// @access  Private
router.delete('/:id', protect, async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    // Find the call log
    const callLog = await CallLog.findById(id);
    if (!callLog) {
      return res.status(404).json({
        success: false,
        message: 'Call log not found'
      });
    }

    // Verify user is involved in this call
    if (callLog.callerId.toString() !== userId && callLog.recipientId.toString() !== userId) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to delete this call log'
      });
    }

    // Delete the call log
    await CallLog.findByIdAndDelete(id);

    res.status(200).json({
      success: true,
      message: 'Call log deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting call log:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete call log'
    });
  }
});

export default router;