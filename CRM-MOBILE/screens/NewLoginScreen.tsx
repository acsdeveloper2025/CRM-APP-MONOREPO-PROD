import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  Alert,
  KeyboardAvoidingView,
  Platform
} from 'react-native';
import { Capacitor } from '@capacitor/core';
import { Toast } from '@capacitor/toast';
import { useAuth } from '../context/AuthContext';
import DeviceAuthentication from '../components/DeviceAuthentication';
import { requestCameraPermissions, requestLocationPermissions } from '../utils/permissions';

const NewLoginScreen: React.FC = () => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const { login } = useAuth();

  // Request permissions for browser environments BEFORE login
  useEffect(() => {
    const requestBrowserPermissions = async () => {
      const platform = Capacitor.getPlatform();

      // Only request permissions upfront for web/browser environments
      if (platform === 'web') {
        console.log('🌐 Browser environment detected - requesting permissions BEFORE login');

        // Small delay to let the page load
        await new Promise(resolve => setTimeout(resolve, 2000));

        try {
          let permissionsGranted: string[] = [];
          let permissionsDenied: string[] = [];

          // Request Camera Permission using browser MediaDevices API
          console.log('📷 Requesting camera permission...');
          try {
            const stream = await navigator.mediaDevices.getUserMedia({ video: true });
            // Stop the stream immediately - we just wanted to trigger permission
            stream.getTracks().forEach(track => track.stop());
            console.log('✅ Camera permission granted');
            permissionsGranted.push('Camera');
          } catch (cameraError: any) {
            console.warn('⚠️ Camera permission denied:', cameraError.message);
            permissionsDenied.push('Camera');
          }

          // Request Location Permission using browser Geolocation API
          console.log('📍 Requesting location permission...');
          try {
            await new Promise((resolve, reject) => {
              navigator.geolocation.getCurrentPosition(
                (position) => {
                  console.log('✅ Location permission granted');
                  permissionsGranted.push('Location');
                  resolve(position);
                },
                (error) => {
                  if (error.code === 1) {
                    // PERMISSION_DENIED
                    console.warn('⚠️ Location permission denied');
                    permissionsDenied.push('Location');
                  } else {
                    // POSITION_UNAVAILABLE or TIMEOUT - permission granted but GPS issue
                    console.log('✅ Location permission granted (GPS unavailable)');
                    permissionsGranted.push('Location');
                  }
                  reject(error);
                },
                {
                  timeout: 5000,
                  enableHighAccuracy: false,
                  maximumAge: 300000
                }
              );
            });
          } catch (locationError) {
            // Error already handled in callback
          }

          // Request Notification Permission (browser API)
          if ('Notification' in window && Notification.permission === 'default') {
            console.log('🔔 Requesting notification permission...');
            try {
              const notificationPermission = await Notification.requestPermission();
              if (notificationPermission === 'granted') {
                console.log('✅ Notification permission granted');
                permissionsGranted.push('Notifications');
              } else {
                console.warn('⚠️ Notification permission denied');
                permissionsDenied.push('Notifications');
              }
            } catch (notifError) {
              console.warn('Notification permission request failed:', notifError);
              permissionsDenied.push('Notifications');
            }
          } else if ('Notification' in window && Notification.permission === 'granted') {
            permissionsGranted.push('Notifications');
          }

          // Show summary toast
          if (permissionsGranted.length > 0) {
            Toast.show({
              text: `✅ Permissions granted: ${permissionsGranted.join(', ')}`,
              duration: 'long',
              position: 'top'
            });
          }

          if (permissionsDenied.length > 0) {
            Toast.show({
              text: `⚠️ Permissions needed: ${permissionsDenied.join(', ')}. Please enable in browser settings.`,
              duration: 'long',
              position: 'top'
            });
          }

        } catch (error) {
          console.error('Error requesting browser permissions:', error);
        }
      }
    };

    requestBrowserPermissions();
  }, []);

  const handleLogin = async () => {
    // Client-side validation
    if (!username.trim()) {
      Alert.alert('Validation Error', 'Please enter your username');
      return;
    }

    if (!password.trim()) {
      Alert.alert('Validation Error', 'Please enter your password');
      return;
    }

    // Additional client-side validation
    if (username.length < 3) {
      Alert.alert('Validation Error', 'Username must be at least 3 characters long');
      return;
    }

    if (password.length < 4) {
      Alert.alert('Validation Error', 'Password must be at least 4 characters long');
      return;
    }

    setIsLoading(true);

    try {
      // Call the updated login function
      const result = await login(username, password);

      if (!result.success) {
        Alert.alert('Authentication Failed', result.error || 'Invalid credentials. Please try again.');
      }
      // If successful, the AuthContext will handle the navigation
    } catch (error) {
      Alert.alert('Error', 'An unexpected error occurred. Please try again.');
      console.error('Login error:', error);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <View
      style={{ flex: 1, backgroundColor: '#111827' }}
      className="mobile-container ios-viewport-fix"
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={{ flex: 1 }}
      >
        <View
          style={{
            flex: 1,
            paddingHorizontal: 16,
            paddingVertical: 8,
            justifyContent: 'space-between'
          }}
        >
          {/* Header Section */}
          <View style={{
            alignItems: 'center',
            paddingVertical: 16
          }}>
            
            {/* Logo Section */}
            <View style={{
              marginBottom: 20,
              alignItems: 'center'
            }}>
              {/* Company Logo Placeholder */}
              <View style={{
                width: 80,
                height: 80,
                backgroundColor: '#00a950',
                borderRadius: 40,
                justifyContent: 'center',
                alignItems: 'center',
                marginBottom: 12,
                shadowColor: '#000',
                shadowOffset: { width: 0, height: 4 },
                shadowOpacity: 0.2,
                shadowRadius: 6,
                elevation: 4
              }}>
                <Text style={{
                  color: '#ffffff',
                  fontSize: 28,
                  fontWeight: 'bold'
                }}>CF</Text>
              </View>

              <Text style={{
                color: '#ffffff',
                fontSize: 22,
                fontWeight: 'bold',
                textAlign: 'center',
                marginBottom: 4
              }}>
                CaseFlow Mobile
              </Text>

              <Text style={{
                color: '#9CA3AF',
                fontSize: 14,
                textAlign: 'center'
              }}>
                Verification Management System
              </Text>
            </View>

            {/* Login Form */}
            <View style={{
              width: '100%',
              maxWidth: 400,
              backgroundColor: '#1F2937',
              borderRadius: 12,
              padding: 16,
              shadowColor: '#000',
              shadowOffset: { width: 0, height: 4 },
              shadowOpacity: 0.15,
              shadowRadius: 8,
              elevation: 6
            }}>

              {/* Username Field */}
              <View style={{ marginBottom: 16 }}>
                <Text style={{
                  color: '#E5E7EB',
                  fontSize: 14,
                  fontWeight: '600',
                  marginBottom: 6
                }}>
                  Username <Text style={{ color: '#ef4444' }}>*</Text>
                </Text>
                <TextInput
                  style={{
                    backgroundColor: '#374151',
                    borderRadius: 8,
                    padding: 12,
                    color: '#ffffff',
                    fontSize: 16,
                    borderWidth: 1,
                    borderColor: '#4B5563',
                    minHeight: 44
                  }}
                  placeholder="Enter your username (min. 3 characters)"
                  placeholderTextColor="#9CA3AF"
                  value={username}
                  onChangeText={setUsername}
                  autoCapitalize="none"
                  autoCorrect={false}
                />
              </View>

              {/* Password Field */}
              <View style={{ marginBottom: 20 }}>
                <Text style={{
                  color: '#E5E7EB',
                  fontSize: 14,
                  fontWeight: '600',
                  marginBottom: 6
                }}>
                  Password <Text style={{ color: '#ef4444' }}>*</Text>
                </Text>
                <TextInput
                  style={{
                    backgroundColor: '#374151',
                    borderRadius: 8,
                    padding: 12,
                    color: '#ffffff',
                    fontSize: 16,
                    borderWidth: 1,
                    borderColor: '#4B5563',
                    minHeight: 44
                  }}
                  placeholder="Enter your password (min. 4 characters)"
                  placeholderTextColor="#9CA3AF"
                  value={password}
                  onChangeText={setPassword}
                  secureTextEntry
                />
              </View>



              {/* Sign In Button */}
              <TouchableOpacity
                style={{
                  backgroundColor: isLoading ? '#6B7280' : '#00a950',
                  borderRadius: 8,
                  padding: 14,
                  alignItems: 'center',
                  shadowColor: '#000',
                  shadowOffset: { width: 0, height: 2 },
                  shadowOpacity: 0.2,
                  shadowRadius: 4,
                  elevation: 4,
                  minHeight: 48
                }}
                onPress={handleLogin}
                disabled={isLoading}
              >
                <Text style={{
                  color: '#ffffff',
                  fontSize: 16,
                  fontWeight: 'bold'
                }}>
                  {isLoading ? 'Signing In...' : 'Sign In'}
                </Text>
              </TouchableOpacity>
            </View>

            {/* Device Authentication Section */}
            <DeviceAuthentication style={{
              width: '100%',
              maxWidth: 400,
              marginTop: 24
            }} />


          </View>
        </View>
      </KeyboardAvoidingView>
    </View>
  );
};

export default NewLoginScreen;
