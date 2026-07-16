/** Chat skins are CSS-scoped looks: every skin styles the same bubble markup
 *  under a `.chat--skin-<id>` root class (see ChatWidget.css). Adding a skin =
 *  register the id here, add its CSS block, add a catalog select option. */
export const CHAT_SKINS = ['imessage', 'whatsapp', 'irc'] as const;

export type ChatSkinId = (typeof CHAT_SKINS)[number];

const DEFAULT_SKIN: ChatSkinId = 'imessage';

export function resolveChatSkin(value: unknown): ChatSkinId {
  return typeof value === 'string' && (CHAT_SKINS as readonly string[]).includes(value)
    ? (value as ChatSkinId)
    : DEFAULT_SKIN;
}
