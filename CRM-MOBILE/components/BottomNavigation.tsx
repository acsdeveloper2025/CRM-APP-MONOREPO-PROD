import React from 'react';
import { View, TouchableOpacity, Text } from 'react-native';
import { useNavigate, useLocation } from 'react-router-dom';
import { HomeIcon, ListTodoIcon, ClockIcon, CheckCircle2Icon, StarIcon } from './Icons';
import { useSafeArea } from './SafeAreaProvider';

interface TabItem {
  name: string;
  route: string;
  icon: React.ComponentType<any>;
  label: string;
}

const BottomNavigation: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { insets, deviceInfo, isNative } = useSafeArea();

  const tabs: TabItem[] = [
    { name: 'Dashboard', route: '/', icon: HomeIcon, label: 'Dashboard' },
    { name: 'Assigned', route: '/cases/assigned', icon: ListTodoIcon, label: 'Assigned' },
    { name: 'In Progress', route: '/cases/in-progress', icon: ClockIcon, label: 'In Progress' },
    { name: 'Saved', route: '/cases/saved', icon: StarIcon, label: 'Saved' },
    { name: 'Completed', route: '/cases/completed', icon: CheckCircle2Icon, label: 'Completed' },
  ];

  const isActive = (route: string) => {
    if (route === '/' && location.pathname === '/') return true;
    if (route !== '/' && location.pathname.startsWith(route)) return true;
    return false;
  };

  // Enhanced safe area calculation for bottom navigation
  const calculateSafeAreaPadding = () => {
    let bottomPadding = 4; // Base padding
    let leftPadding = 0;
    let rightPadding = 0;

    if (isNative || deviceInfo.platform !== 'web') {
      // Native platform calculations
      if (deviceInfo.hasHomeIndicator) {
        // iPhone X and newer - home indicator
        bottomPadding = Math.max(8, insets.bottom || 34);
      } else if (deviceInfo.hasNavigationButtons && !deviceInfo.isGestureNavigation) {
        // Android with traditional navigation buttons
        bottomPadding = Math.max(8, insets.bottom || 48);
      } else if (deviceInfo.isGestureNavigation) {
        // Gesture navigation (Android 10+)
        bottomPadding = Math.max(8, insets.bottom || 16);
      } else {
        // Fallback for other devices
        bottomPadding = Math.max(8, insets.bottom);
      }

      leftPadding = Math.max(0, insets.left);
      rightPadding = Math.max(0, insets.right);
    } else {
      // Web platform - use CSS env() with fallbacks
      bottomPadding = Math.max(8, insets.bottom);
    }

    return { bottomPadding, leftPadding, rightPadding };
  };

  const { bottomPadding, leftPadding, rightPadding } = calculateSafeAreaPadding();

  // Enhanced styling for different device types
  const getNavigationStyle = () => {
    const baseStyle = {
      backgroundColor: '#1f2937',
      borderTop: '1px solid #374151',
      minHeight: '60px',
      paddingBottom: isNative ? `${bottomPadding}px` : `max(${bottomPadding}px, env(safe-area-inset-bottom))`,
      paddingTop: '8px',
      paddingLeft: isNative ? `${leftPadding}px` : `max(0px, env(safe-area-inset-left))`,
      paddingRight: isNative ? `${rightPadding}px` : `max(0px, env(safe-area-inset-right))`,
      display: 'flex',
      flexDirection: 'row' as const,
      justifyContent: 'space-around' as const,
      alignItems: 'center' as const,
      position: 'fixed' as const,
      bottom: 0,
      left: 0,
      right: 0,
      zIndex: 1000,
      // Add backdrop blur and shadow for better visual separation
      backdropFilter: 'blur(8px)',
      WebkitBackdropFilter: 'blur(8px)', // Safari support
      boxShadow: '0 -2px 8px rgba(0, 0, 0, 0.1)',
    };

    // Add device-specific enhancements
    if (deviceInfo.hasHomeIndicator) {
      // iPhone X+ with home indicator - ensure proper spacing
      return {
        ...baseStyle,
        paddingBottom: isNative ? `${Math.max(bottomPadding, 34)}px` : `max(34px, env(safe-area-inset-bottom))`,
      };
    } else if (deviceInfo.hasNavigationButtons && !deviceInfo.isGestureNavigation) {
      // Android with navigation buttons - ensure no overlap
      return {
        ...baseStyle,
        paddingBottom: isNative ? `${Math.max(bottomPadding, 48)}px` : `max(48px, env(safe-area-inset-bottom))`,
      };
    } else if (deviceInfo.isGestureNavigation) {
      // Gesture navigation - minimal padding but ensure touch targets are accessible
      return {
        ...baseStyle,
        paddingBottom: isNative ? `${Math.max(bottomPadding, 16)}px` : `max(16px, env(safe-area-inset-bottom))`,
      };
    }

    return baseStyle;
  };

  return (
    <View style={getNavigationStyle()}>
      {tabs.map((tab) => {
        const IconComponent = tab.icon;
        const active = isActive(tab.route);
        const color = active ? '#00a950' : '#9ca3af';

        return (
          <TouchableOpacity
            key={tab.name}
            onPress={() => navigate(tab.route)}
            style={{
              flex: 1,
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              paddingVertical: 4,
              backgroundColor: 'transparent',
              minHeight: 48, // Ensure minimum touch target size
            }}
            activeOpacity={0.7}
          >
            <IconComponent
              color={color}
              width={24}
              height={24}
              filled={tab.name === 'Saved' && active}
            />
            <Text style={{
              color: color,
              fontSize: 10,
              marginTop: 2,
              fontWeight: active ? '600' : '400',
              textAlign: 'center'
            }}>
              {tab.label}
            </Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
};

export default BottomNavigation;
