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

class SimpleApiClient {
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
      signal: AbortSignal.timeout(10000),
      ...options,
    };

    try {
      const response = await fetch(url, config);
      
      if (!response.ok) {
        const errorText = await response.text();
        let errorMessage = 'An error occurred';
        
        try {
          const errorData = JSON.parse(errorText);
          errorMessage = errorData.message || errorMessage;
        } catch {
          errorMessage = errorText || errorMessage;
        }
        
        throw new Error(errorMessage);
      }

      const contentType = response.headers.get('content-type');
      if (contentType && contentType.includes('application/json')) {
        return await response.json();
      } else {
        return await response.text();
      }
    } catch (error) {
      console.error('API request failed:', error);
      
      // Handle specific error types
      if (error instanceof TypeError && error.message.includes('fetch')) {
        throw new Error('Network error: Please check your internet connection');
      }
      
      if (error instanceof Error && error.name === 'AbortError') {
        throw new Error('Request timeout: Please try again');
      }
      
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

export const simpleApiClient = new SimpleApiClient();
export default simpleApiClient;