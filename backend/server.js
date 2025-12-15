import express from 'express';
import dotenv from 'dotenv';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import bodyParser from 'body-parser';
import { createServer } from 'http';
import connectDB from './config/database.js';
import socketService from './services/socketService.js';

// Import routes
import authRoutes from './routes/auth.js';
import profileRoutes from './routes/profiles.js';
import subscriptionRoutes from './routes/subscriptions.js';
import paymentRoutes from './routes/payments.js';
import chatRoutes from './routes/chats.js';
import chatRoutesOptimized from './routes/chatsOptimized.js';
import timelineRoutes from './routes/timeline.js';
import callRoutes from './routes/calls.js';

// Load environment variables
dotenv.config();

// Connect to database
connectDB();

const app = express();
const server = createServer(app);

// Initialize Socket.IO
socketService.initialize(server);

// Raw body parser for all requests
app.use(bodyParser.raw({
  type: '*/*',
  limit: '10mb'
}));

// Ultra-safe JSON parsing middleware
app.use((req, res, next) => {
  const contentType = req.headers['content-type'] || '';
  
  // Skip ALL parsing for multipart form data
  if (contentType.includes('multipart/form-data')) {
    console.log('Skipping parsing for multipart request');
    return next();
  }
  
  // Only attempt JSON parsing if we have body data and it's clearly JSON
  if (contentType.includes('application/json') && req.body && req.body.length > 0) {
    try {
      // Check if body looks like JSON before parsing
      const bodyStr = req.body.toString('utf8').trim();
      if (bodyStr.startsWith('{') || bodyStr.startsWith('[')) {
        req.body = JSON.parse(bodyStr);
      } else {
        console.log('Body does not appear to be JSON:', bodyStr.substring(0, 50));
      }
    } catch (error) {
      console.error('JSON parsing error:', error.message);
      console.log('Attempted to parse:', req.body.toString('utf8').substring(0, 100));
      // Don't send error response, just log and continue
      // This prevents the request from failing
    }
  }
  
  next();
});

// Cookie parser middleware
app.use(cookieParser());

// CORS middleware
app.use(
  cors({
    origin: [
      process.env.FRONTEND_URL,
      'https://g-lovers.vercel.app',
      'http://localhost:5173',
      'http://localhost:8080'
    ].filter(Boolean),
    credentials: true
  })
);

// Mount routes
app.use('/api/auth', authRoutes);
app.use('/api/profiles', profileRoutes);
app.use('/api/subscriptions', subscriptionRoutes);
app.use('/api/payments', paymentRoutes);
// Mount optimized chat routes BEFORE regular chat routes to avoid conflicts
app.use('/api/chats/optimized', chatRoutesOptimized); // Optimized chat routes
app.use('/api/chats', chatRoutes); // Regular chat routes
app.use('/api/timeline', timelineRoutes); // Timeline routes
app.use('/api/calls', callRoutes); // Call logs routes

// Health check route
app.get('/api/health', (req, res) => {
  res.status(200).json({
    success: true,
    message: 'API is running',
    timestamp: new Date().toISOString(),
    socketStatus: socketService.getConnectedUsersCount() > 0 ? 'active' : 'inactive',
    optimizations: {
      messageOptimization: 'enabled',
      virtualScrolling: 'supported',
      searchAPI: 'available'
    }
  });
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({
    success: false,
    message: 'Internal Server Error',
    error: process.env.NODE_ENV === 'development' ? err.message : undefined
  });
});

// Handle 404 routes
app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: 'Route not found'
  });
});

const PORT = process.env.PORT || 5000;

server.listen(PORT, () => {
  console.log(`Server running in ${process.env.NODE_ENV || 'development'} mode on port ${PORT}`);
  console.log(`Socket.IO server ready for real-time connections`);
  console.log(`Message optimization features enabled`);
  console.log(`Available optimized endpoints:`);
  console.log(`  - GET /api/chats/optimized`);
  console.log(`  - GET /api/chats/:chatId/messages/optimized`);
  console.log(`  - GET /api/chats/:chatId/search`);
  console.log(`  - GET /api/chats/:chatId/messages/virtual-scroll`);
  console.log(`  - GET /api/chats/:chatId/statistics`);
});
