# video-ingest-standardizer

Local, deterministic Node.js pipeline that probes a video with **ffprobe**, builds normalized artifacts (tracks, timeline, subtitle and quality reports), optionally extracts **PCM WAV** audio with **ffmpeg**, and writes a **fixed directory layout** under your chosen `output_dir`.

The runtime does **not** read `.aios/request.json`; behavior is defined in code (`src/contracts.js`) and documented here and in [`docs/artifact-spec.md`](docs/artifact-spec.md).

## Dependencies

| Requirement | Purpose |
|---------------|---------|
| **Node.js** (current LTS or compatible) | Runs the CLI and tests. |
| **ffprobe** on `PATH` (or `FFPROBE_PATH`) | Stream and format probing. |
| **ffmpeg** on `PATH` (or `FFMPEG_PATH`) | Conditional audio extraction to `audio/source_full.wav`. |

There is no `package.json`; the project uses Node’s built-in modules and shell-available tools only.

## CLI contract (fixed)

```bash
node src/index.js --video_path=<absolute_path> --output_dir=<absolute_path>
```

Rules:

- No positional arguments.
- Only `--video_path=` and `--output_dir=` (with `=`).
- Both flags are required.
- Both values must be **absolute** paths.

On success, stdout is one JSON line with at least `ok`, `message`, `output_dir`, and `audio` (extraction result). On failure, the process exits non-zero with structured error output from `src/errors.js`.

## Fixed output directory structure

All artifacts are written **only** under `output_dir` using these relative paths:

**Required:**

- `manifest.json`
- `tracks.json`
- `timeline.json`
- `subtitle_report.json`
- `quality_report.json`

**Conditional:**

- `audio/source_full.wav` — only when a usable audio stream exists and extraction succeeds.

**Debug / diagnostics (written by the current implementation):**

- `debug/ffprobe_raw.json`
- `debug/media_context.json`
- `debug/process_log.json`

Field-level contracts, enums, and downstream usage are described in **[docs/artifact-spec.md](docs/artifact-spec.md)**.

### Stable enums (summary)

- **Timeline `coverage_role`:** `full`, `leading_partial`, `trailing_partial`
- **Subtitle classification:** `none`, `soft_subtitle`, `suspected_hard_subtitle`, `mixed`

## How to run locally

From the project root (`projects/video-ingest-standardizer`):

```bash
node src/index.js --video_path=/absolute/path/to/video.mp4 --output_dir=/absolute/path/to/out
```

Ensure `output_dir` is writable; it will be created if needed. Use absolute paths for both arguments.

## Tests

```bash
node --test tests/*.test.js
```

Requires `ffmpeg` and `ffprobe` on `PATH` for integration and determinism tests (those cases are skipped if tools are missing). See [`tests/fixtures/README.md`](tests/fixtures/README.md) for fixture layout.

- **`tests/determinism.test.js`** — full pipeline run twice on the same synthetic video; JSON artifacts and WAV bytes must match.
- **`tests/pipeline.integration.test.js`** — end-to-end behavior, CLI contract, fixed structure, conditional audio.
- Other files under `tests/` cover probe, tracks, timeline, subtitle, and quality modules.

## Downstream integration

1. Run the CLI with absolute paths; consume JSON from `output_dir` as specified in **artifact-spec**.
2. Use `manifest.json` for a concise inventory and schema version map; use `tracks.json` / `timeline.json` for processing segments; gate expensive work with `quality_report.json` and `subtitle_report.json`.
3. Treat `debug/*` as optional diagnostics, not as the minimal API surface.

## Project layout (runnable module)

| Area | Role |
|------|------|
| `src/index.js` | CLI entry: parses flags, runs `runPipeline`. |
| `src/pipeline.js` | Orchestrates probe → reports → optional audio → manifest → process log. |
| `src/probe.js`, `src/tracks.js`, `src/media-context.js` | Probing and normalization. |
| `src/timeline.js`, `src/subtitles.js`, `src/quality.js` | Segmentation and reports. |
| `src/audio.js` | Conditional WAV extraction. |
| `src/manifest.js` | Manifest payload builder. |
| `src/contracts.js` | Schema versions and fixed structure constants. |
| `src/paths.js`, `src/json.js`, `src/errors.js` | Paths, stable JSON I/O, errors. |

## Limitations

- Requires local **ffmpeg/ffprobe** for full functionality; probe-only unit tests can use JSON fixtures without binaries.
- Behavior is tuned for common container formats; unsupported or corrupt inputs fail with structured errors rather than undefined behavior.
