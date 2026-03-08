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
  labelKey?: string | undefined;
  type: 'text' | 'url' | 'number' | 'boolean' | 'textarea' | 'select' | 'separator' | 'engines-select';
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
    defaultSize: { w: 6, h: 4 },
    defaultOptions: { url: '', ignoreTls: false, timeoutMs: 5000, ping: true, layoutSize: 'normal', showDescription: false },
    configFields: [
      { key: 'description', label: 'Description', type: 'textarea', placeholder: 'What does it do', maxLength: 50 },
      { key: 'showDescription', label: 'Show description', type: 'boolean', default: false },
      {
        key: 'layoutSize',
        label: 'Layout size',
        type: 'select',
        options: [
          { value: 'tiny', label: 'Tiny' },
          { value: 'normal', label: 'Normal' },
          { value: 'big', label: 'Big' },
        ],
        default: 'normal',
      },
      { key: '_sep_network', label: '', type: 'separator' },
      { key: 'url', label: 'Host / URL', type: 'text', placeholder: '192.168.1.1 or example.com', required: true },
      { key: 'port', label: 'Port (TCP check — leave empty for ICMP ping)', type: 'number', placeholder: '80' },
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
    defaultSize: { w: 4, h: 4 },
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
    labelKey: 'widgets.stats.label',
    icon: BarChart2,
    description: 'CPU, memory and uptime for the server',
    descriptionKey: 'widgets.stats.description',
    defaultSize: { w: 6, h: 6 },
    defaultOptions: {},
    configFields: [],
  },
  {
    type: 'bookmarks',
    label: 'Bookmarks',
    labelKey: 'widgets.bookmarks.label',
    icon: Bookmark,
    description: 'Quick-access links grid',
    descriptionKey: 'widgets.bookmarks.description',
    defaultSize: { w: 6, h: 4 },
    defaultOptions: {
      links: [{ title: 'Example', url: 'https://example.com' }],
    },
    configFields: [],
  },
  {
    type: 'search',
    label: 'Search',
    labelKey: 'widgets.search.label',
    icon: Search,
    description: 'Search bar with configurable engine',
    descriptionKey: 'widgets.search.description',
    defaultSize: { w: 8, h: 4 },
    defaultOptions: {},
    configFields: [
      { key: 'engine', label: 'Engine', type: 'engines-select' },
      { key: 'placeholder', label: 'Placeholder override', type: 'text', placeholder: 'Overrides the engine placeholder from settings.yml' },
    ],
  },
  {
    type: 'notepad',
    label: 'Notepad',
    labelKey: 'widgets.notepad.label',
    icon: FileText,
    description: 'Persistent text notes with clickable links',
    descriptionKey: 'widgets.notepad.description',
    defaultSize: { w: 6, h: 6 },
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
    defaultSize: { w: 8, h: 8 },
    defaultOptions: {},
    configFields: [
      { key: 'url', label: 'URL', type: 'url', placeholder: 'https://example.com', required: true },
    ],
  },
];

export function getTemplate(type: string): WidgetTemplate | undefined {
  return WIDGET_CATALOG.find(t => t.type === type);
}
