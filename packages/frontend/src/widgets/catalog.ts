import type { LucideIcon } from 'lucide-react';
import {
  Clock,
  Activity,
  Bookmark,
  Search,
  FileText,
  BarChart2,
  Globe,
  Layers,
  MessageCircle,
} from 'lucide-react';

export interface ConfigField {
  key: string;
  label: string;
  labelKey?: string | undefined;
  type: 'text' | 'url' | 'number' | 'boolean' | 'textarea' | 'select' | 'separator' | 'engines-select' | 'info' | 'links-editor' | 'timezone-select' | 'icon-picker' | 'channels-editor';
  placeholder?: string | undefined;
  required?: boolean | undefined;
  default?: unknown;
  maxLength?: number | undefined;
  options?: { value: string; label: string }[] | undefined;
}

export interface WidgetTemplate {
  type: string;
  label: string;
  labelKey?: string | undefined;
  icon: LucideIcon;
  description: string;
  descriptionKey?: string | undefined;
  defaultSize: { w: number; h: number };
  defaultOptions: Record<string, unknown>;
  configFields: ConfigField[];
}

export const WIDGET_CATALOG: WidgetTemplate[] = [
  {
    type: 'healthcheck',
    label: 'Healthcheck',
    labelKey: 'widgets.healthcheck.label',
    icon: Activity,
    description: 'Monitor a host for uptime and latency',
    descriptionKey: 'widgets.healthcheck.description',
    defaultSize: { w: 16, h: 8 },
    defaultOptions: { url: '', ignoreTls: false, timeoutMs: 5000, ping: true, layoutSize: 'normal', pingIndicator: 'header-bar' },
    configFields: [
      { key: 'icon', label: 'App icon', type: 'icon-picker' },
      { key: 'description', label: 'Description (shown as icon tooltip)', type: 'textarea', placeholder: 'Brief description of this service', maxLength: 80 },
      { key: 'internalUrl', label: 'App URL', type: 'url', placeholder: 'https://app.example.com — opens when clicking the icon' },
      {
        key: 'layoutSize',
        label: 'Layout size',
        type: 'select',
        options: [
          { value: 'tiny', label: 'Tiny — single bar with ping indicator' },
          { value: 'normal', label: 'Normal — icon' },
          { value: 'big', label: 'Big — icon fills the card' },
        ],
        default: 'normal',
      },
      {
        key: 'showName',
        label: 'Show name',
        type: 'select',
        options: [
          { value: 'hidden', label: 'Hidden' },
          { value: 'above', label: 'Above icon' },
          { value: 'below', label: 'Below icon' },
        ],
        default: 'below',
      },
      {
        key: 'pingIndicator',
        label: 'Ping indicator',
        type: 'select',
        options: [
          { value: 'header-bar', label: 'Dot in header bar' },
          { value: 'name', label: 'Red name when unreachable' },
          { value: 'icon-glow', label: 'Red glow around icon when unreachable' },
        ],
        default: 'header-bar',
      },
      { key: '_sep_network', label: '', type: 'separator' },
      { key: 'url', label: 'Ping URL / hostname', type: 'text', placeholder: '192.168.1.1, example.com, or https://service.internal' },
      { key: 'port', label: 'Port (TCP check — leave empty for ICMP ping)', type: 'number', placeholder: '80' },
      { key: '_ping_info', label: 'No port → ICMP ping (host liveness). Add a port, host:port, or an http(s):// URL for a TCP check instead. ICMP needs the NET_RAW capability (enabled by default); where it is unavailable the check shows "unknown".', type: 'info' },
      { key: 'timeoutMs', label: 'Timeout (ms)', type: 'number', default: 5000 },
      { key: 'ping', label: 'Enable ping', type: 'boolean', default: true },
    ],
  },
  {
    type: 'clock',
    label: 'Clock',
    labelKey: 'widgets.clock.label',
    icon: Clock,
    description: 'Display the current time',
    descriptionKey: 'widgets.clock.description',
    defaultSize: { w: 14, h: 9 },
    defaultOptions: { format: '24h', showSeconds: true },
    configFields: [
      {
        key: 'format',
        label: 'Format',
        type: 'select',
        options: [
          { value: '12h', label: '12-hour' },
          { value: '24h', label: '24-hour' },
        ],
        default: '24h',
      },
      { key: 'timezone', label: 'Timezone', type: 'timezone-select', placeholder: 'e.g. Europe/Berlin' },
      { key: 'showSeconds', label: 'Show seconds', type: 'boolean', default: true },
      { key: 'showTimezone', label: 'Show timezone', type: 'boolean', default: false },
    ],
  },
  {
    type: 'stats',
    label: 'System Stats',
    labelKey: 'widgets.stats.label',
    icon: BarChart2,
    description: 'CPU, memory and uptime for the server',
    descriptionKey: 'widgets.stats.description',
    defaultSize: { w: 14, h: 14 },
    defaultOptions: { showCpu: true, showMem: true, showUptime: true },
    configFields: [
      { key: 'showCpu', label: 'Show CPU', type: 'boolean', default: true },
      { key: 'showMem', label: 'Show memory', type: 'boolean', default: true },
      { key: 'showUptime', label: 'Show uptime', type: 'boolean', default: true },
      { key: '_thresholds_info', label: 'Warn/critical colour thresholds apply to all System Stats widgets — set them in the sidebar via the widget\'s gear button (defaults: amber > 65 %, red > 85 %).', type: 'info' },
    ],
  },
  {
    type: 'bookmarks',
    label: 'Bookmarks',
    labelKey: 'widgets.bookmarks.label',
    icon: Bookmark,
    description: 'Quick-access links grid',
    descriptionKey: 'widgets.bookmarks.description',
    defaultSize: { w: 14, h: 9 },
    defaultOptions: {
      links: [{ label: 'Example', url: 'https://example.com' }],
    },
    configFields: [
      {
        key: 'linksLayout',
        label: 'Layout',
        type: 'select',
        options: [
          { value: 'flow', label: 'Flow — side by side, wrapping' },
          { value: 'list', label: 'List — one per line' },
        ],
        default: 'flow',
      },
      { key: 'links', label: 'Bookmarks', type: 'links-editor' },
    ],
  },
  {
    type: 'search',
    label: 'Search',
    labelKey: 'widgets.search.label',
    icon: Search,
    description: 'Search bar with configurable engine',
    descriptionKey: 'widgets.search.description',
    defaultSize: { w: 16, h: 8 },
    defaultOptions: {},
    configFields: [
      { key: 'engine', label: 'Engine', type: 'engines-select' },
      { key: 'placeholder', label: 'Placeholder text', type: 'text', placeholder: 'Overrides the engine placeholder from settings.yml' },
    ],
  },
  {
    type: 'notepad',
    label: 'Notepad',
    labelKey: 'widgets.notepad.label',
    icon: FileText,
    description: 'Persistent text notes with clickable links',
    descriptionKey: 'widgets.notepad.description',
    defaultSize: { w: 28, h: 21 },
    defaultOptions: { pollingInterval: 60 },
    configFields: [
      { key: 'pollingInterval', label: 'Auto-refresh interval (seconds, 0 = off)', type: 'number', default: 60 },
    ],
  },
  {
    type: 'iframe',
    label: 'iFrame',
    labelKey: 'widgets.iframe.label',
    icon: Globe,
    description: 'Embed any URL in a sandboxed frame',
    descriptionKey: 'widgets.iframe.description',
    defaultSize: { w: 21, h: 21 },
    defaultOptions: {},
    configFields: [
      { key: 'url', label: 'URL', type: 'url', placeholder: 'https://example.com', required: true },
    ],
  },
  {
    type: 'chat',
    label: 'Chat',
    labelKey: 'widgets.chat.label',
    icon: MessageCircle,
    description: 'Message channels shared between users',
    descriptionKey: 'widgets.chat.description',
    defaultSize: { w: 28, h: 28 },
    defaultOptions: { pollingInterval: 5, chatSkin: 'imessage', showTimestamps: true },
    configFields: [
      { key: 'channelIds', label: 'Channels', labelKey: 'widgetConfig.chat.channels', type: 'channels-editor' },
      { key: '_sep_chat', label: '', type: 'separator' },
      {
        key: 'chatSkin',
        label: 'Skin',
        labelKey: 'widgetConfig.chat.skin',
        type: 'select',
        options: [
          { value: 'imessage', label: 'iMessage' },
        ],
        default: 'imessage',
      },
      { key: 'pollingInterval', label: 'Refresh interval (seconds, 0 = off)', labelKey: 'widgetConfig.chat.pollingInterval', type: 'number', default: 5 },
      { key: 'showTimestamps', label: 'Show timestamps', labelKey: 'widgetConfig.chat.showTimestamps', type: 'boolean', default: true },
    ],
  },
  {
    type: 'frame',
    label: 'Frame',
    labelKey: 'widgets.frame.label',
    icon: Layers,
    description: 'Group widgets inside a visual frame',
    descriptionKey: 'widgets.frame.description',
    defaultSize: { w: 28, h: 28 },
    defaultOptions: {},
    configFields: [],
  },
];

export function getTemplate(type: string): WidgetTemplate | undefined {
  return WIDGET_CATALOG.find(t => t.type === type);
}
