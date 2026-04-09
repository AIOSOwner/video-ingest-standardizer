"use strict";

function mapStreamToTrack(s, orderIndex) {
  const stream_type = s.codec_type || "unknown";
  return {
    order_index: orderIndex,
    stream_index: s.index,
    stream_type,
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
    disposition: s.disposition,
  };
}

function buildTracksJson(normalizedProbe) {
  const streams = normalizedProbe.streams || [];
  const tracks = streams.map((s, i) => mapStreamToTrack(s, i));
  return {
    schema_version: "1.0.0",
    artifact: "tracks",
    stream_count: tracks.length,
    tracks,
  };
}

module.exports = {
  buildTracksJson,
  mapStreamToTrack,
};
