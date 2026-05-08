import React, {useEffect, useState} from 'react';
import {Dimensions, ScrollView, StyleSheet, View} from 'react-native';
import {Button, Dialog, Portal, Text, TextInput, useTheme} from 'react-native-paper';
import {Muscles} from '../../../models/Muscles';
import {MusclePercentPair} from '../../../models/entities/Exercise';
import {ALL_MUSCLES_SORTED, draftToPairs, pairsToDraft} from './muscle-involvement-utils';

const SCROLL_MAX_HEIGHT = Math.round(Dimensions.get('window').height * 0.55);

interface MuscleInvolvementEditorProps {
  visible: boolean;
  onDismiss: () => void;
  initialPairs: MusclePercentPair[];
  onApply: (pairs: MusclePercentPair[]) => void;
}

const MuscleInvolvementEditor = ({visible, onDismiss, initialPairs, onApply}: MuscleInvolvementEditorProps) => {
  const theme = useTheme();
  const [draft, setDraft] = useState<Record<Muscles, string>>(() => pairsToDraft(initialPairs));

  useEffect(() => {
    if (visible) {
      setDraft(pairsToDraft(initialPairs));
    }
  }, [visible, initialPairs]);

  const setPercentFor = (muscle: Muscles, text: string) => {
    setDraft((prev) => ({...prev, [muscle]: text}));
  };

  const handleApply = () => {
    onApply(draftToPairs(draft));
    onDismiss();
  };

  return (
    <Portal>
      <Dialog visible={visible} onDismiss={onDismiss} theme={theme}>
        <Dialog.Title>Muscle involvement</Dialog.Title>
        <Dialog.Content style={styles.contentPad}>
          <View style={[styles.headerRow, {borderColor: theme.colors.outlineVariant, backgroundColor: theme.colors.surfaceVariant}]}>
            <Text variant="labelMedium" style={[styles.headerMuscleText, {color: theme.colors.onSurfaceVariant}]}>
              Muscle
            </Text>
            <Text variant="labelMedium" style={[styles.headerPercentText, {color: theme.colors.onSurfaceVariant}]}>
              Involvement in %
            </Text>
          </View>
          <ScrollView
            style={[styles.scroll, {maxHeight: SCROLL_MAX_HEIGHT}]}
            keyboardShouldPersistTaps="handled"
            nestedScrollEnabled
          >
            {ALL_MUSCLES_SORTED.map((muscle) => (
              <View key={muscle} style={[styles.row, {borderColor: theme.colors.outlineVariant}]}>
                <Text variant="bodyMedium" style={[styles.muscleLabel, {color: theme.colors.onSurface}]} numberOfLines={1}>
                  {muscle}
                </Text>
                <TextInput
                  mode="outlined"
                  dense
                  label=""
                  keyboardType="numeric"
                  inputMode="numeric"
                  style={styles.percentInput}
                  selectTextOnFocus
                  value={draft[muscle]}
                  onChangeText={(t) => setPercentFor(muscle, t)}
                  right={<TextInput.Affix text="" />}
                />
              </View>
            ))}
          </ScrollView>
        </Dialog.Content>
        <Dialog.Actions>
          <Button onPress={onDismiss}>Cancel</Button>
          <Button onPress={handleApply}>Done</Button>
        </Dialog.Actions>
      </Dialog>
    </Portal>
  );
};

export default MuscleInvolvementEditor;

const styles = StyleSheet.create({
  contentPad: {
    paddingHorizontal: 10,
  },
  scroll: {
    marginHorizontal: -10,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderBottomWidth: 0,
    borderTopLeftRadius: 8,
    borderTopRightRadius: 8,
    paddingVertical: 8,
    paddingHorizontal: 8,
  },
  headerMuscleText: {
    flex: 1,
  },
  headerPercentText: {
    textAlign: 'center',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    borderLeftWidth: 0,
    borderRightWidth: 0,
    borderBottomWidth: 1,
    borderBottomEndRadius: 15,
    borderBottomStartRadius: 15,
    paddingHorizontal: 15,
    paddingVertical: 2,
    gap: 8,
  },
  muscleLabel: {
    flex: 1,
    minWidth: 0,
  },
  percentInput: {
    width: 100,
    height: 40,
  },
});
