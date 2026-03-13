import { lazy, type ComponentType } from 'react';
import type { WidgetProps } from '@dashdash/types';
import { FallbackWidget } from './fallback/fallback.component';

const ClockWidget = lazy(() => import('./clock/clock.component').then(m => ({ default: m.ClockWidget })));
const HealthcheckWidget = lazy(() => import('./healthcheck/healthcheck.component').then(m => ({ default: m.HealthcheckWidget })));
const StatsWidget = lazy(() => import('./stats/stats.component').then(m => ({ default: m.StatsWidget })));
const BookmarksWidget = lazy(() => import('./bookmarks/bookmarks.component').then(m => ({ default: m.BookmarksWidget })));
const SearchWidget = lazy(() => import('./search/search.component').then(m => ({ default: m.SearchWidget })));
const IframeWidget = lazy(() => import('./iframe/iframe.component').then(m => ({ default: m.IframeWidget })));
const NotepadWidget = lazy(() => import('./notepad/notepad.component').then(m => ({ default: m.NotepadWidget })));
const FrameWidget = lazy(() => import('./frame/frame.component').then(m => ({ default: m.FrameWidget })));

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
  ['frame',       { Component: FrameWidget,       clientOnly: true }],
]);

/** Returns the frontend widget definition. Unknown widget types fall back to FallbackWidget. */
export function getWidget(widgetId: string): FrontendWidget {
  return WIDGETS.get(widgetId) ?? { Component: FallbackWidget, clientOnly: true };
}
