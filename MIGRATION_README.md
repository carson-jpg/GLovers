# Backend Migration: Supabase → MongoDB, Node.js, Express

## Overview

This document outlines the migration from Supabase to a custom Node.js, Express, and MongoDB backend. The migration maintains all existing functionality while providing more control and flexibility over the backend infrastructure.

## Changes Made

### Backend Architecture

#### New Stack
- **Runtime**: Node.js with ES modules
- **Framework**: Express.js
- **Database**: MongoDB with Mongoose ODM
- **Authentication**: JWT-based with bcrypt password hashing
- **OAuth**: Google OAuth 2.0 support
- **Payments**: M-Pesa Daraja API integration
- **Validation**: express-validator

#### Project Structure
```
backend/
├── config/
│   └── database.js       # MongoDB connection configuration
├── middleware/
│   └── auth.js           # JWT authentication middleware
├── models/
│   ├── User.js           # User model
│   ├── Profile.js        # Profile model
│   ├── Subscription.js   # Subscription model
│   └── Payment.js        # Payment model
├── routes/
│   ├── auth.js           # Authentication routes
│   ├── profiles.js       # Profile management routes
│   ├── subscriptions.js  # Subscription routes
│   └── payments.js       # Payment processing routes
├── services/
│   └── mpesaService.js   # M-Pesa Daraja API service
├── .env                  # Environment variables
├── .env.example          # Environment template
├── package.json          # Dependencies
└── server.js             # Main server entry point
```

### Frontend Changes

#### Removed Dependencies
- `@supabase/supabase-js`

#### New Files
- `src/integrations/api/client.ts` - API client for backend communication

#### Modified Files
- `src/hooks/useAuth.tsx` - Updated to use new API client with Google OAuth support
- `src/pages/CreateProfile.tsx` - Updated to use new API
- `src/pages/Payment.tsx` - Updated with real-time M-Pesa payment status
- `src/pages/Subscription.tsx` - Updated to use new API
- `package.json` - Removed Supabase dependency
- `.env` - Added API URL and Google OAuth configuration

## API Endpoints

### Authentication (`/api/auth`)
- `POST /signup` - Register new user
- `POST /signin` - User login
- `POST /google` - Google OAuth sign-in
- `POST /signout` - User logout
- `GET /me` - Get current user info

### Profiles (`/api/profiles`)
- `POST /` - Create new profile
- `GET /me` - Get current user's profile
- `PUT /me` - Update current user's profile
- `GET /` - Get all profiles (for browsing)

### Subscriptions (`/api/subscriptions`)
- `POST /` - Create new subscription
- `GET /me` - Get current user's subscription
- `GET /` - Get all subscriptions (admin)

### Payments (`/api/payments`)
- `POST /` - Create new payment (initiates M-Pesa STK Push)
- `POST /check-status` - Check payment status
- `POST /callback` - M-Pesa callback URL
- `GET /` - Get user's payment history
- `GET /:id` - Get specific payment

## Setup Instructions

### Prerequisites
- Node.js (v18 or higher)
- MongoDB (local or cloud instance)
- npm or yarn
- Google OAuth credentials (for Google sign-in)
- M-Pesa Daraja API credentials (for payments)

### Google OAuth Setup

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select existing one
3. Enable Google+ API
4. Create OAuth 2.0 credentials
5. Add authorized origins:
   - `http://localhost:5173` (for development)
   - Your production domain (for production)
6. Add authorized redirect URIs:
   - `http://localhost:5173` (for development)
   - Your production domain (for production)

### M-Pesa Daraja API Setup

