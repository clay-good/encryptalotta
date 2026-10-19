#!/usr/bin/env bash
# Mirror main + tags to Codeberg (SPEC-INTERNATIONAL.md §4.1).
#
# Run by .github/workflows/mirror-codeberg.yml. It does nothing until the
# maintainer opts in by setting both:
#   - secret   CODEBERG_TOKEN  a Codeberg access token with repository write scope
#   - variable CODEBERG_REPO   "<owner>/<repo>" on codeberg.org
#
# Pushes refs/heads/main and all tags, never with --force or --mirror: nothing
# on Codeberg is ever deleted or rewritten, and a diverged mirror fails loudly
# instead of being overwritten. The token goes in an HTTP header, not the URL.
#
# MIRROR_URL overrides the destination and MIRROR_SOURCE_REF the commit pushed as
# main (both used by the local test against a bare repo).
set -euo pipefail

if [[ -z "${MIRROR_URL:-}" ]]; then
    if [[ -z "${CODEBERG_TOKEN:-}" || -z "${CODEBERG_REPO:-}" ]]; then
        echo "mirror: skipped — set the CODEBERG_TOKEN secret and CODEBERG_REPO variable to enable"
        exit 0
    fi
    if [[ ! "$CODEBERG_REPO" =~ ^[A-Za-z0-9._-]+/[A-Za-z0-9._-]+$ ]]; then
        echo "mirror: CODEBERG_REPO must look like owner/repo, got '$CODEBERG_REPO'" >&2
        exit 1
    fi
    MIRROR_URL="https://codeberg.org/${CODEBERG_REPO}.git"
fi

auth=()
if [[ -n "${CODEBERG_TOKEN:-}" ]]; then
    basic=$(printf 'token:%s' "$CODEBERG_TOKEN" | base64 | tr -d '\n')
    auth=(-c "http.extraHeader=Authorization: Basic ${basic}")
fi

# Source of main: origin/main when present. actions/checkout leaves the run
# detached on a tag push and a local refs/heads/main can be stale, while
# fetch-depth: 0 always populates origin/main. MIRROR_SOURCE_REF overrides.
src="${MIRROR_SOURCE_REF:-}"
if [[ -z "$src" ]]; then
    if git rev-parse -q --verify refs/remotes/origin/main >/dev/null; then src=refs/remotes/origin/main; else src=refs/heads/main; fi
fi
sha=$(git rev-parse --verify "${src}^{commit}")

git ${auth[@]+"${auth[@]}"} push "$MIRROR_URL" "${sha}:refs/heads/main"
git ${auth[@]+"${auth[@]}"} push "$MIRROR_URL" --tags
echo "mirror: pushed main (${sha:0:12}) + tags to ${MIRROR_URL}"
