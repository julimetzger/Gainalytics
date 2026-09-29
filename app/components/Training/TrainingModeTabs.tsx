import React from 'react';
import {Pressable, StyleSheet, View} from 'react-native';
import {Text, useTheme} from 'react-native-paper';
import {useInstantSelection} from '../../utils/useInstantSelection';

export type SubTab = 'train' | 'plan' | 'analysis';

interface TrainingModeTabsProps {
  activeTab: SubTab;
  onTabChange: (tab: SubTab) => void;
}

const TABS: {id: SubTab; label: string}[] = [
  {id: 'plan', label: 'Plan'},
  {id: 'train', label: 'Train'},
  {id: 'analysis', label: 'Analysis'},
];

const TrainingModeTabs = ({activeTab, onTabChange}: TrainingModeTabsProps) => {
  const theme = useTheme();
  // PERF-003: the tapped tab is marked at once; the sub-tab's content follows.
  const [shownTab, selectTab] = useInstantSelection(activeTab, onTabChange);

  return (
    <View style={styles.container}>
      {TABS.map((tab) => {
        const isActive = tab.id === shownTab;
        return (
          <Pressable
            key={tab.id}
            testID={`subtab-${tab.id}`}
            style={styles.tab}
            onPress={() => selectTab(tab.id)}
          >
            <Text
              style={[
                styles.label,
                {
                  color: isActive ? theme.colors.primary : theme.colors.onSurfaceVariant,
                  fontWeight: isActive ? 'bold' : 'normal',
                },
              ]}
            >
              {tab.label}
            </Text>
            <View
              style={[
                styles.underline,
                {
                  backgroundColor: isActive ? theme.colors.primary : 'transparent',
                },
              ]}
            />
          </Pressable>
        );
      })}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0,0,0,0.1)',
  },
  tab: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 8,
  },
  label: {
    fontSize: 14,
  },
  underline: {
    height: 2,
    width: '60%',
    marginTop: 4,
    borderRadius: 1,
  },
});

export default TrainingModeTabs;
