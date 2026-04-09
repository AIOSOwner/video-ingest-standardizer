"use strict";

const { spawnSync } = require("child_process");
const fs = require("fs");
const path = require("path");

const { makeError, ERROR_CODES } = require("./errors");
const { resolveOutputPaths } = require("./paths");
const { writeJsonFile } = require("./json");
const { buildTracksJson } = require("./tracks");
const { buildMediaContextJson } = require("./media-context");

function findFfprobeBinary() {
  const env = process.env.FFPROBE_PATH;
  if (env && env.length > 0) {
    return env;
  }
  const r = spawnSync("which", ["ffprobe"], { encoding: "utf8" });
  if (r.status === 0 && r.stdout && r.stdout.trim()) {
    return r.stdout.trim().split("\n")[0];
  }
  return null;
}

function runFfprobeJson(videoPath, ffprobeBin) {
  const args = [
    "-v",
    "error",
    "-print_format",
    "json",
    "-show_format",
    "-show_streams",
    videoPath,
  ];
  const r = spawnSync(ffprobeBin, args, { encoding: "utf8", maxBuffer: 50 * 1024 * 1024 });
  if (r.error) {
    throw makeError(ERROR_CODES.INVALID_PATH, `ffprobe failed to run: ${r.error.message}`, {
      video_path: videoPath,
    });
  }
  if (r.status !== 0) {
    throw makeError(
      ERROR_CODES.INVALID_PATH,
      "ffprobe exited with non-zero status",
      { video_path: videoPath, stderr: (r.stderr || "").slice(0, 2000) }
    );
  }
  try {
    return JSON.parse(r.stdout);
  } catch (e) {
    throw makeError(ERROR_CODES.INVALID_PATH, "ffprobe returned invalid JSON", {
      video_path: videoPath,
    });
  }
}

function normalizeFormat(f) {
  if (!f || typeof f !== "object") return {};
  return stripKeysUndefined({
    format_name: f.format_name,
    format_long_name: f.format_long_name,
    duration: f.duration,
    size: f.size,
    bit_rate: f.bit_rate,
    probe_score: f.probe_score,
    nb_streams: f.nb_streams,
  });
}

function normalizeStream(s) {
  const base = {
    index: s.index,
    codec_type: s.codec_type,
    codec_name: s.codec_name,
    codec_long_name: s.codec_long_name,
    profile: s.profile,
    width: s.width,
    height: s.height,
    sample_rate: s.sample_rate,
    channels: s.channels,
    channel_layout: s.channel_layout,
    r_frame_rate: s.r_frame_rate,
    avg_frame_rate: s.avg_frame_rate,
    pix_fmt: s.pix_fmt,
    bit_rate: s.bit_rate,
    duration: s.duration,
    disposition: s.disposition
      ? {
          default: s.disposition.default,
          forced: s.disposition.forced,
          hearing_impaired: s.disposition.hearing_impaired,
          visual_impaired: s.disposition.visual_impaired,
        }
      : undefined,
  };
  return stripKeysUndefined(base);
}

function stripKeysUndefined(o) {
  const out = {};
  for (const k of Object.keys(o).sort()) {
    if (o[k] !== undefined) out[k] = o[k];
  }
  return out;
}

function normalizeProbe(raw) {
  const format = raw.format ? normalizeFormat(raw.format) : {};
  const streams = Array.isArray(raw.streams)
    ? raw.streams.map(normalizeStream).sort((a, b) => a.index - b.index)
    : [];
  return { format, streams };
}

function runProbePhase(videoPath, outputDir) {
  const absVideo = path.resolve(videoPath);
  if (!fs.existsSync(absVideo)) {
    throw makeError(ERROR_CODES.INVALID_PATH, "video file does not exist", {
      video_path: absVideo,
    });
  }
  const ffprobeBin = findFfprobeBinary();
  if (!ffprobeBin) {
    throw makeError(
      ERROR_CODES.INVALID_PATH,
      "ffprobe not found on PATH. Install ffmpeg/ffprobe or set FFPROBE_PATH.",
      { hint: "FFPROBE_PATH" }
    );
  }
  const raw = runFfprobeJson(absVideo, ffprobeBin);
  const normalized = normalizeProbe(raw);
  const outPaths = resolveOutputPaths(outputDir);
  const tracks = buildTracksJson(normalized);
  const mediaContext = buildMediaContextJson(normalized, absVideo);

  const ffprobeArtifact = {
    schema_version: "1.0.0",
    probe_kind: "ffprobe_normalized",
    probe: normalized,
  };

  writeJsonFile(outPaths.debug_ffprobe_raw, ffprobeArtifact);
  writeJsonFile(outPaths.debug_media_context, mediaContext);
  writeJsonFile(outPaths.tracks, tracks);

  return {
    ok: true,
    message: "probe_phase_complete",
    paths: {
      ffprobe_raw: outPaths.debug_ffprobe_raw,
      media_context: outPaths.debug_media_context,
      tracks: outPaths.tracks,
    },
    ffprobe_binary: ffprobeBin,
  };
}

module.exports = {
  findFfprobeBinary,
  runFfprobeJson,
  normalizeProbe,
  runProbePhase,
};
