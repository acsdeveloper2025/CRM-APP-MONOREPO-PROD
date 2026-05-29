import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Button } from './button';

describe('Button', () => {
  it('renders a button with its label', () => {
    render(<Button>Save</Button>);
    expect(screen.getByRole('button', { name: 'Save' })).toBeInTheDocument();
  });

  it('fires onClick when clicked', async () => {
    const onClick = vi.fn();
    render(<Button onClick={onClick}>Go</Button>);
    await userEvent.click(screen.getByRole('button', { name: 'Go' }));
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it('does not fire onClick when disabled', async () => {
    const onClick = vi.fn();
    render(
      <Button onClick={onClick} disabled>
        Nope
      </Button>
    );
    const btn = screen.getByRole('button', { name: 'Nope' });
    expect(btn).toBeDisabled();
    await userEvent.click(btn);
    expect(onClick).not.toHaveBeenCalled();
  });

  it('renders as a child element when asChild is set (Slot)', () => {
    render(
      <Button asChild>
        <a href="/x">Link</a>
      </Button>
    );
    const link = screen.getByRole('link', { name: 'Link' });
    expect(link).toBeInTheDocument();
    expect(link).toHaveAttribute('href', '/x');
  });

  it('merges a custom className', () => {
    render(<Button className="my-cls">C</Button>);
    expect(screen.getByRole('button', { name: 'C' })).toHaveClass('my-cls');
  });
});
