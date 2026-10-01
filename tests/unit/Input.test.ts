import { describe, it, expect, vi } from 'vitest';
import { Input, isTypingTarget } from '../../services/game/Input';

function key(type: 'keydown' | 'keyup', code: string, extra: Partial<KeyboardEventInit> = {}, target?: EventTarget) {
  const e = new KeyboardEvent(type, { code, key: code, bubbles: true, ...extra });
  if (target) Object.defineProperty(e, 'target', { value: target });
  return e;
}

describe('Input', () => {
  it('Shift never leaves a movement key stuck', () => {
    const input = new Input();
    input.handleKeyDown(key('keydown', 'KeyW'));
    input.handleKeyDown(key('keydown', 'ShiftLeft', { shiftKey: true }));
    // The browser reports key 'W' (capital) on release while Shift is held; code stays KeyW.
    input.handleKeyUp(key('keyup', 'KeyW', { shiftKey: true, key: 'W' }));
    input.handleKeyUp(key('keyup', 'ShiftLeft'));
    expect(input.moveAxis()).toEqual({ x: 0, y: 0, analog: false });
    expect(input.running).toBe(false);
  });

  it('reports running while Shift is held', () => {
    const input = new Input();
    input.handleKeyDown(key('keydown', 'ShiftRight'));
    expect(input.running).toBe(true);
  });

  it('normalises diagonal keyboard movement', () => {
    const input = new Input();
    input.handleKeyDown(key('keydown', 'KeyW'));
    input.handleKeyDown(key('keydown', 'KeyD'));
    const a = input.moveAxis();
    expect(Math.hypot(a.x, a.y)).toBeCloseTo(1, 5);
    expect(a.y).toBeLessThan(0);
    expect(a.x).toBeGreaterThan(0);
  });

  it('clears everything on window blur', () => {
    const input = new Input();
    input.attach(window);
    window.dispatchEvent(key('keydown', 'KeyA'));
    expect(input.isDown('KeyA')).toBe(true);
    window.dispatchEvent(new Event('blur'));
    expect(input.isDown('KeyA')).toBe(false);
    input.detach();
    window.dispatchEvent(key('keydown', 'KeyA'));
    expect(input.isDown('KeyA')).toBe(false);
  });

  it('ignores keys typed into text fields', () => {
    const input = new Input();
    const field = document.createElement('input');
    input.handleKeyDown(key('keydown', 'KeyW', {}, field));
    expect(input.isDown('KeyW')).toBe(false);
    expect(isTypingTarget(field)).toBe(true);
    expect(isTypingTarget(document.createElement('div'))).toBe(false);
    expect(isTypingTarget(null)).toBe(false);
  });

  it('fires actions once per press, not on auto-repeat', () => {
    const input = new Input();
    const action = vi.fn();
    input.onAction(action);
    input.handleKeyDown(key('keydown', 'KeyJ'));
    input.handleKeyDown(key('keydown', 'KeyJ', { repeat: true }));
    input.handleKeyUp(key('keyup', 'KeyJ'));
    input.handleKeyDown(key('keydown', 'KeyJ'));
    expect(action).toHaveBeenCalledTimes(2);
    expect(action.mock.calls[0][0]).toBe('KeyJ');
  });

  it('analog input wins over keys and is clamped to length 1', () => {
    const input = new Input();
    input.handleKeyDown(key('keydown', 'KeyW'));
    input.setAnalog(3, 4);
    const a = input.moveAxis();
    expect(a.analog).toBe(true);
    expect(a.x).toBeCloseTo(0.6, 5);
    expect(a.y).toBeCloseTo(0.8, 5);
    input.setAnalog(0, 0);
    expect(input.moveAxis().y).toBe(-1);
  });

  it('virtual buttons press and release codes', () => {
    const input = new Input();
    input.setVirtual('ArrowLeft', true);
    expect(input.moveAxis().x).toBe(-1);
    input.setVirtual('ArrowLeft', false);
    expect(input.moveAxis().x).toBe(0);
  });
});
