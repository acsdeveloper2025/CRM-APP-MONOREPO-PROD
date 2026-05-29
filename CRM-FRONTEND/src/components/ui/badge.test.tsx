/**
 * First React Testing Library component test — establishes the RTL +
 * jest-dom + happy-dom scaffolding for the FE component slice (§7 #6).
 * Badge is a minimal presentational component (cn + cva variants), so it
 * proves the render harness without provider mocking.
 */
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { Badge } from './badge';

describe('Badge', () => {
  it('renders its children', () => {
    render(<Badge>Active</Badge>);
    expect(screen.getByText('Active')).toBeInTheDocument();
  });

  it('applies the default variant classes', () => {
    render(<Badge>Default</Badge>);
    const el = screen.getByText('Default');
    // cva base class is always present
    expect(el.className).toContain('rounded-full');
  });

  it('merges a custom className', () => {
    render(<Badge className="custom-xyz">Tagged</Badge>);
    expect(screen.getByText('Tagged')).toHaveClass('custom-xyz');
  });

  it('forwards arbitrary DOM props', () => {
    render(<Badge data-testid="b1">X</Badge>);
    expect(screen.getByTestId('b1')).toBeInTheDocument();
  });
});
