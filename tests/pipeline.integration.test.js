"use strict";

const test = require("node:test");
const assert = require("node:assert");
const fs = require("fs");
const os = require("os");
const path = require("path");
const { spawnSync } = require("child_process");

const { runPipeline } = require("../src/pipeline");

const PROJECT_ROOT = path.join(__dirname, "..");

function which(cmd) {
  const r = spawnSync("which", [cmd], { encoding: "utf8" });
  return r.status === 0 && r.stdout.trim().length > 0;
}

/** Every file written by the pipeline must use one of these relative paths (fixed structure). */
const ALLOWED_RELATIVE_PATHS = new Set([
  "manifest.json",
  "tracks.json",
  "timeline.json",
  "subtitle_report.json",
  "quality_report.json",
  "audio/source_full.wav",
  "debug/ffprobe_raw.json",
  "debug/media_context.json",
  "debug/process_log.json",
]);

function assertRequiredOutputs(outDir) {
  const req = [
    "manifest.json",
    "tracks.json",
    "timeline.json",
    "subtitle_report.json",
    "quality_report.json",
    "debug/ffprobe_raw.json",
    "debug/media_context.json",
    "debug/process_log.json",
  ];
  for (const rel of req) {
    assert.ok(fs.existsSync(path.join(outDir, rel)), `missing ${rel}`);
  }
}

function assertOnlyFixedStructureArtifacts(outDir) {
  function walk(dir, baseRel) {
    for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
      const rel = baseRel ? `${baseRel}/${ent.name}` : ent.name;
      const full = path.join(dir, ent.name);
      if (ent.isDirectory()) {
        walk(full, rel);
      } else {
        assert.ok(
          ALLOWED_RELATIVE_PATHS.has(rel),
          `artifact outside fixed structure: ${rel}`
        );
      }
    }
  }
  walk(outDir, "");
}

test("pipeline success with audio produces wav and all required artifacts", (t) => {
  if (!which("ffmpeg") || !which("ffprobe")) {
    t.skip("ffmpeg/ffprobe not on PATH");
    return;
  }

  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "vis-pipe-"));
  const video = path.join(tmp, "with_audio.mp4");
  const out = path.join(tmp, "out_ok");

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

  const result = runPipeline(video, out);
  assert.equal(result.ok, true);
  assert.equal(result.audio.extracted, true);
  assertRequiredOutputs(out);
  assertOnlyFixedStructureArtifacts(out);
  assert.ok(fs.existsSync(path.join(out, "audio", "source_full.wav")));
});

test("pipeline video-only skips audio wav but writes required artifacts", (t) => {
  if (!which("ffmpeg") || !which("ffprobe")) {
    t.skip("ffmpeg/ffprobe not on PATH");
    return;
  }

  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "vis-pipe-na-"));
  const video = path.join(tmp, "no_audio.mp4");
  const out = path.join(tmp, "out_na");

  const gen = spawnSync(
    "ffmpeg",
    [
      "-y",
      "-f",
      "lavfi",
      "-i",
      "color=c=green:s=64x64:d=0.5",
      "-c:v",
      "libx264",
      "-pix_fmt",
      "yuv420p",
      "-an",
      video,
    ],
    { encoding: "utf8" }
  );
  assert.equal(gen.status, 0, gen.stderr || "");

  const result = runPipeline(video, out);
  assert.equal(result.ok, true);
  assert.equal(result.audio.extracted, false);
  assertRequiredOutputs(out);
  assertOnlyFixedStructureArtifacts(out);
  assert.ok(!fs.existsSync(path.join(out, "audio", "source_full.wav")));
});

test("pipeline fails clearly on missing video", () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "vis-pipe-bad-"));
  const out = path.join(tmp, "out_bad");
  assert.throws(
    () => runPipeline(path.join(tmp, "nope.mp4"), out),
    /does not exist|video file does not exist/i
  );
});

test("node src/index.js --video_path --output_dir runs full pipeline (CLI contract)", (t) => {
  if (!which("ffmpeg") || !which("ffprobe")) {
    t.skip("ffmpeg/ffprobe not on PATH");
    return;
  }

  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "vis-index-cli-"));
  const video = path.join(tmp, "index_cli.mp4");
  const out = path.join(tmp, "out_index_cli");

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

  const cli = spawnSync(
    process.execPath,
    [
      path.join(PROJECT_ROOT, "src", "index.js"),
      `--video_path=${video}`,
      `--output_dir=${out}`,
    ],
    { encoding: "utf8", cwd: PROJECT_ROOT }
  );
  assert.equal(cli.status, 0, cli.stderr || cli.stdout);

  const parsed = JSON.parse(cli.stdout.trim());
  assert.equal(parsed.ok, true);
  assert.equal(parsed.audio.extracted, true);
  assertRequiredOutputs(out);
  assertOnlyFixedStructureArtifacts(out);
  assert.ok(fs.existsSync(path.join(out, "audio", "source_full.wav")));
});
