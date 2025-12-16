const API_BASE_URL = import.meta.env.VITE_API_URL || 'https://glovers.onrender.com/api';

class SimpleApiClient {
  private token: string | null = null;

  constructor() {
    this.token = localStorage.getItem('token');
  }

  async request(endpoint: string, options: RequestInit = {}): Promise<any> {
    const url = `${API_BASE_URL}${endpoint}`;
    
    const config: RequestInit = {
      headers: {
        'Content-Type': 'application/json',
        ...options.headers,
      },
      credentials: 'include',
      ...options,
    };

    if (this.token) {
      config.headers = {
        ...config.headers,
        Authorization: `Bearer ${this.token}`,
      };
    }

    try {
      const response = await fetch(url, config);
      
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`HTTP ${response.status}: ${errorText}`);
      }

      const contentType = response.headers.get('content-type');
      if (contentType && contentType.includes('application/json')) {
        return await response.json();
      } else {
        return await response.text();
      }
    } catch (error) {
      console.error('API request failed:', error);
      throw error;
    }
  }

  async signUp(email: string, password: string): Promise<any> {
    const response = await this.request('/auth/signup', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });

    if (response.token) {
      this.setToken(response.token);
    }

    return response;
  }

  async signIn(email: string, password: string): Promise<any> {
    const response = await this.request('/auth/signin', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });

    if (response.token) {
      this.setToken(response.token);
    }

    return response;
  }

  async signInWithGoogle(token: string): Promise<any> {
    const response = await this.request('/auth/google', {
      method: 'POST',
      body: JSON.stringify({ token }),
    });

    if (response.token) {
      this.setToken(response.token);
    }

    return response;
  }

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