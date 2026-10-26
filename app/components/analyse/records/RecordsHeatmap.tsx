import React from 'react';
import {Platform, Pressable, StyleSheet, useWindowDimensions, View} from 'react-native';
import {Text, useTheme} from 'react-native-paper';
import {HeatCell, HeatmapModel} from '../../../utils/RecordsAnalysis';
import {rgba, tileAlpha, tileTextColor} from './heatmapColors';

const mono = Platform.select({ios: 'Menlo', android: 'monospace', default: 'monospace'});

const TILE_GAP = 6;
const ROW_LABEL_WIDTH = 44;
// Screen margin (8 each side) + card padding (14 each side).
const HORIZONTAL_CHROME = 2 * 8 + 2 * 14;

interface Props {
  model: HeatmapModel;
  /** Key of the tile whose records the list shows (GH-617). */
  selectedKey?: string;
  onSelect: (cell: HeatCell) => void;
}

const RecordsHeatmap = ({model, selectedKey, onSelect}: Props) => {
  const theme = useTheme();
  const {width} = useWindowDimensions();
  const surface = (theme.colors as unknown as {surfaceContainer?: string}).surfaceContainer ?? theme.colors.surface;

  const hasRowLabels = model.rows.some((row) => row.label !== '');
  const maxColumns = Math.max(1, ...model.rows.map((row) => row.cells.length));
  const available = width - HORIZONTAL_CHROME - (hasRowLabels ? ROW_LABEL_WIDTH : 0);
  const gap = model.unit === 'day' ? 4 : TILE_GAP;
  const rawSize = (available - (maxColumns - 1) * gap) / maxColumns;
  const maxTile = model.unit === 'day' ? 22 : 44;
  const tileSize = Math.max(10, Math.min(maxTile, rawSize));
  const countFontSize = Math.max(8, Math.min(13, tileSize * 0.42));

  if (model.rows.length === 0) {
    return (
      <Text style={[styles.emptyHint, {color: theme.colors.onSurfaceVariant}]} testID="records-heatmap-empty">
        No data for this accumulation mode.
      </Text>
    );
  }

  const renderCell = (cell: HeatCell) => {
    const alpha = tileAlpha(cell.count, model.maxCount);
    const isBest = model.bestKey !== undefined && cell.key === model.bestKey;
    const filled = cell.count > 0;
    const selected = cell.key === selectedKey;
    return (
      <View key={cell.key} style={{alignItems: 'center'}}>
        {/* Empty tiles are disabled: there are no records to filter to. */}
        <Pressable
          testID={`records-tile-${cell.key}`}
          disabled={!filled}
          onPress={() => onSelect(cell)}
          accessibilityRole="button"
          accessibilityLabel={`${cell.title}: ${cell.count} record${cell.count === 1 ? '' : 's'}`}
          accessibilityState={{selected, disabled: !filled}}
          style={[
            styles.tile,
            {
              width: tileSize,
              height: tileSize,
              backgroundColor: filled ? rgba(theme.colors.primary, alpha) : 'transparent',
            },
            !filled && {borderWidth: 1, borderStyle: 'dashed', borderColor: theme.colors.outline},
            isBest && {borderWidth: 2, borderStyle: 'solid', borderColor: theme.colors.onSurface},
            selected && [styles.selectedTile, {borderColor: theme.colors.tertiary}],
            selectedKey !== undefined && !selected && styles.dimmed,
          ]}
        >
          {filled && tileSize >= 12 ? (
            <Text style={{fontFamily: mono, fontWeight: '700', fontSize: countFontSize, color: tileTextColor(theme.colors.primary, surface, alpha, theme.colors.onSurface)}}>{cell.count}</Text>
          ) : null}
        </Pressable>
        {cell.sublabel ? <Text style={[styles.sublabel, {color: theme.colors.onSurfaceVariant}]}>{cell.sublabel}</Text> : null}
      </View>
    );
  };

  return (
    <View testID="records-heatmap">
      {model.rows.map((row, rowIndex) => (
        <View key={`${row.label}-${rowIndex}`} style={[styles.row, {marginBottom: model.unit === 'day' ? 4 : 10}]}>
          {hasRowLabels ? (
            <Text numberOfLines={1} style={[styles.rowLabel, {color: theme.colors.onSurfaceVariant}]}>
              {row.label}
            </Text>
          ) : null}
          <View style={[styles.cells, {gap}]}>{row.cells.map(renderCell)}</View>
        </View>
      ))}
      <View style={styles.legend}>
        <Text style={[styles.legendText, {color: theme.colors.onSurfaceVariant}]}>Less</Text>
        {[0.25, 0.5, 0.75, 1].map((alpha) => (
          <View key={alpha} style={[styles.legendSwatch, {backgroundColor: rgba(theme.colors.primary, alpha)}]} />
        ))}
        <Text style={[styles.legendText, {color: theme.colors.onSurfaceVariant}]}>More</Text>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  rowLabel: {
    width: ROW_LABEL_WIDTH,
    fontSize: 12,
  },
  cells: {
    flex: 1,
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'flex-start',
  },
  tile: {
    borderRadius: 6,
    alignItems: 'center',
    justifyContent: 'center',
  },
  selectedTile: {
    borderWidth: 3,
    borderStyle: 'solid',
  },
  dimmed: {
    opacity: 0.45,
  },
  sublabel: {
    fontSize: 10,
    marginTop: 3,
  },
  legend: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 8,
  },
  legendText: {
    fontSize: 11,
    marginHorizontal: 2,
  },
  legendSwatch: {
    width: 12,
    height: 12,
    borderRadius: 3,
  },
  emptyHint: {
    fontStyle: 'italic',
    paddingVertical: 8,
  },
});

export default RecordsHeatmap;
