import { createRootRouteWithContext, Outlet } from '@tanstack/react-router';
import { useQuery } from '@tanstack/react-query';
import { ReactQueryDevtools } from '@tanstack/react-query-devtools';
import { TanStackRouterDevtools } from '@tanstack/react-router-devtools';
import { RouterContext } from '../main.tsx';
import { fetchJson } from '@/lib/api.ts';
import { AnalyticsListener } from '@/shared/analytics/AnalyticsListener.tsx';
import { AppFooter } from '@/shared/AppFooter.tsx';

type AppInfo = {
  isTest?: boolean | null;
};

const testBannerText =
  'TEST TEST TEST -- You are on the test site, data returned may be incorrect! -- TEST TEST TEST';

const RootLayout = () => {
  const { data: appInfo } = useQuery({
    queryFn: ({ signal }) => fetchJson<AppInfo>('/api/app-info', {}, signal),
    queryKey: ['app-info'],
    staleTime: Infinity,
  });

  return (
    <div className="flex min-h-dvh flex-col">
      {appInfo?.isTest === true && (
        <div
          className="bg-red-700 px-4 py-2 text-center font-bold tracking-wide text-white"
          role="alert"
        >
          {testBannerText}
        </div>
      )}
      <AnalyticsListener />
      <main className="flex-1">
        <Outlet />
      </main>
      <AppFooter />
      <ReactQueryDevtools buttonPosition="top-right" />
      <TanStackRouterDevtools position="bottom-right" />
    </div>
  );
};

export const Route = createRootRouteWithContext<RouterContext>()({
  component: RootLayout,
  notFoundComponent: () => <div>404 - Not Found!</div>,
});
