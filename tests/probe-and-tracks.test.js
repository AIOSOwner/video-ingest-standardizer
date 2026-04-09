"use strict";

const test = require("node:test");
const assert = require("node:assert");
const fs = require("fs");
const os = require("os");
const path = require("path");
const { spawnSync } = require("child_process");

const { readJsonFile, writeJsonFile, sortKeysDeep } = require("../src/json");
const { normalizeProbe, runProbePhase } = require("../src/probe");
const { buildTracksJson } = require("../src/tracks");
const { buildMediaContextJson } = require("../src/media-context");

const FIXTURE = path.join(__dirname, "fixtures", "probe", "sample_normalized.json");

test("normalizeProbe is deterministic for identical input", () => {
  const raw = readJsonFile(FIXTURE);
  const a = normalizeProbe(raw);
  const b = normalizeProbe(raw);
  assert.deepStrictEqual(a, b);
});

test("buildTracksJson preserves stream order and counts", () => {
  const raw = readJsonFile(FIXTURE);
  const n = normalizeProbe(raw);
  const t = buildTracksJson(n);
  assert.equal(t.schema_version, "1.0.0");
  assert.equal(t.stream_count, 3);
  assert.equal(t.tracks[0].stream_index, 0);
  assert.equal(t.tracks[1].stream_index, 1);
  assert.equal(t.tracks[2].stream_index, 2);
});

test("buildMediaContextJson includes required fields", () => {
  const raw = readJsonFile(FIXTURE);
  const n = normalizeProbe(raw);
  const mc = buildMediaContextJson(n, "/tmp/example/in.mp4");
  assert.equal(mc.schema_version, "1.0.0");
  assert.equal(mc.input_identity.path_basename, "in.mp4");
  assert.equal(mc.audio_usable, true);
  assert.equal(mc.subtitle_hints.subtitle_stream_count, 1);
  assert.equal(mc.subtitle_hints.has_soft_subtitles, true);
  assert.equal(mc.duration.seconds, 10.5);
  assert.ok(mc.primary_video);
  assert.ok(mc.primary_audio);
});

test("sortKeysDeep yields stable stringify for same logical object", () => {
  const obj = { z: 1, a: { m: 2, b: 3 } };
  const s1 = JSON.stringify(sortKeysDeep(obj));
  const s2 = JSON.stringify(sortKeysDeep(obj));
  assert.strictEqual(s1, s2);
});

test("writeJsonFile produces stable output across runs", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "vis-json-"));
  const p = path.join(dir, "out.json");
  const data = { b: 2, a: 1 };
  writeJsonFile(p, data);
  const once = fs.readFileSync(p, "utf8");
  writeJsonFile(p, data);
  const twice = fs.readFileSync(p, "utf8");
  assert.strictEqual(once, twice);
});

function which(cmd) {
  const r = spawnSync("which", [cmd], { encoding: "utf8" });
  return r.status === 0 && r.stdout.trim().length > 0;
}

test("integration: runProbePhase twice yields identical artifact JSON (requires ffmpeg+ffprobe)", (t) => {
  if (!which("ffprobe") || !which("ffmpeg")) {
    t.skip("ffprobe/ffmpeg not available on PATH");
    return;
  }

  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "vis-probe-"));
  const video = path.join(tmp, "tiny.mp4");
  const out1 = path.join(tmp, "out1");
  const out2 = path.join(tmp, "out2");

  const gen = spawnSync(
    "ffmpeg",
    [
      "-y",
      "-f",
      "lavfi",
      "-i",
      "color=c=black:s=64x64:d=0.4",
      "-f",
      "lavfi",
      "-i",
      "sine=frequency=440:sample_rate=48000:duration=0.4",
      "-c:v",
      "libx264",
      "-pix_fmt",
      "yuv420p",
      "-c:a",
      "aac",
      "-shortest",
      video,
    ],
    { encoding: "utf8" }
  );
  assert.equal(gen.status, 0, gen.stderr || "");

  fs.mkdirSync(out1, { recursive: true });
  fs.mkdirSync(out2, { recursive: true });

  runProbePhase(video, out1);
  runProbePhase(video, out2);

  const load = (dir) => ({
    ff: readJsonFile(path.join(dir, "debug", "ffprobe_raw.json")),
    tr: readJsonFile(path.join(dir, "tracks.json")),
    mc: readJsonFile(path.join(dir, "debug", "media_context.json")),
  });

  assert.deepStrictEqual(load(out1), load(out2));
});
