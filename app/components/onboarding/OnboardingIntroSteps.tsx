import React from 'react';
import {StyleSheet, View} from 'react-native';
import {Icon, Surface, Text, useTheme} from 'react-native-paper';

interface HierarchyLevel {
  icon: string;
  title: string;
  text: string;
}

const HIERARCHY: HierarchyLevel[] = [
  {icon: 'clipboard-list-outline', title: 'Plan', text: 'Your program, e.g. a 12-week strength cycle.'},
  {icon: 'layers-outline', title: 'Meso', text: 'A block of weeks with one goal — volume, strength, a deload.'},
  {icon: 'calendar-week', title: 'Micro', text: 'One round of your trainings, usually a week.'},
  {icon: 'dumbbell', title: 'Training', text: 'One session: exercises with planned sets.'},
];

/** GH-497 onboarding step 1: what the app does and how a plan is built. */
export const WelcomeStep = () => {
  const theme = useTheme();
  return (
    <View testID="onboarding-step-welcome">
      <Text variant="headlineSmall" style={styles.title}>
        Welcome to Gainalytics
      </Text>
      <Text variant="bodyLarge" style={[styles.lead, {color: theme.colors.onSurfaceVariant}]}>
        Plan your training, log every set and see how you progress — all data stays on your device.
      </Text>
      <Text variant="titleMedium" style={styles.sectionTitle}>
        How a plan is built
      </Text>
      {HIERARCHY.map((level, depth) => (
        <View key={level.title} style={[styles.levelRow, {marginLeft: depth * 16}]} testID={`onboarding-level-${level.title.toLowerCase()}`}>
          <Surface style={[styles.levelIcon, {backgroundColor: theme.colors.primaryContainer}]} elevation={0}>
            <Icon source={level.icon} size={22} color={theme.colors.onPrimaryContainer} />
          </Surface>
          <View style={styles.levelTexts}>
            <Text variant="titleSmall">{level.title}</Text>
            <Text variant="bodySmall" style={{color: theme.colors.onSurfaceVariant}}>
              {level.text}
            </Text>
          </View>
        </View>
      ))}
    </View>
  );
};

/** GH-497 onboarding step 2: planned sets, RIR and what the app does with them. */
export const RirStep = () => {
  const theme = useTheme();
  return (
    <View testID="onboarding-step-rir">
      <Text variant="headlineSmall" style={styles.title}>
        Plan with reps and RIR
      </Text>
      <Text variant="bodyLarge" style={[styles.lead, {color: theme.colors.onSurfaceVariant}]}>
        Every planned set has a number of reps, an RIR and a weight.
      </Text>
      <Surface style={[styles.card, {backgroundColor: theme.colors.secondaryContainer}]} elevation={0}>
        <Text variant="titleMedium" style={{color: theme.colors.onSecondaryContainer}}>
          RIR = Reps in Reserve
        </Text>
        <Text variant="bodyMedium" style={[styles.cardText, {color: theme.colors.onSecondaryContainer}]}>
          How many more clean reps you could have done. 3 RIR is a comfortable set, 0 RIR is all-out.
        </Text>
        <Text variant="titleSmall" style={[styles.example, {color: theme.colors.onSecondaryContainer}]} testID="onboarding-rir-example">
          5 reps @ 2 RIR → you stop with two good reps left
        </Text>
      </Surface>
      <View style={styles.bullets}>
        <Bullet icon="trending-down" text="Across a meso the RIR usually drops — the training gets harder week by week." />
        <Bullet icon="lightbulb-on-outline" text="The app suggests your next sets from what you logged." />
        <Bullet icon="chart-line" text="Analysis shows volume, records, your 1RM and video-based bar speed." />
      </View>
    </View>
  );
};

const Bullet = ({icon, text}: {icon: string; text: string}) => {
  const theme = useTheme();
  return (
    <View style={styles.bulletRow}>
      <Icon source={icon} size={20} color={theme.colors.primary} />
      <Text variant="bodyMedium" style={styles.bulletText}>
        {text}
      </Text>
    </View>
  );
};

const styles = StyleSheet.create({
  title: {fontWeight: '700', marginBottom: 8},
  lead: {marginBottom: 20},
  sectionTitle: {marginBottom: 12},
  levelRow: {flexDirection: 'row', alignItems: 'center', marginBottom: 14, gap: 12},
  levelIcon: {width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center'},
  levelTexts: {flex: 1},
  card: {borderRadius: 16, padding: 16, marginBottom: 20},
  cardText: {marginTop: 6},
  example: {marginTop: 12},
  bullets: {gap: 14},
  bulletRow: {flexDirection: 'row', alignItems: 'flex-start', gap: 12},
  bulletText: {flex: 1},
});
