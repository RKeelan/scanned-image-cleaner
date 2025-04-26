interface ProcessingParams {
  brightnessThreshold: number;
  saturationThreshold: number;
  meanSaturationThreshold: number;
  blackPixelBrightnessThreshold: number;
  blackPixelSaturationThreshold: number;
  structuringElementSize: number;
  blurKernelSize: number;
  morphOpeningKernelSize: number;
}

export const defaultParams: ProcessingParams = {
  brightnessThreshold: 78,
  saturationThreshold: 16,
  meanSaturationThreshold: 16,
  blackPixelBrightnessThreshold: 25,
  blackPixelSaturationThreshold: 31,
  structuringElementSize: 25,
  blurKernelSize: 12,
  morphOpeningKernelSize: 3,
};

interface ProcessingResult {
  processedImage: ImageData;
  visualizationImage: ImageData;
  stats: {
    brightPixels: number;
    lowSaturationPixels: number;
    candidateArtifacts: number;
    lowSaturationAreas: number;
    nearBlackPixels: number;
    replacedPixels: number;
    blackPixels: number;
    thresholds: {
      brightnessThreshold: number;
      saturationThreshold: number;
      meanSaturationThreshold: number;
      blackPixelBrightnessThreshold: number;
      blackPixelSaturationThreshold: number;
      structuringElementSize: number;
      blurKernelSize: number;
      morphOpeningKernelSize: number;
    };
  };
}

/**
 * Process an image to clean scanned artifacts
 * @param imageData The original image data
 * @param params Processing parameters
 * @returns Processed image data and visualization image
 */
