import type { WidgetProps } from '@dashdash/types';
import { WidgetSkeleton } from '../shared/widget-skeleton.component';
import { WidgetError } from '../shared/widget-error.component';
import './HealthcheckWidget.css';

type HealthcheckLayoutSize = 'tiny' | 'normal' | 'big';

export function HealthcheckWidget({ options, error, loading }: WidgetProps) {
  if (loading) return <WidgetSkeleton />;
  if (error) return <WidgetError message={error} />;

  const layoutSize = (options['layoutSize'] as HealthcheckLayoutSize | undefined) ?? 'normal';
  const appName = (options['_title'] as string | undefined) ?? '';
  const description = (options['description'] as string | undefined) ?? '';
  const isShowDescription = Boolean(options['showDescription']);

  if (layoutSize === 'tiny') {
    return <div className="healthcheck-widget healthcheck-widget--tiny" />;
  }

  if (layoutSize === 'big') {
    return (
      <div className="healthcheck-widget healthcheck-widget--big">
        <div className="healthcheck-widget__icon-area" title={appName} aria-label={`${appName} icon`} />
      </div>
    );
  }

  return (
    <div className="healthcheck-widget healthcheck-widget--normal">
      <div className="healthcheck-widget__icon-area" aria-hidden="true" />
      {isShowDescription && description && (
        <p className="healthcheck-widget__description">{description}</p>
      )}
    </div>
  );
}
