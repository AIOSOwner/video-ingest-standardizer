"use strict";

const { spawnSync } = require("child_process");
const fs = require("fs");

const { makeError, ERROR_CODES } = require("./errors");

function findFfmpegBinary() {
  const env = process.env.FFMPEG_PATH;
  if (env && env.length > 0) {
    return env;
  }
  const r = spawnSync("which", ["ffmpeg"], { encoding: "utf8" });
  if (r.status === 0 && r.stdout && r.stdout.trim()) {
    return r.stdout.trim().split("\n")[0];
  }
  return null;
}

function pickAudioStreamIndex(tracksJson) {
  const tracks = (tracksJson && tracksJson.tracks) || [];
  const audios = tracks.filter((t) => t.stream_type === "audio");
  if (audios.length === 0) return null;
  return audios.reduce((a, b) => (a.stream_index <= b.stream_index ? a : b)).stream_index;
}

/**
 * Writes PCM WAV at outputWavPath only when mediaContext.audio_usable is true.
 * Returns { extracted: boolean, reason?: string }
 */
function extractFullAudioWav(videoPath, outputWavPath, mediaContext, tracksJson) {
  if (!mediaContext || !mediaContext.audio_usable) {
    return { extracted: false, reason: "audio_not_usable_or_absent" };
  }

  const streamIndex = pickAudioStreamIndex(tracksJson);
  if (streamIndex === null || streamIndex === undefined) {
    return { extracted: false, reason: "no_audio_stream_in_tracks" };
  }

  const ffmpeg = findFfmpegBinary();
  if (!ffmpeg) {
    throw makeError(
      ERROR_CODES.INVALID_PATH,
      "ffmpeg not found on PATH. Install ffmpeg or set FFMPEG_PATH.",
      { hint: "FFMPEG_PATH" }
    );
  }

  const args = [
    "-nostdin",
    "-y",
    "-loglevel",
    "error",
    "-i",
    videoPath,
    "-map",
    `0:${streamIndex}`,
    "-vn",
    "-acodec",
    "pcm_s16le",
    "-ar",
    "48000",
    "-ac",
    "2",
    outputWavPath,
  ];

  const r = spawnSync(ffmpeg, args, { encoding: "utf8", maxBuffer: 20 * 1024 * 1024 });
  if (r.error) {
    throw makeError(ERROR_CODES.INVALID_PATH, `ffmpeg failed: ${r.error.message}`, {
      video_path: videoPath,
    });
  }
  if (r.status !== 0) {
    throw makeError(ERROR_CODES.INVALID_PATH, "ffmpeg audio extraction failed", {
      stderr: (r.stderr || "").slice(0, 2000),
    });
  }

  if (!fs.existsSync(outputWavPath)) {
    return { extracted: false, reason: "output_missing_after_ffmpeg" };
  }
  const st = fs.statSync(outputWavPath);
  if (st.size < 64) {
    fs.unlinkSync(outputWavPath);
    return { extracted: false, reason: "output_too_small" };
  }

  return { extracted: true, reason: "ok" };
}

module.exports = {
  findFfmpegBinary,
  extractFullAudioWav,
  pickAudioStreamIndex,
};
