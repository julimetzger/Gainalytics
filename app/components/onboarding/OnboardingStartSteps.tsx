import React from 'react';
import {StyleSheet, View} from 'react-native';
import {Card, Icon, Text, useTheme} from 'react-native-paper';
import {ProgramTemplate} from '../../models/ProgramTemplate';
import ProgramTemplateList from '../Training/templates/ProgramTemplateList';

interface StartChoiceProps {
  icon: string;
  title: string;
  text: string;
  onPress: () => void;
  testID: string;
}

const StartChoice = ({icon, title, text, onPress, testID}: StartChoiceProps) => {
  const theme = useTheme();
  return (
    <Card mode="outlined" onPress={onPress} testID={testID} style={styles.choice} accessibilityLabel={title}>
      <Card.Content style={styles.choiceContent}>
        <Icon source={icon} size={28} color={theme.colors.primary} />
        <View style={styles.choiceTexts}>
          <Text variant="titleMedium">{title}</Text>
          <Text variant="bodySmall" style={{color: theme.colors.onSurfaceVariant}}>
            {text}
          </Text>
        </View>
        <Icon source="chevron-right" size={24} color={theme.colors.onSurfaceVariant} />
      </Card.Content>
    </Card>
  );
};

interface StartStepProps {
  onTemplate: () => void;
  onEmptyPlan: () => void;
  onImport: () => void;
}

/** GH-497 onboarding step 3: the three ways to get started. */
export const StartStep = ({onTemplate, onEmptyPlan, onImport}: StartStepProps) => {
  const theme = useTheme();
  return (
    <View testID="onboarding-step-start">
      <Text variant="headlineSmall" style={styles.title}>
        How do you want to start?
      </Text>
      <Text variant="bodyLarge" style={[styles.lead, {color: theme.colors.onSurfaceVariant}]}>
        You can change everything later.
      </Text>
      <StartChoice
        icon="rocket-launch-outline"
        title="Start with a template"
        text="Pick a ready-made program and train right away. It becomes a normal plan you can edit."
        onPress={onTemplate}
        testID="onboarding-choice-template"
      />
      <StartChoice
        icon="file-plus-outline"
        title="Create an empty plan"
        text="Build your own plan from scratch."
        onPress={onEmptyPlan}
        testID="onboarding-choice-empty"
      />
      <StartChoice
        icon="database-import-outline"
        title="Import data"
        text="Restore a Gainalytics backup (.gains file)."
        onPress={onImport}
        testID="onboarding-choice-import"
      />
    </View>
  );
};

interface TemplateStepProps {
  selectedId?: string;
  onSelect: (template: ProgramTemplate) => void;
}

/** GH-497 onboarding: choosing the template the first plan is created from. */
export const TemplateStep = ({selectedId, onSelect}: TemplateStepProps) => {
  const theme = useTheme();
  return (
    <View testID="onboarding-step-template">
      <Text variant="headlineSmall" style={styles.title}>
        Choose a template
      </Text>
      <Text variant="bodyLarge" style={[styles.lead, {color: theme.colors.onSurfaceVariant}]}>
        Weights stay empty unless you already have a 1RM for an exercise — then they are suggested from it.
      </Text>
      <ProgramTemplateList selectedId={selectedId} onSelect={onSelect} showDescription />
    </View>
  );
};

const styles = StyleSheet.create({
  title: {fontWeight: '700', marginBottom: 8},
  lead: {marginBottom: 20},
  choice: {marginBottom: 12},
  choiceContent: {flexDirection: 'row', alignItems: 'center', gap: 16},
  choiceTexts: {flex: 1},
});
