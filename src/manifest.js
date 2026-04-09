"use strict";

const { SCHEMA_VERSIONS, FIXED_OUTPUT_STRUCTURE } = require("./contracts");

function buildManifestJson({
  videoBasename,
  pipelineStatus,
  artifactsRelative,
  audioExtracted,
}) {
  return {
    schema_version: SCHEMA_VERSIONS.manifest || "1.0.0",
    artifact: "manifest",
    pipeline_status: pipelineStatus,
    input_identity: {
      path_basename: videoBasename,
    },
    schema_versions: { ...SCHEMA_VERSIONS },
    artifacts_present: artifactsRelative.sort(),
    required_outputs_declared: [...FIXED_OUTPUT_STRUCTURE.required_files],
    conditional_audio: {
      path: "audio/source_full.wav",
      extracted: Boolean(audioExtracted),
    },
  };
}

module.exports = {
  buildManifestJson,
};
