const assert = require("node:assert/strict");
const fs = require("node:fs");
const Module = require("node:module");
const os = require("node:os");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const serverFile = path.join(root, "server.js");
const packagedFile = path.join(root, "data", "publicSymbolSnapshot.json");

function loadResolver(dataDir) {
  const previousDataDir = process.env.DATA_DIR;
  process.env.DATA_DIR = dataDir;
  try {
    let source = fs.readFileSync(serverFile, "utf8");
    const serverStart = source.indexOf("const server = http.createServer");
    assert.ok(serverStart > 0, "server entry-point boundary should be present");
    source = `${source.slice(0, serverStart)}
module.exports = {
  ensureSymbolUniverseForScan,
  packagedSymbolUniverse,
};
`;
    const runtimeModule = new Module(serverFile, module);
    runtimeModule.filename = serverFile;
    runtimeModule.paths = Module._nodeModulePaths(root);
    runtimeModule._compile(source, serverFile);
    return runtimeModule.exports;
  } finally {
    if (previousDataDir === undefined) delete process.env.DATA_DIR;
    else process.env.DATA_DIR = previousDataDir;
  }
}

async function main() {
  const packagedDocument = JSON.parse(fs.readFileSync(packagedFile, "utf8"));
  const originalTimestamp =
    packagedDocument.snapshotMetadata?.generatedAt ||
    packagedDocument.symbolUniverseMetadata?.generatedAt;
  assert.ok(originalTimestamp, "checked-in packaged snapshot should carry a source timestamp");

  const writableDataDir = fs.mkdtempSync(path.join(os.tmpdir(), "pti-packaged-first-run-"));
  try {
    let networkCalls = 0;
    const resolver = loadResolver(writableDataDir);
    const previousFetch = global.fetch;
    global.fetch = async () => {
      networkCalls += 1;
      throw new Error("network must not be called when the packaged snapshot is valid");
    };
    const resolved = await resolver.ensureSymbolUniverseForScan().finally(() => {
      global.fetch = previousFetch;
    });
    assert.equal(networkCalls, 0, "valid packaged first-run resolution must avoid live requests");
    assert.equal(resolved.symbols.length, 3200, "production normalization must retain exactly 3,200 packaged symbols");
    assert.equal(new Set(resolved.symbols.map((row) => row.canonicalTicker)).size, 3200);
    assert.equal(resolved.symbols.some((row) => /\d/.test(row.canonicalTicker)), false);
    assert.equal(resolved.symbolUniverseMetadata.source, "Cached Public Snapshot");
    assert.equal(resolved.symbolUniverseMetadata.refreshStatus, "packaged-snapshot");
    assert.equal(resolved.symbolUniverseMetadata.generatedAt, originalTimestamp, "seeding must not renew source time");

    for (const filename of ["symbolUniverse.json", "publicSymbolSnapshot.json"]) {
      const saved = JSON.parse(fs.readFileSync(path.join(writableDataDir, filename), "utf8"));
      assert.equal(saved.symbolUniverseMetadata.generatedAt, originalTimestamp);
      assert.equal(saved.symbolUniverseMetadata.source, "Cached Public Snapshot");
      assert.equal(saved.symbols.length, 3200);
    }
  } finally {
    fs.rmSync(writableDataDir, { recursive: true, force: true });
  }

  const blockedParent = fs.mkdtempSync(path.join(os.tmpdir(), "pti-packaged-seed-failure-"));
  const blockedDataDir = path.join(blockedParent, "not-a-directory");
  fs.writeFileSync(blockedDataDir, "seeding must fail here", "utf8");
  try {
    let networkCalls = 0;
    const resolver = loadResolver(blockedDataDir);
    const previousFetch = global.fetch;
    global.fetch = async () => {
      networkCalls += 1;
      throw new Error("network must not be called after packaged in-memory success");
    };
    const resolved = await resolver.ensureSymbolUniverseForScan().finally(() => {
      global.fetch = previousFetch;
    });
    assert.equal(networkCalls, 0, "seeding failure must not trigger a live refresh");
    assert.equal(resolved.symbols.length, 3200, "packaged data must remain usable in memory");
    assert.match(resolved.symbolUniverseMetadata.refreshNotes.join(" "), /persistent seeding failed/i);
  } finally {
    fs.rmSync(blockedParent, { recursive: true, force: true });
  }

  for (const failedFilename of ["publicSymbolSnapshot.json", "symbolUniverse.json"]) {
    const partialFailureDir = fs.mkdtempSync(path.join(os.tmpdir(), "pti-packaged-partial-failure-"));
    const originalRename = fs.renameSync;
    try {
      let networkCalls = 0;
      const resolver = loadResolver(partialFailureDir);
      fs.renameSync = (from, to) => {
        if (path.basename(to) === failedFilename) {
          const error = new Error("simulated persistence failure");
          error.code = "EACCES";
          throw error;
        }
        return originalRename(from, to);
      };
      const previousFetch = global.fetch;
      global.fetch = async () => {
        networkCalls += 1;
        throw new Error("network must not be called after packaged in-memory success");
      };
      const resolved = await resolver.ensureSymbolUniverseForScan().finally(() => {
        global.fetch = previousFetch;
      });
      assert.equal(networkCalls, 0, `${failedFilename} failure must not trigger a live refresh`);
      assert.equal(resolved.symbols.length, 3200, `${failedFilename} failure must preserve in-memory packaged data`);
      assert.match(resolved.symbolUniverseMetadata.refreshNotes.join(" "), /persistent seeding failed/i);
    } finally {
      fs.renameSync = originalRename;
      fs.rmSync(partialFailureDir, { recursive: true, force: true });
    }
  }

  console.log("Packaged symbol first-run integration contract passed.");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
