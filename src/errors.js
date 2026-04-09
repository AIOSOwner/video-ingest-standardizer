"use strict";

const ERROR_CODES = Object.freeze({
  INVALID_CLI_USAGE: "INVALID_CLI_USAGE",
  INVALID_PATH: "INVALID_PATH",
  PIPELINE_NOT_IMPLEMENTED: "PIPELINE_NOT_IMPLEMENTED",
  INTERNAL_ERROR: "INTERNAL_ERROR",
});

function makeError(code, message, details) {
  const err = new Error(message);
  err.code = code;
  err.details = details || {};
  return err;
}

function toFailurePayload(err) {
  const code = err && err.code ? err.code : ERROR_CODES.INTERNAL_ERROR;
  const message = err && err.message ? err.message : "Unexpected internal error";
  const details = err && err.details ? err.details : {};

  return {
    ok: false,
    error: {
      code,
      message,
      human_readable: message,
      details,
    },
  };
}

function printFailureAndExit(err) {
  process.stdout.write(`${JSON.stringify(toFailurePayload(err))}\n`);
  process.exit(1);
}

module.exports = {
  ERROR_CODES,
  makeError,
  toFailurePayload,
  printFailureAndExit,
};
