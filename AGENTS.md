# AGENTS.md

Read `README.md` first for the product overview, processing parameters, and the standard development workflow.

## Repository Guidance

- The image-processing pipeline lives in `src/utils/imageProcessing.ts`; preserve the sequence of mask generation, neighbourhood filtering, morphology, and transparency replacement unless you are deliberately changing the algorithm.
- `src/App.tsx` owns parameter state, orchestration, and debounced processing.
- `src/components/ImageDisplay.tsx` handles the side-by-side canvas presentation, zooming, and whitelist interaction.
- Run `npm run build` and `npm run lint` before handing work off.
