import React, {memo, useMemo, useState} from 'react';
import {GestureResponderEvent, Image, LayoutChangeEvent, Pressable, StyleSheet, View} from 'react-native';
import {Button, Card, MD3Theme, Text, useTheme} from 'react-native-paper';
import {ManualSeedPayload} from '../../utils/videoAnalysisNative';

interface PreviewDimensions {
  width: number;
  height: number;
}

interface Props {
  previewUri?: string;
  previewDimensions: PreviewDimensions;
  busy?: boolean;
  onRunManualSeedAnalysis: (manualSeed: ManualSeedPayload) => Promise<void> | void;
}

interface PreviewLayout {
  width: number;
  height: number;
}

const MARKER_SIZE = 14;

const createThemedStyles = (theme: MD3Theme) =>
  StyleSheet.create({
    previewBackground: {
      backgroundColor: theme.colors.surfaceVariant,
    },
    marker: {
      backgroundColor: theme.colors.error,
      borderColor: theme.colors.onError,
    },
  });

const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));

const VideoAnalysisManualSeedCard = ({previewUri, previewDimensions, busy = false, onRunManualSeedAnalysis}: Props) => {
  const theme = useTheme();
  const themedStyles = useMemo(() => createThemedStyles(theme), [theme]);
  const [selectedSeed, setSelectedSeed] = useState<ManualSeedPayload | undefined>(undefined);
  const [previewLayout, setPreviewLayout] = useState<PreviewLayout>({width: 0, height: 0});

  const imageMapping = useMemo(() => {
    const containerWidth = previewLayout.width;
    const containerHeight = previewLayout.height;
    if (containerWidth <= 0 || containerHeight <= 0 || previewDimensions.width <= 0 || previewDimensions.height <= 0) {
      return undefined;
    }

    const scale = Math.min(containerWidth / previewDimensions.width, containerHeight / previewDimensions.height);
    const renderedWidth = previewDimensions.width * scale;
    const renderedHeight = previewDimensions.height * scale;
    return {
      renderedWidth,
      renderedHeight,
      offsetX: (containerWidth - renderedWidth) / 2,
      offsetY: (containerHeight - renderedHeight) / 2,
    };
  }, [previewDimensions.height, previewDimensions.width, previewLayout.height, previewLayout.width]);

  const onPreviewLayout = (event: LayoutChangeEvent) => {
    const {width, height} = event.nativeEvent.layout;
    setPreviewLayout({width, height});
  };

  const onPreviewPress = (event: GestureResponderEvent) => {
    if (!imageMapping) {
      return;
    }

    const {locationX, locationY} = event.nativeEvent;
    const normalizedX = clamp((locationX - imageMapping.offsetX) / imageMapping.renderedWidth, 0, 1);
    const normalizedY = clamp((locationY - imageMapping.offsetY) / imageMapping.renderedHeight, 0, 1);
    setSelectedSeed({
      normalizedX,
      normalizedY,
    });
  };

  const markerPosition = useMemo(() => {
    if (!selectedSeed || !imageMapping) {
      return undefined;
    }
    return {
      left: imageMapping.offsetX + selectedSeed.normalizedX * imageMapping.renderedWidth,
      top: imageMapping.offsetY + selectedSeed.normalizedY * imageMapping.renderedHeight,
    };
  }, [imageMapping, selectedSeed]);

  return (
    <Card style={styles.card}>
      <Card.Title title="Manual Seed" subtitle="Tap the plate center and rerun analysis" />
      <Card.Content>
        {!previewUri && <Text>No preview frame available for manual seed.</Text>}
        {previewUri && (
          <>
            <Pressable
              testID="video-analysis-manual-seed-preview"
              onPress={onPreviewPress}
              style={[styles.previewContainer, themedStyles.previewBackground]}
              onLayout={onPreviewLayout}
            >
              <Image source={{uri: previewUri}} resizeMode="contain" style={styles.previewImage} />
              {markerPosition && (
                <View
                  testID="video-analysis-manual-seed-marker"
                  style={[
                    styles.marker,
                    themedStyles.marker,
                    {
                      left: markerPosition.left - MARKER_SIZE / 2,
                      top: markerPosition.top - MARKER_SIZE / 2,
                    },
                  ]}
                />
              )}
            </Pressable>
            <Text style={styles.helperText}>
              {selectedSeed
                ? `Seed: x=${selectedSeed.normalizedX.toFixed(3)}, y=${selectedSeed.normalizedY.toFixed(3)}`
                : 'No seed selected yet.'}
            </Text>
            <Button
              testID="video-analysis-manual-seed-run"
              mode="contained"
              onPress={() => selectedSeed && onRunManualSeedAnalysis(selectedSeed)}
              disabled={!selectedSeed || busy}
              loading={busy}
            >
              Run Manual Seed Analysis
            </Button>
          </>
        )}
      </Card.Content>
    </Card>
  );
};

const styles = StyleSheet.create({
  card: {
    margin: 10,
  },
  previewContainer: {
    width: '100%',
    aspectRatio: 16 / 9,
    borderRadius: 8,
    overflow: 'hidden',
  },
  previewImage: {
    ...StyleSheet.absoluteFillObject,
  },
  marker: {
    width: MARKER_SIZE,
    height: MARKER_SIZE,
    position: 'absolute',
    borderRadius: MARKER_SIZE / 2,
    borderWidth: 2,
  },
  helperText: {
    marginTop: 10,
    marginBottom: 10,
  },
});

export default memo(VideoAnalysisManualSeedCard);
