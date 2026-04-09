"use strict";

const path = require("path");

function pickPrimaryVideo(streams) {
  const videos = streams.filter((s) => s.codec_type === "video");
  if (videos.length === 0) return null;
  return videos.reduce((a, b) => (a.index <= b.index ? a : b));
}

function pickPrimaryAudio(streams) {
  const audios = streams.filter((s) => s.codec_type === "audio");
  if (audios.length === 0) return null;
  return audios.reduce((a, b) => (a.index <= b.index ? a : b));
}

function isAudioUsable(audio) {
  if (!audio) return false;
  if (audio.disposition && audio.disposition.visual_impaired === 1) return false;
  return true;
}

function subtitleHints(streams) {
  const subs = streams.filter((s) => s.codec_type === "subtitle");
  return {
    subtitle_stream_count: subs.length,
    has_soft_subtitles: subs.length > 0,
  };
}

function parseDurationSeconds(format) {
  const d = format && format.duration;
  if (d === undefined || d === null) return null;
  const n = Number(d);
  return Number.isFinite(n) ? n : null;
}

function buildMediaContextJson(normalizedProbe, videoPath) {
  const streams = normalizedProbe.streams || [];
  const format = normalizedProbe.format || {};
  const primary_video = pickPrimaryVideo(streams);
  const primary_audio = pickPrimaryAudio(streams);
  const audio_usable = isAudioUsable(primary_audio);

  return {
    schema_version: "1.0.0",
    artifact: "media_context",
    input_identity: {
      path_basename: path.basename(videoPath),
    },
    container: {
      format_name: format.format_name,
      format_long_name: format.format_long_name,
    },
    duration: {
      seconds: parseDurationSeconds(format),
    },
    primary_video: primary_video
      ? {
          stream_index: primary_video.index,
          width: primary_video.width,
          height: primary_video.height,
          r_frame_rate: primary_video.r_frame_rate,
          pix_fmt: primary_video.pix_fmt,
        }
      : null,
    primary_audio: primary_audio
      ? {
          stream_index: primary_audio.index,
          codec_name: primary_audio.codec_name,
          sample_rate: primary_audio.sample_rate,
          channels: primary_audio.channels,
        }
      : null,
    audio_usable,
    subtitle_hints: subtitleHints(streams),
  };
}

module.exports = {
  buildMediaContextJson,
  pickPrimaryVideo,
  pickPrimaryAudio,
};
