import React, { useMemo } from 'react';
import { View, Text, FlatList, ActivityIndicator, SafeAreaView, FlatListProps, TouchableOpacity } from 'react-native';
import { useNavigate } from 'react-router-dom';
import { VerificationTask } from '../types';
import { useTasks } from "../context/TaskContext"
import TaskCard from "../components/TaskCard"
import TabSearch from '../components/TabSearch';
import { useTabSearch } from '../hooks/useTabSearch';




interface TaskListScreenProps {
  title: string;
  filter: (taskData: VerificationTask) => boolean;
  emptyMessage: string;
  sort?: (a: VerificationTask, b: VerificationTask) => number;
  isReorderable?: boolean;
  tabKey: string; // Unique identifier for search state management
  searchPlaceholder?: string;
  customHeaderActions?: React.ReactNode;
  showTimeline?: boolean;
}

const TaskListScreen: React.FC<TaskListScreenProps> = ({
  title,
  filter,
  emptyMessage,
  sort,
  isReorderable = false,
  tabKey,
  searchPlaceholder = "Search cases...",
  customHeaderActions
}) => {
  const { tasks, loading } = useTasks();
  const navigate = useNavigate();

  // First apply the tab filter to get tab-specific tasks
  const tabTasks = useMemo(() => {
    const filtered = tasks.filter(filter);
    if (sort) {
      filtered.sort(sort);
    }
    return filtered;
  }, [tasks, filter, sort]);

  // Use tab search hook for search functionality
  const {
    searchQuery,
    setSearchQuery,
    filteredTasks,
    resultCount,
    totalCount,
    clearSearch
  } = useTabSearch({
    tasks: tabTasks,
    tabKey
  });

  // Final processed tasks are the search-filtered results
  const processedTasks = filteredTasks;

  const renderEmpty = () => (
    <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', marginTop: 40, paddingHorizontal: 16 }}>
      <Text style={{ color: '#9CA3AF', textAlign: 'center' }}>
        {searchQuery ? `No cases found matching "${searchQuery}"` : emptyMessage}
      </Text>
      {searchQuery && (
        <TouchableOpacity
          onPress={clearSearch}
          style={{
            marginTop: 16,
            paddingHorizontal: 16,
            paddingVertical: 8,
            backgroundColor: '#374151',
            borderRadius: 8
          }}
        >
          <Text style={{ color: '#F9FAFB', fontSize: 14 }}>Clear Search</Text>
        </TouchableOpacity>
      )}
    </View>
  );

  const renderHeader = () => (
    <View style={{ paddingHorizontal: 16, paddingTop: 8, marginBottom: 16 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 8 }}>
        <TouchableOpacity
          onPress={() => navigate('/')}
          style={{
            marginRight: 16,
            padding: 8,
            borderRadius: 20,
            backgroundColor: '#374151'
          }}
        >
          <Text style={{ color: '#F9FAFB', fontSize: 18, fontWeight: 'bold' }}>←</Text>
        </TouchableOpacity>
        <Text style={{ fontSize: 24, fontWeight: 'bold', color: '#F9FAFB', flex: 1 }}>{title}</Text>
      </View>
    </View>
  );

  // Create a stable header component to prevent TabSearch from being recreated
  const ListHeader = React.useMemo(() => (
    <>
      {renderHeader()}
      <TabSearch
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        placeholder={searchPlaceholder}
        resultCount={resultCount}
        totalCount={totalCount}
      />
      {customHeaderActions && (
        <div style={{ padding: '0 16px', marginBottom: 8 }}>
          {customHeaderActions}
        </div>
      )}
    </>
  ), [searchQuery, searchPlaceholder, resultCount, totalCount, customHeaderActions]);

  if (loading) {
    return (
      <View style={{ flex: 1, backgroundColor: '#111827' }}>
        {renderHeader()}
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
          <ActivityIndicator size="large" color="#00a950" />
        </View>
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: '#111827' }}>
      <FlatList
        data={processedTasks}
        renderItem={({ item, index }: { item: VerificationTask, index: number }) => (
          <TaskCard
            taskData={item}
            isReorderable={isReorderable}
            isFirst={index === 0}
            isLast={index === processedTasks.length - 1}
          />
        )}
        keyExtractor={(item: VerificationTask) => item.id}
        ListHeaderComponent={ListHeader}
        ListEmptyComponent={renderEmpty}
        contentContainerStyle={{ paddingBottom: 100 }}
      />
    </View>
  );
};

export default TaskListScreen;
