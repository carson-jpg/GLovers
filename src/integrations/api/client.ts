const API_BASE_URL = import.meta.env.VITE_API_URL || 'https://glovers.onrender.com/api';

export interface User {
  id: string;
  email: string;
  provider: string;
  createdAt: string;
}

export interface AuthResponse {
  success: boolean;
  token: string;
  user: User;
}

class ApiClient {
  private baseURL: string;
  private token: string | null = null;

  constructor(baseURL: string = API_BASE_URL) {
    this.baseURL = baseURL;
    // Get token from localStorage on initialization
    this.token = localStorage.getItem('token');
  }

  // Make request method public so it can be used for custom endpoints
  async request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<any> {
    const url = `${this.baseURL}${endpoint}`;
    
    // Check if body is FormData - if so, don't set Content-Type header
    const isFormData = options.body instanceof FormData;
    
    const config: RequestInit = {
      headers: {
        ...(this.token && { Authorization: `Bearer ${this.token}` }),
        ...(options.body && !isFormData && { 'Content-Type': 'application/json' }),
        ...options.headers,
      },
      credentials: 'include',
      signal: AbortSignal.timeout(30000), // Increased timeout to 30 seconds for mobile
      ...options,
    };

    console.log(`🔗 Making API request to: ${url}`);
    console.log(`📋 Request method: ${options.method || 'GET'}`);
    console.log(`📋 Request headers:`, config.headers);
    console.log(`🔑 Has auth token: ${!!this.token}`);

    try {
      const response = await fetch(url, config);
      
      console.log(`📊 Response status: ${response.status} ${response.statusText}`);
      console.log(`📊 Response headers:`, Object.fromEntries(response.headers.entries()));
      
      if (!response.ok) {
        const errorText = await response.text();
        let errorMessage = `HTTP ${response.status}: ${response.statusText}`;
        
        try {
          const errorData = JSON.parse(errorText);
          errorMessage = errorData.message || errorData.error || errorMessage;
        } catch {
          if (errorText) {
            errorMessage = errorText;
          }
        }
        
        console.error(`❌ API request failed (${response.status}):`, errorMessage);
        console.error(`❌ Error response body:`, errorText);
        throw new Error(errorMessage);
      }

      const contentType = response.headers.get('content-type');
      if (contentType && contentType.includes('application/json')) {
        const result = await response.json();
        console.log(`✅ API request successful: ${endpoint}`);
        console.log(`✅ Response data:`, result);
        return result;
      } else {
        const result = await response.text();
        console.log(`✅ API request successful: ${endpoint}`);
        return result;
      }
    } catch (error) {
      console.error('❌ API request failed:', error);
      
      // Enhanced error logging for mobile debugging
      if (error instanceof TypeError && error.message.includes('fetch')) {
        const errorMsg = `Network error: Unable to connect to ${url}. Please check your internet connection.`;
        console.error('🌐 Network error details:', {
          url,
          message: error.message,
          stack: error.stack
        });
        throw new Error(errorMsg);
      }
      
      if (error instanceof Error && error.name === 'AbortError') {
        const errorMsg = `Request timeout: ${url} took too long to respond. Please try again.`;
        console.error('⏰ Timeout error details:', {
          url,
          timeout: 30000
        });
        throw new Error(errorMsg);
      }
      
      // Log the full error for debugging
      console.error('🚨 Full error details:', {
        url,
        errorType: error?.constructor?.name,
        errorMessage: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
        config: {
          method: options.method,
          headers: config.headers,
          hasBody: !!options.body
        }
      });
      
      throw error;
    }
  }

  private async uploadRequest<T>(
    endpoint: string,
    formData: FormData
  ): Promise<any> {
    const url = `${this.baseURL}${endpoint}`;
    
    const config: RequestInit = {
      method: 'POST',
      headers: {
        ...(this.token && { Authorization: `Bearer ${this.token}` }),
      },
      credentials: 'include',
      body: formData,
    };

    try {
      const response = await fetch(url, config);
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || 'An error occurred');
      }

