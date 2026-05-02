import React from 'react';
import {fireEvent, render} from '@testing-library/react-native';
import RestTargetEditDialog from '../../../../app/components/Training/execute/RestTargetEditDialog';

jest.mock('react-native-paper', () => {
  const {Text, TextInput, TouchableOpacity, View} = require('react-native');
  return {
    Portal: ({children}: any) => <View>{children}</View>,
    Dialog: Object.assign(
      ({children, visible}: any) => (visible ? <View testID="dialog">{children}</View> : null),
      {
        Title: ({children}: any) => <Text>{children}</Text>,
        Content: ({children}: any) => <View>{children}</View>,
        Actions: ({children}: any) => <View>{children}</View>,
      },
    ),
    Button: ({children, onPress, testID}: any) => (
      <TouchableOpacity testID={testID} onPress={onPress}>
        <Text>{children}</Text>
      </TouchableOpacity>
    ),
    Checkbox: ({status, onPress, testID}: any) => (
      <TouchableOpacity testID={testID} onPress={onPress}>
        <Text>{status}</Text>
      </TouchableOpacity>
    ),
    Text: ({children, style, testID}: any) => <Text testID={testID} style={style}>{children}</Text>,
    TextInput: ({label, onChangeText, value, testID}: any) => (
      <TextInput testID={testID} accessibilityLabel={label} onChangeText={onChangeText} value={value} />
    ),
  };
});

describe('RestTargetEditDialog', () => {
  it('saves the parsed seconds and the saveAsDefault flag when Save is pressed', () => {
    const onSave = jest.fn();
    const onCancel = jest.fn();
    const {getByTestId} = render(
      <RestTargetEditDialog visible={true} initialSeconds={90} onCancel={onCancel} onSave={onSave} />,
    );
    fireEvent.changeText(getByTestId('rest-target-minutes'), '2');
    fireEvent.changeText(getByTestId('rest-target-seconds'), '15');
    fireEvent.press(getByTestId('rest-target-save-default'));
    fireEvent.press(getByTestId('rest-target-save'));
    expect(onSave).toHaveBeenCalledWith(135, true);
  });

  it('cancels without committing changes', () => {
    const onSave = jest.fn();
    const onCancel = jest.fn();
    const {getByTestId} = render(
      <RestTargetEditDialog visible={true} initialSeconds={90} onCancel={onCancel} onSave={onSave} />,
    );
    fireEvent.press(getByTestId('rest-target-cancel'));
    expect(onCancel).toHaveBeenCalled();
    expect(onSave).not.toHaveBeenCalled();
  });

  it('initializes minutes/seconds from the initial value when reopened', () => {
    const onSave = jest.fn();
    const {getByTestId, rerender} = render(
      <RestTargetEditDialog visible={false} initialSeconds={150} onCancel={jest.fn()} onSave={onSave} />,
    );
    rerender(
      <RestTargetEditDialog visible={true} initialSeconds={150} onCancel={jest.fn()} onSave={onSave} />,
    );
    expect(getByTestId('rest-target-minutes').props.value).toBe('2');
    expect(getByTestId('rest-target-seconds').props.value).toBe('30');
  });

  it('exerciseDefault mode hides the checkbox and forces saveAsDefault=true on Save (GH-195 P2)', () => {
    const onSave = jest.fn();
    const {getByTestId, queryByTestId} = render(
      <RestTargetEditDialog
        visible={true}
        initialSeconds={90}
        mode="exerciseDefault"
        onCancel={jest.fn()}
        onSave={onSave}
      />,
    );
    // The opt-in "Save as default" checkbox is replaced by an always-on hint.
    expect(queryByTestId('rest-target-save-default')).toBeNull();
    expect(getByTestId('rest-target-exercise-default-hint')).toBeTruthy();

    fireEvent.changeText(getByTestId('rest-target-minutes'), '2');
    fireEvent.changeText(getByTestId('rest-target-seconds'), '0');
    fireEvent.press(getByTestId('rest-target-save'));
    expect(onSave).toHaveBeenCalledWith(120, true);
  });
});
