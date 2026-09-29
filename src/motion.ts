export function renderMotion(
  current: Uint8ClampedArray,
  previous: Uint8ClampedArray | null,
  output: Uint8ClampedArray,
  threshold: number,
) {
  for (let i = 0; i < current.length; i += 4) {
    const difference = previous
      ? Math.max(
          Math.abs(current[i] - previous[i]),
          Math.abs(current[i + 1] - previous[i + 1]),
          Math.abs(current[i + 2] - previous[i + 2]),
        )
      : 0
    const moving = difference > threshold
    output[i] = moving ? 255 : 0
    output[i + 1] = moving ? 255 : 0
    output[i + 2] = moving ? 255 : 0
    output[i + 3] = current[i + 3]
  }
}
