import React, {useMemo} from 'react';
import {StyleSheet, View} from 'react-native';
import {Button, Card, MD3Theme, Text, useTheme} from 'react-native-paper';

export interface AnalyseEmptyStateAction {
  label: string;
  onPress: () => void;
  testID: string;
}

interface AnalyseEmptyStateProps {
  title: string;
  description: string;
  actions?: AnalyseEmptyStateAction[];
  testID: string;
}

/**
 * GH-458 (H3/M4): the shared empty state for the whole Analyse area.
 *
 * The audit named the Training Length empty state the benchmark, because it says
 * WHAT is missing and WHAT to do about it. Every other Analyse screen rendered
 * either an unlabelled box or bare table headers, so "range is empty", "never
 * trained" and "still calculating" were pixel-identical. This component forces
 * both halves: a cause in the title/description and at least one action that
 * leads straight to a result.
 */
const AnalyseEmptyState = ({title, description, actions = [], testID}: AnalyseEmptyStateProps) => {
  const theme = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);

  return (
    <Card style={styles.card} testID={testID}>
      <Card.Title title={title} titleNumberOfLines={3} />
      <Card.Content>
        <Text style={styles.description} testID={`${testID}-description`}>
          {description}
        </Text>
        {actions.length > 0 && (
          <View style={styles.actions}>
            {actions.map((action) => (
              <Button key={action.testID} mode="outlined" style={styles.action} onPress={action.onPress} testID={action.testID}>
                {action.label}
              </Button>
            ))}
          </View>
        )}
      </Card.Content>
    </Card>
  );
};

const createStyles = (theme: MD3Theme) =>
  StyleSheet.create({
    card: {
      marginHorizontal: 12,
      marginTop: 8,
    },
    description: {
      color: theme.colors.onSurfaceVariant,
    },
    actions: {
      marginTop: 12,
      gap: 8,
    },
    action: {
      alignSelf: 'flex-start',
    },
  });

export default AnalyseEmptyState;
