import { GripVertical } from 'lucide-react';
import { useThemeCard } from '../themes/registry';
import './WidgetCard.css';

interface Props {
  id: string;
  title: string;
  icon?: string | undefined;
  editMode: boolean;
}

export function WidgetCard({ id, title, icon: _icon, editMode }: Props) {
  const Card = useThemeCard();

  return (
    <Card className={editMode ? 'widget-card--edit' : ''}>
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
    </Card>
  );
}