export async function processImage(
  imageData: ImageData,
  params: ProcessingParams = defaultParams
): Promise<ProcessingResult> {
  console.log('Processing with parameters:', params);
  
  // Return a promise to allow for asynchronous processing
  return new Promise((resolve) => {
    // Use setTimeout to allow UI updates between processing
    setTimeout(() => {
      const { width, height, data } = imageData;
      const result = new Uint8ClampedArray(data.length);
      const visualization = new Uint8ClampedArray(data.length);
      
      // Stats for logging
      const stats = {
        brightPixels: 0,
        lowSaturationPixels: 0,
        candidateArtifacts: 0,
        lowSaturationAreas: 0,
        nearBlackPixels: 0,
        replacedPixels: 0,
        blackPixels: 0,
        thresholds: {
          brightnessThreshold: params.brightnessThreshold,
          saturationThreshold: params.saturationThreshold,
          meanSaturationThreshold: params.meanSaturationThreshold,
          blackPixelBrightnessThreshold: params.blackPixelBrightnessThreshold,
          blackPixelSaturationThreshold: params.blackPixelSaturationThreshold,
          structuringElementSize: params.structuringElementSize,
          blurKernelSize: params.blurKernelSize,
          morphOpeningKernelSize: params.morphOpeningKernelSize
        }
      };
      
      // Copy the original data first
      for (let i = 0; i < data.length; i++) {
        result[i] = data[i];
        visualization[i] = data[i];
      }

      // Precompute HSV values for all pixels to avoid repeated conversions
      const hsvValues: Array<[number, number, number]> = [];
      for (let i = 0; i < data.length; i += 4) {
        const r = data[i];
        const g = data[i + 1];
        const b = data[i + 2];
        hsvValues.push(rgbToHsv(r, g, b));
      }

      // Find black pixels first for visualization and near-black checks
      const blackPixelsMask: boolean[] = new Array(width * height).fill(false);
      for (let pixelIndex = 0; pixelIndex < hsvValues.length; pixelIndex++) {
        const idx = pixelIndex * 4;
        const a = data[idx + 3]; // Check alpha channel

        // Skip transparent pixels
        if (a === 0) continue;

        const hsv = hsvValues[pixelIndex];
        const v = hsv[2];
        const s = hsv[1];

        const isBlack = v < params.blackPixelBrightnessThreshold &&
                        s < params.blackPixelSaturationThreshold;

        blackPixelsMask[pixelIndex] = isBlack; // Set mask value here

        if (isBlack) {
          stats.blackPixels++;

          // Color black pixels red in visualization
          visualization[idx] = 255;   // R
          visualization[idx + 1] = 0; // G
          visualization[idx + 2] = 0; // B
        }
      }

      // Create intermediate mask (before near-black filtering and morphology)
      // True indicates a pixel initially marked for replacement
      const initialMask: boolean[] = new Array(width * height).fill(false);

      // For each pixel
      for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
          const idx = (y * width + x) * 4;
          const pixelIndex = Math.floor(idx / 4);
          const a = data[idx + 3];

          // Skip transparent pixels
          if (a === 0) continue;

          // Use precomputed HSV values
          const hsv = hsvValues[pixelIndex];
          // hue (hsv[0]) is not needed
          const s = hsv[1];
          const v = hsv[2];
          //console.log("Pixel", x, y, "Saturation:", s, "Brightness:", v);

          // Check if this is a candidate artifact (bright + unsaturated)
          const isBright = v > params.brightnessThreshold;
          if (isBright) {
            stats.brightPixels++;
          }
          const isLowSaturation = s < params.saturationThreshold;
          if (isLowSaturation) {
            stats.lowSaturationPixels++;
          }
          const isCandidateArtifact = isBright && isLowSaturation;
          
          if (isCandidateArtifact) {
            stats.candidateArtifacts++;
            
            // Calculate local mean saturation
            const meanSat = calculateLocalMeanSaturation(data, hsvValues, width, height, x, y, params.blurKernelSize);
            
            if (meanSat < params.meanSaturationThreshold) {
              stats.lowSaturationAreas++;
              
              // Mark this pixel as potentially needing replacement in the initial mask
              initialMask[pixelIndex] = true;
            }
          }
        }
      }

      // Create the final mask after applying filters
      const finalMask: boolean[] = new Array(width * height).fill(false);

      // Now, filter the initialMask based on proximity to black pixels
      for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
          const pixelIndex = y * width + x;

          // Only consider pixels marked in the initial mask and non-transparent
          // (Transparency check already done when building initialMask)
          if (!initialMask[pixelIndex]) continue;

          // 3) Check if it's near a black pixel (using precomputed blackPixelsMask for efficiency)
          const isNearBlack = isNearBlackPixelOptimized(
              blackPixelsMask, // Use the corrected mask
              width,
              height,
              x,
              y,
              params.structuringElementSize
          );

          if (isNearBlack) {
            stats.nearBlackPixels++; // This pixel is whitelisted

            // Color whitelisted pixels blue in visualization 
            const idx = pixelIndex * 4;
            visualization[idx] = 0;       // R
            visualization[idx + 1] = 0;   // G
            visualization[idx + 2] = 255; // B
          } else {
            // This pixel is not near black and remains a candidate for replacement
            finalMask[pixelIndex] = true;
            stats.replacedPixels++; // Count potential replacements here
             // No specific color for replaced pixels in visualization now
          }
        }
      }

      // Apply Morphological Opening to finalMask here
      const openedMask = morphologicalOpenMask(finalMask, width, height, params.morphOpeningKernelSize);

      // 5) Apply the *opened* mask to the result image
      for (let pixelIndex = 0; pixelIndex < openedMask.length; pixelIndex++) {
          if (openedMask[pixelIndex]) { // Use openedMask here
              const idx = pixelIndex * 4;
              // Set to transparent in result
              // The RGB values don't matter when fully transparent
              result[idx] = 0;       // R
              result[idx + 1] = 0;   // G
              result[idx + 2] = 0;   // B
              result[idx + 3] = 0;   // A (0 = fully transparent)
              
              // Color replaced pixels green in visualization
              visualization[idx] = 0;       // R
              visualization[idx + 1] = 255; // G
              visualization[idx + 2] = 0;   // B
          }
      }

      console.log('Processing completed with stats:', stats);
      
      resolve({
        processedImage: new ImageData(result, width, height),
        visualizationImage: new ImageData(visualization, width, height),
        stats
      });
    }, 0);
  });
}

/**
 * Convert RGB to HSV
 * @param r Red (0-255)
 * @param g Green (0-255)
 * @param b Blue (0-255)
 * @returns [h, s, v] where h is in degrees [0-360), s is in [0-100], v is in [0-100]
 */
function rgbToHsv(r: number, g: number, b: number): [number, number, number] {
  r /= 255;
  g /= 255;
  b /= 255;

  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const d = max - min;
  
  let h = 0;
  const s = max === 0 ? 0 : d / max;
  const v = max;

  if (max !== min) {
    switch (max) {
      case r:
        h = (g - b) / d + (g < b ? 6 : 0);
        break;
      case g:
        h = (b - r) / d + 2;
        break;
      case b:
        h = (r - g) / d + 4;
        break;
    }
    h /= 6;
  }

  return [h * 360, s * 100, v * 100];
}

/**
 * Calculate the local mean saturation around a pixel using precomputed HSV values
 * This simulates OpenCV's blur function for the saturation channel
 */
