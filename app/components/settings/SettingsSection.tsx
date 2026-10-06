import React from 'react';
import {StyleSheet, View} from 'react-native';
import {Card, Text, useTheme} from 'react-native-paper';

interface Props {
  title: string;
  testID: string;
  children: React.ReactNode;
}

/** One titled group on the Settings screen. */
const SettingsSection = ({title, testID, children}: Props) => {
  const theme = useTheme();

  return (
    <View style={styles.section} testID={testID}>
      {/* A plain Text rather than Card.Title: Card.Title swallows its testID. */}
      <Text variant="titleSmall" style={[styles.title, {color: theme.colors.primary}]} testID={`${testID}-title`}>
        {title}
      </Text>
      <Card mode="outlined">
        <Card.Content style={styles.content}>{children}</Card.Content>
      </Card>
    </View>
  );
};

const styles = StyleSheet.create({
  section: {
    marginHorizontal: 12,
    marginTop: 12,
  },
  title: {
    marginLeft: 4,
    marginBottom: 6,
  },
  content: {
    paddingVertical: 8,
  },
});

export default SettingsSection;
