import { screen } from '@testing-library/react';
import { http, HttpResponse } from 'msw';
import { describe, expect, it } from 'vitest';
import { server } from '@/test/mswUtils.ts';
import { renderRoute } from '@/test/routerUtils.tsx';

const testBannerText =
  'TEST TEST TEST -- You are on the test site, data returned may be incorrect! -- TEST TEST TEST';

const currentUser = {
  email: 'signed-in@example.com',
  id: 'user-1',
  name: 'Taylor',
  roles: [],
};

describe('test environment banner', () => {
  it('renders the banner when app-info explicitly identifies the test site', async () => {
    server.use(
      http.get('/api/user/me', () => HttpResponse.json(currentUser)),
      http.get('/api/app-info', () =>
        HttpResponse.json({ isTest: true, provider: 'Rosetta' })
      ),
      http.get('/api/peoplelookup/options', () =>
        HttpResponse.json({ allowSensitiveInfo: false })
      )
    );

    const { cleanup } = renderRoute({ initialPath: '/' });

    try {
      const banner = await screen.findByRole('alert');
      expect(banner).toHaveTextContent(testBannerText);
      expect(banner).toHaveClass('bg-red-700', 'text-center', 'text-white');
    } finally {
      cleanup();
    }
  });

  it.each([undefined, null, false])(
    'does not render the banner when the environment flag is %s',
    async (isTest) => {
      const appInfo =
        isTest === undefined
          ? { provider: 'Rosetta' }
          : { isTest, provider: 'Rosetta' };

      server.use(
        http.get('/api/user/me', () => HttpResponse.json(currentUser)),
        http.get('/api/app-info', () => HttpResponse.json(appInfo)),
        http.get('/api/peoplelookup/options', () =>
          HttpResponse.json({ allowSensitiveInfo: false })
        )
      );

      const { cleanup } = renderRoute({ initialPath: '/' });

      try {
        await screen.findByText('Rosetta');
        expect(screen.queryByRole('alert')).not.toBeInTheDocument();
      } finally {
        cleanup();
      }
    }
  );
});
