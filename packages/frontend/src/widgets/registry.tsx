import type { ComponentType } from 'react';
import type { WidgetProps } from '@dashdash/types';
import { ClockWidget } from './clock/clock.component';
import { HealthcheckWidget } from './healthcheck/healthcheck.component';
import { StatsWidget } from './stats/stats.component';
import { BookmarksWidget } from './bookmarks/bookmarks.component';
import { SearchWidget } from './search/search.component';
import { IframeWidget } from './iframe/iframe.component';
import { FallbackWidget } from './fallback/fallback.component';
import { NotepadWidget } from './notepad/notepad.component';

interface FrontendWidget {
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
