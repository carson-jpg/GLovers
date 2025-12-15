import express from 'express';
import { protect } from '../middleware/auth.js';

const router = express.Router();

// Mock call logs data - in a real app, this would be stored in a database
const mockCallLogs = [
  {
    id: '1',
    chatId: 'chat1',
    participantId: 'user1',
    participantEmail: 'john@example.com',
    type: 'voice',
    direction: 'incoming',
    status: 'completed',
    timestamp: new Date(Date.now() - 1000 * 60 * 30).toISOString(), // 30 minutes ago
    duration: 180 // 3 minutes
  },
  {
    id: '2',
    chatId: 'chat2',
    participantId: 'user2',
    participantEmail: 'jane@example.com',
    type: 'video',
    direction: 'outgoing',
    status: 'completed',
    timestamp: new Date(Date.now() - 1000 * 60 * 60 * 2).toISOString(), // 2 hours ago
    duration: 420 // 7 minutes
  },
  {
    id: '3',
    chatId: 'chat1',
    participantId: 'user1',
    participantEmail: 'john@example.com',
    type: 'voice',
    direction: 'missed',
    status: 'missed',
    timestamp: new Date(Date.now() - 1000 * 60 * 60 * 24).toISOString() // 1 day ago
  },
  {
    id: '4',
    chatId: 'chat3',
    participantId: 'user3',
    participantEmail: 'alice@example.com',
    type: 'video',
    direction: 'incoming',
    status: 'rejected',
    timestamp: new Date(Date.now() - 1000 * 60 * 60 * 6).toISOString() // 6 hours ago
  }
];

// @route   GET /api/calls
// @desc    Get user's call logs
// @access  Private
router.get('/', protect, async (req, res) => {
  try {
    // In a real implementation, you would:
    // 1. Query the database for call logs related to the current user
    // 2. Join with user data to get participant information
    // 3. Sort by timestamp descending
    
    // For now, return mock data
    const sortedCallLogs = mockCallLogs.sort((a, b) => 
      new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
    );

    res.status(200).json({
      success: true,
      data: sortedCallLogs
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

// @route   POST /api/calls
// @desc    Log a new call
// @access  Private
router.post('/', protect, async (req, res) => {
  try {
    const { chatId, participantId, type, direction, status, duration } = req.body;

    // Validate required fields
    if (!chatId || !participantId || !type || !direction || !status) {
      return res.status(400).json({
        success: false,
        message: 'Missing required fields'
      });
    }

    // In a real implementation, you would:
    // 1. Create a new call log entry in the database
    // 2. Return the created log entry

    // For now, simulate creating a new log entry
    const newCallLog = {
      id: Date.now().toString(),
      chatId,
      participantId,
      participantEmail: `user${participantId.slice(-4)}@example.com`, // Mock email
      type,
      direction,
      status,
      timestamp: new Date().toISOString(),
      ...(duration && { duration })
    };

    // In real implementation, you would save this to the database
    console.log('New call log created:', newCallLog);

    res.status(201).json({
      success: true,
      data: newCallLog
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({
      success: false,
      message: 'Server error'
    });
  }
});

// @route   GET /api/calls/:chatId
// @desc    Get call logs for a specific chat
// @access  Private
router.get('/:chatId', protect, async (req, res) => {
  try {
    const { chatId } = req.params;

    // In a real implementation, you would query the database
    const chatCallLogs = mockCallLogs.filter(callLog => callLog.chatId === chatId)
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

    res.status(200).json({
      success: true,
      data: chatCallLogs
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