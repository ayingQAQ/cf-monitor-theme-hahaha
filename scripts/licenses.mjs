import { readFile, writeFile, readdir, copyFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { dirname, join, resolve } from "node:path";
const seen = new Set(),
  sections = [];
async function visit(name, from) {
  const req = createRequire(from);
  let dir;
  try {
    dir = dirname(req.resolve(`${name}/package.json`));
  } catch {
    dir = dirname(req.resolve(name));
    while (true) {
      try {
        const pkg = JSON.parse(
          await readFile(join(dir, "package.json"), "utf8"),
        );
        if (pkg.name === name) break;
      } catch {}
      const up = dirname(dir);
      if (up === dir) throw Error(`Cannot locate license for ${name}`);
      dir = up;
    }
  }
  const pkg = JSON.parse(await readFile(join(dir, "package.json"), "utf8"));
  const id = `${pkg.name}@${pkg.version}`;
  if (seen.has(id)) return;
  seen.add(id);
  const files = (await readdir(dir)).filter((f) =>
    /^(licen[sc]e|copying|copyright)(\.|$)/i.test(f),
  );
  if (
    !files.length &&
    !["@vue/devtools-api", "@lit-labs/ssr-dom-shim"].includes(pkg.name)
  )
    throw Error(`Missing license file: ${id}`);
  sections.push(
    `${id} (${pkg.license || "see license"})\n${files.length ? (await Promise.all(files.map((f) => readFile(join(dir, f), "utf8")))).join("\n") : pkg.name === "@vue/devtools-api" ? await readFile("src/assets/VUE-DEVTOOLS-LICENSE.txt", "utf8") : "Copyright 2019 Google LLC\n" + (await readFile("node_modules/lit/LICENSE", "utf8"))}`,
  );
  for (const child of Object.keys(pkg.dependencies || {}))
    await visit(child, join(dir, "package.json"));
}
const root = resolve("package.json"),
  pkg = JSON.parse(await readFile(root, "utf8"));
for (const name of Object.keys(pkg.dependencies)) await visit(name, root);
for (const file of [
  "src/assets/fonts/LongCang-OFL.txt",
  "src/assets/fonts/PatrickHand-OFL.txt",
  "src/assets/RAKUGAKI-LICENSE.txt",
  "src/assets/CF-SERVER-MONITOR-LICENSE.txt",
])
  sections.push(`${file}\n${await readFile(file, "utf8")}`);
const notices = sections.join("\n\n" + "=".repeat(72) + "\n\n");
await writeFile("THIRD_PARTY_NOTICES.txt", notices);
await copyFile("LICENSE", "dist/assets/LICENSE.txt");
await writeFile("dist/assets/THIRD_PARTY_NOTICES.txt", notices);
console.log(
  `Preserved licenses for ${seen.size} runtime packages, fonts and geographic data.`,
);
