import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import Joystick from '../../components/Joystick';

describe('Joystick', () => {
  it('reports a clamped vector while dragged and zero on release', () => {
    const onChange = vi.fn();
    render(<Joystick onChange={onChange} radius={50} />);
    const stick = screen.getByTestId('joystick');
    fireEvent.pointerDown(stick, { pointerId: 1, clientX: 25, clientY: 0 });
    let [x, y] = onChange.mock.calls.at(-1)!;
    expect(x).toBeCloseTo(0.5, 5);
    expect(y).toBeCloseTo(0, 5);
    fireEvent.pointerMove(stick, { pointerId: 1, clientX: 0, clientY: -500 });
    [x, y] = onChange.mock.calls.at(-1)!;
    expect(x).toBeCloseTo(0, 5);
    expect(y).toBeCloseTo(-1, 5);
    fireEvent.pointerMove(stick, { pointerId: 2, clientX: 50, clientY: 0 });
    expect(onChange.mock.calls.at(-1)).toEqual([x, y]);
    fireEvent.pointerUp(stick, { pointerId: 1 });
    expect(onChange.mock.calls.at(-1)).toEqual([0, 0]);
  });
});
