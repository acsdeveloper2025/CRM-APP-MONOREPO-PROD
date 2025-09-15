import React, { useState } from 'react';
import { View, Text, TouchableOpacity, SafeAreaView, ScrollView, Image } from 'react-native';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';

import { CameraIcon, LogOutIcon, UserIcon } from '../components/Icons';
import Modal from '../components/Modal';
import ProfilePhotoCapture from '../components/ProfilePhotoCapture';
import DataCleanupManager from '../components/DataCleanupManager';
import { CompactVersionInfo } from '../components/VersionInfo';

const ProfileScreen: React.FC = () => {
  const { user, logout, updateUserProfile } = useAuth();
  const navigate = useNavigate();
  const [isPhotoModalOpen, setIsPhotoModalOpen] = useState(false);
  const [showCleanupManager, setShowCleanupManager] = useState(false);

  const handlePhotoSave = async (dataUrl: string) => {
    await updateUserProfile({ profilePhotoUrl: dataUrl });
    setIsPhotoModalOpen(false);
  };

  const handleNavigateToDigitalId = () => {
    navigate('/digital-id-card');
  };

  return (
    <View style={{ flex: 1, backgroundColor: '#111827' }}>
      <ScrollView contentContainerStyle={{ padding: 16, paddingTop: 8, paddingBottom: 100 }}>
        <View style={{ alignItems: 'center' }}>
          <View style={{
            position: 'relative',
            width: 128,
            height: 128,
            borderRadius: 64,
            backgroundColor: '#1F2937',
            borderWidth: 4,
            borderColor: '#374151',
            marginBottom: 16,
            alignItems: 'center',
            justifyContent: 'center'
          }}>
            {user?.profilePhotoUrl ? (
              <Image
                source={{ uri: user.profilePhotoUrl }}
                style={{ width: 120, height: 120, borderRadius: 60 }}
              />
            ) : (
              <View style={{ alignItems: 'center', justifyContent: 'center', flex: 1 }}>
                <UserIcon />
              </View>
            )}
            <TouchableOpacity
              onPress={() => setIsPhotoModalOpen(true)}
              style={{
                position: 'absolute',
                bottom: 0,
                right: 0,
                padding: 8,
                backgroundColor: '#00a950',
                borderRadius: 20,
                alignItems: 'center',
                justifyContent: 'center'
              }}
            >
              <CameraIcon width={20} height={20} color="white" />
            </TouchableOpacity>
          </View>
          <Text style={{ fontSize: 24, fontWeight: 'bold', color: '#F9FAFB', marginTop: 16 }}>{user?.name}</Text>
          <Text style={{ color: '#9CA3AF', marginTop: 8 }}>Agent ID: {user?.id}</Text>
        </View>

        <View style={{ marginTop: 32, gap: 16 }}>
          {/* Digital ID Card Button */}
          <TouchableOpacity
            onPress={handleNavigateToDigitalId}
            style={{
              width: '100%',
              backgroundColor: '#10B981',
              padding: 12,
              borderRadius: 6,
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 8
            }}
          >
            <Text style={{ color: 'white', fontSize: 20 }}>🆔</Text>
            <Text style={{ color: 'white', fontWeight: '600', fontSize: 16 }}>View Digital ID Card</Text>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={() => setShowCleanupManager(!showCleanupManager)}
            style={{
              width: '100%',
              backgroundColor: '#7C3AED',
              padding: 12,
              borderRadius: 6,
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 8
            }}
          >
            <Text style={{ color: 'white', fontSize: 20 }}>🧹</Text>
            <Text style={{ color: 'white', fontWeight: '600', fontSize: 16 }}>
              {showCleanupManager ? 'Hide Data Cleanup' : 'Data Cleanup Manager'}
            </Text>
          </TouchableOpacity>

          {/* App Version Information */}
          <View style={{
            backgroundColor: '#1F2937',
            padding: 16,
            borderRadius: 8,
            marginBottom: 16,
            borderWidth: 1,
            borderColor: '#374151'
          }}>
            <CompactVersionInfo />
          </View>

          <TouchableOpacity
            onPress={logout}
            style={{
              width: '100%',
              backgroundColor: '#DC2626',
              padding: 12,
              borderRadius: 6,
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 8
            }}
          >
            <LogOutIcon />
            <Text style={{ color: 'white', fontWeight: '600', fontSize: 16 }}>Logout</Text>
          </TouchableOpacity>
        </View>

        {/* Data Cleanup Manager */}
        {showCleanupManager && (
          <View style={{ marginTop: 24 }}>
            <DataCleanupManager />
          </View>
        )}

        <Modal isVisible={isPhotoModalOpen} onClose={() => setIsPhotoModalOpen(false)} title="Take Profile Photo">
          <ProfilePhotoCapture onSave={handlePhotoSave} onCancel={() => setIsPhotoModalOpen(false)} />
        </Modal>
      </ScrollView>
    </View>
  );
};

export default ProfileScreen;
