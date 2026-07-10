/**
 * GH-321: the "link a video to a set" modal must import through the persistable-URI
 * picker (ACTION_OPEN_DOCUMENT), not the old ACTION_GET_CONTENT document picker whose
 * grant dies with the process.
 */
import React from 'react';
import {fireEvent, render, waitFor} from '@testing-library/react-native';
import {Provider} from 'react-redux';
import {configureStore} from '@reduxjs/toolkit';
import {PaperProvider} from 'react-native-paper';
import rootReducer from '../../../app/redux/rootReducer';
import VideoSelectionModal from '../../../app/components/video/VideoSelectionModal';

jest.mock('../../../app/utils/videoAnalysisNative', () => ({
  pickVideoFromGallery: jest.fn(),
}));

jest.mock('../../../app/utils/video-analysis-import', () => ({
  importVideoAnalysisFromSource: jest.fn().mockResolvedValue('analysis_started'),
}));

// The old picker must not be reachable from this screen anymore.
jest.mock('react-native-document-picker', () => ({
  __esModule: true,
  default: {
    pickSingle: jest.fn(() => {
      throw new Error('react-native-document-picker must not be used for video import (GH-321)');
    }),
    types: {video: 'video'},
    isCancel: () => false,
  },
}));

const {pickVideoFromGallery} = jest.requireMock('../../../app/utils/videoAnalysisNative') as {
  pickVideoFromGallery: jest.Mock;
};
const {importVideoAnalysisFromSource} = jest.requireMock('../../../app/utils/video-analysis-import') as {
  importVideoAnalysisFromSource: jest.Mock;
};

const renderModal = () => {
  const store = configureStore({reducer: rootReducer});
  return render(
    <Provider store={store}>
      <PaperProvider>
        <VideoSelectionModal visible workoutId={1} exerciseId={2} setIndex={0} onDismiss={jest.fn()} />
      </PaperProvider>
    </Provider>,
  );
};

describe('VideoSelectionModal – gallery import (GH-321)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('imports the picked gallery URI directly, without copying it into the app', async () => {
    pickVideoFromGallery.mockResolvedValue({uri: 'content://media/99', persisted: true});

    const {getByTestId} = renderModal();
    fireEvent.press(getByTestId('video-selection-import-gallery'));

    await waitFor(() => expect(importVideoAnalysisFromSource).toHaveBeenCalled());
    expect(importVideoAnalysisFromSource.mock.calls[0][0].sourceUri).toBe('content://media/99');
  });

  it('does nothing when the user cancels the picker', async () => {
    pickVideoFromGallery.mockResolvedValue(null);

    const {getByTestId} = renderModal();
    fireEvent.press(getByTestId('video-selection-import-gallery'));

    await waitFor(() => expect(pickVideoFromGallery).toHaveBeenCalled());
    expect(importVideoAnalysisFromSource).not.toHaveBeenCalled();
  });
});
