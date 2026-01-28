import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  horizontalListSortingStrategy,
} from '@dnd-kit/sortable';
import { EffectorCard } from './EffectorCard';
import type { Effect } from '../types/effects';

interface EffectorBoardProps {
  effects: Effect[];
  onEffectsChange: (effects: Effect[]) => void;
}

export function EffectorBoard({ effects, onEffectsChange }: EffectorBoardProps) {
  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;

    if (over && active.id !== over.id) {
      const oldIndex = effects.findIndex((e) => e.id === active.id);
      const newIndex = effects.findIndex((e) => e.id === over.id);
      onEffectsChange(arrayMove(effects, oldIndex, newIndex));
    }
  };

  const handleToggle = (id: string) => {
    onEffectsChange(
      effects.map((e) =>
        e.id === id ? { ...e, enabled: !e.enabled } : e
      )
    );
  };

  const enabledCount = effects.filter((e) => e.enabled).length;

  return (
    <div className="effector-board-container">
      <div className="effector-board-header">
        <h2>Effect Chain</h2>
        <span className="enabled-count">
          {enabledCount} effect{enabledCount !== 1 ? 's' : ''} enabled
        </span>
      </div>
      <p className="effector-board-hint">
        Drag to reorder. Toggle ON/OFF to enable effects.
      </p>
      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragEnd={handleDragEnd}
      >
        <SortableContext
          items={effects.map((e) => e.id)}
          strategy={horizontalListSortingStrategy}
        >
          <div className="effector-board">
            {effects.map((effect) => (
              <EffectorCard
                key={effect.id}
                effect={effect}
                onToggle={handleToggle}
              />
            ))}
          </div>
        </SortableContext>
      </DndContext>
    </div>
  );
}
