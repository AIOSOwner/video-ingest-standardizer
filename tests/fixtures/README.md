# Test fixtures

This directory holds static inputs used by unit and integration tests. Nothing here is read at runtime by the production CLI; it exists only to keep tests deterministic and documented.

## `probe/`

| File | Purpose |
|------|---------|
| `sample_normalized.json` | Synthetic ffprobe-shaped JSON used by `tests/probe-and-tracks.test.js` and related unit tests. It exercises normalization, track ordering, and media-context fields without calling external binaries. |
| `fixture_metadata.json` | Short machine-readable notes: fixture id, human description, and expected high-level counts (streams, audio usability, subtitles) for reviewers and future fixture additions. |

## Adding fixtures

- Prefer **small, license-clear** inputs. For binary samples, document origin and license in this README or next to the file.
- Keep JSON fixtures **stable**: avoid timestamps, host paths, or random IDs unless the test explicitly strips them.
- Update `fixture_metadata.json` (or add a sibling metadata file) when adding a new primary fixture so downstream tests can assert expectations in one place.

## Storage and licensing

The checked-in JSON files are project-authored synthetic data. If you add real media samples, record **source URL**, **license**, and **checksum** here so executors and reviewers can comply with redistribution rules.
