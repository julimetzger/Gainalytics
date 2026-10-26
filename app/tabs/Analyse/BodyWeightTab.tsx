import React, {useCallback, useMemo, useState} from 'react';
import {processColor, StyleSheet, View} from 'react-native';
import {FlashList} from '@shopify/flash-list';
import {useFocusEffect} from '@react-navigation/native';
import {LineChart} from 'react-native-charts-wrapper';
import {Button, Card, IconButton, MD3Theme, Text, useTheme} from 'react-native-paper';
import AnalyseEmptyState from '../../components/analyse/AnalyseEmptyState';
import BodyWeightEntryDialog from '../../components/analyse/BodyWeightEntryDialog';
import DateRangePicker, {Range} from '../../components/picker/date/DateRangePicker';
import {BodyWeightEntry} from '../../models/entities/BodyWeightEntry';
import {useAddBodyWeightEntry, useDeleteBodyWeightEntry, useEditBodyWeightEntry} from '../../redux/BodyWeight/dispatch/dispatchBodyWeight';
import {useBodyWeightEntries} from '../../redux/BodyWeight/use/useBodyWeightEntries';
import {computeBodyWeightStats, entriesInRange, formatWeightChangeKg, formatWeightKg} from '../../utils/body-weight';
import {firstDayOfWeek, getDateStringFromDate, lastDayOfWeek, subtractMonths} from '../../utils/DateHelper';
import {rangeEndingAt} from '../../utils/analyse-range';
import HealthConnectBodyWeightHeader, {HealthConnectWeightRow} from '../../components/analyse/HealthConnectBodyWeightHeader';
import {useBodyWeights, useHealthConnectActions, useHealthConnectConnection} from '../../redux/HealthConnect/use/useHealthConnect';
import {canReadBodyWeight} from '../../utils/healthConnect/healthConnectStatus';
import {HealthConnectWeight} from '../../utils/healthConnect/healthConnectNative';

const NO_WEIGHTS: HealthConnectWeight[] = [];

const createDefaultRange = () => {
  const now = new Date();
  return new Range(subtractMonths(3, firstDayOfWeek(now, 1)), lastDayOfWeek(now, 0));
};

