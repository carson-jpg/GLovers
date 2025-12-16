# Subscription-Based Chat Restrictions Implementation

## Overview

This implementation adds comprehensive subscription-based restrictions to the chat system, preventing non-subscribed users from sharing phone numbers and limiting them to a maximum of 5 messages before requiring a subscription.

## Features Implemented

### 1. Phone Number Sharing Restrictions
- **Detection**: Automatically detects phone numbers in chat messages using regex patterns
- **Blocking**: Prevents non-subscribed users from sending messages containing phone numbers
- **Error Handling**: Shows appropriate error messages and subscription prompts

### 2. Message Limit Restrictions
- **Free Limit**: Non-subscribed users can send maximum 5 messages
- **Count Tracking**: Tracks message count per user in the database
- **Automatic Blocking**: Blocks further messages after reaching the limit
- **Reset on Subscription**: Limits are removed for subscribed users

### 3. User Interface Components
- **Warning Modals**: Professional modal dialogs explaining restrictions
- **Upgrade Prompts**: Clear calls-to-action to subscribe
- **Seamless Integration**: Non-intrusive warnings that don't break chat flow

## Technical Implementation

### Backend Changes

#### 1. User Model Updates (`backend/models/User.js`)
```javascript
// Added fields for phone number and message tracking
phoneNumber: {
  type: String,
  trim: true,
  match: [/^\+?[1-9]\d{1,14}$/, 'Please provide a valid phone number']
},
phoneNumberVisibility: {
  type: String,
  enum: ['public', 'subscribers', 'private'],
  default: 'private'
},
freeMessageCount: {
  type: Number,
  default: 0
},
freeMessageLimit: {
  type: Number,
  default: 5
}
```

#### 2. Phone Number API Routes (`backend/routes/phone.js`)
- `POST /api/phone/update` - Update phone number and visibility settings
- `GET /api/phone/my-number` - Get current user's phone number info
- `GET /api/phone/:userId` - Get another user's phone number (with subscription check)
- `POST /api/phone/detect-in-message` - Check for phone numbers in messages
- `POST /api/phone/request-access` - Request access to phone numbers

#### 3. Enhanced Chat Routes (`backend/routes/chats.js`)
- Added phone number detection functions
- Added message limit checking logic
- Enhanced error responses with subscription requirements

#### 4. Socket Service Updates (`backend/services/socketService.js`)
- Real-time phone number detection for WebSocket messages
- Message limit checking for instant messaging
- Proper error handling and user feedback

### Frontend Changes

#### 1. New Components
- `PhoneNumberRestrictionWarning.tsx` - Modal for phone number restriction
- `MessageLimitWarning.tsx` - Modal for message limit restriction
- Enhanced `card.tsx` UI component

#### 2. Chat Interface Updates (`src/pages/Chat.tsx`)
- Added state management for restriction warnings
- Enhanced error handling to distinguish between restriction types
- Integrated warning modals into chat flow

#### 3. Server Integration (`backend/server.js`)
- Added phone routes mounting
- Integrated all new endpoints

## Phone Number Detection Patterns

The system uses comprehensive regex patterns to detect various phone number formats:

```javascript
const PHONE_PATTERNS = [
  /\+?\d{1,4}[-.\s]?\(?\d{1,3}\)?[-.\s]?\d{1,4}[-.\s]?\d{1,4}[-.\s]?\d{1,9}/g, // International
  /\d{3}[-.\s]?\d{3}[-.\s]?\d{4}/g, // US format
  /\(\d{3}\)\s?\d{3}[-.\s]?\d{4}/g, // US with parentheses
  /\+?\d{10,15}/g // Simple 10-15 digit format
];
```

## User Flow

### For Non-Subscribed Users:
1. **First 5 Messages**: Can send regular text messages freely
2. **Phone Number Attempt**: Blocked with phone number restriction warning
3. **After 5 Messages**: Blocked with message limit warning

### For Subscribed Users:
1. **Unlimited Messages**: No message count restrictions
2. **Phone Number Sharing**: Allowed to share phone numbers
3. **Premium Features**: Access to all chat features

## Error Response Format

### Phone Number Restriction
```json
{
  "success": false,
  "message": "Sharing phone numbers is not allowed. Please subscribe to send messages containing phone numbers.",
  "restricted": true,
  "subscriptionRequired": true
}
```

### Message Limit Restriction
```json
{
  "success": false,
  "message": "You have reached the free message limit. Please subscribe to continue chatting.",
  "restricted": true,
  "subscriptionRequired": true,
  "messageLimitReached": true
}
```

## Database Schema

### User Collection Updates
```javascript
{
  _id: ObjectId,
  email: String,
  password: String,
  phoneNumber: String,           // New field
  phoneNumberVisibility: String, // New field (public/subscribers/private)
  freeMessageCount: Number,      // New field (default: 0)
  freeMessageLimit: Number,      // New field (default: 5)
  createdAt: Date,
  updatedAt: Date
}
```

## Security Considerations

1. **Input Validation**: Phone numbers validated with regex
2. **Subscription Verification**: Database queries to verify active subscriptions
3. **Rate Limiting**: Message counting prevents abuse
4. **Error Handling**: Secure error messages without exposing sensitive data

## Performance Impact

- **Minimal**: Phone number detection uses efficient regex
- **Database Queries**: Lightweight subscription checks
- **Caching**: Can be added for frequently checked subscriptions
- **Real-time**: Socket service optimizations prevent blocking

## Future Enhancements

1. **Admin Panel**: Management interface for subscription settings
2. **Analytics**: Track restriction triggers and conversions
3. **A/B Testing**: Different limits for optimization
4. **Grace Period**: Temporary extensions for users near limits
5. **Push Notifications**: Remind users about limits

## Testing Scenarios

### Test Cases to Verify:
1. ✅ Free user can send 5 messages
2. ✅ Free user blocked on 6th message
3. ✅ Free user blocked when sending phone numbers
4. ✅ Subscribed user can send unlimited messages
5. ✅ Subscribed user can share phone numbers
6. ✅ Error messages display correctly
7. ✅ Upgrade flow works properly
8. ✅ Socket messaging respects restrictions
9. ✅ REST API endpoints work correctly
10. ✅ Database updates work correctly

## Deployment Notes

1. **Database Migration**: Update existing users with default values
2. **Environment Variables**: Ensure all required configs are set
3. **Testing**: Thoroughly test all restriction scenarios
4. **Monitoring**: Track restriction events and user conversions
5. **Rollback Plan**: Keep previous versions if issues arise

This implementation provides a solid foundation for subscription-based restrictions while maintaining a good user experience for both free and paid users.