export interface ChatChannel {
  id: string;
  name: string;
  /** Days messages are kept; null = keep forever. */
  retentionDays: number | null;
  createdBy: string | null;
  createdAt: string;
}

export interface ChatMessage {
  id: string;
  channelId: string;
  /** Sender account id; null when the account was deleted. */
  userId: string | null;
  /** Display name snapshotted at send time (survives account deletion/rename). */
  senderName: string;
  body: string;
  createdAt: string;
}

export interface ChatMessagesPage {
  /** Ascending by creation (oldest first). */
  messages: ChatMessage[];
  hasMore: boolean;
}
