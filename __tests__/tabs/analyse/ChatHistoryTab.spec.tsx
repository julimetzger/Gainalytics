/**
 * GH-293: chat history overview — list rendering, full-content search,
 * delete (entry + file), and resuming an archived conversation.
 */

import React from 'react';
import {fireEvent, render, waitFor} from '@testing-library/react-native';
import RNFS from 'react-native-fs';
import ChatHistoryTab from '../../../app/tabs/Analyse/ChatHistoryTab';
import {ChatHistoryEntry} from '../../../app/redux/AIChat/aiChatSlice';

const mockNavigate = jest.fn();
jest.mock('@react-navigation/native', () => ({
  useNavigation: () => ({navigate: mockNavigate}),
}));

const dispatched: any[] = [];
const mockState = {
  aiChat: {
    messages: [] as any[],
    history: [] as ChatHistoryEntry[],
    pendingLegacyArchive: false,
  },
};

jest.mock('react-redux', () => ({
  useSelector: (selector: (state: any) => any) => selector(mockState),
  useDispatch: () => (action: any) => dispatched.push(action),
}));

function makeEntry(id: string, title: string, snippet: string): ChatHistoryEntry {
  return {
    id,
    title,
    snippet,
    createdAt: '2026-07-09T18:30:00.000Z',
    fileName: `${id}.json`,
    messageCount: 3,
  };
}

const squatChatMessages = [
  {role: 'user', content: 'How is my squat going?'},
  {role: 'assistant', content: 'Your xylophone cue really improved bracing.'},
  {role: 'user', content: 'Thanks!'},
];

function chatFileJson(messages: any[]): string {
  return JSON.stringify({version: 1, messages});
}

describe('ChatHistoryTab (GH-293)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    dispatched.length = 0;
    mockState.aiChat.messages = [];
    mockState.aiChat.history = [
      makeEntry('chat-1', 'How is my squat going?', 'Thanks!'),
      makeEntry('chat-2', 'Bench press plateau', 'Try pausing at the chest.'),
    ];
    (RNFS.readFile as jest.Mock).mockResolvedValue(chatFileJson(squatChatMessages));
    (RNFS.exists as jest.Mock).mockResolvedValue(true);
  });

  it('renders title, date, and snippet for each entry', () => {
    const {getByText, getAllByTestId} = render(<ChatHistoryTab />);
    expect(getByText('How is my squat going?')).toBeTruthy();
    expect(getByText('Bench press plateau')).toBeTruthy();
    expect(getByText('Try pausing at the chest.')).toBeTruthy();
    expect(getAllByTestId('chat-history-entry-date')).toHaveLength(2);
    // 3 messages each, date derived from createdAt
    expect(getAllByTestId('chat-history-entry-date')[0].props.children).toContain('3 messages');
  });

  it('shows the empty state when there is no history', () => {
    mockState.aiChat.history = [];
    const {getByTestId} = render(<ChatHistoryTab />);
    expect(getByTestId('chat-history-empty')).toBeTruthy();
  });

  it('filters by title match', async () => {
    const {getByTestId, queryByText} = render(<ChatHistoryTab />);
    fireEvent.changeText(getByTestId('chat-history-search'), 'bench');
    await waitFor(() => {
      expect(queryByText('How is my squat going?')).toBeNull();
      expect(queryByText('Bench press plateau')).toBeTruthy();
    });
  });

  it('finds a term that only exists in the middle of the archived conversation', async () => {
    // "xylophone" is in message 2 of the chat file, not in title or snippet.
    (RNFS.readFile as jest.Mock).mockImplementation((path: string) =>
      Promise.resolve(
        path.includes('chat-1')
          ? chatFileJson(squatChatMessages)
          : chatFileJson([{role: 'user', content: 'Bench stuff only'}]),
      ),
    );
    const {getByTestId, queryByText} = render(<ChatHistoryTab />);
    fireEvent.changeText(getByTestId('chat-history-search'), 'xylophone');
    await waitFor(() => {
      expect(queryByText('How is my squat going?')).toBeTruthy();
      expect(queryByText('Bench press plateau')).toBeNull();
    });
  });

  it('delete removes the file and the entry', async () => {
    const {getByTestId} = render(<ChatHistoryTab />);
    fireEvent.press(getByTestId('chat-history-delete-chat-2'));
    await waitFor(() => {
      expect(RNFS.unlink).toHaveBeenCalledWith(expect.stringContaining('chat-2.json'));
      expect(dispatched).toContainEqual(
        expect.objectContaining({type: 'aiChat/removeHistoryEntry', payload: 'chat-2'}),
      );
    });
  });

  it('opening an entry loads its messages into the active chat, un-archives it, and navigates', async () => {
    const {getByTestId} = render(<ChatHistoryTab />);
    fireEvent.press(getByTestId('chat-history-entry-chat-1'));
    await waitFor(() => {
      expect(dispatched).toContainEqual(
        expect.objectContaining({type: 'aiChat/setActiveMessages', payload: squatChatMessages}),
      );
      expect(dispatched).toContainEqual(
        expect.objectContaining({type: 'aiChat/removeHistoryEntry', payload: 'chat-1'}),
      );
      expect(RNFS.unlink).toHaveBeenCalledWith(expect.stringContaining('chat-1.json'));
      expect(mockNavigate).toHaveBeenCalledWith('AIChat');
    });
    // Active chat was empty — nothing gets archived.
    expect(RNFS.writeFile).not.toHaveBeenCalled();
  });

  it('opening an entry archives the running chat first so it is not lost', async () => {
    mockState.aiChat.messages = [{role: 'user', content: 'active conversation'}];
    const {getByTestId} = render(<ChatHistoryTab />);
    fireEvent.press(getByTestId('chat-history-entry-chat-1'));
    await waitFor(() => {
      // The running chat was written to disk and added to the history …
      expect(RNFS.writeFile).toHaveBeenCalledTimes(1);
      const archived = dispatched.find(a => a.type === 'aiChat/addHistoryEntry');
      expect(archived?.payload?.title).toBe('active conversation');
      // … before the archived conversation became the active one.
      expect(dispatched).toContainEqual(
        expect.objectContaining({type: 'aiChat/setActiveMessages', payload: squatChatMessages}),
      );
      const archiveIndex = dispatched.findIndex(a => a.type === 'aiChat/addHistoryEntry');
      const resumeIndex = dispatched.findIndex(a => a.type === 'aiChat/setActiveMessages');
      expect(archiveIndex).toBeLessThan(resumeIndex);
    });
  });
});
