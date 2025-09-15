import React, { useMemo } from 'react';
import { View, Text, FlatList, ActivityIndicator, SafeAreaView, FlatListProps, TouchableOpacity } from 'react-native';
import { useNavigate } from 'react-router-dom';
import { Case } from '../types';
import { useCases } from '../context/CaseContext';
import CaseCard from '../components/CaseCard';
import TabSearch from '../components/TabSearch';
import { useTabSearch } from '../hooks/useTabSearch';




interface CaseListScreenProps {
  title: string;
  filter: (caseData: Case) => boolean;
  emptyMessage: string;
  sort?: (a: Case, b: Case) => number;
  isReorderable?: boolean;
  tabKey: string; // Unique identifier for search state management
  searchPlaceholder?: string;
  customHeaderActions?: React.ReactNode;
}

const CaseListScreen: React.FC<CaseListScreenProps> = ({
  title,
  filter,
  emptyMessage,
  sort,
  isReorderable = false,
  tabKey,
  searchPlaceholder = "Search cases...",
  customHeaderActions
}) => {
  const { cases, loading } = useCases();
  const navigate = useNavigate();

  // First apply the tab filter to get tab-specific cases
  const tabCases = useMemo(() => {
    const filtered = cases.filter(filter);
    if (sort) {
      filtered.sort(sort);
    }
    return filtered;
  }, [cases, filter, sort]);

  // Use tab search hook for search functionality
  const {
    searchQuery,
    setSearchQuery,
    filteredCases,
    resultCount,
    totalCount,
    clearSearch
  } = useTabSearch({
    cases: tabCases,
    tabKey
  });

  // Final processed cases are the search-filtered results
  const processedCases = filteredCases;

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
        data={processedCases}
        renderItem={({ item, index }: { item: Case, index: number }) => (
          <CaseCard
            caseData={item}
            isReorderable={isReorderable}
            isFirst={index === 0}
            isLast={index === processedCases.length - 1}
          />
        )}
        keyExtractor={(item: Case) => item.id}
        ListHeaderComponent={ListHeader}
        ListEmptyComponent={renderEmpty}
        contentContainerStyle={{ paddingBottom: 100 }}
      />
    </View>
  );
};

export default CaseListScreen;
