import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import { AppFooter } from '@/shared/AppFooter.tsx';

afterEach(() => {
  cleanup();
  document.documentElement.dataset.theme = 'gunrock';
  localStorage.clear();
});

describe('AppFooter theme toggle', () => {
  it('switches themes and persists each explicit choice', async () => {
    const user = userEvent.setup();
    document.documentElement.dataset.theme = 'gunrock';

    render(<AppFooter />);

    await user.click(
      screen.getByRole('button', { name: 'Switch to dark mode' })
    );

    expect(document.documentElement).toHaveAttribute('data-theme', 'who-dark');
    expect(localStorage.getItem('who-color-theme')).toBe('dark');

    await user.click(
      screen.getByRole('button', { name: 'Switch to light mode' })
    );

    expect(document.documentElement).toHaveAttribute('data-theme', 'gunrock');
    expect(localStorage.getItem('who-color-theme')).toBe('light');
  });

  it('reflects a dark theme restored before React renders', () => {
    document.documentElement.dataset.theme = 'who-dark';

    render(<AppFooter />);

    expect(
      screen.getByRole('button', { name: 'Switch to light mode' })
    ).toBeInTheDocument();
  });
});
