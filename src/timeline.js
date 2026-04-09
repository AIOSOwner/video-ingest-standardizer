"use strict";

const { COVERAGE_ROLE } = require("./contracts");

const MAX_SEGMENT_SECONDS = 120;
const MIN_SEGMENT_SECONDS = 3;
const TARGET_CHUNK = 45;

function clampSegmentsCount(durationSeconds) {
  if (!Number.isFinite(durationSeconds) || durationSeconds <= 0) {
    return 1;
  }
  const raw = Math.ceil(durationSeconds / TARGET_CHUNK);
  return Math.min(6, Math.max(2, raw));
}

function segmentLength(durationSeconds, n) {
  return durationSeconds / n;
}

function coverageRoleForIndex(i, n) {
  if (n === 1) return "full";
  if (i === 0) return "leading_partial";
  if (i === n - 1) return "trailing_partial";
  return "full";
}

/**
 * Segment-local hints only; no global stream metadata (resolution, codecs, etc.).
 */
function segmentHints(audioUsable) {
  return {
    audio_activity_present: Boolean(audioUsable),
  };
}

function buildTimelineJson(mediaContext, tracksJson) {
  const durationSeconds =
    mediaContext &&
    mediaContext.duration &&
    Number.isFinite(mediaContext.duration.seconds)
      ? mediaContext.duration.seconds
      : null;

  const audioUsable = Boolean(mediaContext && mediaContext.audio_usable);

  if (durationSeconds === null || durationSeconds <= 0) {
    return {
      schema_version: "1.0.0",
      artifact: "timeline",
      duration_seconds: durationSeconds,
      segment_count: 0,
      coverage_role_enum: [...COVERAGE_ROLE],
      segments: [],
    };
  }

  let n;
  if (durationSeconds < MIN_SEGMENT_SECONDS * 2) {
    n = 1;
  } else {
    n = clampSegmentsCount(durationSeconds);
    const len = segmentLength(durationSeconds, n);
    if (len > MAX_SEGMENT_SECONDS) {
      n = Math.ceil(durationSeconds / MAX_SEGMENT_SECONDS);
      n = Math.min(6, Math.max(n, 2));
    }
    if (len < MIN_SEGMENT_SECONDS && n > 2) {
      n = Math.max(2, Math.floor(durationSeconds / MIN_SEGMENT_SECONDS));
      n = Math.min(6, n);
    }
  }

  const segments = [];
  const step = durationSeconds / n;
  for (let i = 0; i < n; i += 1) {
    const start = i * step;
    const end = i === n - 1 ? durationSeconds : (i + 1) * step;
    const dur = end - start;
    const coverage_role = coverageRoleForIndex(i, n);
    if (!COVERAGE_ROLE.includes(coverage_role)) {
      throw new Error(`Invalid coverage_role: ${coverage_role}`);
    }
    segments.push({
      segment_id: `seg_${String(i).padStart(3, "0")}`,
      start,
      end,
      duration: dur,
      cut_reason: "deterministic_equal_split",
      coverage_role,
      analysis_hints: segmentHints(audioUsable),
    });
  }

  return {
    schema_version: "1.0.0",
    artifact: "timeline",
    duration_seconds: durationSeconds,
    segment_count: segments.length,
    coverage_role_enum: [...COVERAGE_ROLE],
    segments,
  };
}

module.exports = {
  buildTimelineJson,
  clampSegmentsCount,
};
