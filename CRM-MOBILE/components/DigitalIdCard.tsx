import React from 'react';
import { View, Text, Image, StyleSheet, Dimensions } from 'react-native';
// import { LinearGradient } from 'expo-linear-gradient';
import stampImage from '../logos/stampsign.png';
import companyLogoImage from '../logos/logo 1024.png';

interface UserProfile {
  fullName: string;
  employeeId: string;
  profilePhoto?: string;
  designation?: string;
  department?: string;
  validUntil?: string;
  phoneNumber?: string;
  email?: string;
}

interface DigitalIdCardProps {
  userProfile: UserProfile;
  companyLogo?: string;
  companyName?: string;
  companyAddress?: string;
}

const { width: screenWidth } = Dimensions.get('window');
const cardWidth = screenWidth * 0.9;

const DigitalIdCard: React.FC<DigitalIdCardProps> = ({
  userProfile,
  companyLogo,
  companyName = "All Check Services LLP",
  companyAddress = "Office No. 406, 4th Floor, Neptune Flying Colors, Din Dayal Upadhyay Rd, Mumbai, Maharashtra 400080",
}) => {
  return (
    <View style={styles.cardContainer}>
      {/* Front Side of ID Card */}
      <View style={[styles.card, { width: cardWidth }]}>
        {/* Header Section with Company Branding */}
        <View style={styles.header}>
          <View style={styles.headerContent}>
            <Image source={companyLogoImage} style={styles.companyLogo} />
            <View style={styles.headerText}>
              <Text style={styles.companyNameText}>{companyName}</Text>
              <Text style={styles.idCardTitle}>EMPLOYEE ID CARD</Text>
            </View>
          </View>
        </View>

        {/* Main Content Section */}
        <View style={styles.mainContent}>
          {/* User Photo Section */}
          <View style={styles.photoSection}>
            <View style={styles.photoContainer}>
              {userProfile.profilePhoto ? (
                <Image 
                  source={{ uri: userProfile.profilePhoto }} 
                  style={styles.profilePhoto}
                />
              ) : (
                <View style={styles.placeholderPhoto}>
                  <Text style={styles.placeholderText}>
                    {userProfile.fullName.split(' ').map(n => n[0]).join('').toUpperCase()}
                  </Text>
                </View>
              )}
            </View>
            <Text style={styles.userName}>{userProfile.fullName.toUpperCase()}</Text>
          </View>

          {/* User Details Section */}
          <View style={styles.detailsSection}>
            <View style={styles.detailsContainer}>
              <View style={styles.detailRow}>
                <Text style={styles.detailLabel}>Employee ID:</Text>
                <Text style={styles.detailValue}>{userProfile.employeeId}</Text>
              </View>

              {userProfile.designation && (
                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>Designation:</Text>
                  <Text style={styles.detailValue}>{userProfile.designation}</Text>
                </View>
              )}

              {userProfile.department && (
                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>Department:</Text>
                  <Text style={styles.detailValue}>{userProfile.department}</Text>
                </View>
              )}

              {userProfile.phoneNumber && (
                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>Phone:</Text>
                  <Text style={styles.detailValue}>{userProfile.phoneNumber}</Text>
                </View>
              )}

              {userProfile.email && (
                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>Email:</Text>
                  <Text style={styles.detailValue}>{userProfile.email}</Text>
                </View>
              )}

              {userProfile.validUntil && (
                <View style={styles.detailRow}>
                  <Text style={styles.detailLabel}>Valid Until:</Text>
                  <Text style={styles.detailValue}>{userProfile.validUntil}</Text>
                </View>
              )}
            </View>

            {/* Company Stamp Section */}
            <View style={styles.stampSection}>
              <Image
                source={stampImage}
                style={styles.companyStamp}
                resizeMode="contain"
              />
            </View>
          </View>
        </View>

        {/* Company Address Footer */}
        <View style={styles.addressSection}>
          <Text style={styles.addressText}>{companyAddress}</Text>
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  cardContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 4,
    },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 8,
    overflow: 'hidden',
  },
  header: {
    height: 70,
    paddingHorizontal: 15,
    paddingVertical: 10,
    backgroundColor: '#10B981',
  },
  headerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  companyLogo: {
    width: 40,
    height: 40,
    borderRadius: 20,
    marginRight: 10,
    backgroundColor: '#FFFFFF',
  },
  headerText: {
    flex: 1,
  },
  companyNameText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: 'bold',
    marginBottom: 2,
  },
  idCardTitle: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '600',
    opacity: 0.9,
  },
  mainContent: {
    flexDirection: 'row',
    padding: 15,
    paddingBottom: 15,
    minHeight: 120,
  },
  photoSection: {
    width: '35%',
    alignItems: 'center',
    justifyContent: 'flex-start',
  },
  photoContainer: {
    marginBottom: 8,
  },
  profilePhoto: {
    width: 80,
    height: 80,
    borderRadius: 40,
    borderWidth: 2,
    borderColor: '#10B981',
  },
  placeholderPhoto: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#E5E7EB',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#10B981',
  },
  placeholderText: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#6B7280',
  },
  userName: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#1F2937',
    textAlign: 'center',
    lineHeight: 14,
    marginTop: 5,
    maxWidth: 100,
  },
  detailsSection: {
    flex: 1,
    paddingLeft: 15,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  detailsContainer: {
    flex: 1,
  },
  detailRow: {
    marginBottom: 6,
  },
  detailLabel: {
    fontSize: 9,
    color: '#6B7280',
    fontWeight: '600',
    marginBottom: 1,
  },
  detailValue: {
    fontSize: 11,
    color: '#1F2937',
    fontWeight: '500',
  },
  addressSection: {
    backgroundColor: '#F9FAFB',
    paddingHorizontal: 15,
    paddingVertical: 8,
    marginTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
    alignItems: 'center',
  },
  stampSection: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingLeft: 10,
  },
  companyStamp: {
    width: 60,
    height: 60,
    opacity: 0.8,
  },
  addressText: {
    fontSize: 8,
    color: '#6B7280',
    textAlign: 'center',
    lineHeight: 10,
    fontWeight: '400',
  },
});

export default DigitalIdCard;
