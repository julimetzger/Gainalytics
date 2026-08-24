import React, {useEffect, useMemo, useRef, useState} from 'react';
import {PanResponder, ScrollView, StyleSheet, useWindowDimensions, View} from 'react-native';
import {Button, Dialog, HelperText, Portal, Text, TextInput, useTheme} from 'react-native-paper';
import Svg, {Circle, Defs, LinearGradient, Path, RadialGradient, Rect, Stop} from 'react-native-svg';
import {hexFromHsv, hsvFromHex, hsvToRgb, normalizeHex, rgbToHex} from '../../theme/colorScience';
import {buildDynamicSchemes} from '../../theme/dynamicTheme';

/**
 * The wheel's *drawing* coordinate space. The SVG is always authored at this size
 * and scaled to the rendered size via `viewBox`, so wedge geometry and the marker
 * stay in one fixed space no matter how small the screen is.
 */
const WHEEL_SIZE = 240;
const WHEEL_RADIUS = WHEEL_SIZE / 2;
const WHEEL_MIN_RENDER_SIZE = 132;
const WEDGE_COUNT = 72;
const SLIDER_HEIGHT = 28;
/** Dialog.Title + Dialog.Actions + the dialog's own vertical margins. */
const DIALOG_CHROME_HEIGHT = 200;

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

const ThemeColorPickerDialog = ({visible, initialColor, onDismiss, onConfirm}: ThemeColorPickerDialogProps) => {
  const theme = useTheme();
  const {width: windowWidth, height: windowHeight} = useWindowDimensions();
  const [hsv, setHsv] = useState(() => hsvFromHex(initialColor));
  const [hexText, setHexText] = useState(() => normalizeHex(initialColor) ?? '#0061A4');

  // Keep the dialog inside the window even in landscape or on short screens, and
  // shrink the wheel rather than letting it push Apply/Cancel off the display.
  const dialogMaxHeight = Math.max(240, windowHeight - 88);
  const wheelSize = Math.max(WHEEL_MIN_RENDER_SIZE, Math.min(WHEEL_SIZE, windowWidth - 96, windowHeight - DIALOG_CHROME_HEIGHT));

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

  // Touch coordinates arrive in rendered pixels; the wheel geometry lives in the
  // fixed WHEEL_SIZE space, so scale before doing any polar maths.
  const wheelScaleRef = useRef(1);
  wheelScaleRef.current = WHEEL_SIZE / wheelSize;

  const handleWheelTouch = (rawX: number, rawY: number) => {
    const x = rawX * wheelScaleRef.current;
    const y = rawY * wheelScaleRef.current;
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
        onPanResponderGrant: (evt) => handleWheelTouch(evt.nativeEvent.locationX, evt.nativeEvent.locationY),
        onPanResponderMove: (evt) => handleWheelTouch(evt.nativeEvent.locationX, evt.nativeEvent.locationY),
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

  // The wheel and the slider always write a valid hex back into the field, so the
  // field can only go invalid by hand. While it is, `currentHex` still holds the
  // last valid colour — applying it would silently confirm something other than
  // what the field shows, so Apply is blocked until the text parses again.
  const hexIsValid = useMemo(() => normalizeHex(hexText) !== null, [hexText]);

  const marker = polar((hsv.h + 360) % 360, hsv.s * WHEEL_RADIUS);
  const fullValueHue = rgbToHex(hsvToRgb({h: hsv.h, s: hsv.s, v: 1}));

  // Live preview of the generated scheme, so the user sees the *dependent*
  // colours — not just the source colour — before applying.
  const preview = useMemo(() => buildDynamicSchemes(currentHex), [currentHex]);
  const previewScheme = theme.dark ? preview.dark : preview.light;

  return (
    <Portal>
      <Dialog visible={visible} onDismiss={onDismiss} testID="theme-color-picker-dialog" style={{maxHeight: dialogMaxHeight}}>
        <Dialog.Title>Pick a theme colour</Dialog.Title>
        <Dialog.ScrollArea style={styles.scrollArea}>
          <ScrollView testID="theme-color-scroll" contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
            <View style={styles.wheelWrapper}>
              <View testID="theme-color-wheel" style={[styles.wheel, {width: wheelSize, height: wheelSize, borderRadius: wheelSize / 2}]} {...wheelResponder.panHandlers}>
                <Svg width={wheelSize} height={wheelSize} viewBox={`0 0 ${WHEEL_SIZE} ${WHEEL_SIZE}`} pointerEvents="none">
                  <Defs>
                    <RadialGradient id="saturation" cx="50%" cy="50%" r="50%">
                      <Stop offset="0" stopColor="#FFFFFF" stopOpacity="1" />
                      <Stop offset="1" stopColor="#FFFFFF" stopOpacity="0" />
                    </RadialGradient>
                  </Defs>
                  {WEDGES.map((wedge, index) => (
                    <Path key={index} d={wedge.d} fill={wedge.fill} />
                  ))}
                  <Circle cx={WHEEL_RADIUS} cy={WHEEL_RADIUS} r={WHEEL_RADIUS} fill="url(#saturation)" />
                  <Circle cx={WHEEL_RADIUS} cy={WHEEL_RADIUS} r={WHEEL_RADIUS} fill="#000000" opacity={1 - hsv.v} />
                  <Circle cx={marker.x} cy={marker.y} r={10} fill={currentHex} stroke="#FFFFFF" strokeWidth={3} />
                  <Circle cx={marker.x} cy={marker.y} r={12} fill="none" stroke="#000000" strokeWidth={1} />
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
                <Rect x="0" y="0" width="100%" height={SLIDER_HEIGHT} rx={SLIDER_HEIGHT / 2} fill="url(#brightness)" />
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
              error={!hexIsValid}
              testID="theme-color-hex-input"
              style={styles.hexInput}
            />
            {/* Rendered conditionally rather than via HelperText's `visible` prop:
                `visible` only animates opacity, so an invisible helper would still
                show up as a node in the native tree an e2e assertion could match. */}
            {!hexIsValid && (
              <HelperText type="error" visible testID="theme-color-hex-error">
                Not a valid colour — Apply is disabled
              </HelperText>
            )}

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
          </ScrollView>
        </Dialog.ScrollArea>
        <Dialog.Actions>
          <Button onPress={onDismiss} testID="theme-color-cancel-button">
            Cancel
          </Button>
          <Button mode="contained" disabled={!hexIsValid} onPress={() => onConfirm(currentHex)} testID="theme-color-apply-button">
            Apply
          </Button>
        </Dialog.Actions>
      </Dialog>
    </Portal>
  );
};

const styles = StyleSheet.create({
  scrollArea: {
    paddingHorizontal: 0,
  },
  scrollContent: {
    paddingHorizontal: 24,
    paddingBottom: 8,
  },
  wheelWrapper: {
    alignItems: 'center',
  },
  wheel: {
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
