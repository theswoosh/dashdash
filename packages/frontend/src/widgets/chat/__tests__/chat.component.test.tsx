import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import type { ReactNode } from 'react';
import type { ChatWsEvent, ChatChannel } from '@dashdash/types';
import { I18nProvider } from '../../../i18n';
import { ChatWidget } from '../chat.component';

let capturedOnEvent: ((e: ChatWsEvent) => void) | undefined;

vi.mock('../../../hooks/use-chat-ws.hook', () => ({
  useChatWs: (onEvent: (e: ChatWsEvent) => void) => { capturedOnEvent = onEvent; },
}));

const generalChannel: ChatChannel = {
  id: 'general-id',
  name: 'general',
  retentionDays: null,
  createdBy: null,
  createdAt: '2026-01-01T00:00:00.000Z',
};

const randomChannel: ChatChannel = {
  id: 'random-id',
  name: 'random',
  retentionDays: null,
  createdBy: null,
  createdAt: '2026-01-01T00:00:00.000Z',
};

vi.mock('../hooks/use-chat-channels.hook', () => ({
  useChatChannels: () => ({
    channels: [generalChannel, randomChannel],
    error: undefined,
    isLoading: false,
    mutate: vi.fn(),
  }),
}));

vi.mock('../hooks/use-chat-messages.hook', () => ({
  useChatMessages: () => ({
    messages: [],
    hasMore: false,
    isLoading: false,
    isLoadingOlder: false,
    error: undefined,
    loadOlder: vi.fn(),
    send: vi.fn(),
    currentUserId: 'user-1',
  }),
}));

const EN_TRANSLATIONS = {
  en: {
    chat: {
      noChannels: 'No channels configured — pick or create one in the widget settings',
      search: 'Search messages',
      unread: 'Unread',
    },
  },
};

function wrap(ui: ReactNode) {
  return render(
    <I18nProvider language="en" translations={EN_TRANSLATIONS} availableLanguages={['en']}>
      {ui}
    </I18nProvider>,
  );
}

const service = {
  serviceId: 'chat-1',
  options: { channelIds: ['general-id', 'random-id'] },
  data: undefined,
  error: undefined,
  loading: false,
};

describe('ChatWidget — unread tab dots', () => {
  beforeEach(() => {
    capturedOnEvent = undefined;
  });

  it('shows a dot on an inactive tab when a message arrives for it', async () => {
    wrap(<ChatWidget {...service} />);
    act(() => {
      capturedOnEvent?.({
        type: 'chat:message',
        channelId: 'random-id',
        message: {
          id: 'm1',
          channelId: 'random-id',
          userId: 'user-2',
          senderName: 'Bob',
          senderColor: null,
          body: 'hi',
          createdAt: '2026-01-01T00:00:00.000Z',
        },
      });
    });
    await waitFor(() => expect(screen.getByLabelText('Unread')).toBeInTheDocument());
  });

  it('clears the dot when the tab becomes active', async () => {
    wrap(<ChatWidget {...service} />);
    act(() => {
      capturedOnEvent?.({
        type: 'chat:message',
        channelId: 'random-id',
        message: {
          id: 'm1',
          channelId: 'random-id',
          userId: 'user-2',
          senderName: 'Bob',
          senderColor: null,
          body: 'hi',
          createdAt: '2026-01-01T00:00:00.000Z',
        },
      });
    });
    await waitFor(() => expect(screen.getByLabelText('Unread')).toBeInTheDocument());
    fireEvent.click(screen.getByText('random'));
    await waitFor(() => expect(screen.queryByLabelText('Unread')).toBeNull());
  });

  it('never marks the active tab unread', async () => {
    wrap(<ChatWidget {...service} />);
    act(() => {
      capturedOnEvent?.({
        type: 'chat:message',
        channelId: 'general-id',
        message: {
          id: 'm1',
          channelId: 'general-id',
          userId: 'user-2',
          senderName: 'Bob',
          senderColor: null,
          body: 'hi',
          createdAt: '2026-01-01T00:00:00.000Z',
        },
      });
    });
    await waitFor(() => expect(screen.queryByLabelText('Unread')).toBeNull());
  });
});
