import axios from 'axios';
import crypto from 'crypto';

class MpesaService {
  constructor() {
    this.consumerKey = process.env.MPESA_CONSUMER_KEY;
    this.consumerSecret = process.env.MPESA_CONSUMER_SECRET;
    this.shortcode = process.env.MPESA_SHORTCODE;
    this.passkey = process.env.MPESA_PASSKEY;
    this.environment = process.env.MPESA_ENVIRONMENT || 'sandbox';
    
    this.baseURL = this.environment === 'sandbox'
      ? 'https://sandbox.safaricom.co.ke'
      : 'https://api.safaricom.co.ke';

    // Log configuration status (without exposing secrets)
    console.log('M-Pesa Service Configuration:', {
      hasConsumerKey: !!this.consumerKey,
      hasConsumerSecret: !!this.consumerSecret,
      hasShortcode: !!this.shortcode,
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

  // Generate OAuth token
  async getAccessToken() {
    try {
      if (!this.consumerKey || !this.consumerSecret) {
        throw new Error('M-Pesa credentials not configured');
      }

      const auth = Buffer.from(`${this.consumerKey}:${this.consumerSecret}`).toString('base64');
      
      const response = await axios.get(
        `${this.baseURL}/oauth/v1/generate?grant_type=client_credentials`,
        {
          headers: {
            'Authorization': `Basic ${auth}`,
            'Content-Type': 'application/json',
          },
          timeout: 10000,
        }
      );

      if (!response.data.access_token) {
        throw new Error('No access token received from M-Pesa');
      }

      return response.data.access_token;
    } catch (error) {
      console.error('Error getting access token:', {
        message: error.message,
        response: error.response?.data,
        status: error.response?.status,
        baseURL: this.baseURL,
        hasCredentials: !!(this.consumerKey && this.consumerSecret)
      });
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
    const requiredFields = ['consumerKey', 'consumerSecret', 'shortcode', 'passkey'];
    const missingFields = requiredFields.filter(field => !this[field]);
    
    if (missingFields.length > 0) {
      throw new Error(`Missing M-Pesa configuration: ${missingFields.join(', ')}`);
    }
    
    return true;
  }

  // Initiate STK Push
  async initiateStkPush(phoneNumber, amount) {
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
      
      const accessToken = await this.getAccessToken();
      const { password, timestamp } = this.generatePassword();

      const requestBody = {
        BusinessShortCode: this.shortcode,
        Password: password,
        Timestamp: timestamp,
        TransactionType: 'CustomerPayBillOnline',
        Amount: Math.round(amount),
        PartyA: formattedPhone,
        PartyB: this.shortcode,
        PhoneNumber: formattedPhone,
        CallBackURL: `${process.env.BACKEND_URL || 'http://localhost:3000'}/api/payments/callback`,
        AccountReference: 'KenyaConnect',
        TransactionDesc: 'Subscription Payment'
      };

      console.log('Initiating STK Push:', {
        BusinessShortCode: requestBody.BusinessShortCode,
        Amount: requestBody.Amount,
        PartyA: requestBody.PartyA,
        CallBackURL: requestBody.CallBackURL,
        environment: this.environment
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
        config: error.config ? {
          url: error.config.url,
          method: error.config.method,
          headers: error.config.headers
        } : null
      });
      
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

  // Process callback
  processCallback(callbackData) {
    try {
      const { Body } = callbackData;
      
      if (Body.stkCallback.CallbackMetadata) {
        const metadata = Body.stkCallback.CallbackMetadata.Item;
        const resultCode = Body.stkCallback.ResultCode;
        const resultDesc = Body.stkCallback.ResultDesc;
        
        let transactionId = null;
        let amount = null;
        let phoneNumber = null;
        
        metadata.forEach(item => {
          if (item.Name === 'MpesaReceiptNumber') {
            transactionId = item.Value;
          } else if (item.Name === 'Amount') {
            amount = item.Value;
          } else if (item.Name === 'MSISDN') {
            phoneNumber = item.Value;
          }
        });

        return {
          success: resultCode === 0,
          resultCode,
          resultDesc,
          transactionId,
          amount,
          phoneNumber,
          checkoutRequestId: Body.stkCallback.CheckoutRequestID,
          merchantRequestId: Body.stkCallback.MerchantRequestID
        };
      }
      
      return {
        success: false,
        resultCode: Body.stkCallback.ResultCode,
        resultDesc: Body.stkCallback.ResultDesc,
        checkoutRequestId: Body.stkCallback.CheckoutRequestID
      };
    } catch (error) {
      console.error('Callback processing error:', error);
      return {
        success: false,
        error: 'Failed to process callback'
      };
    }
  }
}

export default new MpesaService();
