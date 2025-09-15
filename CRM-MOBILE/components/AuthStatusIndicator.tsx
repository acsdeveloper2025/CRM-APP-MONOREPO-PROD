import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { useAuth } from '../context/AuthContext';
import NetworkService from '../services/networkService';

/**
 * Authentication Status Indicator Component
 * Shows current authentication status, days until expiry, and network status
 */

interface NetworkState {
  isOnline: boolean;
  connectionType: string;
}

const AuthStatusIndicator: React.FC = () => {
  const { authStatus, isAuthenticated, refreshTokens, checkAuthStatus } = useAuth();
  const [networkState, setNetworkState] = useState<NetworkState>({
    isOnline: true,
    connectionType: 'unknown',
  });
  const [isRefreshing, setIsRefreshing] = useState(false);

  useEffect(() => {
    // Get initial network state
    const initialState = NetworkService.getNetworkState();
    setNetworkState({
      isOnline: initialState.isOnline,
      connectionType: initialState.connectionType,
    });

    // Listen for network changes
    const handleNetworkChange = (state: any) => {
      setNetworkState({
        isOnline: state.isOnline,
        connectionType: state.connectionType,
      });
    };

    NetworkService.addNetworkListener(handleNetworkChange);

    return () => {
      NetworkService.removeNetworkListener(handleNetworkChange);
    };
  }, []);

  const handleRefreshTokens = async () => {
    if (!networkState.isOnline) {
      return;
    }

    setIsRefreshing(true);
    try {
      await refreshTokens();
      await checkAuthStatus();
    } catch (error) {
      console.error('Manual token refresh failed:', error);
    } finally {
      setIsRefreshing(false);
    }
  };

  const getStatusColor = () => {
    if (!isAuthenticated) return '#dc3545'; // Red
    if (!authStatus) return '#6c757d'; // Gray
    
    if (authStatus.daysUntilExpiry <= 3) return '#dc3545'; // Red - Critical
    if (authStatus.daysUntilExpiry <= 7) return '#fd7e14'; // Orange - Warning
    return '#28a745'; // Green - Good
  };

  const getStatusText = () => {
    if (!isAuthenticated) return 'Not Authenticated';
    if (!authStatus) return 'Loading...';
    
    if (authStatus.daysUntilExpiry <= 0) return 'Expired';
    if (authStatus.daysUntilExpiry === 1) return '1 day left';
    return `${authStatus.daysUntilExpiry} days left`;
  };

  const getNetworkStatusColor = () => {
    return networkState.isOnline ? '#28a745' : '#dc3545';
  };

  const shouldShowRefreshButton = () => {
    return isAuthenticated && 
           networkState.isOnline && 
           authStatus && 
           authStatus.daysUntilExpiry <= 7 && 
           authStatus.daysUntilExpiry > 0;
  };

  if (!isAuthenticated) {
    return null; // Don't show on login screen
  }

  return (
    <View style={styles.container}>
      <View style={styles.statusRow}>
        {/* Authentication Status */}
        <View style={styles.statusItem}>
          <View style={[styles.statusDot, { backgroundColor: getStatusColor() }]} />
          <Text style={styles.statusText}>{getStatusText()}</Text>
        </View>

        {/* Network Status */}
        <View style={styles.statusItem}>
          <View style={[styles.statusDot, { backgroundColor: getNetworkStatusColor() }]} />
          <Text style={styles.statusText}>
            {networkState.isOnline ? 'Online' : 'Offline'}
          </Text>
        </View>

        {/* Refresh Button */}
        {shouldShowRefreshButton() && (
          <TouchableOpacity 
            style={[styles.refreshButton, isRefreshing && styles.refreshButtonDisabled]}
            onPress={handleRefreshTokens}
            disabled={isRefreshing}
          >
            <Text style={styles.refreshButtonText}>
              {isRefreshing ? '⟳' : '↻'}
            </Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Additional Info */}
      {authStatus && authStatus.needsAction && (
        <View style={styles.warningContainer}>
          <Text style={styles.warningText}>
            ⚠️ {authStatus.actionRequired}
          </Text>
        </View>
      )}

      {/* Last Login Info */}
      {authStatus && authStatus.lastLoginDate && (
        <Text style={styles.lastLoginText}>
          Last login: {authStatus.lastLoginDate}
        </Text>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#f8f9fa',
    padding: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#e9ecef',
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  statusItem: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 6,
  },
  statusText: {
    fontSize: 12,
    color: '#495057',
    fontWeight: '500',
  },
  refreshButton: {
    backgroundColor: '#007bff',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
    marginLeft: 8,
  },
  refreshButtonDisabled: {
    backgroundColor: '#6c757d',
  },
  refreshButtonText: {
    color: 'white',
    fontSize: 12,
    fontWeight: 'bold',
  },
  warningContainer: {
    backgroundColor: '#fff3cd',
    padding: 6,
    borderRadius: 4,
    marginTop: 4,
    borderLeftWidth: 3,
    borderLeftColor: '#ffc107',
  },
  warningText: {
    fontSize: 11,
    color: '#856404',
    fontWeight: '500',
  },
  lastLoginText: {
    fontSize: 10,
    color: '#6c757d',
    marginTop: 2,
    textAlign: 'center',
  },
});

export default AuthStatusIndicator;
