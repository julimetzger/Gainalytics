import React, {useMemo, useRef, useState} from 'react';
import {ScrollView, TouchableOpacity, View, StyleSheet} from 'react-native';
import {Button, Card, Divider, SegmentedButtons, Text, useTheme} from 'react-native-paper';
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

// ─── date helpers ────────────────────────────────────────────────────────────

/** Return the Monday of the week containing `date` (week starts Mon). */
function getWeekStart(date: Date): Date {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  const dow = d.getDay(); // 0=Sun … 6=Sat
  const diff = dow === 0 ? -6 : 1 - dow;
  d.setDate(d.getDate() + diff);
  return d;
}

/** Return the Sunday of the week containing `date`. */
function getWeekEnd(date: Date): Date {
  const start = getWeekStart(date);
  start.setDate(start.getDate() + 6);
  return start;
}

function addDays(date: Date, days: number): Date {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

// ─── types ──────────────────────────────────────────────────────────────────

type TrainingEntry = {
  trainingId: number;
  planId: number;
  microNumber: number;
  trainingInMicro: number;
  trainingName: string;
  planName: string;
};

type DayMark = {
  /** All trainings completed on this day (supports multiple per day). */
  trainings?: TrainingEntry[];
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
  const hasTraining = (info.trainings?.length ?? 0) > 0;
  const inMicro = !!info.inMicroRange;
  const MICRO_COLOR = theme.colors.secondary;

  // Background period style: soft translucent fill with rounded ends
  const isSingleDay = inMicro && info.isMicroStart && info.isMicroEnd;
  const bgLeft = inMicro ? (info.isMicroStart ? CELL_W / 2 : 0) : 0;
  const bgRight = inMicro ? (info.isMicroEnd ? CELL_W / 2 : 0) : 0;

  return (
    <View style={styles.dayCell}>
      {/* micro-range background (period fill) */}
      {inMicro && (
        <View
          style={[
            styles.microRangeBg,
            {
              backgroundColor: MICRO_COLOR + '28', // ~16% opacity
              left: isSingleDay ? 5 : bgLeft,
              right: isSingleDay ? 5 : bgRight,
              borderTopLeftRadius: info.isMicroStart ? BG_RADIUS : 0,
              borderBottomLeftRadius: info.isMicroStart ? BG_RADIUS : 0,
              borderTopRightRadius: info.isMicroEnd ? BG_RADIUS : 0,
              borderBottomRightRadius: info.isMicroEnd ? BG_RADIUS : 0,
            },
          ]}
        />
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
  /** Called when the user taps "Zurück zum Plan" — clears the history view */
  onBack?: () => void;
}

const TrainingHistoryCalendar = ({currentPlan, onNavigateToTraining, onBack}: TrainingHistoryCalendarProps) => {
  const theme = useTheme();
  const [selectedDate, setSelectedDate] = useState<string | undefined>(undefined);
  const [selectedTrainingIndex, setSelectedTrainingIndex] = useState(0);
  const scrollRef = useRef<ScrollView>(null);
  const detailY = useRef<number>(0);

  // Read all plans and all trainings from Redux
  const allPlans = useSelector((state: GlobalState) =>
    state.trainingsPlan.allIds.map((id) => state.trainingsPlan.byId[id]),
  );
  const trainingsById = useSelector((state: GlobalState) => state.trainings.byId);

  // Build the marking data
  const {markedDates, selectedTrainings} = useMemo(() => {
    const marks: {[dateStr: string]: DayMark} = {};

    const setMark = (dateStr: string, partial: Partial<DayMark>) => {
      const existing = marks[dateStr] ?? {};
      // Accumulate trainings array instead of overwriting
      if (partial.trainings) {
        marks[dateStr] = {
          ...existing,
          ...partial,
          trainings: [...(existing.trainings ?? []), ...partial.trainings],
        };
      } else {
        marks[dateStr] = {...existing, ...partial};
      }
    };

    allPlans.forEach((plan) => {
      if (!plan?.trainings) return;

      // ── Step 1: collect all finished training dates per micro ────────────
      const microTrainingDates: Map<number, Date[]> = new Map();
      // All events in this plan (for boundary cut detection)
      const allPlanEvents: {date: Date; micro: number}[] = [];

      Object.entries(plan.trainings).forEach(([key, trainingId]) => {
        const micro = getMicroFromTrainingInMicroIndex(key);
        const trainingInMicro = getTrainingFromTrainingInMicroIndex(key);
        const training = trainingsById[trainingId];
        if (!training || training.state !== TrainingsState.FINISHED || !training.start) return;

        const rawDate = new Date(training.start);
        const normalized = new Date(rawDate);
        normalized.setHours(0, 0, 0, 0);

        const dateStr = getYYYYMMDDFormat(rawDate);
        const trainingName = plan.trainingNames?.[trainingInMicro] ?? `Training ${trainingInMicro}`;

        setMark(dateStr, {
          trainings: [{
            trainingId: training.id!,
            planId: plan.id!,
            microNumber: micro,
            trainingInMicro,
            trainingName,
            planName: plan.name,
          }],
        });

        if (!microTrainingDates.has(micro)) microTrainingDates.set(micro, []);
        microTrainingDates.get(micro)!.push(normalized);
        allPlanEvents.push({date: normalized, micro});
      });

      // ── Step 2: week-stretched ranges with boundary cuts ─────────────────
      microTrainingDates.forEach((dates, micro) => {
        if (dates.length === 0) return;

        const sorted = [...dates].sort((a, b) => a.getTime() - b.getTime());
        const firstTraining = sorted[0];
        const lastTraining = sorted[sorted.length - 1];

        // Base range: Monday of first-training-week → Sunday of last-training-week
        let rangeStart = getWeekStart(firstTraining);
        let rangeEnd = getWeekEnd(lastTraining);

        // Cut start: another micro had a training in the same week, before firstTraining
        const firstWeekStart = getWeekStart(firstTraining);
        const hasConflictBefore = allPlanEvents.some(
          (e) =>
            e.micro !== micro &&
            e.date.getTime() >= firstWeekStart.getTime() &&
            e.date.getTime() < firstTraining.getTime(),
        );
        if (hasConflictBefore) {
          rangeStart = firstTraining;
        }

        // Cut end: another micro has its first training in the same week, after lastTraining
        const lastWeekEnd = getWeekEnd(lastTraining);
        const conflictsAfter = allPlanEvents.filter(
          (e) =>
            e.micro !== micro &&
            e.date.getTime() > lastTraining.getTime() &&
            e.date.getTime() <= lastWeekEnd.getTime(),
        );
        if (conflictsAfter.length > 0) {
          const earliest = conflictsAfter.reduce((min, e) => (e.date < min.date ? e : min));
          rangeEnd = addDays(earliest.date, -1);
        }

        // Fill all days in [rangeStart, rangeEnd] (inclusive)
        const allDays = getDaysBetween(rangeStart, rangeEnd);
        allDays.forEach((d, i) => {
          const ds = getYYYYMMDDFormat(d);
          setMark(ds, {
            inMicroRange: true,
            isMicroStart: (marks[ds]?.isMicroStart ?? false) || i === 0,
            isMicroEnd: (marks[ds]?.isMicroEnd ?? false) || i === allDays.length - 1,
            microRangeNumber: micro,
          });
        });
      });

      // ── Step 3: mark meso start ──────────────────────────────────────────
      const allFinishedTimes = allPlanEvents.map((e) => e.date.getTime());
      if (allFinishedTimes.length > 0) {
        const mesoStartDate = new Date(Math.min(...allFinishedTimes));
        const mesoDateStr = getYYYYMMDDFormat(mesoStartDate);
        setMark(mesoDateStr, {isMesoStart: true, mesoName: plan.name});
      }
    });

    // Resolve all trainings for the selected date
    let selectedTrainings: SelectedTraining[] = [];
    if (selectedDate && (marks[selectedDate]?.trainings?.length ?? 0) > 0) {
      selectedTrainings = (marks[selectedDate].trainings ?? []).flatMap((entry) => {
        const training = trainingsById[entry.trainingId];
        const plan = allPlans.find((p) => p?.id === entry.planId);
        if (!training || !plan) return [];
        return [{
          training,
          plan,
          micro: entry.microNumber,
          trainingInMicro: entry.trainingInMicro,
          trainingName: entry.trainingName,
        }];
      });
    }

    return {markedDates: marks, selectedTrainings};
  }, [allPlans, trainingsById, selectedDate]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleDayPress = (day: DateData) => {
    const hasTraining = (markedDates[day.dateString]?.trainings?.length ?? 0) > 0;
    if (hasTraining) {
      setSelectedDate((prev) => {
        if (prev !== day.dateString) {
          setSelectedTrainingIndex(0);
          // Scroll to detail panel after state update
          setTimeout(() => scrollRef.current?.scrollTo({y: detailY.current, animated: true}), 100);
        }
        return prev === day.dateString ? undefined : day.dateString;
      });
    } else {
      setSelectedDate((prev) => (prev === day.dateString ? undefined : day.dateString));
    }
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

  const activeTraining = selectedTrainings[selectedTrainingIndex] ?? selectedTrainings[0];

  return (
    <ScrollView ref={scrollRef} style={styles.container} contentContainerStyle={{flexGrow: 1}}>
      {onBack && (
        <Button
          mode="text"
          icon="arrow-left"
          onPress={onBack}
          style={styles.backButton}
          contentStyle={{flexDirection: 'row-reverse'}}
          testID="history-back-button"
        >
          Zurück zum Plan
        </Button>
      )}
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
        current={getYYYYMMDDFormat(new Date())}
      />
      {selectedTrainings.length > 0 && activeTraining && (
        <View onLayout={(e) => { detailY.current = e.nativeEvent.layout.y; }}>
          {selectedTrainings.length > 1 && (
            <SegmentedButtons
              value={String(selectedTrainingIndex)}
              onValueChange={(v) => setSelectedTrainingIndex(Number(v))}
              style={styles.trainingPicker}
              buttons={selectedTrainings.map((t, i) => ({
                value: String(i),
                label: t.trainingName,
              }))}
            />
          )}
          <TrainingDetailPanel
            selected={activeTraining}
            onNavigate={() =>
              onNavigateToTraining(activeTraining.plan, activeTraining.micro, activeTraining.trainingInMicro)
            }
          />
        </View>
      )}
    </ScrollView>
  );
};

// ─── styles ─────────────────────────────────────────────────────────────────

const CELL_W = 38;
const CELL_H = 48;
const DOT_SIZE = 5;
const CIRCLE_SIZE = 26;
const BG_H = CIRCLE_SIZE + 6; // height of the period background band
const BG_RADIUS = BG_H / 2;

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
  // micro period background
  microRangeBg: {
    position: 'absolute',
    top: (CELL_H - BG_H) / 2,
    height: BG_H,
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
  backButton: {
    alignSelf: 'flex-start',
    marginTop: 4,
  },
  trainingPicker: {
    margin: 8,
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
