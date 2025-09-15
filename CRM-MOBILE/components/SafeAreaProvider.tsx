import React, { createContext, useContext, useEffect, useState } from 'react';
import { View } from 'react-native';
import { StatusBar } from '@capacitor/status-bar';
import { Capacitor } from '@capacitor/core';
import { Device } from '@capacitor/device';

interface SafeAreaInsets {
  top: number;
  bottom: number;
  left: number;
  right: number;
}

interface DeviceInfo {
  platform: string;
  model: string;
  hasHomeIndicator: boolean;
  hasNavigationButtons: boolean;
  isGestureNavigation: boolean;
}

interface SafeAreaContextType {
  insets: SafeAreaInsets;
  deviceInfo: DeviceInfo;
  isNative: boolean;
  isInitialized: boolean;
}

const SafeAreaContext = createContext<SafeAreaContextType>({
  insets: { top: 0, bottom: 0, left: 0, right: 0 },
  deviceInfo: {
    platform: 'web',
    model: '',
    hasHomeIndicator: false,
    hasNavigationButtons: false,
    isGestureNavigation: false
  },
  isNative: false,
  isInitialized: false
});

export const useSafeArea = () => useContext(SafeAreaContext);

interface SafeAreaProviderProps {
  children: React.ReactNode;
}

export const SafeAreaProvider: React.FC<SafeAreaProviderProps> = ({ children }) => {
  const [insets, setInsets] = useState<SafeAreaInsets>({ top: 0, bottom: 0, left: 0, right: 0 });
  const [deviceInfo, setDeviceInfo] = useState<DeviceInfo>({
    platform: 'web',
    model: '',
    hasHomeIndicator: false,
    hasNavigationButtons: false,
    isGestureNavigation: false
  });
  const [isNative] = useState(Capacitor.isNativePlatform());
  const [isInitialized, setIsInitialized] = useState(false);

  // Device detection helper functions
  const detectDeviceInfo = async (): Promise<DeviceInfo> => {
    const platform = Capacitor.getPlatform();
    let deviceInfo: DeviceInfo = {
      platform,
      model: '',
      hasHomeIndicator: false,
      hasNavigationButtons: false,
      isGestureNavigation: false
    };

    if (isNative) {
      try {
        const info = await Device.getInfo();
        deviceInfo.model = info.model || '';

        if (platform === 'ios') {
          // Detect iPhone X and newer (devices with home indicator)
          const hasHomeIndicator = info.model?.includes('iPhone') &&
            (info.model.includes('iPhone1') && parseInt(info.model.split(',')[0].replace('iPhone', '')) >= 10) ||
            info.model.includes('iPhone11') || info.model.includes('iPhone12') ||
            info.model.includes('iPhone13') || info.model.includes('iPhone14') ||
            info.model.includes('iPhone15') || info.model.includes('iPhone16');

          deviceInfo.hasHomeIndicator = hasHomeIndicator;
          deviceInfo.isGestureNavigation = hasHomeIndicator;
        } else if (platform === 'android') {
          // For Android, we'll detect navigation type through safe area insets
          // Devices with gesture navigation typically have larger bottom insets
          deviceInfo.hasNavigationButtons = true; // Default assumption
          deviceInfo.isGestureNavigation = false; // Will be updated based on insets
        }
      } catch (error) {
        console.warn('Failed to get device info:', error);
      }
    } else {
      // Web platform detection
      deviceInfo.platform = 'web';
      // Check if running on mobile web browser
      const userAgent = navigator.userAgent;
      if (/iPhone|iPad|iPod/.test(userAgent)) {
        deviceInfo.hasHomeIndicator = true;
        deviceInfo.isGestureNavigation = true;
      } else if (/Android/.test(userAgent)) {
        deviceInfo.hasNavigationButtons = true;
      }
    }

    return deviceInfo;
  };

  useEffect(() => {
    const initializeSafeArea = async () => {
      try {
        // Detect device information first
        const detectedDeviceInfo = await detectDeviceInfo();
        setDeviceInfo(detectedDeviceInfo);

        if (isNative) {
          try {
            // Configure status bar for native platforms
            await StatusBar.setStyle({ style: 'LIGHT' as any });
            await StatusBar.setBackgroundColor({ color: '#111827' });
            await StatusBar.setOverlaysWebView({ overlay: false });

            // Get status bar info and calculate safe areas
            if (Capacitor.getPlatform() === 'android') {
              const info = await StatusBar.getInfo();
              // Use actual status bar height without additional padding
              const topInset = info.height || 24; // Default to 24px if not available

              // Calculate bottom inset based on navigation type
              let bottomInset = 0;
              if (detectedDeviceInfo.hasNavigationButtons) {
                // Traditional navigation buttons typically need 48dp (about 48px)
                bottomInset = detectedDeviceInfo.isGestureNavigation ? 16 : 48;
              }

              setInsets(prev => ({
                ...prev,
                top: topInset,
                bottom: bottomInset
              }));

              // Update device info based on detected bottom inset
              if (bottomInset <= 20) {
                setDeviceInfo(prev => ({
                  ...prev,
                  isGestureNavigation: true,
                  hasNavigationButtons: false
                }));
              }
            } else if (Capacitor.getPlatform() === 'ios') {
              // For iOS, get status bar info and use system safe areas
              const info = await StatusBar.getInfo();
              const topInset = info.height || 0;
              const bottomInset = detectedDeviceInfo.hasHomeIndicator ? 34 : 0;

              setInsets(prev => ({
                ...prev,
                top: topInset,
                bottom: bottomInset
              }));
            }
          } catch (error) {
            console.warn('Failed to configure status bar:', error);
          }
        } else {
          // For web, use CSS environment variables and enhanced detection
          const updateInsets = () => {
            const computedStyle = getComputedStyle(document.documentElement);
            let top = parseInt(computedStyle.getPropertyValue('env(safe-area-inset-top)') || '0');
            let bottom = parseInt(computedStyle.getPropertyValue('env(safe-area-inset-bottom)') || '0');
            let left = parseInt(computedStyle.getPropertyValue('env(safe-area-inset-left)') || '0');
            let right = parseInt(computedStyle.getPropertyValue('env(safe-area-inset-right)') || '0');

            // Enhanced detection for web browsers
            const userAgent = navigator.userAgent;
            const isIOS = /iPhone|iPad|iPod/.test(userAgent);
            const isAndroid = /Android/.test(userAgent);

            // For iOS web browsers, ensure minimum bottom safe area for home indicator
            if (isIOS && bottom === 0) {
              // Check if it's likely an iPhone X or newer
              const screenHeight = window.screen.height;
              const screenWidth = window.screen.width;
              const hasHomeIndicator = (screenHeight >= 812 && screenWidth >= 375) ||
                                     (screenHeight >= 375 && screenWidth >= 812);
              if (hasHomeIndicator) {
                bottom = 34; // Standard home indicator height
              }
            }

            // For Android web browsers, add padding for potential navigation
            if (isAndroid && bottom === 0) {
              // Add minimal padding for gesture navigation
              bottom = 16;
            }

            setInsets({ top, bottom, left, right });

            // Update device info based on detected values
            setDeviceInfo(prev => ({
              ...prev,
              hasHomeIndicator: isIOS && bottom >= 20,
              hasNavigationButtons: isAndroid && bottom >= 40,
              isGestureNavigation: (isIOS && bottom >= 20) || (isAndroid && bottom <= 20)
            }));
          };

          updateInsets();
          window.addEventListener('resize', updateInsets);
          window.addEventListener('orientationchange', updateInsets);

          return () => {
            window.removeEventListener('resize', updateInsets);
            window.removeEventListener('orientationchange', updateInsets);
          };
        }
      } catch (error) {
        console.error('SafeAreaProvider initialization error:', error);
      } finally {
        setIsInitialized(true);
      }
    };

    // Add timeout to prevent hanging
    const timeoutId = setTimeout(() => {
      console.warn('SafeAreaProvider initialization timeout');
      setIsInitialized(true);
    }, 3000);

    initializeSafeArea().finally(() => {
      clearTimeout(timeoutId);
    });

    return () => clearTimeout(timeoutId);
  }, [isNative]);

  return (
    <SafeAreaContext.Provider value={{ insets, deviceInfo, isNative, isInitialized }}>
      {children}
    </SafeAreaContext.Provider>
  );
};

