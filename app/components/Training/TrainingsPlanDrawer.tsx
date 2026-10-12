import {Divider, IconButton, SegmentedButtons, Text, TextInput, ThemeBase, Tooltip, TouchableRipple} from 'react-native-paper';
import {MD3Colors, MD3Typescale} from 'react-native-paper/lib/typescript/types';
import {Action} from 'redux';
import {TrainingsPlan} from '../../models/entities/TrainingsPlan';
import {View, Keyboard, ScrollView, StyleSheet} from 'react-native';
import React, {useState, useRef, useEffect} from 'react';
import DashedAddButton from '../shared/DashedAddButton';
import {getLocalMicro, getMesoEndMicro, getMesoForMicro, getSortedMesos} from '../../redux/Training/trainingsPlanReducer';

interface TrainingsPlanDrawerProps {
  theme: ThemeBase & {
    version: 3;
    isV3: true;
    colors: MD3Colors;
    fonts: MD3Typescale;
  };
  changeTrainingsName: (trainingsPlanId: number, trainingsName: string, trainingsNumber: number) => Action<any>;
  trainingsPlan: TrainingsPlan;
  setTrainingInMicro: (value: ((prevState: number) => number) | number) => void;
  setMicro: (micro: number) => void;
  setOpen: (value: ((prevState: boolean) => boolean) | boolean) => void;
  showDone: boolean;
  setShowDone: (value: ((prevState: boolean) => boolean) | boolean) => void;
  setShowHistory: (value: ((prevState: boolean) => boolean) | boolean) => void;
  handleValueChange: (newValue: any) => void;
  micro: number;
  onAddMeso: () => void;
  onEditMeso: (mesoId: number, name: string) => void;
  onDeleteMeso: (mesoId: number) => void;
}

