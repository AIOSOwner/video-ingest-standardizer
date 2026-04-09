"use strict";

const test = require("node:test");
const assert = require("node:assert");
const crypto = require("crypto");
const fs = require("fs");
const os = require("os");
const path = require("path");
const { spawnSync } = require("child_process");

const { readJsonFile, sortKeysDeep } = require("../src/json");
const { runPipeline } = require("../src/pipeline");

function which(cmd) {
  const r = spawnSync("which", [cmd], { encoding: "utf8" });
  return r.status === 0 && r.stdout.trim().length > 0;
}

function stableJsonString(obj) {
  return JSON.stringify(sortKeysDeep(obj));
}

function sha256File(filePath) {
  const h = crypto.createHash("sha256");
  h.update(fs.readFileSync(filePath));
  return h.digest("hex");
}

const JSON_ARTIFACTS = [
  "manifest.json",
  "tracks.json",
  "timeline.json",
  "subtitle_report.json",
  "quality_report.json",
  "debug/ffprobe_raw.json",
  "debug/media_context.json",
  "debug/process_log.json",
];

test("full pipeline: two runs on the same input yield identical JSON artifacts and WAV (requires ffmpeg+ffprobe)", (t) => {
  if (!which("ffmpeg") || !which("ffprobe")) {
    t.skip("ffmpeg/ffprobe not on PATH");
    return;
  }

  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "vis-det-"));
  const video = path.join(tmp, "determinism.mp4");
  const out1 = path.join(tmp, "run1");
  const out2 = path.join(tmp, "run2");

  const gen = spawnSync(
    "ffmpeg",
    [
      "-y",
      "-f",
      "lavfi",
      "-i",
      "color=c=blue:s=128x128:d=0.6",
      "-f",
      "lavfi",
      "-i",
      "sine=frequency=440:sample_rate=48000:duration=0.6",
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

  const r1 = runPipeline(video, out1);
  const r2 = runPipeline(video, out2);
  assert.equal(r1.ok, true);
  assert.equal(r2.ok, true);
  assert.equal(r1.audio.extracted, true);
  assert.equal(r2.audio.extracted, true);

  for (const rel of JSON_ARTIFACTS) {
    const p1 = path.join(out1, rel);
    const p2 = path.join(out2, rel);
    assert.ok(fs.existsSync(p1), rel);
    assert.ok(fs.existsSync(p2), rel);
    const s1 = stableJsonString(readJsonFile(p1));
    const s2 = stableJsonString(readJsonFile(p2));
    assert.strictEqual(s1, s2, `mismatch: ${rel}`);
  }

  const wav1 = path.join(out1, "audio", "source_full.wav");
  const wav2 = path.join(out2, "audio", "source_full.wav");
  assert.ok(fs.existsSync(wav1));
  assert.ok(fs.existsSync(wav2));
  assert.strictEqual(sha256File(wav1), sha256File(wav2));
});
