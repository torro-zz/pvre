#!/bin/bash

# Setup git hooks for this repository
# Run this once after cloning: ./.githooks/setup.sh

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(dirname "$SCRIPT_DIR")"

echo "Setting up git hooks..."

# Configure git to use the .githooks directory
git config core.hooksPath .githooks

# Make hooks executable
chmod +x "$SCRIPT_DIR"/*

echo "Git hooks configured successfully!"
echo ""
echo "Active hooks:"
ls -la "$SCRIPT_DIR" | grep -v setup.sh | grep -v "^d" | grep -v "^total"
echo ""
echo "Pre-commit hook will scan for secrets before each commit."
