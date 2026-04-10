import React, {useMemo, useState} from 'react';
import {ScrollView, TouchableOpacity, View, StyleSheet} from 'react-native';
import {Button, Card, Divider, Text, useTheme} from 'react-native-paper';
import {Calendar} from 'react-native-calendars/src';
import {DateData} from 'react-native-calendars';
import {useSelector} from 'react-redux';
import {GlobalState} from '../../../redux/rootReducer';
import {TrainingsPlan} from '../../../models/entities/TrainingsPlan';
import {Training} from '../../../models/entities/Training';
import {TrainingsState} from '../../../models/TrainingsState';
import {getYYYYMMDDFormat, getDateTimeStringFromDate, getDaysBetween} from '../../../utils/DateHelper';
import {getMicroFromTrainingInMicroIndex, getTrainingFromTrainingInMicroIndex} from '../../../redux/Training/trainingsPlanReducer';
import {useWorkoutsByIds} from '../../../redux/Workout/use/useWorkoutsByIds';
import {calculateMetricComparisons} from '../../../utils/AnalyseUtils';
import MetricView from '../../analyse/MetricComparison';
import {Metric} from '../../../models/Metric';
import {Workout} from '../../../models/entities/Workout';

// ─── types ──────────────────────────────────────────────────────────────────

type DayMark = {
  trainingId?: number;
  planId?: number;
  microNumber?: number;
  trainingInMicro?: number;
  trainingName?: string;
  planName?: string;
  // micro-range visual info (may be set even on non-training rest days)
  inMicroRange?: boolean;
  isMicroStart?: boolean;
  isMicroEnd?: boolean;
  microRangeNumber?: number;
  // meso start
  isMesoStart?: boolean;
  mesoName?: string;
};

type SelectedTraining = {
  training: Training;
  plan: TrainingsPlan;
  micro: number;
  trainingInMicro: number;
  trainingName: string;
};

// ─── detail panel ───────────────────────────────────────────────────────────

interface DetailPanelProps {
  selected: SelectedTraining;
  onNavigate: () => void;
}

const TrainingDetailPanel = ({selected, onNavigate}: DetailPanelProps) => {
  const {training, plan, trainingName} = selected;
  const theme = useTheme();

  const workoutIds = useMemo(() => Object.values(training.doneWorkoutIds ?? {}), [training.doneWorkoutIds]);
  const workouts = useWorkoutsByIds(workoutIds);

  const duration = useMemo(() => {
    if (!training.start || !training.end) return undefined;
    const ms = new Date(training.end).getTime() - new Date(training.start).getTime();
    return new Date(ms).toISOString().substring(11, 19);
  }, [training.start, training.end]);

  const metrics = useMemo(() => {
    const sets = workouts.flatMap((w: Workout) => w.sets);
    return calculateMetricComparisons({currentWorkoutSets: sets, lastWorkoutSets: []});
  }, [workouts]);

  return (
    <View style={styles.detailPanel}>
      <Divider />
      <View style={{padding: 8}}>
        <Text variant="titleMedium">{trainingName}</Text>
        <Text variant="bodySmall" style={{color: theme.colors.onSurfaceVariant}}>
          {getDateTimeStringFromDate(training.start)}
          {training.end ? '  –  ' + getDateTimeStringFromDate(training.end) : ''}
        </Text>
        <Text variant="bodySmall" style={{color: theme.colors.onSurfaceVariant}}>
          {plan.name}  ·  Micro {selected.micro}
        </Text>
      </View>
      <View style={styles.cardRow}>
        <Card style={styles.metricCard}>
          <Card.Title title={<Text>Duration</Text>} />
          <Card.Content>
            <Text>{duration ?? '–'}</Text>
          </Card.Content>
        </Card>
        <Card style={styles.metricCard}>
          <Card.Title title={<Text>Volume</Text>} />
          <Card.Content>
            <Text>
              <MetricView comparison={metrics.get(Metric.VOLUME)!} />
            </Text>
          </Card.Content>
        </Card>
        <Card style={styles.metricCard}>
          <Card.Title title={<Text>Sets</Text>} />
          <Card.Content>
            <Text>
              <MetricView comparison={metrics.get(Metric.SETS)!} />
            </Text>
          </Card.Content>
        </Card>
      </View>
      <Button
        mode="contained"
        icon="arrow-right-circle"
        onPress={onNavigate}
        style={{margin: 8}}
      >
        Go to Training
      </Button>
    </View>
  );
};

// ─── custom day component ───────────────────────────────────────────────────

interface DayComponentProps {
  date: DateData;
  state: string;
  marking: DayMark | undefined;
  onPress: (date: DateData) => void;
  selectedDate?: string;
}

