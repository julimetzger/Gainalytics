import {Button, IconButton, Tooltip, useTheme} from 'react-native-paper';
import {TimerPickerModal} from 'react-native-timer-picker';
import React, {useState} from 'react';
import {StyleSheet, View} from 'react-native';

interface TimeRangePickerProps {
  title: string;
  setPauseTimer: (pauseTimerInSeconds?: number) => void;
  timeRange?: number;
  testID?: string;
}

const TimeRangePicker = ({title, setPauseTimer, timeRange, testID}: TimeRangePickerProps) => {
  const [showPicker, setShowPicker] = useState(false);
  let theme = useTheme();
  const getTimeString = (timeInSeconds?: number) => {
    if (timeInSeconds === undefined) return 'disabled';
    const hours = Math.floor(timeInSeconds / 3600);
    const minutes = Math.floor((timeInSeconds % 3600) / 60);
    const seconds = timeInSeconds % 60;
    return `${hours}h ${minutes}m ${seconds}s`;
  };
  return (
    <View style={styles.row} testID={testID && `${testID}-row`}>
      <Button
        mode="outlined"
        testID={testID}
        style={styles.timeButton}
        labelStyle={styles.timeLabel}
        onPress={() => {
          setShowPicker(true);
        }}
      >
        {title}
        {getTimeString(timeRange)}
      </Button>
      <TimerPickerModal
        visible={showPicker}
        setIsVisible={setShowPicker}
        styles={{
          theme: theme.dark ? 'dark' : 'light',
          confirmButton: {
            color: theme.colors.onPrimary,
            backgroundColor: theme.colors.primary,
            borderColor: theme.colors.primary,
          },
        }}
        onConfirm={(pickedDuration) => {
          setPauseTimer(pickedDuration.hours * 3600 + pickedDuration.minutes * 60 + pickedDuration.seconds);
          setShowPicker(false);
        }}
        modalTitle={title}
        onCancel={() => setShowPicker(false)}
        closeOnOverlayPress
      />
      <Tooltip title="Resets Timer">
        <IconButton
          icon={'delete'}
          testID={testID && `${testID}-delete`}
          iconColor={theme.colors.secondary}
          onPress={() => {
            setPauseTimer(undefined);
          }}
        />
      </Tooltip>
    </View>
  );
};

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginEnd: 5,
  },
  // A long title (or a large system font) must not push the delete button out
  // of the row: the button gives way, so every delete button keeps the same
  // right-aligned spot (GH-522).
  timeButton: {
    flexShrink: 1,
  },
  // Paper's 24 per side leaves "Finish Training Timer: 0h 20m 0s" too little
  // room with a large system font before it has to be cut off.
  timeLabel: {
    marginHorizontal: 16,
  },
});

export default TimeRangePicker;
