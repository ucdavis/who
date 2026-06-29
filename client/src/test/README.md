# TanStack Router Test Organization

Keep route tests outside `src/routes/`. TanStack Router treats files under `src/routes/` as route candidates, so tests should mirror the route structure under `src/test/routes/` instead.

## Running Tests

```bash
npm test
```