const BodyWeightTab = () => {
  const theme = useTheme();
  const styles = useMemo(() => createStyles(theme), [theme]);
  const [range, setRange] = useState(createDefaultRange);
  const [dialogVisible, setDialogVisible] = useState(false);
  const [editedEntry, setEditedEntry] = useState<BodyWeightEntry | undefined>(undefined);
  const allEntries = useBodyWeightEntries();
  const addEntry = useAddBodyWeightEntry();
  const editEntry = useEditBodyWeightEntry();
  const deleteEntry = useDeleteBodyWeightEntry();
  // GH-528 (T3): with "Read body weight" the weights from Health Connect follow the manual entries.
  const healthConnectWeights = useBodyWeights();
  const showHealthConnect = canReadBodyWeight(useHealthConnectConnection());
  const {loadWeights} = useHealthConnectActions();
  // Re-read on every visit: the scale app may have written a new value meanwhile. Without the
  // permission Health Connect is not asked at all.
  useFocusEffect(
    useCallback(() => {
      if (showHealthConnect) loadWeights();
    }, [showHealthConnect, loadWeights]),
  );
  const healthConnectNewestFirst = useMemo(() => (showHealthConnect ? [...healthConnectWeights].reverse() : NO_WEIGHTS), [showHealthConnect, healthConnectWeights]);

  const entries = useMemo(() => entriesInRange(allEntries, range.startDate.getTime(), range.endDate.getTime()), [allEntries, range]);
  const stats = useMemo(() => computeBodyWeightStats(entries), [entries]);
  const latestEntry = allEntries[0];

  const chartData = useMemo(() => {
    const color = processColor(theme.colors.primary);
    return {
      dataSets: [
        {
          label: 'Body weight',
          config: {
            color,
            circleColor: color,
            highlightEnabled: true,
            lineWidth: 2,
            drawCircleHole: false,
            highlightColor: processColor(theme.colors.secondary),
            circleRadius: 4,
            mode: 'LINEAR' as const,
            drawValues: false,
          },
          values: entries.map((entry) => ({x: entry.date, y: entry.weightKg, marker: `${formatWeightKg(entry.weightKg)}${entry.note ? `\n${entry.note}` : ''}`})),
        },
      ],
    };
  }, [entries, theme.colors.primary, theme.colors.secondary]);

  const openNew = useCallback(() => {
    setEditedEntry(undefined);
    setDialogVisible(true);
  }, []);

  const openEdit = useCallback((entry: BodyWeightEntry) => {
    setEditedEntry(entry);
    setDialogVisible(true);
  }, []);

  const closeDialog = useCallback(() => setDialogVisible(false), []);

  const handleSave = useCallback(
    (entry: Omit<BodyWeightEntry, 'id'>) => {
      if (editedEntry) {
        editEntry({...entry, id: editedEntry.id});
      } else {
        addEntry(entry);
      }
      setDialogVisible(false);
    },
    [addEntry, editEntry, editedEntry],
  );

  const handleDelete = useCallback(() => {
    if (editedEntry) {
      deleteEntry(editedEntry.id);
    }
    setDialogVisible(false);
  }, [deleteEntry, editedEntry]);

  const manualSection = (
    <View>
      <Card style={styles.card}>
        <Card.Content>
          <Text variant="titleMedium">Body weight</Text>
          <Text variant="bodyMedium" style={styles.mutedText}>
            Entered manually, stored only on this device.
          </Text>
          {!showHealthConnect && (
            <Text variant="bodySmall" style={styles.mutedText} testID="body-weight-not-connected">
              Connect Health Connect with "Read body weight" in Settings to also see the values of your scale or health app here.
            </Text>
          )}
          <Button mode="contained" icon="plus" onPress={openNew} style={styles.addButton} testID="body-weight-add">
            Add weight
          </Button>
        </Card.Content>
      </Card>

      {allEntries.length === 0 ? (
        <AnalyseEmptyState
          testID="body-weight-empty-state"
          title="No body weight yet"
          description="Add your first weight to see how it develops over time."
          actions={[{label: 'Add first weight', testID: 'body-weight-empty-add', onPress: openNew}]}
        />
      ) : (
        <>
          <DateRangePicker range={range} setRange={setRange} />

          {entries.length === 0 ? (
            <AnalyseEmptyState
              testID="body-weight-empty-range"
              title="No weight entries in this period"
              description={`The latest entry is from ${getDateStringFromDate(latestEntry.date)}.`}
              actions={[{label: `Jump to ${getDateStringFromDate(latestEntry.date)}`, testID: 'body-weight-jump-to-last', onPress: () => setRange(rangeEndingAt(new Date(latestEntry.date)))}]}
            />
          ) : (
            <>
              <View style={styles.kpiRow}>
                <Card style={styles.kpiCard}>
                  <Card.Content>
                    <Text variant="labelMedium" style={styles.mutedText}>
                      Current
                    </Text>
                    <Text variant="titleLarge" testID="body-weight-current">
                      {formatWeightKg(stats!.currentKg)}
                    </Text>
                  </Card.Content>
                </Card>
                <Card style={styles.kpiCard}>
                  <Card.Content>
                    <Text variant="labelMedium" style={styles.mutedText}>
                      Change in period
                    </Text>
                    <Text variant="titleLarge" testID="body-weight-change">
                      {stats!.changeKg === undefined ? '–' : formatWeightChangeKg(stats!.changeKg)}
                    </Text>
                  </Card.Content>
                </Card>
              </View>

              <Card style={styles.card} testID="body-weight-chart">
                <Card.Content>
                  <LineChart
                    style={styles.chart}
                    data={chartData}
                    marker={{enabled: true, markerColor: processColor(theme.colors.backdrop), textSize: 15, textColor: processColor(theme.colors.secondary)}}
                    legend={{enabled: false}}
                    xAxis={{valueFormatter: 'date', valueFormatterPattern: 'dd MMM', position: 'BOTTOM', textColor: processColor(theme.colors.onBackground)}}
                    yAxis={{left: {textColor: processColor(theme.colors.onBackground)}, right: {enabled: false}}}
                    chartDescription={{text: ''}}
                  />
                </Card.Content>
              </Card>

              <Card style={styles.card} testID="body-weight-entries">
                <Card.Title title="Entries" />
                <Card.Content>
                  {[...entries].reverse().map((entry) => (
                    <View key={entry.id} style={styles.entryRow} testID={`body-weight-entry-${entry.id}`}>
                      <View style={styles.entryText}>
                        <Text variant="bodyLarge" testID={`body-weight-entry-text-${entry.id}`}>{`${getDateStringFromDate(entry.date)}  ·  ${formatWeightKg(entry.weightKg)}`}</Text>
                        {!!entry.note && (
                          <Text variant="bodySmall" style={styles.mutedText}>
                            {entry.note}
                          </Text>
                        )}
                      </View>
                      <IconButton icon="pencil" onPress={() => openEdit(entry)} accessibilityLabel="Edit entry" testID={`body-weight-edit-${entry.id}`} />
                    </View>
                  ))}
                </Card.Content>
              </Card>
            </>
          )}
        </>
      )}
      {showHealthConnect && <HealthConnectBodyWeightHeader weights={healthConnectWeights} />}
    </View>
  );

  return (
    <View style={styles.container} testID="body-weight-screen">
      <FlashList
        data={healthConnectNewestFirst}
        ListHeaderComponent={manualSection}
        keyExtractor={(item: HealthConnectWeight) => `${item.time}-${item.origin}-${item.kg}`}
        renderItem={({item, index}: {item: HealthConnectWeight; index: number}) => <HealthConnectWeightRow item={item} index={index} />}
        contentContainerStyle={styles.content}
        testID="body-weight-list"
      />
      <BodyWeightEntryDialog visible={dialogVisible} entry={editedEntry} onDismiss={closeDialog} onSave={handleSave} onDelete={handleDelete} />
    </View>
  );
};

const createStyles = (theme: MD3Theme) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: theme.colors.background,
    },
    content: {
      paddingBottom: 24,
    },
    card: {
      marginHorizontal: 12,
      marginTop: 8,
    },
    addButton: {
      marginTop: 12,
      alignSelf: 'flex-start',
    },
    kpiRow: {
      flexDirection: 'row',
      marginHorizontal: 12,
      marginTop: 8,
      gap: 8,
    },
    kpiCard: {
      flex: 1,
    },
    chart: {
      height: 280,
    },
    entryRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
    },
    entryText: {
      flex: 1,
    },
    mutedText: {
      color: theme.colors.onSurfaceVariant,
    },
  });

export default BodyWeightTab;
