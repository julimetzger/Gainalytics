declare module 'sharingan-rn-modal-dropdown' {
  import * as React from 'react';

  export interface IDropdownData {
    label: string;
    value: string;
    avatarComponent?: React.ReactNode;
  }

  export interface MultiselectDropdownProps {
    label?: string;
    enableSearch?: boolean;
    value?: string[];
    onChange?: (value: string[]) => void;
    searchInputTheme?: unknown;
    data?: IDropdownData[];
    paperTheme?: unknown;
    disableSort?: boolean;
    selectedItemViewStyle?: unknown;
    primaryColor?: string;
    enableAvatar?: boolean;
    multiline?: boolean;
    hideChip?: boolean;
    onBlur?: () => void;
    /** patches/: parent-controlled close (GH-324). */
    open?: boolean;
    /** patches/: parent-controlled open (GH-403). */
    autoOpen?: boolean;
    /** patches/: render the "x selected" counter as the list's header row (GH-403). */
    selectionHeader?: boolean;
  }

  export const MultiselectDropdown: React.ComponentType<MultiselectDropdownProps>;
}
