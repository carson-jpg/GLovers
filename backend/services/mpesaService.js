import axios from 'axios';
import crypto from 'crypto';

class MpesaService {
  constructor() {
    this.consumerKey = process.env.MPESA_CONSUMER_KEY;
    this.consumerSecret = process.env.MPESA_CONSUMER_SECRET;
    this.shortcode = process.env.MPESA_SHORTCODE;
    this.tillNumber = process.env.MPESA_TILL_NUMBER;
    this.storeNumber = process.env.MPESA_STORE_NUMBER;
    this.passkey = process.env.MPESA_PASSKEY;
    this.environment = process.env.MPESA_ENVIRONMENT || 'sandbox';

    this.baseURL = this.environment === 'sandbox'
      ? 'https://sandbox.safaricom.co.ke'
      : 'https://api.safaricom.co.ke';

    // Token caching
    this.accessToken = null;
    this.tokenExpiry = null;

    // Log configuration status (without exposing secrets)
    console.log('M-Pesa Service Configuration:', {
      hasConsumerKey: !!this.consumerKey,
      hasConsumerSecret: !!this.consumerSecret,
      hasShortcode: !!this.shortcode,
      hasTillNumber: !!this.tillNumber,
      hasStoreNumber: !!this.storeNumber,
      hasPasskey: !!this.passkey,
      environment: this.environment,
      baseURL: this.baseURL
    });

    try {
      this.validateConfig();
      console.log('✅ M-Pesa configuration validated successfully');
    } catch (error) {
      console.error('❌ M-Pesa configuration error:', error.message);
    }
  }

  // Generate OAuth token with caching
  async getAccessToken() {
    try {
      // Check if we have a valid cached token
      if (this.accessToken && this.tokenExpiry && new Date() < this.tokenExpiry) {
        console.log('Using cached access token');
        return this.accessToken;
      }

      if (!this.consumerKey || !this.consumerSecret) {
        throw new Error('M-Pesa credentials not configured');
      }

      console.log('Generating new access token...');

      const auth = Buffer.from(`${this.consumerKey}:${this.consumerSecret}`).toString('base64');
      
      const response = await axios.get(
        `${this.baseURL}/oauth/v1/generate?grant_type=client_credentials`,
        {
          headers: {
            'Authorization': `Basic ${auth}`,
            'Content-Type': 'application/json',
          },
          timeout: 15000,
        }
      );

      if (!response.data.access_token) {
        throw new Error('No access token received from M-Pesa');
      }

      // Cache the token for 50 minutes (tokens expire after 1 hour)
      this.accessToken = response.data.access_token;
      this.tokenExpiry = new Date(Date.now() + 50 * 60 * 1000);

      console.log('✅ New access token generated and cached');
      console.log('Token expires at:', this.tokenExpiry.toISOString());

      return this.accessToken;
    } catch (error) {
      console.error('Error getting access token:', {
        message: error.message,
        response: error.response?.data,
        status: error.response?.status,
        baseURL: this.baseURL,
        hasCredentials: !!(this.consumerKey && this.consumerSecret)
      });
      
      // Clear cached token on error
      this.accessToken = null;
      this.tokenExpiry = null;
      
      throw new Error(`Failed to get M-Pesa access token: ${error.message}`);
    }
  }

  // Generate password for STK Push
  generatePassword() {
    const timestamp = new Date().toISOString().replace(/[-:TZ.]/g, '').slice(0, 14);
    const dataToEncode = `${this.shortcode}${this.passkey}${timestamp}`;
    const password = Buffer.from(dataToEncode).toString('base64');
    
    return {
      password,
      timestamp
    };
  }

  // Format phone number for M-Pesa
  formatPhoneNumber(phoneNumber) {
    // Remove all non-digit characters
    const digits = phoneNumber.replace(/\D/g, '');
    
    // Handle different formats
    if (digits.startsWith('254')) {
      return digits; // Already in international format
    } else if (digits.startsWith('0')) {
      return '254' + digits.slice(1); // Remove leading 0 and add country code
    } else if (digits.length === 9) {
      return '254' + digits; // Add country code
    } else {
      throw new Error('Invalid phone number format');
    }
  }

  // Validate M-Pesa configuration
  validateConfig() {
    const requiredFields = ['consumerKey', 'consumerSecret', 'shortcode', 'tillNumber', 'storeNumber', 'passkey'];
    const missingFields = requiredFields.filter(field => !this[field]);

    if (missingFields.length > 0) {
      throw new Error(`Missing M-Pesa configuration: ${missingFields.join(', ')}`);
    }

    return true;
  }

  // Clear cached token (useful for debugging)
  clearTokenCache() {
    this.accessToken = null;
    this.tokenExpiry = null;
    console.log('🔄 Token cache cleared');
  }

