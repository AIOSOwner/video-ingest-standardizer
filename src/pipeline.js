"use strict";

const fs = require("fs");
const path = require("path");

const { printFailureAndExit } = require("./errors");
const { resolveOutputPaths } = require("./paths");
const { writeJsonFile, readJsonFile } = require("./json");
const { runProbePhase } = require("./probe");
const { buildTimelineJson } = require("./timeline");
const { buildSubtitleReportJson } = require("./subtitles");
const { buildQualityReportJson } = require("./quality");
const { extractFullAudioWav } = require("./audio");
const { buildManifestJson } = require("./manifest");

function runIngestStage(videoPath, outputDir) {
  const absVideo = path.resolve(videoPath);
  const absOut = path.resolve(outputDir);
  const paths = resolveOutputPaths(absOut);
  const steps = [];

  fs.mkdirSync(absOut, { recursive: true });

  runProbePhase(absVideo, absOut);
  steps.push({ name: "probe", status: "ok", detail: {} });

  const tracks = readJsonFile(paths.tracks);
  const mc = readJsonFile(paths.debug_media_context);

  writeJsonFile(paths.timeline, buildTimelineJson(mc, tracks));
  steps.push({ name: "timeline", status: "ok", detail: {} });

  writeJsonFile(paths.subtitle_report, buildSubtitleReportJson(mc, tracks));
  steps.push({ name: "subtitle_report", status: "ok", detail: {} });

  writeJsonFile(paths.quality_report, buildQualityReportJson(mc, tracks));
  steps.push({ name: "quality_report", status: "ok", detail: {} });

  fs.mkdirSync(path.dirname(paths.audio_source_full_wav), { recursive: true });
  if (fs.existsSync(paths.audio_source_full_wav)) {
    fs.unlinkSync(paths.audio_source_full_wav);
  }

  const audioResult = extractFullAudioWav(
    absVideo,
    paths.audio_source_full_wav,
    mc,
    tracks
  );

  if (!audioResult.extracted && fs.existsSync(paths.audio_source_full_wav)) {
    fs.unlinkSync(paths.audio_source_full_wav);
  }

  steps.push({
    name: "audio_extract",
    status: audioResult.extracted ? "ok" : "skipped",
    detail: { reason: audioResult.reason || "" },
  });

  const artifactsRelative = [
    "debug/ffprobe_raw.json",
    "debug/media_context.json",
    "tracks.json",
    "timeline.json",
    "subtitle_report.json",
    "quality_report.json",
    "manifest.json",
    "debug/process_log.json",
  ];
  if (audioResult.extracted) {
    artifactsRelative.push("audio/source_full.wav");
  }

  writeJsonFile(
    paths.manifest,
    buildManifestJson({
      videoBasename: path.basename(absVideo),
      pipelineStatus: "completed",
      artifactsRelative,
      audioExtracted: audioResult.extracted,
    })
  );
  steps.push({ name: "manifest", status: "ok", detail: {} });

  writeJsonFile(paths.debug_process_log, {
    schema_version: "1.0.0",
    artifact: "process_log",
    pipeline_status: "completed",
    steps,
  });

  return {
    ok: true,
    message: "pipeline_complete",
    output_dir: absOut,
    audio: audioResult,
  };
}

// if (require.main === module) {
//   try {
//     const { parseArgs } = require("./index");
//     const inputs = parseArgs(process.argv.slice(2));
//     const result = runIngestStage(inputs.video_path, inputs.output_dir);
//     process.stdout.write(`${JSON.stringify(result)}\n`);
//   } catch (err) {
//     printFailureAndExit(err);
//   }
// }

module.exports = {
  runIngestStage,
};
