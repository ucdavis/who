import { afterEach, describe, expect, it } from 'vitest';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, render, screen } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import packageJson from '../../../package.json' with { type: 'json' };
import { AppFooter } from '@/shared/AppFooter.tsx';
import { server } from '@/test/mswUtils.ts';

const renderFooter = (provider: 'Rosetta' | 'IAM' = 'Rosetta') => {
  server.use(
    http.get('/api/app-info', () => HttpResponse.json({ provider }))
  );

  return render(
    <QueryClientProvider client={new QueryClient()}>
      <AppFooter />
    </QueryClientProvider>
  );
};

afterEach(() => {
  cleanup();
  document.documentElement.dataset.theme = 'gunrock';
  localStorage.clear();
});

describe('AppFooter', () => {
  it('centers the wordmark and shows the version below the footer links', () => {
    renderFooter();

    const wordmarkLink = screen.getByRole('link', {
      name: 'UC Davis wordmark',
    });
    const helpLink = screen.getByRole('link', { name: 'Help' });
    const version = screen.getByLabelText(
      `Application version ${packageJson.version}`
    );

    expect(wordmarkLink).toHaveClass('self-center');
    expect(version).toHaveTextContent(`v${packageJson.version}`);
    expect(version).toHaveClass('absolute', 'top-full');
    expect(version.parentElement).toHaveClass('relative');
    expect(helpLink.compareDocumentPosition(version)).toBe(
      Node.DOCUMENT_POSITION_FOLLOWING
    );
  });

  it.each(['Rosetta', 'IAM'] as const)(
    'shows %s as the configured identity provider before Help',
    async (provider) => {
      renderFooter(provider);

      const providerBadge = await screen.findByText(provider);
      const helpLink = screen.getByRole('link', { name: 'Help' });

      expect(screen.getByText('powered by')).toBeInTheDocument();
      expect(providerBadge).toHaveClass(
        'badge',
        'badge-primary',
        'badge-soft',
        'badge-sm'
      );
      expect(providerBadge.compareDocumentPosition(helpLink)).toBe(
        Node.DOCUMENT_POSITION_FOLLOWING
      );
    }
  );

  it('switches themes and persists each explicit choice', async () => {
    const user = userEvent.setup();
    document.documentElement.dataset.theme = 'gunrock';

    renderFooter();

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

    renderFooter();

    expect(
      screen.getByRole('button', { name: 'Switch to light mode' })
    ).toBeInTheDocument();
  });
});
