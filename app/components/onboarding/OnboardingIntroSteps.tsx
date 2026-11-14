import React from 'react';
import {StyleSheet, View} from 'react-native';
import {Icon, Surface, Text, useTheme} from 'react-native-paper';
import {BOTTOM_TABS, BottomTabMeta} from '../../routing/bottomTabs';

interface IconRowProps {
  icon: string;
  title: string;
  text: string;
  testID?: string;
}

/** One line of an intro card: round icon, short title, one sentence. */
const IconRow = ({icon, title, text, testID}: IconRowProps) => {
  const theme = useTheme();
  return (
    // One accessible element per row, so screen readers (and Maestro) read title and text together.
    <View style={styles.row} testID={testID} accessible accessibilityLabel={`${title}. ${text}`}>
      <Surface style={[styles.rowIcon, {backgroundColor: theme.colors.primaryContainer}]} elevation={0}>
        <Icon source={icon} size={22} color={theme.colors.onPrimaryContainer} />
      </Surface>
      <View style={styles.rowTexts}>
        <Text variant="titleSmall">{title}</Text>
        <Text variant="bodySmall" style={{color: theme.colors.onSurfaceVariant}}>
          {text}
        </Text>
      </View>
    </View>
  );
};

interface IntroCardProps {
  testID: string;
  title: string;
  lead: string;
  children: React.ReactNode;
}

const IntroCard = ({testID, title, lead, children}: IntroCardProps) => {
  const theme = useTheme();
  return (
    <View testID={testID}>
      <Text variant="headlineSmall" style={styles.title}>
        {title}
      </Text>
      <Text variant="bodyLarge" style={[styles.lead, {color: theme.colors.onSurfaceVariant}]}>
        {lead}
      </Text>
      {children}
    </View>
  );
};

/** GH-693 card 1: what the app is and what it does. */
export const WelcomeStep = () => (
  <IntroCard testID="onboarding-step-welcome" title="Welcome to Gainalytics" lead="Your training log for strength training.">
    <IconRow icon="cellphone-lock" title="Local first" text="Works offline. Your data stays on your device." testID="onboarding-feature-local" />
    <IconRow icon="clipboard-list-outline" title="Plan & track" text="Build plans and log every set." testID="onboarding-feature-tracking" />
    <IconRow icon="chart-line" title="Analytics" text="Volume, records, 1RM and progress charts." testID="onboarding-feature-analytics" />
    <IconRow icon="video-outline" title="Video analysis" text="Bar speed and path from your lift videos." testID="onboarding-feature-video" />
    <IconRow icon="tune-variant" title="Modifications" text="Adjust plans, exercises and sets any time." testID="onboarding-feature-modifications" />
  </IntroCard>
);

interface NavEntry {
  key: keyof typeof BOTTOM_TABS;
  text: string;
}

const NAV_ENTRIES: NavEntry[] = [
  {key: 'training', text: 'Your plans and today’s training.'},
  {key: 'exercises', text: 'All exercises with history and records.'},
  {key: 'analyse', text: 'Charts, records and video analyses.'},
  {key: 'settings', text: 'Backup, import, AI coach and help.'},
];

/** GH-693 card 2: the bottom tabs, with the icons of the real nav bar. */
export const NavigationStep = () => (
  <IntroCard testID="onboarding-step-navigation" title="Find your way" lead="Use the bar at the bottom to switch between four areas.">
    {NAV_ENTRIES.map(({key, text}) => {
      const tab: BottomTabMeta = BOTTOM_TABS[key];
      return <IconRow key={key} icon={tab.icon} title={tab.label} text={text} testID={`onboarding-nav-${key}`} />;
    })}
  </IntroCard>
);

/** GH-693 card 3: optional features, all off until you set them up. */
export const OptionalStep = () => (
  <IntroCard testID="onboarding-step-optional" title="Optional extras" lead="Not needed to train. Turn them on in Settings when you want them.">
    <IconRow icon="robot-outline" title="AI coach" text="Chat about your training with your own AI key." testID="onboarding-optional-ai" />
    <IconRow icon="heart-pulse" title="Health Connect" text="Save trainings and read your body weight." testID="onboarding-optional-health" />
    <IconRow icon="timer-outline" title="Rest timer" text="Notifications when your rest is over." testID="onboarding-optional-timer" />
    <IconRow icon="file-import-outline" title="Import & backup" text="Bring your history or save a backup file." testID="onboarding-optional-backup" />
  </IntroCard>
);

const styles = StyleSheet.create({
  title: {fontWeight: '700', marginBottom: 8},
  lead: {marginBottom: 24},
  row: {flexDirection: 'row', alignItems: 'center', marginBottom: 18, gap: 14},
  rowIcon: {width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center'},
  rowTexts: {flex: 1},
});
