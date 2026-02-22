import type { ComponentType } from 'react';
import type { WidgetProps } from '@dashdash/types';
import { ClockWidget } from './clock/ClockWidget';
import { HealthcheckWidget } from './healthcheck/HealthcheckWidget';
import { StatsWidget } from './stats/StatsWidget';
import { BookmarksWidget } from './bookmarks/BookmarksWidget';
import { SearchWidget } from './search/SearchWidget';
import { IframeWidget } from './iframe/IframeWidget';
import { FallbackWidget } from './fallback/FallbackWidget';
import { NotepadWidget } from './notepad/NotepadWidget';

export interface FrontendWidget {
  Component: ComponentType<WidgetProps>;
  clientOnly?: boolean | undefined;
}

const WIDGETS = new Map<string, FrontendWidget>([
  ['clock',       { Component: ClockWidget,       clientOnly: true }],
  ['bookmarks',   { Component: BookmarksWidget,   clientOnly: true }],
  ['search',      { Component: SearchWidget,      clientOnly: true }],
  ['iframe',      { Component: IframeWidget,      clientOnly: true }],
  ['healthcheck', { Component: HealthcheckWidget                   }],
  ['stats',       { Component: StatsWidget                         }],
  ['notepad',     { Component: NotepadWidget,     clientOnly: true }],
]);

/** Returns the frontend widget definition. Unknown widget types fall back to FallbackWidget. */
export function getWidget(widgetId: string): FrontendWidget {
  return WIDGETS.get(widgetId) ?? { Component: FallbackWidget, clientOnly: true };
}
