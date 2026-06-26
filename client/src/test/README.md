# TanStack Router Test Organization

## ✅ Correct Structure

```
src/
├── routes/                           # Only actual route files
│   ├── __root.tsx
│   ├── index.tsx
│   ├── about.tsx
│   └── (authenticated)/
│       └── dashboard.tsx             # Route component
├── test/
│   ├── setup.ts                      # Global test setup
│   ├── routerUtils.tsx               # Router testing utilities
│   ├── mswUtils.ts                   # MSW testing utilities
│   └── routes/                       # Mirror route structure for tests
│       ├── index.test.tsx
│       ├── about.test.tsx
│       └── (authenticated)/
│           └── dashboard.test.tsx    # ✅ Test for dashboard route
```

## Why This Matters

- TanStack Router's file-based routing treats everything in `src/routes/` as potential route files
- Test files in the routes directory cause "does not contain any route piece" errors
- The correct pattern mirrors the route structure in a separate `test/routes/` directory
- This keeps route discovery clean and follows TanStack Router best practices

## Running Tests

```bash
# Run all tests
npm test

# Run specific test file
npm test -- notification.test

```
