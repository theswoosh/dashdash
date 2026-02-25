import './WidgetSkeleton.css';

export function WidgetSkeleton() {
  return (
    <div className="widget-skeleton">
      <div className="widget-skeleton__bar widget-skeleton__bar--title" />
      <div className="widget-skeleton__bar" />
      <div className="widget-skeleton__bar widget-skeleton__bar--short" />
    </div>
  );
}
