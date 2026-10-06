/**
 * GH-462: the custom colour row moved out of SettingsTab into its own section.
 * These cases used to live in SettingsTab.spec against a stubbed Paper; here
 * they run against the real components.
 */
import React from 'react';
import {MD3LightTheme, Provider as PaperProvider} from 'react-native-paper';
import {fireEvent, render, screen} from '@testing-library/react-native';
import CustomThemeColorRow from '../../../app/components/settings/CustomThemeColorRow';
import {useSettings} from '../../../app/redux/settings/use/useSettings';
import {dispatchSetPalette} from '../../../app/redux/settings/dispatch/dispatchSetPalette';

const mockSetPalette = jest.fn();

jest.mock('../../../app/redux/settings/use/useSettings', () => ({
  useSettings: jest.fn(),
}));

jest.mock('../../../app/redux/settings/dispatch/dispatchSetPalette', () => ({
  dispatchSetPalette: jest.fn(() => mockSetPalette),
}));

const mockedUseSettings = jest.mocked(useSettings);

const renderRow = () =>
  render(
    <PaperProvider theme={MD3LightTheme}>
      <CustomThemeColorRow />
    </PaperProvider>,
  );

describe('CustomThemeColorRow', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.mocked(dispatchSetPalette).mockReturnValue(mockSetPalette);
    mockedUseSettings.mockReturnValue({palette: 'blue'});
  });

  it('labels the button with the current preset', () => {
    renderRow();

    expect(screen.getByTestId('settings-custom-theme-color-button-text')).toHaveTextContent('Blue');
    expect(screen.getByLabelText('Theme colour Blue')).toBeTruthy();
  });

  it('labels the button with the applied hex', () => {
    mockedUseSettings.mockReturnValue({palette: '#e91e63'});
    renderRow();

    expect(screen.getByTestId('settings-custom-theme-color-button-text')).toHaveTextContent('#E91E63');
  });

  it('applies a custom colour picked from the wheel dialog', () => {
    renderRow();

    expect(screen.queryByTestId('theme-color-hex-input')).toBeNull();
    fireEvent.press(screen.getByTestId('settings-custom-theme-color-button'));

    fireEvent.changeText(screen.getByTestId('theme-color-hex-input'), '#E91E63');
    fireEvent.press(screen.getByTestId('theme-color-apply-button'));

    expect(mockSetPalette).toHaveBeenCalledWith('#E91E63');
  });

  it('does not apply a palette when the hex field holds an invalid value', () => {
    renderRow();
    fireEvent.press(screen.getByTestId('settings-custom-theme-color-button'));

    fireEvent.changeText(screen.getByTestId('theme-color-hex-input'), '#00FF');
    fireEvent.press(screen.getByTestId('theme-color-apply-button'));

    expect(mockSetPalette).not.toHaveBeenCalled();
  });
});
