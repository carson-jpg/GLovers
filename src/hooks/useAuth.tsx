import { useState, useEffect, createContext, useContext, ReactNode } from 'react';
import { Capacitor } from '@capacitor/core';
import { apiClient, type User } from '@/integrations/api/client';
import { socketService } from '@/services/socketService';

// Global type declarations
declare global {
  interface Window {
    google: any;
  }
}

interface AuthContextType {
  user: User | null;
  loading: boolean;
  signUp: (email: string, password: string) => Promise<{ error: Error | null }>;
  signIn: (email: string, password: string) => Promise<{ error: Error | null }>;
  signInWithGoogle: () => Promise<{ error: Error | null }>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    checkAuthState();
  }, []);

  const checkAuthState = async () => {
    try {
      const token = apiClient.getToken();
      if (token) {
        const response = await apiClient.getCurrentUser();
        if (response.success && response.user) {
          setUser(response.user);
          // Connect socket service when user is authenticated
          socketService.connect();
          socketService.setUserOnline();
        } else {
          apiClient.removeToken();
          socketService.disconnect();
        }
      } else {
        socketService.disconnect();
      }
    } catch (error) {
      console.error('Auth check failed:', error);
      apiClient.removeToken();
      socketService.disconnect();
    } finally {
      setLoading(false);
    }
  };

  const signUp = async (email: string, password: string) => {
    try {
      const response = await apiClient.signUp(email, password);
      if (response.success && response.user) {
        setUser(response.user);
        // Connect socket service when user signs up
        socketService.connect();
        socketService.setUserOnline();
        return { error: null };
      }
      return { error: new Error('Failed to sign up') };
    } catch (error: any) {
      return { error };
    }
  };

  const signIn = async (email: string, password: string) => {
    try {
      const response = await apiClient.signIn(email, password);
      if (response.success && response.user) {
        setUser(response.user);
        // Connect socket service when user signs in
        socketService.connect();
        socketService.setUserOnline();
        return { error: null };
      }
      return { error: new Error('Failed to sign in') };
    } catch (error: any) {
      return { error };
    }
  };

  const signInWithGoogle = async () => {
    try {
      // Check if running in Capacitor (native mobile app)
      const isMobile = Capacitor.isNativePlatform();
      
      if (isMobile) {
        // For mobile apps, use a simplified approach
        // Open Google OAuth in system browser and handle callback
        const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID || '448558588562-5ko63opc5cs7nae83mqmr9n7ukh9r8t0.apps.googleusercontent.com';
        
        // Create a callback URL that will work with our app
        const callbackUrl = `${window.location.origin}/auth/google-callback`;
        
        // Create Google OAuth URL
        const googleAuthUrl = `https://accounts.google.com/oauth/authorize?` +
          `client_id=${clientId}&` +
          `redirect_uri=${encodeURIComponent(callbackUrl)}&` +
          `response_type=code&` +
          `scope=${encodeURIComponent('openid email profile')}&` +
          `access_type=offline&` +
          `prompt=consent&` +
          `state=mobile_auth`;

        // For mobile, show instructions for manual sign-in
        // In a real implementation, you'd use a custom URL scheme or deep linking
        alert('Please sign in with Google in your device browser and then return to the app.');
        
        // Open in system browser
        window.open(googleAuthUrl, '_system');
        
        return { error: null };
      } else {
        // For web, use Google Sign-In SDK
        if (!window.google) {
          await loadGoogleSDK();
        }

        // Initialize Google Sign-In
        const googleUser = await new Promise<any>((resolve, reject) => {
          window.google.accounts.id.initialize({
            client_id: import.meta.env.VITE_GOOGLE_CLIENT_ID || '448558588562-5ko63opc5cs7nae83mqmr9n7ukh9r8t0.apps.googleusercontent.com',
            callback: (response: any) => {
              if (response.credential) {
                resolve(response);
              } else {
                reject(new Error('No credential received'));
              }
            },
          });

          window.google.accounts.id.prompt();
        });

        // Send token to backend
        const response = await apiClient.signInWithGoogle(googleUser.credential);

        if (response.success && response.user) {
          setUser(response.user);
          // Connect socket service when user signs in with Google
          socketService.connect();
          socketService.setUserOnline();
          return { error: null };
        }

        return { error: new Error('Failed to sign in with Google') };
      }
    } catch (error: any) {
      console.error('Google sign-in error:', error);
      return { error };
    }
  };

  const signOut = async () => {
    try {
      await apiClient.signOut();
      // Disconnect socket service when user signs out
      socketService.disconnect();
    } finally {
      setUser(null);
    }
  };

  return (
    <AuthContext.Provider value={{ user, loading, signUp, signIn, signInWithGoogle, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}

// Load Google SDK dynamically
function loadGoogleSDK(): Promise<void> {
  return new Promise((resolve, reject) => {
    if (window.google) {
      resolve();
      return;
    }

    const script = document.createElement('script');
    script.src = 'https://accounts.google.com/gsi/client';
    script.async = true;
    script.defer = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error('Failed to load Google SDK'));
    document.head.appendChild(script);
  });
}
