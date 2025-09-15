import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  Alert
} from 'react-native';
import DeviceAuthManager from '../utils/DeviceAuth';

interface DeviceAuthenticationProps {
  style?: any;
}

const DeviceAuthentication: React.FC<DeviceAuthenticationProps> = ({ style }) => {
  const [deviceId, setDeviceId] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [copyFeedback, setCopyFeedback] = useState<string>('');
  const [isCopying, setIsCopying] = useState<boolean>(false);
  const [showDeviceId, setShowDeviceId] = useState<boolean>(false);

  const deviceAuthManager = DeviceAuthManager.getInstance();

  useEffect(() => {
    initializeDeviceAuth();
  }, []);

  const initializeDeviceAuth = async () => {
    try {
      setIsLoading(true);
      const id = await deviceAuthManager.getDeviceId();
      setDeviceId(id);
    } catch (error) {
      console.error('Error initializing device auth:', error);
      setDeviceId('Error generating device ID');
    } finally {
      setIsLoading(false);
    }
  };

  const handleShowDeviceId = () => {
    if (!deviceId || deviceId.startsWith('Error')) {
      Alert.alert('Error', 'Device ID not available');
      return;
    }
    setShowDeviceId(true);
  };

  const handleCopyDeviceId = async () => {
    if (!deviceId || deviceId.startsWith('Error')) {
      Alert.alert('Error', 'No valid device ID to copy');
      return;
    }

    setIsCopying(true);
    setCopyFeedback('');

    try {
      const success = await deviceAuthManager.copyToClipboard(deviceId);

      if (success) {
        setCopyFeedback('Copied!');
        // Clear feedback after 2 seconds
        setTimeout(() => setCopyFeedback(''), 2000);
      } else {
        // Fallback: show device ID in alert for manual copy
        Alert.alert(
          'Device ID',
          deviceId,
          [
            {
              text: 'Close',
              style: 'cancel'
            }
          ]
        );
        setCopyFeedback('Device ID shown above');
        setTimeout(() => setCopyFeedback(''), 3000);
      }
    } catch (error) {
      console.error('Error copying device ID:', error);
      Alert.alert('Error', 'Failed to copy device ID');
    } finally {
      setIsCopying(false);
    }
  };

  const handleRegenerateDeviceId = async () => {
    Alert.alert(
      'Regenerate Device ID',
      'This will create a new device ID. Your administrator will need to re-authenticate this device. Continue?',
      [
        {
          text: 'Cancel',
          style: 'cancel'
        },
        {
          text: 'Regenerate',
          style: 'destructive',
          onPress: async () => {
            try {
              setIsLoading(true);
              await deviceAuthManager.resetDeviceAuth();
              const newId = await deviceAuthManager.getDeviceId();
              setDeviceId(newId);
              Alert.alert('Success', 'New device ID generated');
            } catch (error) {
              console.error('Error regenerating device ID:', error);
              Alert.alert('Error', 'Failed to regenerate device ID');
            } finally {
              setIsLoading(false);
            }
          }
        }
      ]
    );
  };

  return (
    <View style={[{
      backgroundColor: '#1F2937',
      borderRadius: 8,
      padding: 12,
      marginTop: 16,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.1,
      shadowRadius: 4,
      elevation: 3
    }, style]}>
      
      {/* Section Header */}
      <Text style={{
        color: '#ffffff',
        fontSize: 16,
        fontWeight: 'bold',
        textAlign: 'center',
        marginBottom: 12
      }}>
        Device Authentication
      </Text>

      {/* Show Device ID Button or Device ID Display */}
      {!showDeviceId ? (
        <View style={{ marginBottom: 12 }}>
          <TouchableOpacity
            style={{
              backgroundColor: '#374151',
              borderRadius: 6,
              padding: 12,
              alignItems: 'center',
              borderWidth: 1,
              borderColor: '#4B5563',
              minHeight: 40
            }}
            onPress={handleShowDeviceId}
            disabled={isLoading}
          >
            <Text style={{
              color: '#ffffff',
              fontSize: 14,
              fontWeight: '600'
            }}>
              {isLoading ? 'Preparing Device ID...' : 'Show Device ID'}
            </Text>
          </TouchableOpacity>
        </View>
      ) : (
        <View style={{ marginBottom: 12 }}>
          <View style={{
            flexDirection: 'row',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: 6
          }}>
            <Text style={{
              color: '#E5E7EB',
              fontSize: 12,
              fontWeight: '600'
            }}>
              Device ID
            </Text>
            <TouchableOpacity
              onPress={() => setShowDeviceId(false)}
              style={{
                padding: 2
              }}
            >
              <Text style={{
                color: '#9CA3AF',
                fontSize: 11
              }}>
                Hide
              </Text>
            </TouchableOpacity>
          </View>

          <View style={{
            backgroundColor: '#374151',
            borderRadius: 6,
            borderWidth: 1,
            borderColor: '#4B5563',
            position: 'relative'
          }}>
            <TextInput
              style={{
                padding: 8,
                color: '#ffffff',
                fontSize: 11,
                fontFamily: 'monospace',
                minHeight: 36
              }}
              value={deviceId}
              editable={false}
              multiline={true}
              numberOfLines={2}
              textAlignVertical="center"
            />

            {/* Copy Feedback Overlay */}
            {copyFeedback && (
              <View style={{
                position: 'absolute',
                top: 0,
                right: 0,
                backgroundColor: '#10b981',
                paddingHorizontal: 6,
                paddingVertical: 2,
                borderTopRightRadius: 6,
                borderBottomLeftRadius: 6
              }}>
                <Text style={{
                  color: '#ffffff',
                  fontSize: 10,
                  fontWeight: 'bold'
                }}>
                  {copyFeedback}
                </Text>
              </View>
            )}
          </View>
        </View>
      )}

      {/* Action Buttons - Only show when device ID is visible */}
      {showDeviceId && (
        <View style={{
          flexDirection: 'row',
          gap: 8,
          marginBottom: 12
        }}>
          {/* Copy Button */}
          <TouchableOpacity
            style={{
              flex: 1,
              backgroundColor: isCopying ? '#6B7280' : '#3b82f6',
              borderRadius: 6,
              padding: 10,
              alignItems: 'center',
              minHeight: 36
            }}
            onPress={handleCopyDeviceId}
            disabled={isLoading || isCopying || deviceId.startsWith('Error')}
          >
            <Text style={{
              color: '#ffffff',
              fontSize: 12,
              fontWeight: 'bold'
            }}>
              {isCopying ? 'Copying...' : 'Copy ID'}
            </Text>
          </TouchableOpacity>

          {/* Regenerate Button */}
          <TouchableOpacity
            style={{
              backgroundColor: '#6B7280',
              borderRadius: 6,
              padding: 10,
              alignItems: 'center',
              minWidth: 70
            }}
            onPress={handleRegenerateDeviceId}
            disabled={isLoading}
          >
            <Text style={{
              color: '#ffffff',
              fontSize: 11,
              fontWeight: '600'
            }}>
              Regenerate
            </Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Explanatory Text */}
      <View style={{
        backgroundColor: '#065f46',
        borderRadius: 6,
        padding: 8,
        borderWidth: 1,
        borderColor: '#10b981'
      }}>
        <Text style={{
          color: '#d1fae5',
          fontSize: 11,
          fontWeight: '600',
          marginBottom: 2,
          textAlign: 'center'
        }}>
          📱 Device Authentication Required
        </Text>
        <Text style={{
          color: '#a7f3d0',
          fontSize: 10,
          lineHeight: 14,
          textAlign: 'center'
        }}>
          {showDeviceId
            ? 'Copy the Device ID above and send it to your administrator for device authentication.'
            : 'Click "Show Device ID" to get your unique device identifier for administrator approval.'
          }
        </Text>
      </View>

      {/* Debug Info (only in development) */}
      {__DEV__ && (
        <TouchableOpacity
          style={{
            marginTop: 8,
            padding: 4,
            backgroundColor: '#374151',
            borderRadius: 4
          }}
          onPress={async () => {
            const deviceInfo = await deviceAuthManager.getDeviceInfo();
            Alert.alert(
              'Device Info (Debug)',
              JSON.stringify(deviceInfo, null, 2),
              [{ text: 'OK' }]
            );
          }}
        >
          <Text style={{
            color: '#9CA3AF',
            fontSize: 9,
            textAlign: 'center'
          }}>
            Debug: Tap for device info
          </Text>
        </TouchableOpacity>
      )}
    </View>
  );
};

export default DeviceAuthentication;
