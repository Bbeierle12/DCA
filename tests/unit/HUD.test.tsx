import React from 'react';
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import HUD from '../../components/HUD';
import { GameState } from '../../types';

function makeGameState(overrides: Partial<GameState> = {}): GameState {
  return {
    money: 100,
    energy: 80,
    zone: 'City Center',
    level: 0,
    isBuilding: false,
    buildItem: 'wood',
    showMobileControls: false,
    alwaysRun: false,
    health: 100,
    maxHealth: 100,
    weapon: null,
    isDead: false,
    invertYCamera: false,
    cameraSensitivity: 1.0,
    cameraRelativeMovement: true,
    renderDistance: 500,
    shadowQuality: 'medium',
    showOtherPlayers: true,
    masterVolume: 80,
    musicVolume: 60,
    sfxVolume: 70,
    showDamageNumbers: true,
    showTooltips: true,
    ...overrides,
  };
}

describe('HUD', () => {
  it('displays money amount', () => {
    render(<HUD state={makeGameState({ money: 250 })} />);
    expect(screen.getByText(/250/)).toBeInTheDocument();
  });

  it('displays zone name', () => {
    render(<HUD state={makeGameState({ zone: 'Home Lot' })} />);
    expect(screen.getByText(/Home Lot/)).toBeInTheDocument();
  });

  it('displays weapon when equipped', () => {
    render(<HUD state={makeGameState({ weapon: 'sword' })} />);
    expect(screen.getByText(/sword/i)).toBeInTheDocument();
  });

  it('shows health bar', () => {
    render(<HUD state={makeGameState({ health: 50, maxHealth: 100 })} />);
    // Health should be displayed somewhere
    expect(screen.getByText(/50/)).toBeInTheDocument();
  });
});
