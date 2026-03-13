# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Client-side React app for cleaning artifacts from scanned images. All image processing runs in the browser using Canvas API pixel manipulation (no server, no OpenCV). Deployed to GitHub Pages via CI on push to main.

## Commands

- `npm run dev` — start Vite dev server
- `npm run build` — typecheck with `tsc -b` then bundle with Vite
- `npm run lint` — ESLint across the project
- `npm run preview` — preview production build locally

## Architecture

Single-page app with no routing. The processing pipeline in `src/utils/imageProcessing.ts` is the core logic:

1. Convert all pixels to HSV color space
2. Identify "black" pixels (low brightness + low saturation) and build a mask
3. Find candidate artifacts: bright + low saturation pixels whose local mean saturation (box blur) is also low
4. Filter candidates by proximity to black pixels (structuring element / dilation) — pixels near black are kept (whitelisted), others are marked for removal
5. Apply morphological opening (erode then dilate) to clean up the removal mask
6. Replace marked pixels with transparency

The visualization overlay color-codes pixels: red = black, blue = near-black whitelisted, green = removed, purple = manually whitelisted.

`App.tsx` orchestrates state and debounces parameter changes (300ms). `ImageDisplay.tsx` handles synchronized side-by-side canvas rendering with zoom and a whitelist brush tool (paint on the original to protect pixels from removal).

## Git Conventions

- Keep commits small enough for a single subject line when possible
- When a body is needed, use bullet points with `-`; don't hard wrap body lines
- Never manually add PR numbers like `(#9)` to commit subject lines — GitHub adds these automatically during squash merge
- Default PR merge: `gh pr merge --squash --delete-branch && git fetch --prune`
- Always run `npm run lint` before committing
