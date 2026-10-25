import React, {useState} from 'react';
import {ScrollView, StyleSheet} from 'react-native';
import {Button, Dialog, List, Portal, RadioButton, Text, useTheme} from 'react-native-paper';
import {HEALTH_CONNECT_SEGMENT_KEYS, HEALTH_CONNECT_SEGMENT_LABELS, HealthConnectSegmentKey} from '../../../models/HealthConnectSegmentType';
import {segmentTypeForName} from '../../../utils/healthConnect/healthConnectMapping';

interface Props {
  /** Current exercise name, for the "Automatic" suggestion. */
  name: string;
  value: HealthConnectSegmentKey | undefined;
  onChange: (value: HealthConnectSegmentKey | undefined) => void;
}

const AUTOMATIC = 'AUTOMATIC';

/** GH-528 (T2): optional Health Connect exercise type of an exercise; overrides the name rule. */
const HealthConnectTypeField = ({name, value, onChange}: Props) => {
  const theme = useTheme();
  const [open, setOpen] = useState(false);
  const automatic = HEALTH_CONNECT_SEGMENT_LABELS[segmentTypeForName(name.trim())];
  const current = value ? HEALTH_CONNECT_SEGMENT_LABELS[value] : `Automatic (${automatic})`;

  const select = (selected: string) => {
    onChange(selected === AUTOMATIC ? undefined : HEALTH_CONNECT_SEGMENT_KEYS.find((key) => key === selected));
    setOpen(false);
  };

  return (
    <>
      <List.Item
        title="Health Connect type"
        description={current}
        left={(props) => <List.Icon {...props} icon="heart-pulse" />}
        onPress={() => setOpen(true)}
        style={styles.item}
        testID="edit-exercise-health-connect-type"
      />
      <Portal>
        <Dialog visible={open} onDismiss={() => setOpen(false)} testID="edit-exercise-health-connect-type-dialog">
          <Dialog.Title>Health Connect type</Dialog.Title>
          <Dialog.ScrollArea style={styles.scrollArea}>
            <ScrollView>
              <Text variant="bodySmall" style={[styles.hint, {color: theme.colors.onSurfaceVariant}]}>
                How this exercise appears in Health Connect when a training is written there.
              </Text>
              <RadioButton.Group value={value ?? AUTOMATIC} onValueChange={select}>
                <RadioButton.Item label={`Automatic (${automatic})`} value={AUTOMATIC} testID="health-connect-type-AUTOMATIC" />
                {HEALTH_CONNECT_SEGMENT_KEYS.map((key) => (
                  <RadioButton.Item key={key} label={HEALTH_CONNECT_SEGMENT_LABELS[key]} value={key} testID={`health-connect-type-${key}`} />
                ))}
              </RadioButton.Group>
            </ScrollView>
          </Dialog.ScrollArea>
          <Dialog.Actions>
            <Button onPress={() => setOpen(false)}>Cancel</Button>
          </Dialog.Actions>
        </Dialog>
      </Portal>
    </>
  );
};

const styles = StyleSheet.create({
  item: {
    paddingHorizontal: 0,
    marginTop: 8,
  },
  scrollArea: {
    maxHeight: 420,
    paddingHorizontal: 0,
  },
  hint: {
    paddingHorizontal: 24,
    paddingTop: 8,
  },
});

export default HealthConnectTypeField;
