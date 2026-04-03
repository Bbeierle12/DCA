import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import PetStoreModal from '../../components/PetStoreModal';

describe('PetStoreModal', () => {
  it('renders pet store header', () => {
    render(<PetStoreModal onClose={vi.fn()} onBuy={vi.fn()} />);
    expect(screen.getByText('PET STORE')).toBeInTheDocument();
  });

  it('renders pet options with names', () => {
    render(<PetStoreModal onClose={vi.fn()} onBuy={vi.fn()} />);
    expect(screen.getByText('Dog')).toBeInTheDocument();
    expect(screen.getByText('Cat')).toBeInTheDocument();
    expect(screen.getByText('Horse')).toBeInTheDocument();
  });

  it('shows pet costs', () => {
    render(<PetStoreModal onClose={vi.fn()} onBuy={vi.fn()} />);
    // Dog and Cat cost 10, Horse costs 25 (text includes 💰 emoji in same span)
    const tens = screen.getAllByText(/10/);
    expect(tens.length).toBeGreaterThanOrEqual(2);
    expect(screen.getByText(/25/)).toBeInTheDocument();
  });

  it('calls onBuy when a pet button is clicked', async () => {
    const onBuy = vi.fn();
    render(<PetStoreModal onClose={vi.fn()} onBuy={onBuy} />);
    // Pet buttons contain the pet name text; click the Dog button
    const dogButton = screen.getByText('Dog').closest('button')!;
    await userEvent.click(dogButton);
    expect(onBuy).toHaveBeenCalledWith('dog', 10);
  });

  it('calls onClose when close button clicked', async () => {
    const onClose = vi.fn();
    render(<PetStoreModal onClose={onClose} onBuy={vi.fn()} />);
    // Close button has ✖ text
    const closeButton = screen.getByText('✖');
    await userEvent.click(closeButton);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('has a no-pet option', () => {
    render(<PetStoreModal onClose={vi.fn()} onBuy={vi.fn()} />);
    expect(screen.getByText(/No Pet/)).toBeInTheDocument();
  });
});
