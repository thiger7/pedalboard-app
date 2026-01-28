import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createElement } from 'react';
import { describe, expect, it, vi } from 'vitest';
import type { Effect } from '../types/effects';
import { EffectorBoard } from './EffectorBoard';

// @dnd-kit のモック
vi.mock('@dnd-kit/core', () => ({
  DndContext: ({ children }: { children: React.ReactNode }) => children,
  closestCenter: vi.fn(),
  KeyboardSensor: vi.fn(),
  PointerSensor: vi.fn(),
  useSensor: vi.fn(),
  useSensors: vi.fn(() => []),
}));

vi.mock('@dnd-kit/sortable', () => ({
  SortableContext: ({ children }: { children: React.ReactNode }) => children,
  arrayMove: vi.fn((arr, from, to) => {
    const result = [...arr];
    const [removed] = result.splice(from, 1);
    result.splice(to, 0, removed);
    return result;
  }),
  horizontalListSortingStrategy: vi.fn(),
  sortableKeyboardCoordinates: vi.fn(),
  useSortable: vi.fn(() => ({
    attributes: {},
    listeners: {},
    setNodeRef: vi.fn(),
    transform: null,
    transition: null,
    isDragging: false,
  })),
}));

vi.mock('@dnd-kit/utilities', () => ({
  CSS: {
    Transform: {
      toString: vi.fn(() => null),
    },
  },
}));

const createMockEffects = (): Effect[] => [
  {
    id: 'chorus-1',
    name: 'Chorus',
    image: '/images/chorus.png',
    enabled: true,
    params: {},
    defaultParams: {},
  },
  {
    id: 'delay-1',
    name: 'Delay',
    image: '/images/delay.png',
    enabled: false,
    params: {},
    defaultParams: {},
  },
  {
    id: 'reverb-1',
    name: 'Reverb',
    image: '/images/reverb.png',
    enabled: true,
    params: {},
    defaultParams: {},
  },
];

describe('EffectorBoard', () => {
  it('Effect Chain ヘッダーを表示する', () => {
    render(
      createElement(EffectorBoard, {
        effects: createMockEffects(),
        onEffectsChange: vi.fn(),
      }),
    );
    expect(screen.getByText('Effect Chain')).toBeInTheDocument();
  });

  it('ヒントテキストを表示する', () => {
    render(
      createElement(EffectorBoard, {
        effects: createMockEffects(),
        onEffectsChange: vi.fn(),
      }),
    );
    expect(
      screen.getByText('Drag to reorder. Toggle ON/OFF to enable effects.'),
    ).toBeInTheDocument();
  });

  it('有効なエフェクトの数を表示する（複数形）', () => {
    render(
      createElement(EffectorBoard, {
        effects: createMockEffects(), // 2個が有効
        onEffectsChange: vi.fn(),
      }),
    );
    expect(screen.getByText('2 effects enabled')).toBeInTheDocument();
  });

  it('有効なエフェクトが1つの場合は単数形', () => {
    const effects = createMockEffects().map((e, i) => ({
      ...e,
      enabled: i === 0,
    }));
    render(
      createElement(EffectorBoard, {
        effects,
        onEffectsChange: vi.fn(),
      }),
    );
    expect(screen.getByText('1 effect enabled')).toBeInTheDocument();
  });

  it('有効なエフェクトが0の場合', () => {
    const effects = createMockEffects().map((e) => ({ ...e, enabled: false }));
    render(
      createElement(EffectorBoard, {
        effects,
        onEffectsChange: vi.fn(),
      }),
    );
    expect(screen.getByText('0 effects enabled')).toBeInTheDocument();
  });

  it('すべてのエフェクトカードを表示する', () => {
    render(
      createElement(EffectorBoard, {
        effects: createMockEffects(),
        onEffectsChange: vi.fn(),
      }),
    );
    expect(screen.getByText('Chorus')).toBeInTheDocument();
    expect(screen.getByText('Delay')).toBeInTheDocument();
    expect(screen.getByText('Reverb')).toBeInTheDocument();
  });

  it('トグルクリック時に onEffectsChange が呼ばれる', async () => {
    const user = userEvent.setup();
    const onEffectsChange = vi.fn();
    const effects = createMockEffects();

    render(
      createElement(EffectorBoard, {
        effects,
        onEffectsChange,
      }),
    );

    const checkboxes = screen.getAllByRole('checkbox');
    await user.click(checkboxes[0]); // Chorus をクリック

    expect(onEffectsChange).toHaveBeenCalled();
    const newEffects = onEffectsChange.mock.calls[0][0];
    expect(newEffects[0].enabled).toBe(false); // Chorus が無効になる
  });
});
