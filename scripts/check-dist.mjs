import { readdir, readFile, stat } from "node:fs/promises";
import { join } from "node:path";
const files = (await readdir("dist")).sort();
if (JSON.stringify(files) !== '["assets","index.html"]')
  throw Error(`Invalid dist root: ${files}`);
let total = 0;
for (const name of await readdir("dist/assets")) {
  if (/(?:^|[-_.])(flags|os-icons)(?:[-_.]|$)/i.test(name))
    throw Error(`Bundled default-skin resource: ${name}`);
  total += (await stat(join("dist/assets", name))).size;
}
const html = await readFile("dist/index.html", "utf8");
if (/\/src\/|\/fonts\/|theme\.json|theme\.tar\.gz/.test(html))
  throw Error("Legacy or source path in dist HTML");
console.log(
  `Verified index.html + assets/ (${(total / 1024 / 1024).toFixed(2)} MiB uncompressed assets)`,
);
