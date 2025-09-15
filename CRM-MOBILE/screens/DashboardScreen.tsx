import React from 'react';
import { View, Text, TouchableOpacity, ScrollView, ActivityIndicator, Image } from 'react-native';
import { useCases } from '../context/CaseContext';
import { useAuth } from '../context/AuthContext';
import { CaseStatus } from '../types';
import { useNavigate } from 'react-router-dom';
import { RefreshCwIcon, UserIcon } from '../components/Icons';


interface StatCardProps {
  title: string;
  count: number;
  color: string;
  path: string;
}

const StatCard: React.FC<StatCardProps> = ({ title, count, color, path }) => {
    const navigate = useNavigate();

    // Map the path to the correct route
    const getRoute = (path: string) => {
        switch (path) {
            case 'Assigned':
                return '/cases/assigned';
            case 'In Progress':
                return '/cases/in-progress';
            case 'Completed':
                return '/cases/completed';
            case 'Saved':
                return '/cases/saved';
            default:
                return '/cases';
        }
    };

    return (
        <TouchableOpacity
            onPress={() => navigate(getRoute(path))}
            style={{
                backgroundColor: '#1F2937',
                padding: 16,
                borderRadius: 8,
                flex: 1,
                marginHorizontal: 4,
                borderTopWidth: 4,
                borderTopColor: color === 'border-t-4 border-blue-500' ? '#3B82F6' :
                               color === 'border-t-4 border-yellow-500' ? '#F59E0B' :
                               color === 'border-t-4 border-green-500' ? '#10B981' : '#8B5CF6'
            }}
        >
            <Text style={{ color: '#9CA3AF', fontSize: 12, fontWeight: 'bold', textTransform: 'uppercase' }}>{title}</Text>
            <Text style={{ color: '#F9FAFB', fontSize: 24, fontWeight: '600', marginTop: 8 }}>{count}</Text>
        </TouchableOpacity>
    );
};

const DashboardScreen: React.FC = () => {
  const { cases, loading, syncing, syncCases } = useCases();
  const { user } = useAuth();
  const navigate = useNavigate();
  
  const assignedCount = cases.filter(c => c.status === CaseStatus.Assigned).length;
  const inProgressCount = cases.filter(c => c.status === CaseStatus.InProgress).length;
  const completedCount = cases.filter(c => c.status === CaseStatus.Completed).length;
  const savedCount = cases.filter(c => c.isSaved).length;

  return (
    <View style={{ flex: 1, backgroundColor: '#111827' }} className="mobile-content">
      <ScrollView
        contentContainerStyle={{
          paddingBottom: 'calc(80px + max(4px, env(safe-area-inset-bottom)))',
          minHeight: '100%'
        }}
        className="custom-scrollbar"
      >
        <View
          style={{
            padding: 16,
            flexDirection: 'row',
            justifyContent: 'space-between',
            alignItems: 'center'
          }}
          className="mobile-padding"
        >
          <View>
              <Text style={{ fontSize: 24, fontWeight: 'bold', color: '#F9FAFB' }}>Welcome, {user?.name || 'Agent'}!</Text>
              <Text style={{ color: '#9CA3AF' }}>Here is your daily summary.</Text>
          </View>
          <TouchableOpacity
            onPress={() => navigate('/profile')}
            style={{
              width: 48,
              height: 48,
              borderRadius: 24,
              backgroundColor: '#1F2937',
              borderWidth: 2,
              borderColor: '#374151',
              alignItems: 'center',
              justifyContent: 'center'
            }}
          >
              {user?.profilePhotoUrl ? (
                  <Image source={{uri: user.profilePhotoUrl}} style={{ width: 44, height: 44, borderRadius: 22 }} />
              ) : (
                  <UserIcon color="#f9fafb" />
              )}
          </TouchableOpacity>
        </View>

        {loading ? (
          <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', marginTop: 40 }}>
              <ActivityIndicator size="large" color="#00a950" />
          </View>
        ) : (
        <>
          <View style={{ paddingHorizontal: 16, marginTop: 16 }}>
              <TouchableOpacity
                  onPress={syncCases}
                  disabled={syncing}
                  style={{
                    width: '100%',
                    backgroundColor: syncing ? '#6B7280' : '#00a950',
                    paddingVertical: 12,
                    paddingHorizontal: 16,
                    borderRadius: 8,
                    flexDirection: 'row',
                    alignItems: 'center',
                    justifyContent: 'center'
                  }}
              >
                  <RefreshCwIcon color="white" />
                  <Text style={{ marginLeft: 8, color: 'white', fontWeight: 'bold' }}>{syncing ? 'Syncing...' : 'Sync with Server'}</Text>
              </TouchableOpacity>
          </View>

          <View style={{ padding: 16, marginTop: 16 }}>
            <View style={{ flexDirection: 'row', gap: 8 }}>
              <StatCard title="Assigned" count={assignedCount} color="border-t-4 border-blue-500" path="Assigned"/>
              <StatCard title="In Progress" count={inProgressCount} color="border-t-4 border-yellow-500" path="In Progress" />
            </View>
            <View style={{ flexDirection: 'row', gap: 8, marginTop: 16 }}>
              <StatCard title="Completed" count={completedCount} color="border-t-4 border-green-500" path="Completed"/>
              <StatCard title="Saved" count={savedCount} color="border-t-4 border-purple-500" path="Saved" />
            </View>
          </View>

          <View style={{ paddingHorizontal: 16, marginTop: 24 }}>
              <Text style={{ fontSize: 20, fontWeight: 'bold', color: '#F9FAFB', marginBottom: 8 }}>Recent Activity</Text>
              <Text style={{ color: '#9CA3AF' }}>Sync to get the latest updates from the server.</Text>
          </View>
        </>
        )}
      </ScrollView>
    </View>
  );
};

export default DashboardScreen;