const HistoryDayComponent = ({date, state, marking, onPress, selectedDate}: DayComponentProps) => {
  const theme = useTheme();
  const info = marking ?? {};
  const isToday = state === 'today';
  const isSelected = date.dateString === selectedDate;
  const hasTraining = !!info.trainingId;
  const inMicro = !!info.inMicroRange;
  const MICRO_COLOR = theme.colors.secondary;
  const BORDER = 1.5;

  return (
    <View style={styles.dayCell}>
      {/* micro-range top + bottom lines */}
      {inMicro && (
        <View
          style={[
            styles.microLineTop,
            {
              backgroundColor: MICRO_COLOR,
              left: info.isMicroStart ? 8 : 0,
              right: info.isMicroEnd ? 8 : 0,
            },
          ]}
        />
      )}
      {inMicro && (
        <View
          style={[
            styles.microLineBottom,
            {
              backgroundColor: MICRO_COLOR,
              left: info.isMicroStart ? 8 : 0,
              right: info.isMicroEnd ? 8 : 0,
            },
          ]}
        />
      )}
      {/* left cap */}
      {inMicro && info.isMicroStart && (
        <View style={[styles.microCapLeft, {backgroundColor: MICRO_COLOR}]} />
      )}
      {/* right cap */}
      {inMicro && info.isMicroEnd && (
        <View style={[styles.microCapRight, {backgroundColor: MICRO_COLOR}]} />
      )}

      {/* micro number badge */}
      {info.isMicroStart && (
        <Text style={[styles.microBadge, {color: MICRO_COLOR}]}>M{info.microRangeNumber}</Text>
      )}

      {/* meso start label */}
      {info.isMesoStart && (
        <Text style={[styles.mesoLabel, {color: theme.colors.tertiary}]} numberOfLines={1}>
          {(info.mesoName ?? '').slice(0, 6)}
        </Text>
      )}

      {/* day circle (press target) */}
      <TouchableOpacity onPress={() => onPress(date)} activeOpacity={0.7}>
        <View
          style={[
            styles.dayCircle,
            isSelected && {backgroundColor: theme.colors.primary},
            isToday && !isSelected && {borderWidth: 1.5, borderColor: theme.colors.primary},
          ]}
        >
          <Text
            style={{
              fontSize: 13,
              fontWeight: hasTraining || isToday ? '600' : 'normal',
              color: isSelected
                ? theme.colors.onPrimary
                : isToday
                ? theme.colors.primary
                : state === 'disabled'
                ? theme.colors.onSurfaceDisabled
                : theme.colors.onBackground,
            }}
          >
            {date.day}
          </Text>
        </View>
      </TouchableOpacity>

      {/* training dot */}
      {hasTraining && (
        <View
          style={[
            styles.trainingDot,
            {backgroundColor: isSelected ? theme.colors.onPrimary : theme.colors.primary},
          ]}
        />
      )}
    </View>
  );
};

// ─── main component ─────────────────────────────────────────────────────────

interface TrainingHistoryCalendarProps {
  /** The plan whose drawer opened this calendar */
  currentPlan: TrainingsPlan;
  onNavigateToTraining: (plan: TrainingsPlan, micro: number, trainingInMicro: number) => void;
}

