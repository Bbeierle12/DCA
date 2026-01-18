import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import MainMenu from '../../components/MainMenu';

describe('MainMenu', () => {
  it('disables start button while loading', () => {
    render(<MainMenu onStart={() => {}} isReady={false} />);
    const button = screen.getByRole('button', { name: /loading/i });
    expect(button).toBeDisabled();
  });

  it('calls onStart when ready and clicked', async () => {
    const onStart = vi.fn();
    render(<MainMenu onStart={onStart} isReady />);
    const button = screen.getByRole('button', { name: /start game/i });
    await userEvent.click(button);
    expect(onStart).toHaveBeenCalledTimes(1);
  });
});