      return data;
    } catch (error) {
      console.error('Upload request failed:', error);
      throw error;
    }
  }

  // Auth methods
  async signUp(email: string, password: string): Promise<AuthResponse> {
    const response = await this.request<AuthResponse>('/auth/signup', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });

    if (response.success && response.token) {
      this.setToken(response.token);
    }

    return response;
  }

  async signIn(email: string, password: string): Promise<AuthResponse> {
    const response = await this.request<AuthResponse>('/auth/signin', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });

    if (response.success && response.token) {
      this.setToken(response.token);
    }

    return response;
  }

  async signInWithGoogle(token: string): Promise<AuthResponse> {
    const response = await this.request<AuthResponse>('/auth/google', {
      method: 'POST',
      body: JSON.stringify({ token }),
    });

    if (response.success && response.token) {
      this.setToken(response.token);
    }

    return response;
  }

  async signOut(): Promise<void> {
    try {
      await this.request('/auth/signout', {
        method: 'POST',
      });
    } finally {
      this.removeToken();
    }
  }

  async getCurrentUser(): Promise<any> {
    return this.request('/auth/me');
  }

  // Profile methods
  async getMyProfile(): Promise<any> {
    return this.request('/profiles/me');
  }

  async createProfile(profileData: any): Promise<any> {
    return this.request('/profiles', {
      method: 'POST',
      body: JSON.stringify(profileData),
    });
  }

  async updateProfile(profileData: any): Promise<any> {
    return this.request('/profiles/me', {
      method: 'PUT',
      body: JSON.stringify(profileData),
    });
  }

  async getAllProfiles(): Promise<any> {
    return this.request('/profiles');
  }

  async uploadAvatar(file: File): Promise<any> {
    const formData = new FormData();
    formData.append('avatar', file);
    return this.uploadRequest('/profiles/avatar', formData);
  }

  // Chat methods
  async getMyChats(): Promise<any> {
    return this.request('/chats');
  }

  async getChat(chatId: string): Promise<any> {
    return this.request(`/chats/${chatId}`);
  }

  async createChat(participantId: string): Promise<any> {
    return this.request('/chats', {
      method: 'POST',
      body: JSON.stringify({ participantId }),
    });
  }

  async getChatMessages(chatId: string): Promise<any> {
    return this.request(`/chats/${chatId}/messages`);
  }

  async sendMessage(chatId: string, content: string): Promise<any> {
    return this.request(`/chats/${chatId}/messages`, {
      method: 'POST',
      body: JSON.stringify({ content }),
    });
  }

  // Call logs methods
  async getCallLogs(): Promise<any> {
    return this.request('/calls');
  }

  async getChatCallLogs(chatId: string): Promise<any> {
    return this.request(`/calls/${chatId}`);
  }

  async logCall(callData: any): Promise<any> {
    return this.request('/calls', {
      method: 'POST',
      body: JSON.stringify(callData),
    });
  }

  // Subscription methods
  async getMySubscription(): Promise<any> {
    return this.request('/subscriptions/me');
  }

  async createSubscription(planType: string): Promise<any> {
    return this.request('/subscriptions', {
      method: 'POST',
      body: JSON.stringify({ planType }),
    });
  }

  // Payment methods
  async createPayment(paymentData: any): Promise<any> {
    return this.request('/payments', {
      method: 'POST',
      body: JSON.stringify(paymentData),
    });
  }

  async checkPaymentStatus(checkoutRequestId: string): Promise<any> {
    return this.request('/payments/check-status', {
      method: 'POST',
      body: JSON.stringify({ checkoutRequestId }),
    });
  }

  async getMyPayments(): Promise<any> {
    return this.request('/payments');
  }

  // Token management
  setToken(token: string): void {
    this.token = token;
    localStorage.setItem('token', token);
  }

  removeToken(): void {
    this.token = null;
    localStorage.removeItem('token');
  }

  getToken(): string | null {
    return this.token;
  }
}

export const apiClient = new ApiClient();
export default apiClient;
