import type { LucideIcon } from 'lucide-react';
import {
  Clock,
  Activity,
  Bookmark,
  Search,
  FileText,
  BarChart2,
  Globe,
} from 'lucide-react';

export interface ConfigField {
  key: string;
  label: string;
  type: 'text' | 'url' | 'number' | 'boolean' | 'textarea' | 'select';
  placeholder?: string | undefined;
  required?: boolean | undefined;
  default?: unknown;
  options?: { value: string; label: string }[] | undefined;
}

export interface WidgetTemplate {
  type: string;
  label: string;
  icon: LucideIcon;
  description: string;
  defaultSize: { w: number; h: number };
  defaultOptions: Record<string, unknown>;
  configFields: ConfigField[];
}

export const WIDGET_CATALOG: WidgetTemplate[] = [
  {
    type: 'healthcheck',
    label: 'Healthcheck',
    icon: Activity,
    description: 'Monitor a host for uptime and latency',
    defaultSize: { w: 3, h: 2 },
    defaultOptions: { url: '', port: 80, ignoreTls: false, timeoutMs: 5000 },
    configFields: [
      { key: 'url', label: 'Host / URL', type: 'text', placeholder: '192.168.1.1 or https://example.com', required: true },
      { key: 'port', label: 'Port', type: 'number', placeholder: '80', default: 80 },
      { key: 'ignoreTls', label: 'Ignore TLS errors (self-signed cert)', type: 'boolean', default: false },
      { key: 'timeoutMs', label: 'Timeout (ms)', type: 'number', default: 5000 },
    ],
  },
  {
    type: 'clock',
    label: 'Clock',
    icon: Clock,
    description: 'Display the current time',
    defaultSize: { w: 2, h: 2 },
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
      { key: 'timezone', label: 'Timezone', type: 'text', placeholder: 'e.g. Europe/Berlin' },
      { key: 'showSeconds', label: 'Show seconds', type: 'boolean', default: true },
    ],
  },
  {
    type: 'stats',
    label: 'System Stats',
    icon: BarChart2,
    description: 'CPU, memory and uptime for the server',
    defaultSize: { w: 3, h: 3 },
    defaultOptions: {},
    configFields: [],
  },
  {
    type: 'bookmarks',
    label: 'Bookmarks',
    icon: Bookmark,
    description: 'Quick-access links grid',
    defaultSize: { w: 3, h: 2 },
    defaultOptions: {
      links: [{ title: 'Example', url: 'https://example.com' }],
    },
    configFields: [],
  },
  {
    type: 'search',
    label: 'Search',
    icon: Search,
    description: 'Search bar with configurable engine',
    defaultSize: { w: 4, h: 2 },
    defaultOptions: { engine: 'duckduckgo' },
    configFields: [
      {
        key: 'engine',
        label: 'Search engine',
        type: 'select',
        options: [
          { value: 'duckduckgo', label: 'DuckDuckGo' },
          { value: 'google', label: 'Google' },
          { value: 'brave', label: 'Brave' },
          { value: 'bing', label: 'Bing' },
        ],
        default: 'duckduckgo',
      },
      { key: 'placeholder', label: 'Placeholder text', type: 'text', placeholder: 'Search…' },
    ],
  },
  {
    type: 'notepad',
    label: 'Notepad',
    icon: FileText,
    description: 'Persistent text notes with clickable links',
    defaultSize: { w: 3, h: 3 },
    defaultOptions: {},
    configFields: [],
  },
  {
    type: 'iframe',
    label: 'iFrame',
    icon: Globe,
    description: 'Embed any URL in a sandboxed frame',
    defaultSize: { w: 4, h: 4 },
    defaultOptions: {},
    configFields: [
      { key: 'url', label: 'URL', type: 'url', placeholder: 'https://example.com', required: true },
    ],
  },
];

export function getTemplate(type: string): WidgetTemplate | undefined {
  return WIDGET_CATALOG.find(t => t.type === type);
}
