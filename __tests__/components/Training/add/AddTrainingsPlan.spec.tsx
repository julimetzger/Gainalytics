import React from 'react';
import {Keyboard} from 'react-native';
import {fireEvent, render} from '@testing-library/react-native';
import AddTrainingsPlan from '../../../../app/components/Training/add/AddTrainingsPlan';

const mockAddTrainingsPlan = jest.fn();

jest.mock('react-redux', () => ({
  ...jest.requireActual('react-redux'),
  useStore: () => ({getState: () => ({settings: {}})}),
  useDispatch: () => jest.fn(),
  useSelector: () => undefined,
}));

jest.mock('../../../../app/redux/Training/dispatch/general/dispatchAddTrainingsPlan', () => ({
  dispatchAddTrainingsPlan: () => mockAddTrainingsPlan,
}));
jest.mock('../../../../app/redux/Training/dispatch/general/dispatchEditTrainingsPlan', () => ({
  dispatchEditTrainingsPlan: () => jest.fn(),
}));
jest.mock('../../../../app/redux/Training/dispatch/general/dispatchDeleteTrainingsPlan', () => ({
  dispatchDeleteTrainingsPlan: () => jest.fn(),
}));
jest.mock('../../../../app/redux/Training/use/useTrainingsPlan', () => ({
  useTrainingsPlan: () => undefined,
}));
jest.mock('../../../../app/redux/fullstateactions/dispatchImportTrainingsPlan', () => ({
  useDispatchImportTrainingsPlan: () => jest.fn(),
}));
jest.mock('../../../../app/utils/exportTrainingsPlan', () => ({
  exportTrainingsPlanToFile: jest.fn(),
}));
jest.mock('react-native-toast-message', () => ({show: jest.fn(), default: {show: jest.fn()}}));

// The scaffold is a Portal/Modal — replaced by a flat stand-in that exposes the
// primary action under its testID, which is all this spec interacts with.
jest.mock('../../../../app/components/common/EditDialogScaffold', () => {
  const React = require('react');
  const {Text, TouchableOpacity, View} = require('react-native');
  return {
    __esModule: true,
    default: ({visible, children, primaryAction}: any) =>
      visible ? (
        <View>
          {children}
          <TouchableOpacity testID={primaryAction.testID} onPress={primaryAction.onPress}>
            <Text>{primaryAction.label}</Text>
          </TouchableOpacity>
        </View>
      ) : null,
  };
});

jest.mock('react-native-paper', () => {
  const React = require('react');
  const {Text, TextInput, TouchableOpacity} = require('react-native');
  return {
    IconButton: ({onPress, testID}: any) => (
      <TouchableOpacity testID={testID} onPress={onPress}>
        <Text>icon</Text>
      </TouchableOpacity>
    ),
    TextInput: ({value, onChangeText, testID}: any) => <TextInput value={value} onChangeText={onChangeText} testID={testID} />,
    useTheme: () => ({colors: {tertiary: '#abc'}}),
  };
});

describe('AddTrainingsPlan — saving a new plan (GH-436 usability walk)', () => {
  beforeEach(() => jest.clearAllMocks());

  it('closes the keyboard together with the dialog so the plan list is visible again', () => {
    const dismiss = jest.spyOn(Keyboard, 'dismiss').mockImplementation(() => undefined);
    const {getByTestId, queryByTestId} = render(<AddTrainingsPlan />);

    fireEvent.press(getByTestId('add-trainings-plan'));
    fireEvent.changeText(getByTestId('plan-name-input'), 'UX436');
    fireEvent.press(getByTestId('confirm-trainings-plan'));

    expect(dismiss).toHaveBeenCalledTimes(1);
    expect(mockAddTrainingsPlan).toHaveBeenCalledWith({name: 'UX436'});
    expect(queryByTestId('plan-name-input')).toBeNull();
    dismiss.mockRestore();
  });
});
