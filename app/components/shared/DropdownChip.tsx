import React, {useState} from 'react';
import {StyleSheet, View} from 'react-native';
import {Icon, Menu, Text, TouchableRipple, useTheme} from 'react-native-paper';

export interface DropdownChipOption<T extends string> {
  value: T;
  label: string;
  disabled?: boolean;
}

interface DropdownChipProps<T extends string> {
  value: T;
  options: DropdownChipOption<T>[];
  onChange: (value: T) => void;
  testID?: string;
}

const DropdownChip = <T extends string>({value, options, onChange, testID}: DropdownChipProps<T>) => {
  const theme = useTheme();
  const [open, setOpen] = useState(false);
  const selected = options.find((o) => o.value === value) ?? options[0];

  const background = open ? theme.colors.secondaryContainer : (theme.colors as unknown as {surfaceContainerHigh?: string}).surfaceContainerHigh ?? theme.colors.surfaceVariant;
  const onBackground = open ? theme.colors.onSecondaryContainer : theme.colors.onSurface;

  return (
    <Menu
      visible={open}
      onDismiss={() => setOpen(false)}
      anchor={
        <TouchableRipple
          testID={testID}
          accessibilityRole="button"
          accessibilityLabel={`${selected?.label ?? ''} dropdown`}
          onPress={() => setOpen(true)}
          style={[styles.chip, {backgroundColor: background}]}
        >
          <View style={styles.chipInner}>
            <Text style={[styles.label, {color: onBackground}]}>{selected?.label ?? ''}</Text>
            <View style={styles.chevron}>
              <Icon source="chevron-down" size={14} color={onBackground} />
            </View>
          </View>
        </TouchableRipple>
      }
    >
      {options.map((option) => {
        const isSelected = option.value === value;
        return (
          <Menu.Item
            key={option.value}
            testID={testID ? `${testID}-option-${option.value}` : undefined}
            title={option.label}
            leadingIcon={isSelected ? 'check' : undefined}
            disabled={option.disabled}
            onPress={() => {
              if (option.disabled) return;
              onChange(option.value);
              setOpen(false);
            }}
            titleStyle={isSelected ? undefined : styles.unselectedTitle}
          />
        );
      })}
    </Menu>
  );
};

const styles = StyleSheet.create({
  chip: {
    paddingTop: 3,
    paddingBottom: 3,
    paddingLeft: 8,
    paddingRight: 6,
    borderRadius: 8,
    alignSelf: 'flex-start',
  },
  chipInner: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  label: {
    fontSize: 11,
    fontWeight: '500',
    letterSpacing: 0.2,
  },
  chevron: {
    marginLeft: 2,
    opacity: 0.7,
  },
  unselectedTitle: {
    marginLeft: 22,
  },
});

export default DropdownChip;
