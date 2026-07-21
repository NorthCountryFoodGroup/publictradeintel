"use strict";

const fs = require("node:fs");
const path = require("node:path");

function resolveDataDirectory(root, configuredValue) {
  const configured = String(configuredValue || "").trim();
  return configured ? path.resolve(configured) : path.join(root, "data");
}

function validateDataDirectory(directory, { production = false, configured = false, fileSystem = fs } = {}) {
  if (production && !configured) throw new Error("DATA_DIR is required in production.");
  fileSystem.mkdirSync(directory, { recursive: true });
  const stat = fileSystem.statSync(directory);
  if (!stat.isDirectory()) throw new Error("Runtime storage is not a directory.");
  const probe = path.join(directory, `.storage-probe.${process.pid}.${Date.now()}`);
  try {
    const descriptor = fileSystem.openSync(probe, "wx");
    fileSystem.writeSync(descriptor, "ok");
    fileSystem.fsyncSync(descriptor);
    fileSystem.closeSync(descriptor);
    fileSystem.unlinkSync(probe);
  } catch {
    try { if (fileSystem.existsSync(probe)) fileSystem.unlinkSync(probe); } catch {}
    throw new Error("Runtime storage is not writable.");
  }
  return { healthy: true };
}

module.exports = {
  resolveDataDirectory,
  validateDataDirectory,
};