const TrainingsPlanDrawer = ({
  theme,
  changeTrainingsName,
  trainingsPlan,
  setTrainingInMicro,
  setMicro,
  setOpen,
  setShowDone,
  setShowHistory,
  handleValueChange,
  micro,
  onAddMeso,
  onEditMeso,
  onDeleteMeso,
}: TrainingsPlanDrawerProps) => {
  const [edit, setEdit] = useState<number | undefined>(undefined);
  const [trainingsName, setTrainingsName] = useState('');
  const [longPressIndex, setLongPressIndex] = useState<number | undefined>(undefined);
  const inputRef = useRef(null);

  const [editMesoId, setEditMesoId] = useState<number | undefined>(undefined);
  const [mesoName, setMesoName] = useState('');
  const [longPressMesoId, setLongPressMesoId] = useState<number | undefined>(undefined);
  const mesoInputRef = useRef(null);

  useEffect(() => {
    if (!trainingsPlan.trainingNames || Object.keys(trainingsPlan.trainingNames).length === 0) {
      changeTrainingsName(trainingsPlan.id!!, 'Training 1', 1);
    }
  }, [trainingsPlan, changeTrainingsName]);

  const sortedMesos = getSortedMesos(trainingsPlan.mesos);
  const currentMeso = getMesoForMicro(trainingsPlan.mesos, micro);
  const mesoEndMicro = getMesoEndMicro(trainingsPlan.mesos, currentMeso);
  const localMicro = getLocalMicro(trainingsPlan.mesos, micro);
  const maxLocalMicro = mesoEndMicro ? getLocalMicro(trainingsPlan.mesos, mesoEndMicro) : undefined;
  const canDeleteMesos = sortedMesos.length > 1;
  const previousLocalMicroLabel = Math.max(1, localMicro - 1);
  const nextLocalMicroLabel = maxLocalMicro ? Math.min(maxLocalMicro, localMicro + 1) : localMicro + 1;

  return (
    // GH-509: bottom padding so the micro pager isn't clipped at the end of a long list.
    <ScrollView style={{flex: 1}} contentContainerStyle={{flexDirection: 'column', paddingBottom: 12}}>
      <Divider />
      <View style={{display: 'flex', flexDirection: 'row', alignItems: 'center', marginBottom: 5}}>
        <Text style={{fontSize: theme.fonts.headlineSmall.fontSize, marginLeft: 5}}>Mesos:</Text>
      </View>
      {sortedMesos.map((meso) => {
        return (
          <View key={meso.id} style={{display: 'flex', flexDirection: 'row', alignItems: 'center', minHeight: 40}}>
            <TouchableRipple
              style={{flex: 1}}
              onPress={() => {
                setMicro(meso.startMicro);
                setOpen(false);
                setShowDone(false);
              }}
              onLongPress={() => canDeleteMesos && setLongPressMesoId(meso.id)}
            >
              <View>
                {editMesoId !== meso.id && (
                  <Text testID={`drawer-meso-name-${meso.id}`} style={{fontSize: 20, margin: 5}}>
                    {meso.name}
                  </Text>
                )}
                {editMesoId === meso.id && (
                  <TextInput
                    ref={mesoInputRef}
                    mode="outlined"
                    maxLength={20}
                    value={mesoName}
                    onChangeText={(text) => setMesoName(text)}
                    onEndEditing={() => {
                      onEditMeso(meso.id, mesoName);
                      setEditMesoId(undefined);
                      setMesoName('');
                      mesoInputRef.current?.blur();
                      Keyboard.dismiss();
                    }}
                    selectTextOnFocus={true}
                    right={
                      <TextInput.Icon
                        icon="check"
                        onPress={() => {
                          onEditMeso(meso.id, mesoName);
                          setEditMesoId(undefined);
                          setMesoName('');
                          mesoInputRef.current?.blur();
                          Keyboard.dismiss();
                        }}
                      />
                    }
                  />
                )}
              </View>
            </TouchableRipple>
            {editMesoId !== meso.id &&
              (longPressMesoId === meso.id && canDeleteMesos ? (
                <IconButton
                  testID={`delete-meso-${meso.id}`}
                  icon="delete"
                  onPress={() => {
                    onDeleteMeso(meso.id);
                    setLongPressMesoId(undefined);
                  }}
                  size={20}
                  style={{marginRight: 5}}
                />
              ) : (
                <IconButton
                  icon="pencil"
                  onPress={() => {
                    setEditMesoId(meso.id);
                    setMesoName(meso.name);
                    setTimeout(() => mesoInputRef.current?.focus(), 0);
                  }}
                  size={20}
                  style={{marginRight: 5}}
                />
              ))}
          </View>
        );
      })}
      {/* GH-509: full-width dashed button in the "Add set" style instead of a lone "+" icon.
          The testID is kept so existing flows still find the meso add button. */}
      <DashedAddButton label="Add Meso" testID="icon-plus-circle" onPress={onAddMeso} style={styles.addButton} />
      <Divider />
      <View style={{display: 'flex', flexDirection: 'row', alignItems: 'center', marginBottom: 5}}>
        <Text style={{fontSize: theme.fonts.headlineSmall.fontSize, marginLeft: 5}}>Trainings:</Text>
      </View>
      {Object.entries(trainingsPlan.trainingNames ?? []).map(([micro, name], index) => {
        return (
          <View key={index} style={{display: 'flex', flexDirection: 'row', alignItems: 'center', minHeight: 40}}>
            <TouchableRipple
              style={{flex: 1}}
              onPress={() => {
                setShowHistory(false);
                setTrainingInMicro(parseInt(micro));
                setOpen(false);
                setShowDone(false);
              }}
              onLongPress={() => setLongPressIndex(index)}
            >
              <View>
                {(edit === undefined || edit !== index) && <Text style={{fontSize: 20, margin: 5}}>{name}</Text>}
                {edit !== undefined && edit === index ? (
                  <TextInput
                    ref={inputRef}
                    mode="outlined"
                    maxLength={20}
                    value={trainingsName}
                    onChangeText={(text) => {
                      setTrainingsName(text);
                    }}
                    onEndEditing={() => {
                      changeTrainingsName(trainingsPlan.id!!, trainingsName, index + 1);
                      setEdit(undefined);
                      setTrainingsName('');
                      inputRef.current?.blur();
                      Keyboard.dismiss();
                    }}
                    selectTextOnFocus={true}
                    right={
                      <TextInput.Icon
                        icon="check"
                        onPress={() => {
                          changeTrainingsName(trainingsPlan.id!!, trainingsName, index + 1);
                          setEdit(undefined);
                          setTrainingsName('');
                          inputRef.current?.blur();
                          Keyboard.dismiss();
                        }}
                      />
                    }
                  />
                ) : null}
              </View>
            </TouchableRipple>
            {edit !== index &&
              (longPressIndex === index ? (
                <IconButton
                  icon="delete"
                  onPress={() => {
                    // Add delete logic here
                    setLongPressIndex(undefined);
                  }}
                  size={20}
                  style={{marginRight: 5}}
                />
              ) : (
                <IconButton
                  icon="pencil"
                  onPress={() => {
                    setEdit(index);
                    setTrainingsName(name);
                    setTimeout(() => inputRef.current?.focus(), 0);
                  }}
                  size={20}
                  style={{marginRight: 5}}
                />
              ))}
          </View>
        );
      })}
      <DashedAddButton
        label="Add Training"
        testID="drawer-add-training-button"
        onPress={() => {
          changeTrainingsName(trainingsPlan.id!!, 'Training ' + (Object.keys(trainingsPlan.trainingNames ?? []).length + 1), Object.keys(trainingsPlan.trainingNames ?? []).length + 1);
        }}
        style={styles.addButton}
      />
      <Divider />
      <TouchableRipple>
        <Tooltip title="Displays workout statistics for this Micro">
          <Text
            style={{fontSize: 20, margin: 5}}
            onPress={() => {
              setShowHistory(false);
              setOpen(false);
              setShowDone(true);
            }}
          >
            Overview
          </Text>
        </Tooltip>
      </TouchableRipple>
      <TouchableRipple testID="history-drawer-item">
        <Tooltip title="Shows a calendar with all completed trainings">
          <Text
            style={{fontSize: 20, margin: 5}}
            onPress={() => {
              setOpen(false);
              setShowHistory(true);
            }}
          >
            History
          </Text>
        </Tooltip>
      </TouchableRipple>
      {/* GH-417: the "Enable Planning Mode" and "Show muscle map" switches used to
          sit here. Both moved into the analysis view's Plan | Train toggle. */}
      <Divider style={{marginVertical: 5}} />
      <SegmentedButtons
        style={{marginTop: 5}}
        value={''}
        onValueChange={handleValueChange}
        buttons={[
          {
            icon: 'chevron-left',
            value: 'micro - 1',
            label: 'Micro ' + previousLocalMicroLabel,
            disabled: currentMeso ? micro === currentMeso.startMicro : micro === 1,
          },
          {
            icon: 'chevron-right',
            value: 'micro + 1',
            label: 'Micro ' + nextLocalMicroLabel,
            disabled: mesoEndMicro !== undefined && micro >= mesoEndMicro,
          },
        ]}
      />
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  addButton: {
    marginHorizontal: 8,
    marginTop: 4,
    marginBottom: 8,
  },
});

export default TrainingsPlanDrawer;
