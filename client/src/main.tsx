import { StrictMode } from 'react';
import ReactDOM from 'react-dom/client';
import {
  RouterProvider,
  createRouter,
  type ParsedLocation,
} from '@tanstack/react-router';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import './main.css';

// Import the generated route tree
import { routeTree } from './routeTree.gen.ts';

const queryClient = new QueryClient();

export type RouterContext = { queryClient: QueryClient };

// Create a new router instance
const router = createRouter({
  caseSensitive: false,
  context: { queryClient },
  defaultPreload: 'intent',
  routeTree,
  // Since we're using React Query, we don't want loader calls to ever be stale
  // This will ensure that the loader is always called when the route is preloaded or visited
  defaultPreloadStaleTime: 0,
  // Keep the browser's autofocus scroll when the lookup field is below the fold.
  scrollRestoration: ({ location }: { location: ParsedLocation }) =>
    location.pathname !== '/' ||
    Boolean(location.hash) ||
    document.activeElement?.id !== 'single-user-lookup',
});

// Register the router instance for type safety
declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router;
  }
}

// Render the app
const rootElement = document.getElementById('root')!;
if (!rootElement.innerHTML) {
  const root = ReactDOM.createRoot(rootElement);
  root.render(
    <StrictMode>
      <QueryClientProvider client={queryClient}>
        <RouterProvider router={router} />
      </QueryClientProvider>
    </StrictMode>
  );
}
