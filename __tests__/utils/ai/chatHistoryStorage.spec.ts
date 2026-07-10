/**
 * GH-293: chat history file storage — entry building, file roundtrip,
 * deletion, and full-content search matching.
 */

import RNFS from 'react-native-fs';
import {
  archiveChatToFile,
  buildHistoryEntry,
  chatHistoryDir,
  deleteChatFile,
  deriveChatSnippet,
  deriveChatTitle,
  historyEntryMatchesQuery,
  messagesToSearchText,
  readChatFile,
  writeChatFile,
} from '../../../app/utils/ai/chatHistoryStorage';
import {ChatMessage} from '../../../app/utils/ai/sendChatMessage';
import {ChatHistoryEntry} from '../../../app/redux/AIChat/aiChatSlice';

const conversation: ChatMessage[] = [
  {role: 'user', content: 'How is my squat progressing?'},
  {role: 'assistant', content: 'Your squat volume went up 12% over the last meso.'},
  {role: 'user', content: 'And what about bench press lockout strength?'},
  {role: 'assistant', content: 'Add close-grip work for the lockout.'},
];

describe('deriveChatTitle', () => {
  it('uses the first user message', () => {
    expect(deriveChatTitle(conversation)).toBe('How is my squat progressing?');
  });

  it('falls back to the first non-empty message when there is no user message', () => {
    const seeded: ChatMessage[] = [{role: 'assistant', content: 'Coach insight: nice session!'}];
    expect(deriveChatTitle(seeded)).toBe('Coach insight: nice session!');
  });

  it('falls back to "Chat" when all messages are empty', () => {
    expect(deriveChatTitle([{role: 'user', content: '   '}])).toBe('Chat');
  });

  it('collapses whitespace and truncates long titles to 60 chars', () => {
    const long = 'word '.repeat(40);
    const title = deriveChatTitle([{role: 'user', content: long}]);
    expect(title.length).toBeLessThanOrEqual(60);
    expect(title.endsWith('…')).toBe(true);
    expect(title).not.toContain('  ');
  });
});

describe('deriveChatSnippet', () => {
  it('uses the last non-empty message', () => {
    expect(deriveChatSnippet(conversation)).toBe('Add close-grip work for the lockout.');
  });

  it('returns empty string for an empty conversation', () => {
    expect(deriveChatSnippet([])).toBe('');
  });

  it('truncates to 100 chars', () => {
    const snippet = deriveChatSnippet([{role: 'assistant', content: 'x'.repeat(300)}]);
    expect(snippet.length).toBeLessThanOrEqual(100);
    expect(snippet.endsWith('…')).toBe(true);
  });
});

describe('buildHistoryEntry', () => {
  it('builds metadata with date, count, and a matching file name', () => {
    const archivedAt = new Date('2026-07-10T12:00:00.000Z');
    const entry = buildHistoryEntry(conversation, archivedAt);
    expect(entry.title).toBe('How is my squat progressing?');
    expect(entry.snippet).toBe('Add close-grip work for the lockout.');
    expect(entry.createdAt).toBe('2026-07-10T12:00:00.000Z');
    expect(entry.messageCount).toBe(4);
    expect(entry.fileName).toBe(`${entry.id}.json`);
  });

  it('generates unique ids for entries archived at the same instant', () => {
    const archivedAt = new Date('2026-07-10T12:00:00.000Z');
    const ids = new Set(
      Array.from({length: 20}, () => buildHistoryEntry(conversation, archivedAt).id),
    );
    expect(ids.size).toBe(20);
  });
});

describe('chat file roundtrip', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('writeChatFile creates the directory and writes JSON with the full messages', async () => {
    const entry = buildHistoryEntry(conversation, new Date());
    await writeChatFile(entry, conversation);
    expect(RNFS.mkdir).toHaveBeenCalledWith(chatHistoryDir());
    const [path, payload, encoding] = (RNFS.writeFile as jest.Mock).mock.calls[0];
    expect(path).toBe(`${chatHistoryDir()}/${entry.fileName}`);
    expect(encoding).toBe('utf8');
    expect(JSON.parse(payload).messages).toEqual(conversation);
  });

  it('readChatFile returns the messages written by writeChatFile', async () => {
    const entry = buildHistoryEntry(conversation, new Date());
    await writeChatFile(entry, conversation);
    const written = (RNFS.writeFile as jest.Mock).mock.calls[0][1];
    (RNFS.readFile as jest.Mock).mockResolvedValue(written);
    const messages = await readChatFile(entry.fileName);
    expect(messages).toEqual(conversation);
  });

  it('readChatFile returns [] for a file without a messages array', async () => {
    (RNFS.readFile as jest.Mock).mockResolvedValue('{"version":1}');
    expect(await readChatFile('broken.json')).toEqual([]);
  });

  it('archiveChatToFile returns null for an empty conversation and writes nothing', async () => {
    expect(await archiveChatToFile([])).toBeNull();
    expect(RNFS.writeFile).not.toHaveBeenCalled();
  });

  it('archiveChatToFile writes the file and returns the entry', async () => {
    const entry = await archiveChatToFile(conversation);
    expect(entry).not.toBeNull();
    expect(entry!.messageCount).toBe(4);
    expect(RNFS.writeFile).toHaveBeenCalledTimes(1);
  });

  it('deleteChatFile unlinks an existing file', async () => {
    (RNFS.exists as jest.Mock).mockResolvedValue(true);
    await deleteChatFile('chat-1.json');
    expect(RNFS.unlink).toHaveBeenCalledWith(`${chatHistoryDir()}/chat-1.json`);
  });

  it('deleteChatFile is a no-op for a missing file', async () => {
    (RNFS.exists as jest.Mock).mockResolvedValue(false);
    await deleteChatFile('chat-1.json');
    expect(RNFS.unlink).not.toHaveBeenCalled();
  });
});

describe('full-content search (GH-293)', () => {
  const entry: ChatHistoryEntry = {
    id: 'chat-1',
    title: 'How is my squat progressing?',
    snippet: 'Add close-grip work for the lockout.',
    createdAt: '2026-07-10T12:00:00.000Z',
    fileName: 'chat-1.json',
    messageCount: 4,
  };
  const fullText = messagesToSearchText(conversation);

  it('empty query matches everything', () => {
    expect(historyEntryMatchesQuery(entry, undefined, '')).toBe(true);
    expect(historyEntryMatchesQuery(entry, undefined, '   ')).toBe(true);
  });

  it('matches the title case-insensitively', () => {
    expect(historyEntryMatchesQuery(entry, undefined, 'SQUAT')).toBe(true);
  });

  it('finds a term that only appears in the middle of the conversation', () => {
    // "12%" is only in message 2 — not in title or snippet.
    expect(entry.title).not.toContain('12%');
    expect(entry.snippet).not.toContain('12%');
    expect(historyEntryMatchesQuery(entry, fullText, '12%')).toBe(true);
  });

  it('does not match a mid-conversation term while the file content is not loaded yet', () => {
    expect(historyEntryMatchesQuery(entry, undefined, '12%')).toBe(false);
  });

  it('returns false when neither metadata nor content match', () => {
    expect(historyEntryMatchesQuery(entry, fullText, 'deadlift')).toBe(false);
  });
});
