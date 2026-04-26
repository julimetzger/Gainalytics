import {Platform} from 'react-native';
import {MD3Theme} from 'react-native-paper';

const monospace = Platform.OS === 'ios' ? 'Courier' : 'monospace';

export function aiChatMarkdownStyles(theme: MD3Theme) {
  return {
    body: {color: theme.colors.onSurfaceVariant, fontSize: 14, lineHeight: 20},
    heading1: {fontSize: 18, fontWeight: 'bold' as const, marginTop: 4, marginBottom: 4, color: theme.colors.onSurfaceVariant},
    heading2: {fontSize: 16, fontWeight: 'bold' as const, marginTop: 4, marginBottom: 4, color: theme.colors.onSurfaceVariant},
    heading3: {fontSize: 15, fontWeight: 'bold' as const, marginTop: 4, marginBottom: 2, color: theme.colors.onSurfaceVariant},
    strong: {fontWeight: 'bold' as const},
    em: {fontStyle: 'italic' as const},
    bullet_list: {marginVertical: 2},
    ordered_list: {marginVertical: 2},
    list_item: {flexDirection: 'row' as const, marginVertical: 1},
    code_inline: {
      backgroundColor: theme.colors.surface,
      paddingHorizontal: 4,
      paddingVertical: 1,
      borderRadius: 3,
      fontFamily: monospace,
    },
    code_block: {
      backgroundColor: theme.colors.surface,
      padding: 8,
      borderRadius: 6,
      marginVertical: 4,
      fontFamily: monospace,
    },
    fence: {
      backgroundColor: theme.colors.surface,
      padding: 8,
      borderRadius: 6,
      marginVertical: 4,
      fontFamily: monospace,
    },
    link: {color: theme.colors.primary, textDecorationLine: 'underline' as const},
    paragraph: {marginVertical: 2},
  };
}
