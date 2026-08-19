import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';
import { afterAll, afterEach, beforeAll } from 'vitest';

// Create a shared MSW server instance that can be used across all tests
export const server = setupServer(
  http.get('/api/app-info', () => HttpResponse.json({ provider: 'Rosetta' }))
);

// Global setup for MSW server
// This will be automatically called when imported in test files
beforeAll(() => {
  server.listen({ onUnhandledRequest: 'error' });
});

afterEach(() => {
  server.resetHandlers();
});

afterAll(() => {
  server.close();
});
