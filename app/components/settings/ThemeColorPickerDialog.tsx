import React, {useEffect, useMemo, useRef, useState} from 'react';
import {PanResponder, StyleSheet, View} from 'react-native';
import {Button, Dialog, Portal, Text, TextInput, useTheme} from 'react-native-paper';
import Svg, {Circle, Defs, LinearGradient, Path, RadialGradient, Rect, Stop} from 'react-native-svg';
import {hexFromHsv, hsvFromHex, hsvToRgb, normalizeHex, rgbToHex} from '../../theme/colorScience';
import {buildDynamicSchemes} from '../../theme/dynamicTheme';

const WHEEL_SIZE = 240;
const WHEEL_RADIUS = WHEEL_SIZE / 2;
const WEDGE_COUNT = 72;
const SLIDER_HEIGHT = 28;

export interface ThemeColorPickerDialogProps {
  visible: boolean;
  /** Colour the wheel starts on — the currently applied custom colour, or the current primary. */
  initialColor: string;
  onDismiss: () => void;
  onConfirm: (hex: string) => void;
}

function polar(angleDegrees: number, radius: number): {x: number; y: number} {
  const radians = (angleDegrees * Math.PI) / 180;
  return {
    x: WHEEL_RADIUS + radius * Math.cos(radians),
    y: WHEEL_RADIUS + radius * Math.sin(radians),
  };
}

/**
 * Hue wheel drawn as `WEDGE_COUNT` pie slices at full saturation/value.
 * Saturation comes from the white radial gradient painted on top, value from
 * the black overlay — together that is exactly the HSV cylinder.
 */
function buildWedges(): Array<{d: string; fill: string}> {
  const step = 360 / WEDGE_COUNT;
  const wedges: Array<{d: string; fill: string}> = [];
  for (let i = 0; i < WEDGE_COUNT; i++) {
    const start = i * step;
    // Overlap the next wedge slightly so no background seam shows through.
    const end = start + step + 0.6;
    const from = polar(start, WHEEL_RADIUS);
    const to = polar(end, WHEEL_RADIUS);
    wedges.push({
      d: `M ${WHEEL_RADIUS} ${WHEEL_RADIUS} L ${from.x} ${from.y} A ${WHEEL_RADIUS} ${WHEEL_RADIUS} 0 0 1 ${to.x} ${to.y} Z`,
      fill: rgbToHex(hsvToRgb({h: start + step / 2, s: 1, v: 1})),
    });
  }
  return wedges;
}

const WEDGES = buildWedges();

