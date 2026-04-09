"use strict";

function parseFrameRate(s) {
  if (!s || typeof s !== "string") return null;
  const parts = s.split("/");
  if (parts.length === 2) {
    const a = Number(parts[0]);
    const b = Number(parts[1]);
    if (b !== 0 && Number.isFinite(a) && Number.isFinite(b)) {
      return a / b;
    }
  }
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

function sumBitrateBitsPerSec(tracksJson) {
  let sum = 0;
  for (const t of (tracksJson && tracksJson.tracks) || []) {
    const br = Number(t.bit_rate);
    if (Number.isFinite(br)) sum += br;
  }
  return sum > 0 ? sum : null;
}

function pickPrimaryVideoTrack(tracksJson) {
  const tracks = (tracksJson && tracksJson.tracks) || [];
  const videos = tracks.filter((t) => t.stream_type === "video");
  if (videos.length === 0) return null;
  return videos.reduce((a, b) => (a.stream_index <= b.stream_index ? a : b));
}

function pickPrimaryAudioTrack(tracksJson) {
  const tracks = (tracksJson && tracksJson.tracks) || [];
  const audios = tracks.filter((t) => t.stream_type === "audio");
  if (audios.length === 0) return null;
  return audios.reduce((a, b) => (a.stream_index <= b.stream_index ? a : b));
}

function buildQualityReportJson(mediaContext, tracksJson) {
  const pv =
    mediaContext && mediaContext.primary_video
      ? mediaContext.primary_video
      : null;
  const pa =
    mediaContext && mediaContext.primary_audio
      ? mediaContext.primary_audio
      : null;

  const videoTrack = pickPrimaryVideoTrack(tracksJson);
  const audioTrack = pickPrimaryAudioTrack(tracksJson);

  const width = pv && pv.width != null ? pv.width : videoTrack && videoTrack.width;
  const height = pv && pv.height != null ? pv.height : videoTrack && videoTrack.height;
  const rFrame = pv && pv.r_frame_rate ? pv.r_frame_rate : videoTrack && videoTrack.r_frame_rate;

  const durationSeconds =
    mediaContext &&
    mediaContext.duration &&
    Number.isFinite(mediaContext.duration.seconds)
      ? mediaContext.duration.seconds
      : null;

  const bitrate = sumBitrateBitsPerSec(tracksJson);
  const frameRate = parseFrameRate(rFrame);

  let audioAvailability = "absent";
  if (audioTrack && mediaContext && mediaContext.audio_usable) {
    audioAvailability = "available";
  } else if (audioTrack && mediaContext && !mediaContext.audio_usable) {
    audioAvailability = "unavailable";
  } else if (!audioTrack) {
    audioAvailability = "absent";
  }

  const warnings = [];
  if (durationSeconds === null || durationSeconds <= 0) {
    warnings.push("missing_or_invalid_duration");
  }
  if (bitrate === null) {
    warnings.push("missing_aggregate_bitrate_from_tracks");
  }
  if (!width || !height) {
    warnings.push("missing_resolution");
  }
  if (frameRate === null) {
    warnings.push("missing_frame_rate");
  }

  const risk_flags = [];
  if (audioAvailability === "unavailable") {
    risk_flags.push("audio_stream_present_but_marked_not_usable");
  }

  return {
    schema_version: "1.0.0",
    artifact: "quality_report",
    diagnostics: {
      duration_seconds: durationSeconds,
      bitrate_bits_per_sec: bitrate,
      resolution:
        width && height
          ? { width, height }
          : { width: null, height: null },
      frame_rate: frameRate,
      audio_availability: audioAvailability,
    },
    warnings,
    risk_flags,
    stream_usability: {
      video: videoTrack ? "usable" : "absent",
      audio:
        audioAvailability === "available"
          ? "usable"
          : audioAvailability === "unavailable"
            ? "usable_with_risk"
            : "absent",
    },
    primary_streams: {
      video_codec: videoTrack ? videoTrack.codec_name : null,
      audio_codec: pa ? pa.codec_name : audioTrack ? audioTrack.codec_name : null,
    },
  };
}

module.exports = {
  buildQualityReportJson,
  parseFrameRate,
  sumBitrateBitsPerSec,
};
