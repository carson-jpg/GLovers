import { Capacitor } from '@capacitor/core';
import { StatusBar, Style } from '@capacitor/status-bar';
import { SplashScreen } from '@capacitor/splash-screen';
import { Haptics, ImpactStyle } from '@capacitor/haptics';
import { Device } from '@capacitor/device';

export class MobileUtils {
  static isMobileApp(): boolean {
    return Capacitor.isNativePlatform();
  }

  static async initializeMobileApp(): Promise<void> {
    if (!this.isMobileApp()) return;

    try {
      // Hide splash screen
      await SplashScreen.hide();
      
      // Set status bar style
      await StatusBar.setStyle({ style: Style.Dark });
      await StatusBar.setBackgroundColor({ color: '#ffffff' });

      console.log('Mobile app initialized successfully');
    } catch (error) {
      console.error('Error initializing mobile app:', error);
    }
  }

  static async vibrate(pattern: number | number[] = 50): Promise<void> {
    if (!this.isMobileApp()) return;
    
    try {
      await Haptics.vibrate({ duration: Array.isArray(pattern) ? pattern[0] : pattern });
    } catch (error) {
      console.error('Vibration error:', error);
    }
  }

  static async hapticFeedback(style: ImpactStyle = ImpactStyle.Light): Promise<void> {
    if (!this.isMobileApp()) return;
    
    try {
      await Haptics.impact({ style });
    } catch (error) {
      console.error('Haptic feedback error:', error);
    }
  }

  static async getDeviceInfo() {
    if (!this.isMobileApp()) return null;
    
    try {
      return await Device.getInfo();
    } catch (error) {
      console.error('Device info error:', error);
      return null;
    }
  }

  static getSafeAreaInsets() {
    if (!this.isMobileApp()) return { top: 0, right: 0, bottom: 0, left: 0 };

    // Get computed style for safe area insets
    const style = getComputedStyle(document.documentElement);
    
    return {
      top: parseInt(style.getPropertyValue('--safe-area-inset-top') || '0'),
      right: parseInt(style.getPropertyValue('--safe-area-inset-right') || '0'),
      bottom: parseInt(style.getPropertyValue('--safe-area-inset-bottom') || '0'),
      left: parseInt(style.getPropertyValue('--safe-area-inset-left') || '0')
    };
  }

  static isIOS(): boolean {
    if (!this.isMobileApp()) return false;
    
    // This is a simple iOS detection - you might want to use Device.getInfo() for more accuracy
    return /iPad|iPhone|iPod/.test(navigator.userAgent);
  }

  static isAndroid(): boolean {
    if (!this.isMobileApp()) return false;
    
    return /Android/.test(navigator.userAgent);
  }

  static preventZoom(event: Event): void {
    if (!this.isMobileApp()) return;
    
    // Prevent double-tap zoom on iOS
    const target = event.target as HTMLElement;
    if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA') {
      return;
    }
    
    event.preventDefault();
  }

  static addMobileEventListeners(): void {
    if (!this.isMobileApp()) return;

    // Prevent zoom on double tap
    document.addEventListener('touchend', this.preventZoom, { passive: false });
    
    // Handle orientation change
    window.addEventListener('orientationchange', () => {
      setTimeout(() => {
        window.scrollTo(0, 0);
      }, 500);
    });

    // Handle viewport changes
    window.addEventListener('resize', () => {
      setTimeout(() => {
        window.scrollTo(0, 0);
      }, 100);
    });
  }

  static removeMobileEventListeners(): void {
    document.removeEventListener('touchend', this.preventZoom);
  }
}