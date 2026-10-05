import { createWriteStream } from "node:fs";
import { mkdir, stat, rename, rm } from "node:fs/promises";
import { get } from "node:https";
import { pipeline } from "node:stream/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const targetDir = resolve(__dirname, "../../../ephemeris");
const baseUrl = "https://raw.githubusercontent.com/aloistr/swisseph/master/ephe";
const files = ["sepl_18.se1", "semo_18.se1", "seas_18.se1"];

const exists = async (path) => {
  try {
    return (await stat(path)).size > 0;
  } catch {
    return false;
  }
};

const download = async (url, targetPath) => {
  const temporary = `${targetPath}.${process.pid}.part`;
  try {
    await new Promise((resolvePromise, reject) => {
      const request = get(url, (response) => {
        if (response.statusCode !== 200) {
          reject(new Error(`Failed to download ${url}: HTTP ${response.statusCode}`));
          response.resume();
          return;
        }
        pipeline(response, createWriteStream(temporary)).then(resolvePromise, reject);
      });
      request.setTimeout(60000, () => request.destroy(new Error(`Download timed out: ${url}`)));
      request.on("error", reject);
    });
    if (!(await exists(temporary))) throw new Error(`Downloaded empty ephemeris: ${url}`);
    await rename(temporary, targetPath);
  } catch (error) {
    await rm(temporary, { force: true });
    throw error;
  }
};

await mkdir(targetDir, { recursive: true });

for (const file of files) {
  const targetPath = resolve(targetDir, file);

  if (await exists(targetPath)) {
    console.log(`exists ${targetPath}`);
    continue;
  }

  const url = `${baseUrl}/${file}`;
  console.log(`download ${url}`);
  await download(url, targetPath);
}

console.log(`Swiss Ephemeris files are ready in ${targetDir}`);
