import React from 'react';
import {StyleSheet} from 'react-native';
import {InfoToast, ToastConfig, ToastConfigParams} from 'react-native-toast-message';

/** GH-544: an info toast whose message may span several lines (the AI's explanation). */
export const MULTILINE_INFO_TOAST = 'multilineInfo';

const MultilineInfoToast = (props: ToastConfigParams<unknown>) => (
  <InfoToast {...props} style={styles.toast} text2NumberOfLines={8} />
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
    borderLeftColor: '#87CEFA',
  },
});
