import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
} from 'react-native';
import DigitalIdCard from '../components/DigitalIdCard';
import { useAuth } from '../context/AuthContext';

const DigitalIdCardScreen: React.FC = () => {
  const { user } = useAuth();

  // User profile data from authenticated user context
  const userProfile = {
    fullName: user?.name || 'John Doe',
    employeeId: user?.employeeId || 'EMP001',
    designation: user?.designation || 'Field Verification Officer',
    department: user?.department || 'Verification Services',
    validUntil: '31/12/2024',
    phoneNumber: user?.phone || '+91 9876543210',
    email: user?.email || 'john.doe@allcheckservices.com',
    profilePhoto: user?.profilePhotoUrl,
  };



  return (
    <View style={styles.container}>
      <ScrollView 
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Digital ID Card</Text>
          <Text style={styles.headerSubtitle}>
            Your official employee identification card
          </Text>
        </View>

        {/* ID Card Display */}
        <View style={styles.cardSection}>
          <DigitalIdCard userProfile={userProfile} />
        </View>

        {/* Information Section */}
        <View style={styles.infoSection}>
          <View style={styles.infoCard}>
            <Text style={{ fontSize: 24, color: '#10B981' }}>ℹ️</Text>
            <View style={styles.infoContent}>
              <Text style={styles.infoTitle}>How to Use Your Digital ID</Text>
              <Text style={styles.infoText}>
                • Show this digital ID to clients and authorities for verification{'\n'}
                • Access your ID card anytime through this app{'\n'}
                • Keep your profile updated for accurate information{'\n'}
                • Use for official identification purposes
              </Text>
            </View>
          </View>

          <View style={styles.infoCard}>
            <Text style={{ fontSize: 24, color: '#059669' }}>🛡️</Text>
            <View style={styles.infoContent}>
              <Text style={styles.infoTitle}>Card Features</Text>
              <Text style={styles.infoText}>
                • Official company logo and branding{'\n'}
                • Employee verification details{'\n'}
                • Contact information for communication{'\n'}
                • Valid until date for authenticity
              </Text>
            </View>
          </View>
        </View>

        {/* Footer */}
        <View style={styles.footer}>
          <Text style={styles.footerText}>
            This digital ID card is valid for official verification purposes.
            Keep your profile information updated to ensure accuracy.
          </Text>
        </View>
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F9FAFB',
    paddingTop: 40, // Add top padding to replace SafeAreaView
  },
  scrollContent: {
    paddingBottom: 30,
  },
  header: {
    padding: 20,
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#1F2937',
    marginBottom: 8,
  },
  headerSubtitle: {
    fontSize: 16,
    color: '#6B7280',
    textAlign: 'center',
  },
  cardSection: {
    alignItems: 'center',
    marginBottom: 30,
  },
  infoSection: {
    paddingHorizontal: 20,
    marginBottom: 20,
  },
  infoCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    flexDirection: 'row',
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  infoContent: {
    flex: 1,
    marginLeft: 12,
  },
  infoTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1F2937',
    marginBottom: 8,
  },
  infoText: {
    fontSize: 14,
    color: '#6B7280',
    lineHeight: 20,
  },
  footer: {
    paddingHorizontal: 20,
    alignItems: 'center',
  },
  footerText: {
    fontSize: 12,
    color: '#9CA3AF',
    textAlign: 'center',
    lineHeight: 16,
  },
});

export default DigitalIdCardScreen;
