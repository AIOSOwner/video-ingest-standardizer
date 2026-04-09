"use strict";

const test = require("node:test");
const assert = require("node:assert");
const path = require("path");

const { readJsonFile } = require("../src/json");
const { normalizeProbe } = require("../src/probe");
const { buildTracksJson } = require("../src/tracks");
const { buildMediaContextJson } = require("../src/media-context");
const { buildTimelineJson } = require("../src/timeline");
const { buildSubtitleReportJson } = require("../src/subtitles");
const { buildQualityReportJson, parseFrameRate } = require("../src/quality");
const { COVERAGE_ROLE, SUBTITLE_CLASSIFICATION } = require("../src/contracts");

const FIXTURE = path.join(__dirname, "fixtures", "probe", "sample_normalized.json");

function loadFixtureContext() {
  const raw = readJsonFile(FIXTURE);
  const n = normalizeProbe(raw);
  const tracks = buildTracksJson(n);
  const mc = buildMediaContextJson(n, "/tmp/demo/sample.mp4");
  return { tracks, mc };
}

test("timeline segments are non-overlapping and ordered", () => {
  const { tracks, mc } = loadFixtureContext();
  const tl = buildTimelineJson(mc, tracks);
  const segs = tl.segments;
  for (let i = 0; i < segs.length; i += 1) {
    assert.ok(segs[i].end > segs[i].start);
    assert.ok(segs[i].duration > 0);
    assert.ok(COVERAGE_ROLE.includes(segs[i].coverage_role));
    if (i > 0) {
      assert.ok(segs[i].start >= segs[i - 1].end - 1e-9);
    }
  }
  if (segs.length > 0) {
    assert.ok(Math.abs(segs[segs.length - 1].end - tl.duration_seconds) < 1e-6);
  }
});

test("timeline does not embed global resolution or codec metadata", () => {
  const { tracks, mc } = loadFixtureContext();
  const tl = buildTimelineJson(mc, tracks);
  const s = JSON.stringify(tl);
  assert.ok(!s.includes("codec"));
  assert.ok(!s.includes("1280"));
});

test("subtitle report is enum-bound with evidence and handling", () => {
  const { tracks, mc } = loadFixtureContext();
  const rep = buildSubtitleReportJson(mc, tracks);
  assert.ok(SUBTITLE_CLASSIFICATION.includes(rep.classification));
  assert.ok(typeof rep.evidence.subtitle_stream_count === "number");
  assert.ok(typeof rep.recommended_handling === "string");
});

test("subtitle mixed when multiple subtitle codec kinds", () => {
  const mc = { duration: { seconds: 10 }, audio_usable: true, subtitle_hints: { subtitle_stream_count: 2 } };
  const tracks = {
    tracks: [
      { stream_index: 0, stream_type: "video", codec_name: "h264" },
      { stream_index: 1, stream_type: "subtitle", codec_name: "subrip" },
      { stream_index: 2, stream_type: "subtitle", codec_name: "hdmv_pgs_subtitle" },
    ],
  };
  const rep = buildSubtitleReportJson(mc, tracks);
  assert.strictEqual(rep.classification, "mixed");
});

test("quality report includes required diagnostics fields", () => {
  const { tracks, mc } = loadFixtureContext();
  const q = buildQualityReportJson(mc, tracks);
  const d = q.diagnostics;
  assert.ok(Object.prototype.hasOwnProperty.call(d, "duration_seconds"));
  assert.ok(Object.prototype.hasOwnProperty.call(d, "bitrate_bits_per_sec"));
  assert.ok(d.resolution && Object.prototype.hasOwnProperty.call(d.resolution, "width"));
  assert.ok(Object.prototype.hasOwnProperty.call(d, "frame_rate"));
  assert.ok(Object.prototype.hasOwnProperty.call(d, "audio_availability"));
  assert.ok(Array.isArray(q.warnings));
  assert.ok(Array.isArray(q.risk_flags));
  assert.ok(q.stream_usability);
});

test("parseFrameRate handles fraction strings", () => {
  assert.strictEqual(parseFrameRate("30/1"), 30);
  assert.strictEqual(parseFrameRate("24000/1001"), 24000 / 1001);
});
