import React, {useMemo} from 'react';
import {StyleSheet} from 'react-native';
import {Button, Card, MD3Theme, Text, useTheme} from 'react-native-paper';
import {Range} from '../picker/date/DateRangePicker';
import {useLastWorkoutDate, useLastWorkoutDateForExercises} from '../../redux/Workout/use/useLastWorkoutDate';
import {useWorkoutsIn} from '../../redux/Workout/use/useWorkoutsIn';
import {getDateStringFromDate} from '../../utils/DateHelper';
import {rangeEndingAt} from '../../utils/analyse-range';

interface AnalyseStaleRangeBannerProps {
  range: Range;
  /**
   * The one-tap correction. Receives a range that ends on the last logged
   * workout. Screens with their own range picker just set it; the Dashboard has
   * no picker and navigates to a screen that can show the period instead.
   */
  onApplyRange: (suggestedRange: Range) => void;
  /** Overrides the action's label where "Show up to <date>" does not fit. */
  actionLabel?: string;
  /**
   * Override the emptiness check for screens whose content is not "workouts in
   * range" — Training Length counts completed trainings, not workouts.
   */
  isEmpty?: boolean;
  /**
   * GH-458 round 3 (review #7): when the screen is filtered to an exercise or
   * muscle, "your last training" means the last training OF THAT SELECTION —
   * both whether the banner shows and where its action jumps to. Omit for an
   * unfiltered screen.
   */
  selectionExerciseIds?: number[];
  testID?: string;
}

/**
 * GH-458 (H5): every Analyse screen starts on its own default range — "last
 * 3 months", "this week", "last year". A user who paused for a few months sees
 * emptiness on all of them and nothing says that data exists, just earlier;
 * they had to work that out themselves and then fix the range on five screens
 * one by one.
 *
 * The banner appears only when the selected range is empty AND a training
 * exists outside it, and it corrects the range in one tap. On a genuinely empty
 * account it stays hidden — there the screens' own empty states apply.
 */
const AnalyseStaleRangeBanner = ({range, onApplyRange, actionLabel, isEmpty, selectionExerciseIds, testID = 'analyse-stale-range-banner'}: AnalyseStaleRangeBannerProps) => {
  const theme = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const globalLastWorkoutDate = useLastWorkoutDate();
  const selectionLastWorkoutDate = useLastWorkoutDateForExercises(selectionExerciseIds ?? []);
  const lastWorkoutDate = selectionExerciseIds ? selectionLastWorkoutDate : globalLastWorkoutDate;
  const workoutsInRange = useWorkoutsIn(range);
  const rangeIsEmpty = isEmpty ?? workoutsInRange.length === 0;

  if (!rangeIsEmpty || lastWorkoutDate === undefined) {
    return null;
  }

  const lastWorkoutIsInRange = lastWorkoutDate.getTime() >= range.startDate.getTime() && lastWorkoutDate.getTime() <= range.endDate.getTime();
  if (lastWorkoutIsInRange) {
    return null;
  }

  const lastWorkoutLabel = getDateStringFromDate(lastWorkoutDate);

  return (
    <Card style={styles.card} testID={testID}>
      <Card.Content>
        <Text style={styles.text} testID={`${testID}-text`}>
          {`No trainings in this period. Your last training was on ${lastWorkoutLabel}.`}
        </Text>
        <Button mode="contained-tonal" style={styles.action} onPress={() => onApplyRange(rangeEndingAt(lastWorkoutDate))} testID={`${testID}-action`}>
          {actionLabel ?? `Show up to ${lastWorkoutLabel}`}
        </Button>
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
    text: {
      color: theme.colors.onSurfaceVariant,
    },
    action: {
      marginTop: 12,
      alignSelf: 'flex-start',
    },
  });

export default AnalyseStaleRangeBanner;
