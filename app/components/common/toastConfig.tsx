import React from 'react';
import {StyleSheet} from 'react-native';
import {InfoToast, ToastConfig, ToastConfigParams} from 'react-native-toast-message';

/** GH-544: an info toast whose message may span several lines (the AI's explanation). */
export const MULTILINE_INFO_TOAST = 'multilineInfo';

/** Props passed via `Toast.show({props})`; the Toast host sits outside the PaperProvider. */
export interface MultilineInfoToastProps {
  /** The accent (left border) colour, from the caller's `theme.colors`. */
  accentColor?: string;
}

const MultilineInfoToast = (params: ToastConfigParams<MultilineInfoToastProps>) => (
  <InfoToast {...params} style={[styles.toast, params.props?.accentColor ? {borderLeftColor: params.props.accentColor} : null]} text2NumberOfLines={8} />
);

export const toastConfig: ToastConfig = {
  [MULTILINE_INFO_TOAST]: MultilineInfoToast,
};

const styles = StyleSheet.create({
  toast: {
    // The default toast has a fixed height of 60; let the text decide.
    height: undefined,
    minHeight: 60,
    paddingVertical: 8,
  },
});
