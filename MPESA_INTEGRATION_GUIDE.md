# M-Pesa Integration Guide

## Overview
This guide explains the M-Pesa STK Push integration for Kenya Connect dating app, including setup, configuration, and troubleshooting.

## Common Issues & Solutions

### 🚨 STK Push Error: Invalid Access Token

**Error Details:**
```json
{
  "requestId": "b21c-4bb4-b75d-bf97aca3d0331373",
  "errorCode": "404.001.03",
  "errorMessage": "Invalid Access Token"
}
```

**Root Causes & Solutions:**

#### 1. **Incorrect OAuth Endpoint URL**
- **Problem**: Using wrong URL for OAuth token generation
- **Solution**: Ensure using correct URL format:
  ```
  https://sandbox.safaricom.co.ke/oauth/v1/generate?grant_type=client_credentials
  ```

#### 2. **Invalid Consumer Credentials**
- **Problem**: Wrong or expired consumer key/secret
- **Solution**: 
  - Verify credentials in Safaricom Developer Portal
  - Ensure using correct environment (sandbox vs production)
  - Check that credentials are active and not expired

#### 3. **Malformed Authorization Header**
- **Problem**: Incorrect Base64 encoding or header format
- **Solution**: 
  ```javascript
  const auth = Buffer.from(`${consumerKey}:${consumerSecret}`).toString('base64');
  headers: { 'Authorization': `Basic ${auth}` }
  ```

#### 4. **Environment Mismatch**
- **Problem**: Using sandbox credentials with production URL or vice versa
- **Solution**: Ensure environment matches credentials:
  - Sandbox: `https://sandbox.safaricom.co.ke`
  - Production: `https://api.safaricom.co.ke`

## Environment Variables Setup

Create a `.env` file with the following variables:

```bash
# M-Pesa Configuration
MPESA_CONSUMER_KEY=your_consumer_key_here
MPESA_CONSUMER_SECRET=your_consumer_secret_here
MPESA_SHORTCODE=your_shortcode_here
MPESA_PASSKEY=your_passkey_here
MPESA_ENVIRONMENT=sandbox

# Application URLs
BACKEND_URL=http://localhost:3000
FRONTEND_URL=http://localhost:8080
```

## Getting M-Pesa Credentials

### 1. **Safaricom Developer Portal**
1. Visit [developer.safaricom.co.ke](https://developer.safaricom.co.ke)
2. Create an account or sign in
3. Create a new app

### 2. **App Configuration**
- **App Type**: Choose "STK Push"
- **Environment**: Select "Sandbox" for testing
- **Callback URLs**: Set your backend URL

### 3. **Credentials to Copy**
- Consumer Key
- Consumer Secret  
- Shortcode
- Passkey (from STK Push configuration)

## Implementation Details

### 1. **Phone Number Formatting**
The service automatically formats phone numbers:
- `0712345678` → `254712345678`
- `+254712345678` → `254712345678`
- `254712345678` → `254712345678`

### 2. **Password Generation**
```javascript
const timestamp = new Date().toISOString().replace(/[-:TZ.]/g, '').slice(0, 14);
const password = Buffer.from(`${shortcode}${passkey}${timestamp}`).toString('base64');
```

### 3. **STK Push Request**
```javascript
const requestBody = {
  BusinessShortCode: shortcode,
  Password: generatedPassword,
  Timestamp: timestamp,
  TransactionType: 'CustomerPayBillOnline',
  Amount: amount,
  PartyA: formattedPhoneNumber,
  PartyB: shortcode,
  PhoneNumber: formattedPhoneNumber,
  CallBackURL: `${backendUrl}/api/payments/callback`,
  AccountReference: 'KenyaConnect',
  TransactionDesc: 'Subscription Payment'
};
```

## Error Handling

### Common Error Codes

| Error Code | Description | Solution |
|------------|-------------|----------|
| 404.001.03 | Invalid Access Token | Check OAuth credentials and URL |
| 400.001.002 | Invalid Phone Number | Format phone number correctly |
| 400.001.004 | Invalid Amount | Ensure amount is positive integer |
| 400.001.006 | Invalid Shortcode | Verify shortcode configuration |
| 1032 | Request cancelled by user | User rejected STK push |
| 1037 | Timeout | Increase timeout or retry |

### Error Response Format
```javascript
{
  success: false,
  error: {
    message: "Error description",
    details: {...},
    code: "ERROR_CODE"
  }
}
```

## Testing

### 1. **Sandbox Testing**
- Use sandbox credentials for development
- Test with sandbox phone numbers
- Monitor responses in Safaricom portal

### 2. **Phone Number for Testing**
Use these sandbox phone numbers for testing:
- `254708374149` (success)
- `254700000000` (failure)
- `254711231232` (timeout)

### 3. **Debug Logging**
Enable detailed logging:
```javascript
console.log('M-Pesa Service Configuration:', {
  hasConsumerKey: !!this.consumerKey,
  environment: this.environment,
  baseURL: this.baseURL
});
```

## Production Deployment

### 1. **Environment Switch**
- Change `MPESA_ENVIRONMENT` to `production`
- Use production credentials
- Update callback URLs

### 2. **Security Considerations**
- Store credentials securely
- Use HTTPS for callback URLs
- Implement proper validation
- Log all transactions

### 3. **Performance Optimization**
- Cache access tokens (valid for 1 hour)
- Implement retry logic
- Monitor response times
- Handle rate limiting

## Callback Handling

### Callback URL Structure
```
POST /api/payments/callback
Content-Type: application/json
```

### Sample Callback Data
```javascript
{
  "Body": {
    "stkCallback": {
      "MerchantRequestID": "12345-67890-12345",
      "CheckoutRequestID": "ws_CO_DMZ_123456789_1234567890123",
      "ResultCode": 0,
      "ResultDesc": "The service request is processed successfully.",
      "CallbackMetadata": {
        "Item": [
          {"Name": "Amount", "Value": 1000},
          {"Name": "MpesaReceiptNumber", "Value": "MNO123456789"},
          {"Name": "PhoneNumber", "Value": "254712345678"}
        ]
      }
    }
  }
}
```

## Troubleshooting Checklist

- [ ] Environment variables are set correctly
- [ ] Consumer credentials are valid and active
- [ ] Shortcode and passkey are configured
- [ ] Phone number format is correct (254XXXXXXXXX)
- [ ] Amount is positive integer
- [ ] Callback URL is accessible
- [ ] Using correct environment (sandbox/production)
- [ ] Network connectivity to M-Pesa APIs
- [ ] Time synchronization (timestamp format)

## Support Resources

- **Safaricom Developer Portal**: [developer.safaricom.co.ke](https://developer.safaricom.co.ke)
- **M-Pesa API Documentation**: Available in developer portal
- **STK Push Guide**: [STK Push Documentation](https://developer.safaricom.co.ke/docs/stk-push-api/)

## Recent Fixes Applied

1. ✅ **Fixed OAuth Token Generation**
   - Added proper error handling
   - Improved logging and debugging
   - Added timeout configuration

2. ✅ **Fixed Callback URL**
   - Changed from frontend to backend URL
   - Added BACKEND_URL environment variable

3. ✅ **Enhanced Phone Number Handling**
   - Added formatPhoneNumber function
   - Improved validation and error messages

4. ✅ **Improved Error Handling**
   - Better error messages and logging
   - Detailed error response formatting
   - Configuration validation

5. ✅ **Added Comprehensive Logging**
   - Service initialization logging
   - Request/response debugging
   - Configuration status monitoring

These fixes should resolve the "Invalid Access Token" error and improve the overall M-Pesa integration stability.