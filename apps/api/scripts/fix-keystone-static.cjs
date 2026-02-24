const fs = require("fs");
const path = require("path");

const resolveCoreRoot = () => {
  const pkgPath = require.resolve("@keystone-6/core/package.json");
  return path.dirname(pkgPath);
};

const copyIfMissing = (source, target) => {
  if (fs.existsSync(target)) return false;
  if (!fs.existsSync(source)) return false;
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.copyFileSync(source, target);
  return true;
};

try {
  const coreRoot = resolveCoreRoot();
  const source = path.join(coreRoot, "static", "dev-loading.html");
  const target = path.join(coreRoot, "scripts", "cli", "static", "dev-loading.html");
  const changed = copyIfMissing(source, target);

  if (changed) {
    console.log("[colonus/api] patched Keystone static path for dev-loading.html");
  }
} catch (error) {
  console.warn("[colonus/api] keystone static fix skipped:", error && error.message ? error.message : error);
}