// Safe Area View component
interface SafeAreaViewProps {
  children: React.ReactNode;
  style?: React.CSSProperties;
  edges?: ('top' | 'bottom' | 'left' | 'right')[];
  className?: string;
}

export const SafeAreaView: React.FC<SafeAreaViewProps> = ({
  children,
  style = {},
  edges = ['top', 'bottom', 'left', 'right'],
  className = ''
}) => {
  const { insets, deviceInfo, isNative } = useSafeArea();

  // Calculate enhanced safe area values
  const getEnhancedInsets = () => {
    const enhanced = { ...insets };

    // Ensure minimum safe areas based on device type
    if (deviceInfo.hasHomeIndicator) {
      enhanced.bottom = Math.max(enhanced.bottom, 34); // iPhone X+ home indicator
    } else if (deviceInfo.hasNavigationButtons && !deviceInfo.isGestureNavigation) {
      enhanced.bottom = Math.max(enhanced.bottom, 48); // Android navigation buttons
    } else if (deviceInfo.isGestureNavigation) {
      enhanced.bottom = Math.max(enhanced.bottom, 16); // Gesture navigation
    }

    return enhanced;
  };

  const enhancedInsets = getEnhancedInsets();

  const safeAreaStyle: React.CSSProperties = {
    ...style,
    ...(edges.includes('top') && {
      paddingTop: isNative
        ? enhancedInsets.top
        : `env(safe-area-inset-top)`
    }),
    ...(edges.includes('bottom') && {
      paddingBottom: isNative
        ? Math.max(4, enhancedInsets.bottom)
        : `max(${enhancedInsets.bottom}px, env(safe-area-inset-bottom))`
    }),
    ...(edges.includes('left') && {
      paddingLeft: isNative
        ? Math.max(0, enhancedInsets.left)
        : `env(safe-area-inset-left)`
    }),
    ...(edges.includes('right') && {
      paddingRight: isNative
        ? Math.max(0, enhancedInsets.right)
        : `env(safe-area-inset-right)`
    }),
  };

  return (
    <View style={safeAreaStyle} className={className}>
      {children}
    </View>
  );
};

// Mobile Container component with proper safe area handling
interface MobileContainerProps {
  children: React.ReactNode;
  className?: string;
  style?: React.CSSProperties;
}

export const MobileContainer: React.FC<MobileContainerProps> = ({
  children,
  className = '',
  style = {}
}) => {
  const { insets, isNative } = useSafeArea();

  return (
    <View
      className={`mobile-container ${className}`}
      style={{
        minHeight: '100vh',
        backgroundColor: '#111827',
        position: 'relative',
        // Apply only the actual safe area insets without extra padding
        paddingTop: isNative ? insets.top : `env(safe-area-inset-top)`,
        paddingLeft: isNative ? insets.left : `env(safe-area-inset-left)`,
        paddingRight: isNative ? insets.right : `env(safe-area-inset-right)`,
        ...style
      }}
    >
      {children}
    </View>
  );
};
