# Scanned Image Cleaner

An interactive web application for cleaning up artifacts and unwanted elements from scanned images.

## Features

- Upload images via drag-and-drop or file picker
- Clean up scan artifacts automatically with real-time processing
- Fine-tune with adjustable processing parameters
- Side-by-side comparison of original and processed images
- Toggle between processed result and visualization mode
- Synchronized scrolling for easier comparison
- Zoom controls (20% to 300%) with consistent scaling
- View processing statistics to understand the algorithm's decisions
- Reset parameters or upload new images easily
- Download processed images with transparency
- Continuous processing feedback with overlays

## How It Works

This application implements an image processing algorithm that identifies and removes artifacts commonly found in scanned images. The algorithm works by:

1. Detecting bright, unsaturated pixels (likely scan artifacts)
2. Calculating local mean saturation to identify artifact regions
3. Excluding areas near black text/lines through mask operations
4. Applying morphological opening to refine the artifact mask
5. Making identified artifacts transparent for seamless compositing

## Parameters

The application provides controls for fine-tuning the processing algorithm:

- **Brightness Threshold**: Minimum brightness value for potential artifacts
- **Saturation Threshold**: Maximum saturation value for potential artifacts
- **Mean Saturation Threshold**: Maximum local-mean saturation for artifact regions
- **Black Pixel Brightness/Saturation Thresholds**: Define what's considered "black"
- **Structuring Element Size**: Controls the dilation area around black pixels
- **Blur Kernel Size**: Size of the kernel used for local mean calculations
- **Morphological Opening Kernel Size**: Controls artifact shape refinement

## User Interface

The application features a modern, intuitive interface with:

- Split-panel layout with original image on the left
- Tab control for toggling between processed and visualization views on the right
- Processing overlay indicators for visual feedback during computation
- Responsive design with scrollable image panels
- Consistent image scaling and synchronized scrolling
- Clean, tab-based navigation between image modes

## Visualization Mode

The visualization view highlights different elements of the processing:
- Red: Detected black text/lines
- Blue: Areas near black text that are preserved
- Green: Identified artifacts that will be made transparent

## Development

### Prerequisites

- Node.js 16+
- npm or yarn

### Setup

```powershell
# Clone the repository
git clone https://github.com/RKeelan/scanned-image-cleaner.git
cd scanned-image-cleaner

# Install dependencies
npm install

# Start the development server
npm run dev
```

### Build

```powershell
# Build for production
npm run build

# Preview the build
npm run preview
```
