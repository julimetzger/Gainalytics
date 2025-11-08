import {Button, IconButton, Tooltip, useTheme} from 'react-native-paper';
import {TimerPickerModal} from 'react-native-timer-picker';
import React, {useState} from 'react';
import {View} from 'react-native';

interface TimeRangePickerProps {
  title: string;
  setPauseTimer: (pauseTimerInSeconds?: number) => void;
  timeRange?: number;
}

const TimeRangePicker = ({title, setPauseTimer, timeRange}: TimeRangePickerProps) => {
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
    <View style={{flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginEnd: 5}}>
      <Button
        mode="outlined"
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
          iconColor={theme.colors.secondary}
          onPress={() => {
            setPauseTimer(undefined);
          }}
        />
      </Tooltip>
    </View>
  );
};

export default TimeRangePicker;
