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
  }

  // Generate OAuth token
  async getAccessToken() {
    try {
      const auth = Buffer.from(`${this.consumerKey}:${this.consumerSecret}`).toString('base64');
      
      const response = await axios.get(`${this.baseURL}/oauth/v1/generate?grant_type=client_credentials`, {
        headers: {
          'Authorization': `Basic ${auth}`,
        },
      });

      return response.data.access_token;
    } catch (error) {
      console.error('Error getting access token:', error.response?.data || error.message);
      throw new Error('Failed to get M-Pesa access token');
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

  // Initiate STK Push
  async initiateStkPush(phoneNumber, amount) {
    try {
      const accessToken = await this.getAccessToken();
      const { password, timestamp } = this.generatePassword();

      const requestBody = {
        BusinessShortCode: this.shortcode,
        Password: password,
        Timestamp: timestamp,
        TransactionType: 'CustomerPayBillOnline',
        Amount: Math.round(amount),
        PartyA: phoneNumber,
        PartyB: this.shortcode,
        PhoneNumber: phoneNumber,
        CallBackURL: `${process.env.FRONTEND_URL}/api/payments/callback`,
        AccountReference: 'KenyaConnect',
        TransactionDesc: 'Subscription Payment'
      };

      const response = await axios.post(
        `${this.baseURL}/mpesa/stkpush/v1/processrequest`,
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
        data: response.data,
        checkoutRequestId: response.data.CheckoutRequestID,
        merchantRequestId: response.data.MerchantRequestID
      };
    } catch (error) {
      console.error('STK Push error:', error.response?.data || error.message);
      return {
        success: false,
        error: error.response?.data || error.message
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
