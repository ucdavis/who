# Web App Template

A full-stack web application template featuring a .NET 10 backend with React/Vite frontend, using OIDC authentication with Microsoft Entra ID.

## Architecture

- **Backend**: .NET 10 Web API with ASP.NET Core
- **Frontend**: React 19 with Vite, TypeScript, and TanStack Router/Query/Table
- **Authentication**: OIDC with Microsoft Entra ID (Azure AD)
- **Styling**: Tailwind CSS
- **Development**: Hot reload for both frontend and backend
- **Development Integration**: ASP.NET Core `SpaProxy` launches Vite for Visual Studio users, while Vite proxies API and auth routes back to ASP.NET Core during development

## Quick Start

1. **Clone the repository**

   ```bash
   git clone https://github.com/ucdavis/web-app-template/
   cd web-app-template
   ```

2. **Open In DevContainer**

   - Open the project folder in Visual Studio Code.
   - Click the prompt to open in container (or manually select from the command palette).

_Using the DevContainer is optional, but it will get you the right version of dotnet + node, and install all dependencies for you_

3. **Start the application**

   **Inside DevContainer**: The application starts automatically via `postStartCommand` — no manual steps required.

   **Outside DevContainer (command line)**:

   Prerequisites:
   - [.NET 10 SDK](https://dotnet.microsoft.com/download)
   - [Node.js 22+](https://nodejs.org/) (includes npm)

   Install dependencies and start the app:
   ```bash
   npm install
   cd client && npm install && cd ..
   npm start
   ```

   `npm start` starts the .NET backend on port `5165` with a CLI-specific launch profile, waits for health check, and then starts the Vite dev server on port `5173` which opens the browser.

   **Visual Studio (Windows)**:

   Prerequisites:
   - Visual Studio 2026 version 18.0 or later (for `net10.0` support)
   - [Node.js 22+](https://nodejs.org/) (includes npm)

   Install dependencies:
   ```bash
   npm install
   cd client && npm install && cd ..
   ```

   Then open `app.sln`, set the `server` project as the startup project, and press `F5`. `SpaProxy` starts Vite if needed and redirects the browser to the frontend dev server.

   **Visual Studio Code**:

   Prerequisites:
   - [.NET 10 SDK](https://dotnet.microsoft.com/download)
   - [Node.js 22+](https://nodejs.org/) (includes npm)

   Install dependencies:
   ```bash
   npm install
   cd client && npm install && cd ..
   ```

   Then open the repo root in VS Code, install the recommended extensions when prompted (at minimum the Microsoft C# extension), choose `Full Stack: VS Code` in **Run and Debug**, and press `F5`. VS Code builds and launches the backend with the `http-cli` launch profile, starts Vite after the backend health check passes, and opens the app in your default external browser at `http://localhost:5173`. For backend-only debugging, choose `Backend: ASP.NET Core + Swagger`.

4. **Access the application**

In development, the frontend runs from **http://localhost:5173** and proxies backend requests to ASP.NET Core on **http://localhost:5165**.

- **Main App**: http://localhost:5173
- **Backend API**: http://localhost:5165/api/*
- **API Documentation (Swagger)**: http://localhost:5165/swagger
- **Health Check**: http://localhost:5165/health
- **Visual Studio F5**: launches through the backend profile, then redirects to the Vite dev server on `:5173`

### Auth Configuration

The app uses OIDC with Microsoft Entra ID (Azure AD). The default settings in `appsettings.*.json` are enough for local template development.

For a new application registration, redirect URIs, and app-specific auth settings, follow [the customization guide](README.customization.md#3-microsoft-entra-id-azure-ad-setup).

### Google Analytics (GA4)

This template includes GA4 wiring:

- GA bootstrap script is in `client/index.html`
- Route-change page view tracking is in `client/src/shared/analytics/AnalyticsListener.tsx`

A placeholder measurement ID is included by default:

- `G-XXXXXXXXXX`

Before using this template in a real app, replace `G-XXXXXXXXXX` in `client/index.html` with your real GA4 measurement ID in **both** places:

1. `https://www.googletagmanager.com/gtag/js?id=...`
2. `gtag('config', '...')`

### Health check

The health check endpoint (`/health`) is configured to return the status of the application.

## Azure Deployment

The template includes generic Azure App Service deployment scaffolding in `infrastructure/azure/` and GitHub Actions workflows in `.github/workflows/`.

Cloud deployments are intentionally limited to `test` and `prod`. Before the first cloud deployment, replace placeholder names such as `webapp`, `rg-webapp-test`, and `rg-webapp-prod` with names for your application.

For GitHub Environments, the one-time OIDC bootstrap, required variables/secrets, local deploy scripts, and first-deploy caveats, see [Azure Deployment Setup](README.customization.md#5-azure-deployment-setup). For the hosting flow and key deployment files, see [Development Architecture](docs/ARCHITECTURE.md#azure-hosting-flow).

## Development

### Development Architecture

In development, ASP.NET Core runs on port `5165`, Vite serves the frontend on port `5173`, and Vite proxies backend routes to ASP.NET Core. Visual Studio uses `SpaProxy` to start Vite and redirect the browser to it.

For request-flow diagrams, production behavior, and key file responsibilities, see [Development Architecture](docs/ARCHITECTURE.md).

### Backend Development

The backend is configured with hot reload via `dotnet watch`. Any changes to C# files automatically restart the server. Visual Studio users can also run the `server` project directly with `SpaProxy`.

### Frontend Development

The frontend uses Vite's hot module replacement (HMR). Changes to React components, TypeScript files, and CSS are reflected immediately by the Vite dev server.

### VS Code Debugging

The repository includes `.vscode/launch.json` and `.vscode/tasks.json` so the standard VS Code workflow works out of the box:

- `Full Stack: VS Code` launches the backend debugger, starts the Vite dev server, and opens the frontend in your default external browser.
- `Backend: ASP.NET Core + Swagger` launches only the backend and opens Swagger when Kestrel is ready.

The VS Code flow intentionally uses the `http-cli` launch profile instead of the `SpaProxy` profile so terminal and editor-driven debugging both avoid the duplicate browser-launch behavior from the ASP.NET Core side.

### Authentication Flow

1. Frontend routes requiring authentication redirect to the backend's login endpoint
2. Backend handles OIDC flow with Microsoft Entra ID
3. Upon successful authentication, a same-site cookie is set
4. Frontend API calls automatically include the authentication cookie
5. Backend validates the cookie for protected endpoints

## Testing

### Client tests

- Run `cd client && npm test` to execute the Vitest suite once.
- Use `npm run test:watch` inside `client/` for red/green feedback while you work.
- Tests run against a jsdom environment with Testing Library so you do not need the backend running.

### Server tests

- Run `dotnet test` from the repository root to execute the .NET test project included in `app.sln`.
- Alternatively, target the project directly with `dotnet test tests/server.tests/server.tests.csproj`.
- The tests do not require an external database.

## Updating Dependencies

### Client

- JavaScript/TypeScript packages: run `npm outdated` at the repository root and inside `client/` to see what can be updated. Use `npm update` in each location for compatible updates, or `npm install <package>@latest` when you need to jump to a new major version.
- After updating Node packages, reinstall if needed (`npm install`, `cd client && npm install`) and rerun key checks like `npm run lint`, `cd client && npm test`, and `dotnet test`.

### Server

.Net is a bit more complicated, but we're going to use the dotnet-outdated tool to help.

Run the following command from the repository root:

```
dotnet-outdated
```

and it'll show you a nice table of what can be updated. Be careful when updating major versions, especially with packages that are pinned to the .net version.

You can update individual packages or you can use the `--upgrade` flag to update all at once. Here's a nice way to do it and only update minor/patch versions:

```
dotnet-outdated --upgrade --version-lock Major
```

If you update a package that a tool depends on, update the matching tool version as well so local development stays consistent.

And as always, after updating dependencies, make sure to run `dotnet build` and `dotnet test` to verify everything is working.

## Project Structure

```text
.
├── client/                  # React frontend
│   ├── src/
│   │   ├── routes/          # TanStack Router routes
│   │   ├── queries/         # TanStack Query hooks
│   │   ├── lib/             # API client and utilities
│   │   └── shared/          # Shared components
│   ├── package.json
│   └── vite.config.ts
├── server/                  # .NET backend
│   ├── Controllers/         # API controllers
│   ├── Helpers/             # Utility classes
│   ├── Properties/          # Launch settings
│   ├── Program.cs           # Application entry point
│   └── server.csproj        # SpaProxy + publish integration
├── infrastructure/azure/    # Azure Bicep templates and local deployment scripts
├── .github/workflows/       # CI/CD and reusable Azure App Service deployment workflow
├── package.json             # Root dev orchestration scripts
└── app.sln                  # Visual Studio solution file
```

## Available Scripts

### Root Level

- `npm start` - Starts both backend and frontend with hot reload
- `npm run start:server` - Starts only the ASP.NET Core backend
- `npm run start:client` - Starts only the Vite dev server

### Client Directory

- `npm run dev` - Start Vite development server
- `npm run dev:open` - Start Vite development server and open the browser
- `npm run build` - Build for production
- `npm run lint` - Run ESLint
- `npm run preview` - Preview production build
- `npm test` - Run tests

### Server Directory

- `dotnet run` - Start the .NET application
- `dotnet watch` - Start with hot reload
- `dotnet build` - Build the application
- `dotnet test` - Run tests
