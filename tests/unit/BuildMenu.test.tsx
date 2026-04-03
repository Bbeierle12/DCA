import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import BuildMenu from '../../components/BuildMenu';

describe('BuildMenu', () => {
  const defaultProps = {
    selected: 'wood',
    onSelect: vi.fn(),
    level: 0,
    onLevelToggle: vi.fn(),
    onHover: vi.fn(),
  };

  it('renders build mode header', () => {
    render(<BuildMenu {...defaultProps} />);
    expect(screen.getByText('Build Mode')).toBeInTheDocument();
  });

  it('renders build item buttons', () => {
    render(<BuildMenu {...defaultProps} />);
    // Items are emoji buttons, check that we have 8 (wood, stone, floor, stairs, flower, table, bed, delete)
    const buttons = screen.getAllByRole('button');
    // Level toggle + 8 build items = 9 buttons
    expect(buttons.length).toBeGreaterThanOrEqual(8);
  });

  it('highlights the selected item with yellow border', () => {
    const { container } = render(<BuildMenu {...defaultProps} selected="wood" />);
    const yellowBorder = container.querySelector('.border-yellow-400');
    expect(yellowBorder).not.toBeNull();
  });

  it('calls onSelect when an item button is clicked', async () => {
    const onSelect = vi.fn();
    render(<BuildMenu {...defaultProps} onSelect={onSelect} />);
    // Get all item buttons (skip the level toggle which has "Level:" text)
    const buttons = screen.getAllByRole('button').filter(
      btn => !btn.textContent?.includes('Level')
    );
    await userEvent.click(buttons[1]); // Click second item (stone)
    expect(onSelect).toHaveBeenCalled();
  });

  it('shows level toggle with current level', () => {
    render(<BuildMenu {...defaultProps} level={0} />);
    expect(screen.getByText(/Level/)).toBeInTheDocument();
  });

  it('calls onLevelToggle when level button clicked', async () => {
    const onLevelToggle = vi.fn();
    render(<BuildMenu {...defaultProps} onLevelToggle={onLevelToggle} />);
    const levelButton = screen.getByText(/Level/);
    await userEvent.click(levelButton);
    expect(onLevelToggle).toHaveBeenCalledTimes(1);
  });
});
