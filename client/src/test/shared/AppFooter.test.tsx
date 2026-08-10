import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import packageJson from '../../../package.json' with { type: 'json' };
import { AppFooter } from '@/shared/AppFooter.tsx';

afterEach(() => {
  cleanup();
  document.documentElement.dataset.theme = 'gunrock';
  localStorage.clear();
});

describe('AppFooter', () => {
  it('shows the version below the footer links without changing their layout', () => {
    render(<AppFooter />);

    const helpLink = screen.getByRole('link', { name: 'Help' });
    const version = screen.getByLabelText(
      `Application version ${packageJson.version}`
    );

    expect(version).toHaveTextContent(`v${packageJson.version}`);
    expect(version).toHaveClass('absolute', 'top-full');
    expect(version.parentElement).toHaveClass('relative');
    expect(helpLink.compareDocumentPosition(version)).toBe(
      Node.DOCUMENT_POSITION_FOLLOWING
    );
  });

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
