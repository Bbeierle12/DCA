import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import CharacterCreator from '../../components/CharacterCreator';
import { GameConfig } from '../../types';

function makeConfig(overrides: Partial<GameConfig> = {}): GameConfig {
  return {
    skin: '#f5d0a9',
    hair: '#4a3728',
    eyes: '#3498db',
    shirt: '#e74c3c',
    pants: '#2c3e50',
    name: 'Player',
    pet: null,
    ...overrides,
  };
}

describe('CharacterCreator', () => {
  it('renders character customization UI', () => {
    const config = makeConfig();
    render(<CharacterCreator config={config} setConfig={vi.fn()} onFinish={vi.fn()} />);
    // Should have a name input
    expect(screen.getByDisplayValue('Player')).toBeInTheDocument();
  });

  it('allows name input', async () => {
    const config = makeConfig({ name: '' });
    const setConfig = vi.fn();
    render(<CharacterCreator config={config} setConfig={setConfig} onFinish={vi.fn()} />);
    const nameInput = screen.getByRole('textbox');
    await userEvent.type(nameInput, 'TestName');
    expect(setConfig).toHaveBeenCalled();
  });

  it('has a finish/play button', () => {
    render(<CharacterCreator config={makeConfig()} setConfig={vi.fn()} onFinish={vi.fn()} />);
    const button = screen.getByRole('button', { name: /play|start|finish|enter|go/i });
    expect(button).toBeInTheDocument();
  });

  it('calls onFinish when play button clicked', async () => {
    const onFinish = vi.fn();
    render(<CharacterCreator config={makeConfig()} setConfig={vi.fn()} onFinish={onFinish} />);
    const button = screen.getByRole('button', { name: /play|start|finish|enter|go/i });
    await userEvent.click(button);
    expect(onFinish).toHaveBeenCalledTimes(1);
  });
});
