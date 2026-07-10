/**
 * GH-293: file storage for archived AI chat conversations.
 * Each archived chat is one JSON file under DocumentDirectoryPath/aiChatHistory/;
 * Redux only keeps the ChatHistoryEntry metadata (see aiChatSlice).
 */

import RNFS from 'react-native-fs';
import {ChatMessage} from './sendChatMessage';
import {ChatHistoryEntry} from '../../redux/AIChat/aiChatSlice';

const TITLE_MAX_LENGTH = 60;
const SNIPPET_MAX_LENGTH = 100;

export function chatHistoryDir(): string {
  return `${RNFS.DocumentDirectoryPath}/aiChatHistory`;
}

function chatFilePath(fileName: string): string {
  return `${chatHistoryDir()}/${fileName}`;
}

function collapseWhitespace(text: string): string {
  return text.replace(/\s+/g, ' ').trim();
}

function truncate(text: string, maxLength: number): string {
  return text.length > maxLength ? `${text.substring(0, maxLength - 1)}…` : text;
}

/** Title: the first user message (what the user asked); falls back to the first
 *  message of any role (e.g. a coach-insight seeded chat), then to a constant. */
export function deriveChatTitle(messages: ChatMessage[]): string {
  const firstUser = messages.find(m => m.role === 'user' && m.content.trim() !== '');
  const source = firstUser ?? messages.find(m => m.content.trim() !== '');
  if (!source) return 'Chat';
  return truncate(collapseWhitespace(source.content), TITLE_MAX_LENGTH);
}

/** Snippet: the start of the last message, so the list shows where the
 *  conversation left off. */
export function deriveChatSnippet(messages: ChatMessage[]): string {
  const lastWithContent = [...messages].reverse().find(m => m.content.trim() !== '');
  if (!lastWithContent) return '';
  return truncate(collapseWhitespace(lastWithContent.content), SNIPPET_MAX_LENGTH);
}

// In-session counter so two archives within the same millisecond still get unique ids.
let archiveCounter = 0;

/** Builds the Redux metadata entry for a conversation archived at `archivedAt`. */
export function buildHistoryEntry(messages: ChatMessage[], archivedAt: Date): ChatHistoryEntry {
  archiveCounter += 1;
  const id = `chat-${archivedAt.getTime()}-${archiveCounter}-${Math.floor(Math.random() * 1e6)}`;
  return {
    id,
    title: deriveChatTitle(messages),
    snippet: deriveChatSnippet(messages),
    createdAt: archivedAt.toISOString(),
    fileName: `${id}.json`,
    messageCount: messages.length,
  };
}

/** Writes the messages of `entry` to its chat file. Creates the directory on demand. */
export async function writeChatFile(entry: ChatHistoryEntry, messages: ChatMessage[]): Promise<void> {
  await RNFS.mkdir(chatHistoryDir());
  const payload = JSON.stringify({version: 1, messages});
  await RNFS.writeFile(chatFilePath(entry.fileName), payload, 'utf8');
}

/** Reads the full messages of an archived chat back from disk. */
export async function readChatFile(fileName: string): Promise<ChatMessage[]> {
  const raw = await RNFS.readFile(chatFilePath(fileName), 'utf8');
  const parsed = JSON.parse(raw);
  return Array.isArray(parsed?.messages) ? parsed.messages : [];
}

/** Deletes an archived chat file. Missing files are treated as already deleted. */
export async function deleteChatFile(fileName: string): Promise<void> {
  const path = chatFilePath(fileName);
  const exists = await RNFS.exists(path);
  if (exists) {
    await RNFS.unlink(path);
  }
}

/** Archives a conversation: writes the file and returns the metadata entry to
 *  dispatch, or null when there is nothing to archive. */
export async function archiveChatToFile(messages: ChatMessage[]): Promise<ChatHistoryEntry | null> {
  if (messages.length === 0) return null;
  const entry = buildHistoryEntry(messages, new Date());
  await writeChatFile(entry, messages);
  return entry;
}

/** Lower-cased full text of a conversation, used for full-content search. */
export function messagesToSearchText(messages: ChatMessage[]): string {
  return messages.map(m => m.content).join('\n').toLowerCase();
}

/** True when the query matches the entry metadata or the full chat text.
 *  `fullText` is the (already lower-cased) file content, or undefined while loading. */
export function historyEntryMatchesQuery(
  entry: ChatHistoryEntry,
  fullText: string | undefined,
  query: string,
): boolean {
  const q = query.trim().toLowerCase();
  if (q === '') return true;
  if (entry.title.toLowerCase().includes(q)) return true;
  if (entry.snippet.toLowerCase().includes(q)) return true;
  return fullText !== undefined && fullText.includes(q);
}
