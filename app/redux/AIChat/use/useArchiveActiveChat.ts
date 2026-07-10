import {useCallback} from 'react';
import {useDispatch, useSelector} from 'react-redux';
import {GlobalState} from '../../rootReducer';
import {addHistoryEntry, setPendingLegacyArchive, ChatHistoryEntry} from '../aiChatSlice';
import {archiveChatToFile} from '../../../utils/ai/chatHistoryStorage';

/**
 * GH-293: archives the running conversation into the chat history (file on disk
 * + metadata entry in Redux). Used by every action that replaces the active chat
 * (Clear, coach-insight "Ask AI", resuming an archived chat) so no conversation
 * is ever silently discarded. Resolves to the new entry, or null when the active
 * chat was empty. Also clears the pending legacy-archive flag: once the running
 * chat is archived, the pre-update conversation is safe in the history.
 */
export function useArchiveActiveChat(): () => Promise<ChatHistoryEntry | null> {
  const dispatch = useDispatch();
  const messages = useSelector((s: GlobalState) => s.aiChat.messages);

  return useCallback(async () => {
    const entry = await archiveChatToFile(messages);
    if (entry) {
      dispatch(addHistoryEntry(entry));
    }
    dispatch(setPendingLegacyArchive(false));
    return entry;
  }, [messages, dispatch]);
}
