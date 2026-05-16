<!--
Thanks for the PR. Keep the checklist short and truthful; anything that
doesn't apply can be left unchecked with a note instead of force-checked.
-->

## Summary

<!-- Short, outcome-oriented description. "Why" first, "what" second. -->

## Checklist

- [ ] `python3 _tools/build-catalog.py && ODD_VALIDATE_REBUILD=1 odd/bin/validate-catalog` pass locally when catalog sources or generated catalog artifacts changed.
- [ ] `npm test` passes locally, or focused Vitest coverage is listed below.
- [ ] `composer phpcs` passes locally (run `composer phpcbf` to auto-fix).
- [ ] If PHP logic changed, `composer phpunit` passes locally.
- [ ] `odd/bin/validate-blueprint` passes when Playground, release, or Desktop Mode version pins changed.
- [ ] `CHANGELOG.md` has an entry under `## [Unreleased]` when this PR is intended for a plugin release. Catalog-only and internal-only changes do not need one.
- [ ] Screenshot, screencast, or Playground link attached for any user-visible change.
- [ ] Plugin version bumped in `odd/odd.php` (`Version:` header **and** `ODDOUT_VERSION` constant) if this PR ships in a release.

## Test plan

<!--
Concrete steps: what did you do to convince yourself this works? Include
the smallest repro, the URL you tested on, or the wp-cli command you ran.
-->
