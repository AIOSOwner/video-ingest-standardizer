"use strict";

const path = require("path");

function assertAbsolutePath(name, value) {
  if (typeof value !== "string" || value.length === 0) {
    return `${name} must be a non-empty string`;
  }
  if (!path.isAbsolute(value)) {
    return `${name} must be an absolute path`;
  }
  return null;
}

function resolveOutputPaths(outputDir) {
  const audioDir = path.join(outputDir, "audio");
  const debugDir = path.join(outputDir, "debug");

  return {
    root: outputDir,
    manifest: path.join(outputDir, "manifest.json"),
    tracks: path.join(outputDir, "tracks.json"),
    timeline: path.join(outputDir, "timeline.json"),
    subtitle_report: path.join(outputDir, "subtitle_report.json"),
    quality_report: path.join(outputDir, "quality_report.json"),
    audio_source_full_wav: path.join(audioDir, "source_full.wav"),
    debug_ffprobe_raw: path.join(debugDir, "ffprobe_raw.json"),
    debug_process_log: path.join(debugDir, "process_log.json"),
    debug_media_context: path.join(debugDir, "media_context.json"),
    readme: path.join(outputDir, "README.md"),
  };
}

module.exports = {
  assertAbsolutePath,
  resolveOutputPaths,
};
