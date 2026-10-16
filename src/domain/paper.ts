export function tornContour(w: number, h: number, seed: number) {
  const jiggle = (i: number) =>
    Math.sin(i * 7.93 + seed) * 1.4 + Math.cos(i * 3.73 + seed) * 1.2;
  const edge = 6;
  const points: number[][] = [[edge, edge + 3]];
  let i = 0;
  for (let x = edge + 10; x < w - 26; x += 14)
    points.push([x, edge + jiggle(i++)]);
  points.push([w - 26, edge], [w - edge, 24]);
  for (let y = 31; y < h - edge; y += 13)
    points.push([w - edge + jiggle(i++), y]);
  points.push([w - edge, h - edge - 1]);
  for (let x = w - edge - 13; x > edge; x -= 12)
    points.push([x, h - edge + jiggle(i++)]);
  points.push([edge, h - edge]);
  for (let y = h - edge - 13; y > edge + 6; y -= 17)
    points.push([edge + jiggle(i++), y]);
  return (
    points
      .map(([x, y], k) => `${k ? "L" : "M"}${x.toFixed(1)} ${y.toFixed(1)}`)
      .join(" ") + " Z"
  );
}
