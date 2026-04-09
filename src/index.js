"use strict";

const { ERROR_CODES, makeError, printFailureAndExit } = require("./errors");
const { assertAbsolutePath } = require("./paths");
const { runPipeline } = require("./pipeline");

function parseArgs(argv) {
  const out = {
    video_path: null,
    output_dir: null,
  };

  for (const token of argv) {
    if (!token.startsWith("--")) {
      throw makeError(
        ERROR_CODES.INVALID_CLI_USAGE,
        "Positional args are not allowed",
        { token }
      );
    }

    const eqIndex = token.indexOf("=");
    if (eqIndex === -1) {
      throw makeError(
        ERROR_CODES.INVALID_CLI_USAGE,
        "Flags must be in --key=value form",
        { token }
      );
    }

    const key = token.slice(2, eqIndex);
    const value = token.slice(eqIndex + 1);

    if (key !== "video_path" && key !== "output_dir") {
      throw makeError(
        ERROR_CODES.INVALID_CLI_USAGE,
        "Only --video_path and --output_dir are supported",
        { key }
      );
    }

    if (key === "video_path") out.video_path = value;
    if (key === "output_dir") out.output_dir = value;
  }

  if (!out.video_path || !out.output_dir) {
    throw makeError(
      ERROR_CODES.INVALID_CLI_USAGE,
      "Missing required flags",
      { required_flags: ["--video_path", "--output_dir"] }
    );
  }

  const videoError = assertAbsolutePath("video_path", out.video_path);
  if (videoError) {
    throw makeError(ERROR_CODES.INVALID_PATH, videoError, { video_path: out.video_path });
  }

  const outputError = assertAbsolutePath("output_dir", out.output_dir);
  if (outputError) {
    throw makeError(ERROR_CODES.INVALID_PATH, outputError, { output_dir: out.output_dir });
  }

  return out;
}

function dispatchPipeline(inputs) {
  return runPipeline(inputs.video_path, inputs.output_dir);
}

function main() {
  try {
    const inputs = parseArgs(process.argv.slice(2));
    const result = dispatchPipeline(inputs);
    process.stdout.write(`${JSON.stringify(result)}\n`);
  } catch (err) {
    printFailureAndExit(err);
  }
}

if (require.main === module) {
  main();
}

module.exports = {
  parseArgs,
  dispatchPipeline,
  main,
};