  // Initiate STK Push with retry logic
  async initiateStkPush(phoneNumber, amount, retryCount = 0) {
    const maxRetries = 2;
    
    try {
      // Validate inputs
      if (!this.shortcode || !this.passkey) {
        throw new Error('M-Pesa shortcode or passkey not configured');
      }

      if (!phoneNumber || !amount) {
        throw new Error('Phone number and amount are required');
      }

      // Format phone number
      const formattedPhone = this.formatPhoneNumber(phoneNumber);
      
      let accessToken;
      try {
        accessToken = await this.getAccessToken();
      } catch (tokenError) {
        console.error('Failed to get access token:', tokenError.message);
        throw new Error(`Authentication failed: ${tokenError.message}`);
      }
      
      const { password, timestamp } = this.generatePassword();

      const requestBody = {
        BusinessShortCode: this.shortcode,
        Password: password,
        Timestamp: timestamp,
        TransactionType: 'CustomerBuyGoodsOnline',
        Amount: Math.round(amount),
        PartyA: formattedPhone,
        PartyB: this.tillNumber,
        PhoneNumber: formattedPhone,
        CallBackURL: `${process.env.BACKEND_URL || 'http://localhost:3000'}/api/payments/callback`,
        AccountReference: 'Glovers',
        TransactionDesc: 'Buy Goods Payment'
      };

      console.log('Initiating STK Push:', {
        BusinessShortCode: requestBody.BusinessShortCode,
        Amount: requestBody.Amount,
        PartyA: requestBody.PartyA,
        CallBackURL: requestBody.CallBackURL,
        environment: this.environment,
        retryCount
      });

      const response = await axios.post(
        `${this.baseURL}/mpesa/stkpush/v1/processrequest`,
        requestBody,
        {
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
          },
          timeout: 30000,
        }
      );

      console.log('STK Push response:', response.data);

      return {
        success: true,
        data: response.data,
        checkoutRequestId: response.data.CheckoutRequestID,
        merchantRequestId: response.data.MerchantRequestID
      };
    } catch (error) {
      console.error('STK Push error:', {
        message: error.message,
        response: error.response?.data,
        status: error.response?.status,
        retryCount,
        maxRetries,
        config: error.config ? {
          url: error.config.url,
          method: error.config.method,
          headers: error.config.headers
        } : null
      });
      
      // Handle authentication errors with retry
      if (error.response?.data?.errorCode === '404.001.03' && retryCount < maxRetries) {
        console.log(`Retrying STK Push due to auth error (attempt ${retryCount + 1}/${maxRetries})`);
        
        // Clear cached token to force regeneration
        this.accessToken = null;
        this.tokenExpiry = null;
        
        // Wait a bit before retrying
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        return this.initiateStkPush(phoneNumber, amount, retryCount + 1);
      }
      
      return {
        success: false,
        error: {
          message: error.message,
          details: error.response?.data,
          code: error.response?.data?.errorCode || 'UNKNOWN_ERROR'
        }
      };
    }
  }

  // Check payment status
  async checkPaymentStatus(checkoutRequestId) {
    try {
      const accessToken = await this.getAccessToken();
      const { password, timestamp } = this.generatePassword();

      const requestBody = {
        BusinessShortCode: this.shortcode,
        Password: password,
        Timestamp: timestamp,
        CheckoutRequestID: checkoutRequestId
      };

      const response = await axios.post(
        `${this.baseURL}/mpesa/stkpushquery/v1/query`,
        requestBody,
        {
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
          },
        }
      );

      return {
        success: true,
        data: response.data
      };
    } catch (error) {
      console.error('Payment status check error:', error.response?.data || error.message);
      return {
        success: false,
        error: error.response?.data || error.message
      };
    }
  }

  // Process callback with improved error handling
  processCallback(callbackData) {
    try {
      console.log('🔔 Processing M-Pesa callback:', JSON.stringify(callbackData, null, 2));
      
      const { Body } = callbackData;
      
      if (!Body || !Body.stkCallback) {
        console.error('Invalid callback data structure:', callbackData);
        return {
          success: false,
          error: 'Invalid callback data structure'
        };
      }

      const stkCallback = Body.stkCallback;
      const resultCode = stkCallback.ResultCode;
      const resultDesc = stkCallback.ResultDesc;
      const checkoutRequestId = stkCallback.CheckoutRequestID;
      const merchantRequestId = stkCallback.MerchantRequestID;

      console.log('📊 Callback analysis:', {
        resultCode,
        resultDesc,
        checkoutRequestId,
        merchantRequestId,
        hasMetadata: !!stkCallback.CallbackMetadata
      });

      let transactionId = null;
      let amount = null;
      let phoneNumber = null;
      
      // Handle callback with metadata (successful payment)
      if (stkCallback.CallbackMetadata && stkCallback.CallbackMetadata.Item) {
        const metadata = stkCallback.CallbackMetadata.Item;
        
        metadata.forEach(item => {
          if (item.Name === 'MpesaReceiptNumber') {
            transactionId = item.Value;
          } else if (item.Name === 'Amount') {
            amount = item.Value;
          } else if (item.Name === 'MSISDN') {
            phoneNumber = item.Value;
          }
        });

        console.log('💰 Extracted metadata:', { transactionId, amount, phoneNumber });
      }

      const isSuccess = resultCode === 0;
      
      const result = {
        success: isSuccess,
        resultCode,
        resultDesc,
        transactionId,
        amount,
        phoneNumber,
        checkoutRequestId,
        merchantRequestId
      };

      console.log(`✅ Callback processed: ${isSuccess ? 'SUCCESS' : 'FAILED'} - ${resultDesc}`);
      
      return result;
    } catch (error) {
      console.error('Callback processing error:', error);
      return {
        success: false,
        error: `Failed to process callback: ${error.message}`,
        rawData: callbackData
      };
    }
  }
}

export default new MpesaService();
