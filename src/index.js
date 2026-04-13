"use strict";

const fs = require("fs");
const path = require("path");
const { runIngestStage } = require("./pipeline");

function parseArgs(argv) {
  let input_json = null;
  let output_dir = null;

  for (const token of argv) {
    if (!token.startsWith("--")) continue;
    const [k, v] = token.replace("--", "").split("=");
    if (k === "input_json") input_json = v;
    if (k === "output_dir") output_dir = v;
  }

  if (!input_json || !output_dir) {
    throw new Error("Missing required args: --input_json and --output_dir");
  }

  return { input_json, output_dir };
}

function loadInput(p) {
  return JSON.parse(fs.readFileSync(p, "utf8"));
}

function writeOutput(dir, data) {
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(
    path.join(dir, "stage_output.json"),
    JSON.stringify(data, null, 2)
  );
}

function main() {
  let output_dir = null;

  try {
    const parsed = parseArgs(process.argv.slice(2));
    output_dir = parsed.output_dir;

    const input = loadInput(parsed.input_json);
    if (!input.inputs || !input.inputs.video_path) {
      throw new Error("Missing inputs.video_path");
    }
    const videoPath = input.inputs.video_path;

    const result = runIngestStage(videoPath, output_dir);

    const artifacts = {
      timeline_json: "timeline.json",
      subtitle_report_json: "subtitle_report.json",
      quality_report_json: "quality_report.json",
      manifest_json: "manifest.json"
    };
    
    if (result.audio?.extracted) {
      artifacts.audio_source_wav = "audio/source_full.wav";
    }

    writeOutput(output_dir, {
      status: "SUCCESS",
      artifacts,
      error: null
    });
  } catch (err) {
    if (output_dir) {
      writeOutput(output_dir, {
        status: "FAILED",
        artifacts: {},
        error: {
          message: err.message,
          code: "INGEST_ERROR"
        }
      });
    }
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}

module.exports = {
  parseArgs,
  loadInput,
  writeOutput,
  main,
};