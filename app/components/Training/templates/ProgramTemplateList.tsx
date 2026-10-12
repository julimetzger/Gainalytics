import React, {memo} from 'react';
import {StyleSheet, View} from 'react-native';
import {RadioButton, Text, TouchableRipple, useTheme} from 'react-native-paper';
import {ProgramTemplate} from '../../../models/ProgramTemplate';
import {PROGRAM_TEMPLATES} from '../../../constants/programTemplates';
import {formatTemplateStructure} from '../../../utils/program-templates';

interface ProgramTemplateListProps {
  selectedId?: string;
  onSelect: (template: ProgramTemplate) => void;
  /** Show the long description under each template (onboarding) or only the summary (dialog). */
  showDescription?: boolean;
}

/** GH-497: radio list of the built-in program templates. */
const ProgramTemplateList = ({selectedId, onSelect, showDescription}: ProgramTemplateListProps) => {
  const theme = useTheme();

  return (
    <View style={styles.list} accessibilityRole="radiogroup">
      {PROGRAM_TEMPLATES.map((template) => {
        const selected = template.id === selectedId;
        return (
          <TouchableRipple
            key={template.id}
            onPress={() => onSelect(template)}
            testID={`program-template-${template.id}`}
            accessibilityRole="radio"
            accessibilityState={{checked: selected}}
            accessibilityLabel={`${template.name}, ${template.summary}`}
            borderless
            style={[
              styles.row,
              {
                borderColor: selected ? theme.colors.primary : theme.colors.outlineVariant,
                backgroundColor: selected ? theme.colors.secondaryContainer : 'transparent',
                borderRadius: theme.roundness * 3,
              },
            ]}
          >
            <View style={styles.rowContent}>
              <RadioButton.Android value={template.id} status={selected ? 'checked' : 'unchecked'} onPress={() => onSelect(template)} />
              <View style={styles.texts}>
                <Text variant="titleMedium">{template.name}</Text>
                <Text variant="bodySmall" style={{color: theme.colors.onSurfaceVariant}}>
                  {template.summary}
                </Text>
                <Text variant="labelSmall" style={[styles.structure, {color: theme.colors.primary}]} testID={`program-template-structure-${template.id}`}>
                  {formatTemplateStructure(template)}
                </Text>
                {showDescription && selected && (
                  <Text variant="bodySmall" style={styles.description}>
                    {template.description}
                  </Text>
                )}
              </View>
            </View>
          </TouchableRipple>
        );
      })}
    </View>
  );
};

const styles = StyleSheet.create({
  list: {gap: 8},
  row: {borderWidth: 1},
  rowContent: {flexDirection: 'row', alignItems: 'flex-start', paddingVertical: 8, paddingRight: 12, paddingLeft: 4},
  texts: {flex: 1, paddingTop: 6},
  structure: {marginTop: 4},
  description: {marginTop: 6},
});

export default memo(ProgramTemplateList);