function calculateLocalMeanSaturation(
  data: Uint8ClampedArray,
  hsvValues: Array<[number, number, number]>,
  width: number,
  height: number,
  x: number,
  y: number,
  kernelSize: number
): number {
  const halfKernel = Math.floor(kernelSize / 2);
  let totalSaturation = 0;
  let count = 0;

  // Use all pixels in the kernel area, including transparent ones with zero weight
  // This matches OpenCV's blur behavior which uses zero padding
  for (let ky = Math.max(0, y - halfKernel); ky < Math.min(height, y + halfKernel + 1); ky++) {
    for (let kx = Math.max(0, x - halfKernel); kx < Math.min(width, x + halfKernel + 1); kx++) {
      const idx = (ky * width + kx) * 4;
      const pixelIndex = Math.floor(idx / 4);
      const a = data[idx + 3];

      // Include all pixels in the kernel area, but use saturation value only for non-transparent pixels
      if (a > 0) {
        totalSaturation += hsvValues[pixelIndex][1];
      }
      // Always count the pixel for averaging (OpenCV's blur counts all pixels in kernel)
      count++;
    }
  }

  // Divide by total count (OpenCV's behavior)
  return count > 0 ? totalSaturation / count : 0;
}

/**
 * Optimized check if a pixel is near a black pixel using a precomputed mask.
 * This simulates the dilation step in Python more directly.
 */
function isNearBlackPixelOptimized(
  blackPixelsMask: boolean[], // Precomputed mask where true means black
  width: number,
  height: number,
  x: number,
  y: number,
  structureSize: number
): boolean {
  const halfSize = Math.floor(structureSize / 2);
  // Using square of distance to avoid unnecessary sqrt calculations
  const radiusSquared = halfSize * halfSize;

  for (let ky = Math.max(0, y - halfSize); ky < Math.min(height, y + halfSize + 1); ky++) {
    for (let kx = Math.max(0, x - halfSize); kx < Math.min(width, x + halfSize + 1); kx++) {
      // Calculate squared distance from center
      const dx = kx - x;
      const dy = ky - y;
      const distanceSquared = dx * dx + dy * dy;

      // Skip if outside the ellipse
      // Use <= to include the boundary (more like OpenCV's implementation)
      if (distanceSquared > radiusSquared) continue;

      const checkPixelIndex = ky * width + kx;
      if (blackPixelsMask[checkPixelIndex]) {
        // Found a black pixel within the structuring element's bounds
        return true;
      }
    }
  }

  return false;
}

/**
 * Performs erosion on a boolean mask.
 * A pixel is set to true only if all pixels in its neighborhood (kernel) are true.
 */
function erodeMask(mask: boolean[], width: number, height: number, kernelSize: number): boolean[] {
  const erodedMask = new Array(mask.length).fill(false);
  const halfKernel = Math.floor(kernelSize / 2);

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      let allTrue = true;
      for (let ky = Math.max(0, y - halfKernel); ky < Math.min(height, y + halfKernel + 1); ky++) {
        for (let kx = Math.max(0, x - halfKernel); kx < Math.min(width, x + halfKernel + 1); kx++) {
          if (!mask[ky * width + kx]) {
            allTrue = false;
            break;
          }
        }
        if (!allTrue) break;
      }
      if (allTrue) {
        erodedMask[y * width + x] = true;
      }
    }
  }
  return erodedMask;
}

/**
 * Performs dilation on a boolean mask.
 * A pixel is set to true if any pixel in its neighborhood (kernel) is true.
 */
function dilateMask(mask: boolean[], width: number, height: number, kernelSize: number): boolean[] {
  const dilatedMask = new Array(mask.length).fill(false);
  const halfKernel = Math.floor(kernelSize / 2);

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      let anyTrue = false;
      for (let ky = Math.max(0, y - halfKernel); ky < Math.min(height, y + halfKernel + 1); ky++) {
        for (let kx = Math.max(0, x - halfKernel); kx < Math.min(width, x + halfKernel + 1); kx++) {
          if (mask[ky * width + kx]) {
            anyTrue = true;
            break;
          }
        }
        if (anyTrue) break;
      }
      if (anyTrue) {
        dilatedMask[y * width + x] = true;
      }
    }
  }
  return dilatedMask;
}

/**
 * Performs morphological opening (erosion followed by dilation) on a boolean mask.
 */
function morphologicalOpenMask(mask: boolean[], width: number, height: number, kernelSize: number): boolean[] {
  const eroded = erodeMask(mask, width, height, kernelSize);
  return dilateMask(eroded, width, height, kernelSize);
}