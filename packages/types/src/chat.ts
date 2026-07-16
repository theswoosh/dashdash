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
  /** Sender's personal chat color (`#rrggbb`); null when unset or the account was deleted. */
  senderColor: string | null;
  body: string;
  createdAt: string;
}

export interface ChatMessagesPage {
  /** Ascending by creation (oldest first). */
  messages: ChatMessage[];
  hasMore: boolean;
}

export type ChatWsEvent =
  | { type: 'chat:message'; channelId: string; message: ChatMessage }
  | { type: 'chat:channel-created'; channel: ChatChannel }
  | { type: 'chat:channel-updated'; channel: ChatChannel }
  | { type: 'chat:channel-deleted'; channelId: string };
