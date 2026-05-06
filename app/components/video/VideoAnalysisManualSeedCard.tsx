import React, {memo, useMemo, useState} from 'react';
import {Image, LayoutChangeEvent, Pressable, StyleSheet, View} from 'react-native';
import {Button, Card, MD3Theme, Text, useTheme} from 'react-native-paper';
import {SeedCandidate} from '../../models/entities/VideoAnalysis';
import {ManualSeedPayload} from '../../utils/videoAnalysisNative';

interface PreviewDimensions {
  width: number;
  height: number;
}

interface Props {
  previewUri?: string;
  previewDimensions: PreviewDimensions;
  busy?: boolean;
  title?: string;
  subtitle?: string;
  actionLabel?: string;
  suggestedBoxes?: SeedCandidate[];
  onRunManualSeedAnalysis: (manualSeed: ManualSeedPayload) => Promise<void> | void;
}

interface PreviewLayout {
  width: number;
  height: number;
}

interface MappedBox extends SeedCandidate {
  left: number;
  top: number;
  widthPx: number;
  heightPx: number;
}

const createThemedStyles = (theme: MD3Theme) =>
  StyleSheet.create({
    previewBackground: {
      backgroundColor: theme.colors.surfaceVariant,
    },
    suggestionBox: {
      borderColor: theme.colors.tertiary,
    },
    suggestionBoxSelected: {
      borderColor: theme.colors.primary,
    },
  });

const VideoAnalysisManualSeedCard = ({
  previewUri,
  previewDimensions,
  busy = false,
  title = 'Seed Selection',
  subtitle = 'Choose the detected plate before starting analysis',
  actionLabel = 'Start Analysis',
  suggestedBoxes = [],
  onRunManualSeedAnalysis,
}: Props) => {
  const theme = useTheme();
  const themedStyles = useMemo(() => createThemedStyles(theme), [theme]);
  const [selectedCandidateId, setSelectedCandidateId] = useState<string | undefined>(undefined);
  const [previewLayout, setPreviewLayout] = useState<PreviewLayout>({width: 0, height: 0});
  const previewAspectRatio = previewDimensions.width > 0 && previewDimensions.height > 0
    ? previewDimensions.width / previewDimensions.height
    : 16 / 9;

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

  const mappedBoxes = useMemo(() => {
    if (!imageMapping) {
      return [];
    }

    return suggestedBoxes.map((box) => {
      const widthPx = imageMapping.renderedWidth * box.normalizedWidth;
      const heightPx = imageMapping.renderedHeight * box.normalizedHeight;
      return {
        ...box,
        left: imageMapping.offsetX + box.normalizedX * imageMapping.renderedWidth - widthPx / 2,
        top: imageMapping.offsetY + box.normalizedY * imageMapping.renderedHeight - heightPx / 2,
        widthPx,
        heightPx,
      } as MappedBox;
    });
  }, [imageMapping, suggestedBoxes]);

  const selectedCandidate = useMemo(() => {
    return suggestedBoxes.find((candidate) => candidate.id === selectedCandidateId);
  }, [selectedCandidateId, suggestedBoxes]);

  const onPreviewLayout = (event: LayoutChangeEvent) => {
    const {width, height} = event.nativeEvent.layout;
    setPreviewLayout({width, height});
  };

  return (
    <Card style={styles.card}>
      <Card.Title title={title} subtitle={subtitle} />
      <Card.Content>
        {!previewUri && <Text>No preview frame available.</Text>}
        {previewUri && (
          <>
            <View
              testID="video-analysis-manual-seed-preview"
              style={[styles.previewContainer, themedStyles.previewBackground, {aspectRatio: previewAspectRatio}]}
              onLayout={onPreviewLayout}
            >
              <Image source={{uri: previewUri}} resizeMode="contain" style={styles.previewImage} />
              {mappedBoxes.map((box) => (
                <Pressable
                  key={box.id}
                  onPress={() => setSelectedCandidateId(box.id)}
                  style={[
                    styles.suggestionBox,
                    themedStyles.suggestionBox,
                    selectedCandidateId === box.id && themedStyles.suggestionBoxSelected,
                    {
                      left: box.left,
                      top: box.top,
                      width: box.widthPx,
                      height: box.heightPx,
                    },
                  ]}
                />
              ))}
            </View>

            {suggestedBoxes.length > 0 && (
              <View style={styles.suggestionList}>
                {suggestedBoxes.map((candidate, index) => (
                  <Button
                    key={candidate.id}
                    testID={`video-analysis-seed-candidate-${index + 1}`}
                    mode={selectedCandidateId === candidate.id ? 'contained' : 'outlined'}
                    onPress={() => setSelectedCandidateId(candidate.id)}
                    style={styles.suggestionButton}
                  >
                    {`Use #${index + 1} (${candidate.score.toFixed(2)})`}
                  </Button>
                ))}
              </View>
            )}

            <Text style={styles.helperText}>
              {selectedCandidate
                ? `Selected: x=${selectedCandidate.normalizedX.toFixed(3)}, y=${selectedCandidate.normalizedY.toFixed(3)}`
                : 'No candidate selected yet.'}
            </Text>

            <Button
              testID="video-analysis-manual-seed-run"
              mode="contained"
              onPress={() =>
                selectedCandidate &&
                onRunManualSeedAnalysis({
                  candidateId: selectedCandidate.id,
                  normalizedX: selectedCandidate.normalizedX,
                  normalizedY: selectedCandidate.normalizedY,
                  normalizedWidth: selectedCandidate.normalizedWidth,
                  normalizedHeight: selectedCandidate.normalizedHeight,
                })
              }
              disabled={!selectedCandidate || busy}
              loading={busy}
            >
              {actionLabel}
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
    borderRadius: 8,
    overflow: 'hidden',
  },
  previewImage: {
    ...StyleSheet.absoluteFillObject,
  },
  suggestionBox: {
    position: 'absolute',
    borderWidth: 2,
  },
  suggestionList: {
    marginTop: 10,
  },
  suggestionButton: {
    marginBottom: 8,
  },
  helperText: {
    marginTop: 10,
    marginBottom: 10,
  },
});

export default memo(VideoAnalysisManualSeedCard);
