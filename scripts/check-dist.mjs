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
const favicon = html.match(/<link\b[^>]*rel="icon"[^>]*href="([^"?]+)"/);
if (!favicon || !/^\.?\/assets\/favicon-[\w-]+\.svg$/.test(favicon[1]))
  throw Error("Missing built theme favicon in dist HTML");
await stat(join("dist", favicon[1].replace(/^\.?\//, "")));
console.log(
  `Verified index.html + assets/ (${(total / 1024 / 1024).toFixed(2)} MiB uncompressed assets)`,
);