const TrainingHistoryCalendar = ({currentPlan, onNavigateToTraining}: TrainingHistoryCalendarProps) => {
  const theme = useTheme();
  const [selectedDate, setSelectedDate] = useState<string | undefined>(undefined);

  // Read all plans and all trainings from Redux
  const allPlans = useSelector((state: GlobalState) =>
    state.trainingsPlan.allIds.map((id) => state.trainingsPlan.byId[id]),
  );
  const trainingsById = useSelector((state: GlobalState) => state.trainings.byId);

  // Build the marking data
  const {markedDates, selectedTraining} = useMemo(() => {
    const marks: {[dateStr: string]: DayMark} = {};

    const setMark = (dateStr: string, partial: Partial<DayMark>) => {
      marks[dateStr] = {...(marks[dateStr] ?? {}), ...partial};
    };

    allPlans.forEach((plan) => {
      if (!plan?.trainings) return;

      // Collect per-micro ranges: micro → [finished trainings]
      const microTrainings: Map<number, Training[]> = new Map();

      Object.entries(plan.trainings).forEach(([key, trainingId]) => {
        const micro = getMicroFromTrainingInMicroIndex(key);
        const trainingInMicro = getTrainingFromTrainingInMicroIndex(key);
        const training = trainingsById[trainingId];
        if (!training) return;
        if (training.state !== TrainingsState.FINISHED || !training.start) return;

        const dateStr = getYYYYMMDDFormat(new Date(training.start));
        const trainingName = plan.trainingNames?.[trainingInMicro] ?? `Training ${trainingInMicro}`;

        setMark(dateStr, {
          trainingId: training.id,
          planId: plan.id,
          microNumber: micro,
          trainingInMicro,
          trainingName,
          planName: plan.name,
        });

        if (!microTrainings.has(micro)) microTrainings.set(micro, []);
        microTrainings.get(micro)!.push(training);
      });

      // For each micro, mark its date range with the micro border info
      microTrainings.forEach((trainings, micro) => {
        const dates = trainings
          .map((t) => new Date(t.start!).getTime())
          .filter((t) => !isNaN(t));
        if (dates.length === 0) return;

        const minDate = new Date(Math.min(...dates));
        const maxDate = new Date(Math.max(...dates));
        const allDates = getDaysBetween(minDate, maxDate);

        allDates.forEach((d, i) => {
          const ds = getYYYYMMDDFormat(d);
          const isMicroStart = i === 0;
          const isMicroEnd = i === allDates.length - 1;
          setMark(ds, {
            inMicroRange: true,
            isMicroStart: (marks[ds]?.isMicroStart ?? false) || isMicroStart,
            isMicroEnd: (marks[ds]?.isMicroEnd ?? false) || isMicroEnd,
            microRangeNumber: micro,
          });
        });
      });

      // Mark the very first training day of the plan as meso start
      const allFinishedDates = Object.entries(plan.trainings)
        .map(([, tid]) => trainingsById[tid])
        .filter((t) => t?.state === TrainingsState.FINISHED && t.start)
        .map((t) => new Date(t.start!).getTime());

      if (allFinishedDates.length > 0) {
        const mesoStartDate = new Date(Math.min(...allFinishedDates));
        const mesoDateStr = getYYYYMMDDFormat(mesoStartDate);
        setMark(mesoDateStr, {isMesoStart: true, mesoName: plan.name});
      }
    });

    // Resolve selectedTraining from selectedDate
    let sel: SelectedTraining | undefined;
    if (selectedDate && marks[selectedDate]?.trainingId !== undefined) {
      const mark = marks[selectedDate];
      const training = trainingsById[mark.trainingId!];
      const plan = allPlans.find((p) => p?.id === mark.planId);
      if (training && plan) {
        sel = {
          training,
          plan,
          micro: mark.microNumber!,
          trainingInMicro: mark.trainingInMicro!,
          trainingName: mark.trainingName ?? 'Training',
        };
      }
    }

    return {markedDates: marks, selectedTraining: sel};
  }, [allPlans, trainingsById, selectedDate]);

  const handleDayPress = (day: DateData) => {
    setSelectedDate((prev) => (prev === day.dateString ? undefined : day.dateString));
  };

  const calTheme = useMemo(
    () => ({
      backgroundColor: theme.colors.background,
      calendarBackground: theme.colors.background,
      textSectionTitleColor: theme.colors.onBackground,
      todayTextColor: theme.colors.primary,
      dayTextColor: theme.colors.onBackground,
      textDisabledColor: theme.colors.onSurfaceDisabled,
      monthTextColor: theme.colors.primary,
      arrowColor: theme.colors.primary,
    }),
    [theme],
  );

  return (
    <ScrollView style={styles.container} contentContainerStyle={{flexGrow: 1}}>
      <Calendar
        theme={calTheme}
        markedDates={markedDates}
        markingType={'custom'}
        dayComponent={(props: any) => (
          <HistoryDayComponent
            date={props.date}
            state={props.state}
            marking={props.marking}
            onPress={handleDayPress}
            selectedDate={selectedDate}
          />
        )}
        enableSwipeMonths={true}
        style={styles.calendar}
        current={new Date().toISOString().slice(0, 10)}
      />
      {selectedTraining && (
        <TrainingDetailPanel
          selected={selectedTraining}
          onNavigate={() =>
            onNavigateToTraining(selectedTraining.plan, selectedTraining.micro, selectedTraining.trainingInMicro)
          }
        />
      )}
    </ScrollView>
  );
};

// ─── styles ─────────────────────────────────────────────────────────────────

const CELL_W = 38;
const CELL_H = 48;
const DOT_SIZE = 5;
const CIRCLE_SIZE = 26;
const BORDER_W = 1.5;
const CAP_H = 14; // height of the vertical cap on micro start/end

const styles = StyleSheet.create({
  container: {flex: 1},
  calendar: {},
  // day cell
  dayCell: {
    width: CELL_W,
    height: CELL_H,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  dayCircle: {
    width: CIRCLE_SIZE,
    height: CIRCLE_SIZE,
    borderRadius: CIRCLE_SIZE / 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  trainingDot: {
    width: DOT_SIZE,
    height: DOT_SIZE,
    borderRadius: DOT_SIZE / 2,
    marginTop: 1,
  },
  // micro range lines
  microLineTop: {
    position: 'absolute',
    top: 8,
    height: BORDER_W,
  },
  microLineBottom: {
    position: 'absolute',
    bottom: 9,
    height: BORDER_W,
  },
  microCapLeft: {
    position: 'absolute',
    top: 8,
    left: 8,
    width: BORDER_W,
    height: CAP_H,
  },
  microCapRight: {
    position: 'absolute',
    top: 8,
    right: 8,
    width: BORDER_W,
    height: CAP_H,
  },
  // labels
  microBadge: {
    position: 'absolute',
    top: 0,
    right: 1,
    fontSize: 8,
    fontWeight: '700',
    lineHeight: 10,
  },
  mesoLabel: {
    position: 'absolute',
    bottom: 0,
    fontSize: 6,
    lineHeight: 8,
    fontWeight: '600',
  },
  // detail panel
  detailPanel: {
    maxHeight: 260,
  },
  cardRow: {
    flexDirection: 'row',
    paddingHorizontal: 4,
  },
  metricCard: {
    flex: 1,
    margin: 4,
  },
});

export default TrainingHistoryCalendar;