1. Register at [Safaricom Developer Portal](https://developer.safaricom.co.ke/)
2. Create an app and get credentials:
   - Consumer Key
   - Consumer Secret
   - Shortcode
   - Passkey
3. Configure callback URLs in your app settings

### Backend Setup

1. Navigate to backend directory:
```bash
cd backend
```

2. Install dependencies:
```bash
npm install
```

3. Configure environment variables:
   - Copy `.env.example` to `.env`
   - Update the following variables:
     - `MONGODB_URI`: Your MongoDB connection string
     - `JWT_SECRET`: A secure random string for JWT signing
     - `PORT`: Server port (default: 5000)
     - `FRONTEND_URL`: Your frontend URL (default: http://localhost:5173)
     - `GOOGLE_CLIENT_ID`: Your Google OAuth Client ID
     - `GOOGLE_CLIENT_SECRET`: Your Google OAuth Client Secret
     - `MPESA_CONSUMER_KEY`: Your M-Pesa Consumer Key
     - `MPESA_CONSUMER_SECRET`: Your M-Pesa Consumer Secret
     - `MPESA_SHORTCODE`: Your M-Pesa Shortcode
     - `MPESA_PASSKEY`: Your M-Pesa Passkey
     - `MPESA_ENVIRONMENT`: sandbox or production

4. Start MongoDB:
```bash
# If using local MongoDB
mongod

# Or use MongoDB Atlas cloud service
```

5. Start the backend server:
```bash
# Development mode (with nodemon)
npm run dev

# Production mode
npm start
```

### Frontend Setup

1. Install dependencies (if not already done):
```bash
npm install
```

2. Configure environment variables:
   - Copy `.env.example` to `.env`
   - Update the following variables:
     - `VITE_API_URL` to point to your backend (default: http://localhost:5000/api)
     - `VITE_GOOGLE_CLIENT_ID` to your Google OAuth Client ID

3. Start the frontend:
```bash
npm run dev
```

## Database Schema

### User Model
```javascript
{
  email: String (unique, required)
  password: String (hashed, required)
  provider: String (enum: 'email', 'google', default: 'email')
  googleId: String (optional)
  createdAt: Date
  updatedAt: Date
}
```

### Profile Model
```javascript
{
  userId: ObjectId (ref: User, unique, required)
  fullName: String (required)
  dateOfBirth: Date (required)
  gender: String (enum: 'male', 'female', 'other', required)
  location: String (optional)
  bio: String (optional)
  interests: [String]
  avatarUrl: String
  isVerified: Boolean (default: false)
  createdAt: Date
  updatedAt: Date
}
```

### Subscription Model
```javascript
{
  userId: ObjectId (ref: User, required)
  planType: String (enum: 'weekly', 'monthly', required)
  amount: Number (required)
  startDate: Date
  endDate: Date (required)
  isActive: Boolean (default: true)
  createdAt: Date
}
```

### Payment Model
```javascript
{
  userId: ObjectId (ref: User, required)
  subscriptionId: ObjectId (ref: Subscription, optional)
  amount: Number (required)
  phoneNumber: String (required)
  transactionCode: String
  status: String (enum: 'pending', 'completed', 'failed', 'cancelled', default: 'pending')
  paymentMethod: String (default: 'mpesa')
  metadata: Mixed (includes M-Pesa request IDs)
  createdAt: Date
  updatedAt: Date
}
```

## Authentication Flow

### Email/Password Authentication
1. User signs up/signs in with email and password
2. Backend validates credentials and generates JWT token
3. Token is stored in localStorage on frontend
4. Token is sent in Authorization header for authenticated requests
5. Backend middleware validates token on protected routes

### Google OAuth Authentication
1. User clicks "Sign in with Google" button
2. Google Sign-In SDK is loaded (if not already loaded)
3. User is redirected to Google OAuth flow
4. Google returns ID token to frontend
5. Frontend sends token to backend
6. Backend verifies token with Google
7. Backend creates or finds user in database
8. Backend generates JWT token and sends to frontend
9. Frontend stores token and sets user state

## M-Pesa Payment Integration

The payment system now uses the real M-Pesa Daraja API:

### Payment Flow
1. User enters M-Pesa phone number and clicks pay
2. Backend validates phone number and creates payment record
3. Backend initiates STK Push via Daraja API
4. M-Pesa sends STK push to user's phone
5. User enters M-Pesa PIN on their phone
6. M-Pesa processes payment and sends callback to backend
7. Backend receives callback and updates payment status
8. Backend creates subscription for successful payments
9. Frontend polls for payment status and shows real-time updates

### API Features
- **STK Push**: Real M-Pesa STK Push initiation
- **Payment Status Checking**: Manual status verification endpoint
- **Automatic Callbacks**: Handles M-Pesa payment callbacks
- **Error Handling**: Comprehensive error handling for failed payments
- **Real-time Updates**: Frontend polling for payment status
- **Subscription Creation**: Automatic subscription creation on successful payment

## Security Features

- Password hashing with bcrypt (salt rounds: 10)
- JWT token-based authentication
- Google OAuth 2.0 integration with token verification
- M-Pesa Daraja API integration with secure credential management
- Input validation with express-validator
- CORS configuration
- Environment variable protection
- MongoDB injection prevention with Mongoose
- M-Pesa callback signature verification (implement in production)

## Differences from Supabase

### What Changed
- Authentication moved from Supabase Auth to custom JWT implementation
- Database moved from PostgreSQL to MongoDB
- Real-time subscriptions replaced with traditional REST API
- Row Level Security replaced with middleware-based authorization
- Added custom Google OAuth implementation
- Added real M-Pesa Daraja API integration

### What Stayed the Same
- Frontend UI and user experience
- API request/response structure (mostly)
- Business logic and validation rules
- Data relationships
- Google OAuth login option (now using custom implementation)
- Payment flow user experience

## Next Steps

1. **Test the Migration**: Run both frontend and backend to ensure all features work
2. **M-Pesa Callback Security**: Implement callback signature verification for production
3. **Admin Features**: Add admin routes for user and subscription management
4. **Error Handling**: Improve error handling and logging
5. **Testing**: Add unit and integration tests
6. **Documentation**: API documentation with Swagger/OpenAPI
7. **Production Deployment**: Set up production environment with proper security
8. **Rate Limiting**: Add rate limiting for API endpoints

## Troubleshooting

### Common Issues

1. **MongoDB Connection Failed**
   - Ensure MongoDB is running
   - Check connection string in `.env`
   - Verify network access (if using Atlas)

2. **JWT Token Issues**
   - Ensure `JWT_SECRET` is set
   - Check token expiration settings
   - Verify token is being sent in requests

3. **CORS Errors**
   - Check `FRONTEND_URL` in backend `.env`
   - Ensure CORS is properly configured

4. **Google OAuth Not Working**
   - Verify `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` are set correctly
   - Check authorized origins and redirect URIs in Google Cloud Console
   - Ensure `VITE_GOOGLE_CLIENT_ID` is set in frontend `.env`

5. **M-Pesa STK Push Not Working**
   - Verify all M-Pesa credentials are correct
   - Check `MPESA_ENVIRONMENT` setting (sandbox vs production)
   - Ensure phone number format is correct (254XXXXXXXXX)
   - Check M-Pesa app configuration in Safaricom portal
   - Verify callback URL is accessible

6. **Port Already in Use**
   - Change `PORT` in backend `.env`
   - Kill existing process using the port

## Support

For issues or questions about the migration, please check:
- Backend logs for detailed error messages
- Browser console for frontend errors
- MongoDB logs for database issues
- Google Cloud Console for OAuth configuration issues
- Safaricom Developer Portal for M-Pesa API issues
