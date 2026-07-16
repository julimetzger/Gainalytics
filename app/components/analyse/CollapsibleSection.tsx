import React from 'react';
import {StyleSheet, View} from 'react-native';
import {IconButton, Text, TouchableRipple} from 'react-native-paper';
import {useAnalysisSectionCollapsed} from '../../redux/settings/use/useAnalysisSectionCollapsed';
import {AnalysisSectionId} from '../../redux/settings/settingsReducer';

interface CollapsibleSectionProps {
  /** Persisted-state key; also used to derive testIDs. */
  id: AnalysisSectionId;
  title: string;
  children: React.ReactNode;
}

/**
 * Collapsible wrapper for the Muscle Map / Metrics sections of the in-training
 * analysis tab (GH-367). Collapsed state persists via settings.
 */
const CollapsibleSection = ({id, title, children}: CollapsibleSectionProps) => {
  const [collapsed, toggle] = useAnalysisSectionCollapsed(id);

  return (
    <View testID={`analysis-section-${id}`}>
      <TouchableRipple
        onPress={toggle}
        testID={`analysis-section-${id}-header`}
        accessibilityRole="button"
        accessibilityLabel={`${title} section, ${collapsed ? 'collapsed' : 'expanded'}`}
      >
        <View style={styles.header}>
          <Text variant="titleMedium" style={styles.title}>
            {title}
          </Text>
          <IconButton
            icon={collapsed ? 'chevron-down' : 'chevron-up'}
            size={20}
            onPress={toggle}
            testID={`analysis-section-${id}-chevron`}
          />
        </View>
      </TouchableRipple>
      {!collapsed && <View testID={`analysis-section-${id}-content`}>{children}</View>}
    </View>
  );
};

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingTop: 8,
  },
  title: {
    flexShrink: 1,
  },
});

export default CollapsibleSection;
