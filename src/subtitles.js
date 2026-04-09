"use strict";

const { SUBTITLE_CLASSIFICATION } = require("./contracts");

function countSubtitleTracks(tracksJson) {
  const tracks = (tracksJson && tracksJson.tracks) || [];
  return tracks.filter((t) => t.stream_type === "subtitle").length;
}

function countVideoTracks(tracksJson) {
  const tracks = (tracksJson && tracksJson.tracks) || [];
  return tracks.filter((t) => t.stream_type === "video").length;
}

function subtitleCodecKinds(tracksJson) {
  const tracks = (tracksJson && tracksJson.tracks) || [];
  const kinds = new Set();
  for (const t of tracks) {
    if (t.stream_type !== "subtitle") continue;
    const name = (t.codec_name || "").toLowerCase();
    if (name.includes("hdmv") || name.includes("dvd") || name.includes("pgssub")) {
      kinds.add("bitmap");
    } else if (name.length > 0) {
      kinds.add("text");
    }
  }
  return kinds;
}

/**
 * Track-based classification first; optional weak heuristic for suspected hard subs
 * when no subtitle tracks exist (bounded, evidence-flagged).
 */
function buildSubtitleReportJson(mediaContext, tracksJson) {
  const subtitleStreams = countSubtitleTracks(tracksJson);
  const videoStreams = countVideoTracks(tracksJson);
  const hintCount =
    mediaContext &&
    mediaContext.subtitle_hints &&
    Number.isFinite(mediaContext.subtitle_hints.subtitle_stream_count)
      ? mediaContext.subtitle_hints.subtitle_stream_count
      : subtitleStreams;

  const codecKinds = subtitleCodecKinds(tracksJson);

  let classification;
  if (subtitleStreams >= 2 && codecKinds.size >= 2) {
    classification = "mixed";
  } else if (subtitleStreams >= 1) {
    classification = "soft_subtitle";
  } else if (videoStreams >= 1) {
    classification = "suspected_hard_subtitle";
  } else {
    classification = "none";
  }

  if (!SUBTITLE_CLASSIFICATION.includes(classification)) {
    throw new Error(`Invalid subtitle classification: ${classification}`);
  }

  const evidence = {
    subtitle_stream_count: subtitleStreams,
    video_stream_count: videoStreams,
    subtitle_codec_kind_count: codecKinds.size,
    track_inventory_agrees_with_media_context: subtitleStreams === hintCount,
  };

  let recommended_handling;
  if (classification === "soft_subtitle" || classification === "mixed") {
    recommended_handling = "extract_or_mux_soft_subtitle_streams";
  } else if (classification === "suspected_hard_subtitle") {
    recommended_handling = "optional_ocr_or_manual_review_if_subtitles_required";
  } else {
    recommended_handling = "no_subtitle_tracks_to_extract";
  }

  return {
    schema_version: "1.0.0",
    artifact: "subtitle_report",
    classification_enum: [...SUBTITLE_CLASSIFICATION],
    classification,
    confidence: {
      subtitle_track_score: subtitleStreams > 0 ? 1 : 0,
      heuristic_hard_sub_score: classification === "suspected_hard_subtitle" ? 0.2 : 0,
    },
    evidence,
    recommended_handling,
  };
}

module.exports = {
  buildSubtitleReportJson,
  countSubtitleTracks,
};