const ThemeColorPickerDialog = ({
  visible,
  initialColor,
  onDismiss,
  onConfirm,
}: ThemeColorPickerDialogProps) => {
  const theme = useTheme();
  const [hsv, setHsv] = useState(() => hsvFromHex(initialColor));
  const [hexText, setHexText] = useState(() => normalizeHex(initialColor) ?? '#0061A4');

  // Reset to the currently applied colour every time the dialog is opened.
  useEffect(() => {
    if (visible) {
      setHsv(hsvFromHex(initialColor));
      setHexText(normalizeHex(initialColor) ?? '#0061A4');
    }
  }, [visible, initialColor]);

  const currentHex = useMemo(() => hexFromHsv(hsv), [hsv]);

  const applyHsv = (next: {h: number; s: number; v: number}) => {
    setHsv(next);
    setHexText(hexFromHsv(next));
  };

  const hsvRef = useRef(hsv);
  hsvRef.current = hsv;

  const handleWheelTouch = (x: number, y: number) => {
    const dx = x - WHEEL_RADIUS;
    const dy = y - WHEEL_RADIUS;
    const distance = Math.sqrt(dx * dx + dy * dy);
    let angle = (Math.atan2(dy, dx) * 180) / Math.PI;
    if (angle < 0) angle += 360;
    applyHsv({
      h: angle,
      s: Math.min(1, distance / WHEEL_RADIUS),
      v: hsvRef.current.v,
    });
  };

  const wheelResponder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onMoveShouldSetPanResponder: () => true,
        onPanResponderGrant: (evt) =>
          handleWheelTouch(evt.nativeEvent.locationX, evt.nativeEvent.locationY),
        onPanResponderMove: (evt) =>
          handleWheelTouch(evt.nativeEvent.locationX, evt.nativeEvent.locationY),
      }),
    [],
  );

  const sliderWidthRef = useRef(1);
  const handleSliderTouch = (x: number) => {
    const width = sliderWidthRef.current || 1;
    applyHsv({
      ...hsvRef.current,
      v: Math.max(0, Math.min(1, x / width)),
    });
  };

  const sliderResponder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onMoveShouldSetPanResponder: () => true,
        onPanResponderGrant: (evt) => handleSliderTouch(evt.nativeEvent.locationX),
        onPanResponderMove: (evt) => handleSliderTouch(evt.nativeEvent.locationX),
      }),
    [],
  );

  const onHexTextChange = (text: string) => {
    setHexText(text);
    const normalized = normalizeHex(text);
    if (normalized) {
      setHsv(hsvFromHex(normalized));
    }
  };

  const marker = polar((hsv.h + 360) % 360, hsv.s * WHEEL_RADIUS);
  const fullValueHue = rgbToHex(hsvToRgb({h: hsv.h, s: hsv.s, v: 1}));

  // Live preview of the generated scheme, so the user sees the *dependent*
  // colours — not just the source colour — before applying.
  const preview = useMemo(() => buildDynamicSchemes(currentHex), [currentHex]);
  const previewScheme = theme.dark ? preview.dark : preview.light;

  return (
    <Portal>
      <Dialog visible={visible} onDismiss={onDismiss} testID="theme-color-picker-dialog">
        <Dialog.Title>Pick a theme colour</Dialog.Title>
        <Dialog.Content>
          <View style={styles.wheelWrapper}>
            <View
              testID="theme-color-wheel"
              style={styles.wheel}
              {...wheelResponder.panHandlers}
            >
              <Svg width={WHEEL_SIZE} height={WHEEL_SIZE} pointerEvents="none">
                <Defs>
                  <RadialGradient id="saturation" cx="50%" cy="50%" r="50%">
                    <Stop offset="0" stopColor="#FFFFFF" stopOpacity="1" />
                    <Stop offset="1" stopColor="#FFFFFF" stopOpacity="0" />
                  </RadialGradient>
                </Defs>
                {WEDGES.map((wedge, index) => (
                  <Path key={index} d={wedge.d} fill={wedge.fill} />
                ))}
                <Circle
                  cx={WHEEL_RADIUS}
                  cy={WHEEL_RADIUS}
                  r={WHEEL_RADIUS}
                  fill="url(#saturation)"
                />
                <Circle
                  cx={WHEEL_RADIUS}
                  cy={WHEEL_RADIUS}
                  r={WHEEL_RADIUS}
                  fill="#000000"
                  opacity={1 - hsv.v}
                />
                <Circle
                  cx={marker.x}
                  cy={marker.y}
                  r={10}
                  fill={currentHex}
                  stroke="#FFFFFF"
                  strokeWidth={3}
                />
                <Circle
                  cx={marker.x}
                  cy={marker.y}
                  r={12}
                  fill="none"
                  stroke="#000000"
                  strokeWidth={1}
                />
              </Svg>
            </View>
          </View>

          <Text variant="labelMedium" style={styles.sectionLabel}>
            Brightness
          </Text>
          <View
            testID="theme-color-brightness-slider"
            style={styles.slider}
            onLayout={(e) => {
              sliderWidthRef.current = e.nativeEvent.layout.width;
            }}
            {...sliderResponder.panHandlers}
          >
            <Svg width="100%" height={SLIDER_HEIGHT} pointerEvents="none">
              <Defs>
                <LinearGradient id="brightness" x1="0" y1="0" x2="1" y2="0">
                  <Stop offset="0" stopColor="#000000" />
                  <Stop offset="1" stopColor={fullValueHue} />
                </LinearGradient>
              </Defs>
              <Rect
                x="0"
                y="0"
                width="100%"
                height={SLIDER_HEIGHT}
                rx={SLIDER_HEIGHT / 2}
                fill="url(#brightness)"
              />
            </Svg>
            <View
              pointerEvents="none"
              style={[
                styles.sliderThumb,
                {
                  left: `${hsv.v * 100}%`,
                  backgroundColor: currentHex,
                  borderColor: theme.colors.onSurface,
                },
              ]}
            />
          </View>

          <TextInput
            mode="outlined"
            label="Hex"
            dense
            value={hexText}
            onChangeText={onHexTextChange}
            autoCapitalize="characters"
            autoCorrect={false}
            testID="theme-color-hex-input"
            style={styles.hexInput}
          />

          <View style={styles.previewRow}>
            <View style={[styles.previewSwatch, {backgroundColor: currentHex}]} />
            <Text testID="theme-color-preview-hex" variant="titleMedium">
              {currentHex}
            </Text>
          </View>

          <Text variant="labelMedium" style={styles.sectionLabel}>
            Preview
          </Text>
          <View style={[styles.previewCard, {backgroundColor: previewScheme.surface}]}>
            <View style={[styles.previewChip, {backgroundColor: previewScheme.primary}]}>
              <Text style={{color: previewScheme.onPrimary}}>Primary</Text>
            </View>
            <View style={[styles.previewChip, {backgroundColor: previewScheme.primaryContainer}]}>
              <Text style={{color: previewScheme.onPrimaryContainer}}>Container</Text>
            </View>
            <View
              style={[
                styles.previewChip,
                {
                  backgroundColor: previewScheme.surfaceVariant,
                  borderColor: previewScheme.outline,
                  borderWidth: 1,
                },
              ]}
            >
              <Text style={{color: previewScheme.onSurfaceVariant}}>Surface</Text>
            </View>
          </View>
        </Dialog.Content>
        <Dialog.Actions>
          <Button onPress={onDismiss} testID="theme-color-cancel-button">
            Cancel
          </Button>
          <Button
            mode="contained"
            onPress={() => onConfirm(currentHex)}
            testID="theme-color-apply-button"
          >
            Apply
          </Button>
        </Dialog.Actions>
      </Dialog>
    </Portal>
  );
};

const styles = StyleSheet.create({
  wheelWrapper: {
    alignItems: 'center',
  },
  wheel: {
    width: WHEEL_SIZE,
    height: WHEEL_SIZE,
    borderRadius: WHEEL_RADIUS,
    overflow: 'hidden',
  },
  sectionLabel: {
    marginTop: 16,
    marginBottom: 6,
  },
  slider: {
    height: SLIDER_HEIGHT,
    justifyContent: 'center',
  },
  sliderThumb: {
    position: 'absolute',
    width: 20,
    height: 20,
    marginLeft: -10,
    borderRadius: 10,
    borderWidth: 2,
  },
  hexInput: {
    marginTop: 14,
  },
  previewRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 14,
  },
  previewSwatch: {
    width: 28,
    height: 28,
    borderRadius: 14,
    marginRight: 10,
  },
  previewCard: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    padding: 10,
    borderRadius: 12,
  },
  previewChip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
  },
});

export default ThemeColorPickerDialog;
