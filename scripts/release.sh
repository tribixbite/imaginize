#!/bin/bash
# Complete release workflow for imaginize
# Usage: ./scripts/release.sh [patch|minor|major|X.Y.Z]

set -e

if [[ $# -eq 0 ]]; then
    echo "Usage: $0 [patch|minor|major|X.Y.Z]"
    echo ""
    echo "This script will:"
    echo "  1. Run pre-release checks"
    echo "  2. Bump version"
    echo "  3. Commit and tag"
    echo "  4. Push to GitHub (triggers publish workflow)"
    exit 1
fi

BUMP_TYPE=$1

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

echo "🚀 imaginize Release Workflow"
echo "============================="
echo ""

# Step 1: Pre-release checks
echo -e "${YELLOW}Step 1: Running pre-release checks...${NC}"
./scripts/pre-release-check.sh
if [[ $? -ne 0 ]]; then
    echo -e "${RED}Pre-release checks failed. Please fix issues before releasing.${NC}"
    exit 1
fi
echo ""

# Step 2: Bump version
echo -e "${YELLOW}Step 2: Bumping version...${NC}"
./scripts/bump-version.sh $BUMP_TYPE
NEW_VERSION=$(node -p "require('./package.json').version")
echo ""

# Step 3: Confirm CHANGELOG
echo -e "${YELLOW}Step 3: CHANGELOG verification${NC}"
echo "Have you updated CHANGELOG.md with release notes for v$NEW_VERSION?"
read -p "Continue? (y/n): " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo -e "${RED}Please update CHANGELOG.md before releasing${NC}"
    exit 1
fi

# Step 4: Commit and tag
echo -e "${YELLOW}Step 4: Creating commit and tag...${NC}"
git add .
git commit -m "chore: release v$NEW_VERSION"
git tag "v$NEW_VERSION"
echo -e "${GREEN}✓ Created commit and tag v$NEW_VERSION${NC}"
echo ""

# Step 5: Push
echo -e "${YELLOW}Step 5: Pushing to GitHub...${NC}"
echo "This will push to GitHub and trigger the publish workflow."
read -p "Continue? (y/n): " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo -e "${YELLOW}Aborted. To push manually:${NC}"
    echo "  git push origin main --tags"
    exit 0
fi

git push origin main --tags
echo -e "${GREEN}✓ Pushed to GitHub${NC}"
echo ""

# Done
echo "============================="
echo -e "${GREEN}🎉 Release v$NEW_VERSION initiated!${NC}"
echo ""
echo "Monitor the release at:"
echo "  https://github.com/tribixbite/imaginize/actions"
echo ""
echo "Once published, verify at:"
echo "  https://www.npmjs.com/package/imaginize"
