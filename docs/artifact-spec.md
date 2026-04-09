# Artifact specification (video-ingest-standardizer)

This document describes the **fixed output package** written under `output_dir` by `node src/index.js --video_path=... --output_dir=...`. All paths below are **relative to `output_dir`**. Schemas are versioned in each JSON file’s `schema_version` where applicable; global schema version maps live in `manifest.json` under `schema_versions`.

The module does **not** read `.aios/request.json` at runtime. Behavior is defined by `src/contracts.js` and the implementation modules listed in the project README.

---

## Required JSON artifacts

### `manifest.json`

Top-level run summary.

| Field | Description |
|--------|-------------|
| `schema_version` | Manifest schema version. |
| `artifact` | Always `"manifest"`. |
| `pipeline_status` | e.g. `"completed"` after a successful run. |
| `input_identity.path_basename` | Basename of the input video (stable handle, not a full path). |
| `schema_versions` | Map of logical artifact names to schema version strings (aligned with `src/contracts.js` `SCHEMA_VERSIONS`). |
| `artifacts_present` | Sorted list of relative paths produced this run. |
| `required_outputs_declared` | Copy of `FIXED_OUTPUT_STRUCTURE.required_files` from contracts. |
| `conditional_audio` | `{ path: "audio/source_full.wav", extracted: boolean }`. |

### `tracks.json`

Stream inventory from probing: video, audio, and subtitle streams in **discovery order**, with normalized fields for downstream selection (see `src/tracks.js`).

### `timeline.json`

Segment-oriented timeline: non-overlapping segments covering most of the duration. Each segment includes at least:

- `segment_id`, `start`, `end`, `duration`, `cut_reason`, `coverage_role`

**`coverage_role` enum** (stable): `full`, `leading_partial`, `trailing_partial`.

Optional `analysis_hints` are **segment-local** and bounded (no duplication of global stream metadata from `tracks.json` or `quality_report.json`).

### `subtitle_report.json`

Subtitle presence classification.

**`subtitle_classification` enum**: `none`, `soft_subtitle`, `suspected_hard_subtitle`, `mixed`.

Includes evidence fields and a **recommended handling strategy** for downstream stages.

### `quality_report.json`

Technical quality and usability: warnings, stream usability flags, duration, bitrate, resolution, frame rate, audio availability, and related diagnostics.

---

## Conditional artifact

### `audio/source_full.wav`

- **Produced only** when the probe-derived media context marks audio as usable downstream **and** extraction succeeds.
- Format: PCM WAV (`pcm_s16le`), 48 kHz, stereo (see `src/audio.js`).
- If audio is absent or unusable, this file **must not** exist (any failed partial file is removed).

---

## Debug and optional JSON artifacts

These are written for auditability; repeat runs should be stable for the same input except where noted in tests.

| Path | Role |
|------|------|
| `debug/ffprobe_raw.json` | Normalized or raw ffprobe JSON used to build tracks and media context. |
| `debug/media_context.json` | Consolidated duration, stream hints, usability flags, and related normalized facts. |
| `debug/process_log.json` | Bounded ordered `steps` array (probe, timeline, reports, audio, manifest) and pipeline status. |

Optional placeholder in contracts (not necessarily written by current pipeline): `README.md` under `output_dir` is listed in `FIXED_OUTPUT_STRUCTURE.optional_files` but may be unused unless implemented.

---

## Downstream consumption

1. **Discover streams** from `tracks.json`; choose primary video/audio using stable ordering rules from the spec in code.
2. **Segment work** using `timeline.json` segments and `coverage_role`.
3. **Subtitles**: branch on `subtitle_report.json` classification and recommended strategy.
4. **Quality gates**: read `quality_report.json` for warnings and usability before expensive steps.
5. **Audio**: if `manifest.json` → `conditional_audio.extracted` is true, read `audio/source_full.wav`; otherwise plan a no-audio path.
6. **Debug**: use `debug/*` only for troubleshooting; do not depend on them for core business logic if you need minimal surface area.

---

## CLI contract (fixed)

```text
node src/index.js --video_path=<absolute_path> --output_dir=<absolute_path>
```

- Flags must be exactly `--video_path=` and `--output_dir=` (with `=`).
- Values must be **absolute** paths.
- Errors are structured JSON via `src/errors.js` on stderr/exit code (see implementation).

This spec is the contract reference for reviewers and executors; behavior should match `src/*.js` and `tests/*.test.js`.
