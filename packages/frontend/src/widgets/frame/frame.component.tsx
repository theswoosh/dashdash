import type { WidgetProps } from '@dashdash/types';
import './FrameWidget.css';

export function FrameWidget({ options }: WidgetProps) {
  const note = typeof options['_frameNote'] === 'string' ? options['_frameNote'] : null;
  return (
    <div className="frame-widget">
      {note ? <p className="frame-widget__note">{note}</p> : null}
    </div>
  );
}
