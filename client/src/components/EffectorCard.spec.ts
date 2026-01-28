import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createElement } from 'react';
import { describe, expect, it, vi } from 'vitest';
import type { Effect } from '../types/effects';
import { EffectorCard } from './EffectorCard';

// @dnd-kit/sortable のモック
vi.mock('@dnd-kit/sortable', () => ({
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

const createMockEffect = (overrides?: Partial<Effect>): Effect => ({
  id: 'chorus-1',
  name: 'Chorus',
  image: '/images/chorus.png',
  enabled: true,
  params: { rate_hz: 1.0, depth: 0.5 },
  defaultParams: { rate_hz: 1.0, depth: 0.5 },
  ...overrides,
});

describe('EffectorCard', () => {
  it('エフェクト名を表示する', () => {
    render(
      createElement(EffectorCard, {
        effect: createMockEffect({ name: 'Distortion' }),
        onToggle: vi.fn(),
      }),
    );
    expect(screen.getByText('Distortion')).toBeInTheDocument();
  });

  it('エフェクト画像を表示する', () => {
    render(
      createElement(EffectorCard, {
        effect: createMockEffect({
          image: '/images/reverb.png',
          name: 'Reverb',
        }),
        onToggle: vi.fn(),
      }),
    );
    const img = screen.getByRole('img', { name: 'Reverb' });
    expect(img).toHaveAttribute('src', '/images/reverb.png');
  });

  it('有効時は ON を表示する', () => {
    render(
      createElement(EffectorCard, {
        effect: createMockEffect({ enabled: true }),
        onToggle: vi.fn(),
      }),
    );
    expect(screen.getByText('ON')).toBeInTheDocument();
  });

  it('無効時は OFF を表示する', () => {
    render(
      createElement(EffectorCard, {
        effect: createMockEffect({ enabled: false }),
        onToggle: vi.fn(),
      }),
    );
    expect(screen.getByText('OFF')).toBeInTheDocument();
  });

  it('チェックボックスをクリックすると onToggle が呼ばれる', async () => {
    const user = userEvent.setup();
    const onToggle = vi.fn();
    const effect = createMockEffect({ id: 'delay-1' });

    render(
      createElement(EffectorCard, {
        effect,
        onToggle,
      }),
    );

    await user.click(screen.getByRole('checkbox'));
    expect(onToggle).toHaveBeenCalledWith('delay-1');
  });

  it('有効時は enabled クラスを持つ', () => {
    const { container } = render(
      createElement(EffectorCard, {
        effect: createMockEffect({ enabled: true }),
        onToggle: vi.fn(),
      }),
    );
    expect(
      container.querySelector('.effector-card.enabled'),
    ).toBeInTheDocument();
  });

  it('無効時は disabled クラスを持つ', () => {
    const { container } = render(
      createElement(EffectorCard, {
        effect: createMockEffect({ enabled: false }),
        onToggle: vi.fn(),
      }),
    );
    expect(
      container.querySelector('.effector-card.disabled'),
    ).toBeInTheDocument();
  });
});
