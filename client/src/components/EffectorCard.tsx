import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import type { Effect } from '../types/effects';

interface EffectorCardProps {
  effect: Effect;
  onToggle: (id: string) => void;
}

export function EffectorCard({ effect, onToggle }: EffectorCardProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: effect.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`effector-card ${effect.enabled ? 'enabled' : 'disabled'}`}
    >
      <div className="effector-drag-handle" {...attributes} {...listeners}>
        <img
          src={effect.image}
          alt={effect.name}
          className="effector-image"
          draggable={false}
        />
      </div>
      <div className="effector-info">
        <span className="effector-name">{effect.name}</span>
        <label className="effector-toggle">
          <input
            type="checkbox"
            checked={effect.enabled}
            onChange={() => onToggle(effect.id)}
          />
          <span>{effect.enabled ? 'ON' : 'OFF'}</span>
        </label>
      </div>
    </div>
  );
}
