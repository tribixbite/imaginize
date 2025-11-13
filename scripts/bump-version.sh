#!/bin/bash
# Version bump script for imaginize
# Usage: ./scripts/bump-version.sh [patch|minor|major|X.Y.Z]

set -e

if [[ $# -eq 0 ]]; then
    echo "Usage: $0 [patch|minor|major|X.Y.Z]"
    echo ""
    echo "Examples:"
    echo "  $0 patch       # 2.6.2 -> 2.6.3"
    echo "  $0 minor       # 2.6.2 -> 2.7.0"
    echo "  $0 major       # 2.6.2 -> 3.0.0"
    echo "  $0 2.7.0       # Set specific version"
    exit 1
fi

BUMP_TYPE=$1

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

# Get current version
CURRENT_VERSION=$(node -p "require('./package.json').version")
echo -e "${YELLOW}Current version: $CURRENT_VERSION${NC}"

# Check for uncommitted changes
if [[ -n $(git status -s) ]]; then
    echo -e "${RED}Error: Working directory has uncommitted changes${NC}"
    echo "Please commit or stash your changes before bumping version"
    exit 1
fi

# Bump version using npm
if [[ "$BUMP_TYPE" =~ ^[0-9]+\.[0-9]+\.[0-9]+$ ]]; then
    # Specific version provided
    NEW_VERSION=$BUMP_TYPE
    npm version $NEW_VERSION --no-git-tag-version
else
    # Use npm version bump
    NEW_VERSION=$(npm version $BUMP_TYPE --no-git-tag-version | sed 's/v//')
fi

echo -e "${GREEN}New version: $NEW_VERSION${NC}"

# Update dashboard package.json if it exists
if [[ -f "dashboard/package.json" ]]; then
    echo "Updating dashboard version..."
    cd dashboard
    npm version $NEW_VERSION --no-git-tag-version > /dev/null
    cd ..
    echo -e "${GREEN}✓ Dashboard version updated${NC}"
fi

# Remind about CHANGELOG.md
echo ""
echo -e "${YELLOW}⚠ Don't forget to:${NC}"
echo "  1. Update CHANGELOG.md with release notes"
echo "  2. Review changes: git diff"
echo "  3. Commit: git add . && git commit -m \"chore: bump version to $NEW_VERSION\""
echo "  4. Create tag: git tag v$NEW_VERSION"
echo "  5. Push: git push origin main --tags"
echo ""
echo -e "${GREEN}Or use: ./scripts/release.sh${NC}"
