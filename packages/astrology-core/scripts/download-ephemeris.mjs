import { createWriteStream } from "node:fs";
import { mkdir, stat } from "node:fs/promises";
import { get } from "node:https";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const targetDir = resolve(__dirname, "../../../ephemeris");
const baseUrl = "https://raw.githubusercontent.com/aloistr/swisseph/master/ephe";
const files = ["sepl_18.se1", "semo_18.se1", "seas_18.se1"];

const exists = async (path) => {
  try {
    await stat(path);
    return true;
  } catch {
    return false;
  }
};

const download = async (url, targetPath) =>
  new Promise((resolvePromise, reject) => {
    const request = get(url, (response) => {
      if (response.statusCode !== 200) {
        reject(new Error(`Failed to download ${url}: HTTP ${response.statusCode}`));
        response.resume();
        return;
      }

      const file = createWriteStream(targetPath);
      response.pipe(file);
      file.on("finish", () => {
        file.close(resolvePromise);
      });
    });

    request.on("error", reject);
  });

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

