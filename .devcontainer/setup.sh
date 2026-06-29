#!/usr/bin/env bash
set -e

echo "Running post-create setup..."

# Restore .NET tools and packages
echo "Restoring .NET tools and packages..."
(cd server && dotnet restore && dotnet tool restore)

# Install root npm dependencies (for npm-run-all, etc.)
echo "Installing root dependencies..."
npm install

# Install frontend dependencies
echo "Installing client dependencies..."
(cd client && npm install)

echo "Dev container setup complete."