import type { WidgetProps } from '@dashdash/types';
import { WidgetSkeleton } from '../shared/widget-skeleton.component';
import { WidgetError } from '../shared/widget-error.component';
import './HealthcheckWidget.css';

type HealthcheckLayoutSize = 'tiny' | 'normal' | 'big';

export function HealthcheckWidget({ options, error, loading }: WidgetProps) {
  if (loading) return <WidgetSkeleton />;
  if (error) return <WidgetError message={error} />;

  const layoutSizeRaw = options['layoutSize'];
  const layoutSize: HealthcheckLayoutSize =
    layoutSizeRaw === 'tiny' || layoutSizeRaw === 'big' ? layoutSizeRaw : 'normal';
  const appName = typeof options['_title'] === 'string' ? options['_title'] : '';
  const description = typeof options['description'] === 'string' ? options['description'] : '';
  const isShowDescription = Boolean(options['showDescription']);

  if (layoutSize === 'tiny') {
    return null;
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
