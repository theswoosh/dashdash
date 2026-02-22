import { GripVertical } from 'lucide-react';
import { LiquidCard } from './LiquidCard';
import './WidgetCard.css';

interface Props {
  id: string;
  title: string;
  editMode: boolean;
}

export function WidgetCard({ id, title, editMode }: Props) {
  return (
    <LiquidCard className={editMode ? 'widget-card--edit' : ''}>
      <div className="widget-header">
        {editMode && (
          <span className="widget-drag-handle" title="Drag to move">
            <GripVertical size={16} />
          </span>
        )}
        <span className="widget-title">{title}</span>
      </div>
      <div className="widget-body">
        <span className="widget-placeholder-id">{id}</span>
        <p className="widget-placeholder-text">Widget content coming in Phase 3</p>
      </div>
    </LiquidCard>
  );
}
