"use strict";

const SCHEMA_VERSIONS = Object.freeze({
  manifest: "1.0.0",
  tracks: "1.0.0",
  timeline: "1.0.0",
  subtitle_report: "1.0.0",
  quality_report: "1.0.0",
  debug_ffprobe_raw: "1.0.0",
  debug_process_log: "1.0.0",
});

const COVERAGE_ROLE = Object.freeze([
  "full",
  "leading_partial",
  "trailing_partial",
]);

const SUBTITLE_CLASSIFICATION = Object.freeze([
  "none",
  "soft_subtitle",
  "suspected_hard_subtitle",
  "mixed",
]);

const FIXED_OUTPUT_STRUCTURE = Object.freeze({
  required_files: [
    "manifest.json",
    "tracks.json",
    "timeline.json",
    "subtitle_report.json",
    "quality_report.json",
  ],
  conditional_files: [
    {
      path: "audio/source_full.wav",
      condition: "produce_only_when_usable_audio_exists",
    },
  ],
  optional_files: [
    "debug/ffprobe_raw.json",
    "debug/process_log.json",
    "debug/media_context.json",
    "README.md",
  ],
});

module.exports = {
  SCHEMA_VERSIONS,
  COVERAGE_ROLE,
  SUBTITLE_CLASSIFICATION,
  FIXED_OUTPUT_STRUCTURE,
};
