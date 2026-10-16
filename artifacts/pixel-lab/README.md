# PixelLab

PixelLab is a browser-based computer graphics learning lab. The left rail selects a concept, the signed-coordinate grid shows the geometry and active raster steps, and the right panel explains the current decision.

## Run locally

From the workspace root:

```sh
pnpm install
pnpm --filter @workspace/pixel-lab run dev
```

Build with `pnpm --filter @workspace/pixel-lab run build`, check TypeScript with `pnpm --filter @workspace/pixel-lab run typecheck`, and run pure algorithm tests with `pnpm --filter @workspace/pixel-lab run test`.

## Using the lab

- Choose DDA, Bresenham, midpoint circle, a 2D transform, Cohen–Sutherland clipping, or Liang–Barsky clipping in the left rail.
- Edit the numeric parameters in the learning panel and choose **Visualize trace** to rerun from step one.
- Use Play/Pause, Next, Reset, and speed controls below the canvas. Space toggles playback and the right arrow advances one step.
- Line endpoints and clipping regions use signed integer coordinates. Transforms work on an editable triangle or rectangle; matrices and vertex coordinates are shown in the panel. Rotation angle and scale factors accept decimals.
- Liang–Barsky includes accepted, rejected, and partially clipped example segments. Each boundary step shows p, q, and the entering/leaving parameters u₁ and u₂.
- Raster pixels appear progressively during playback. Transformations animate between the original and transformed shape; clipping marks the active boundary and intersection.
- Missing, non-finite, or non-integer raster coordinates are reported before a trace runs; transform and clipping fields accept finite decimals where appropriate.

The algorithm implementations are pure functions in `src/lib/algorithms.ts`; their recorded step arrays power the animation and lesson details. There is no backend or persistence.
Rasterized lines and circles are limited to 10,000 pixels per input to keep each visualization responsive; larger requests show a validation message.
