import { useCallback, useEffect, useState } from 'react';
import './App.css';
import ImageUploader from './components/ImageUploader';
import ParameterControls from './components/ParameterControls';
import ImageDisplay from './components/ImageDisplay';
import { defaultParams, processImage } from './utils/imageProcessing';

function App() {
  const [originalImage, setOriginalImage] = useState<string | null>(null);
  const [originalImageData, setOriginalImageData] = useState<ImageData | null>(null);
  const [processedImage, setProcessedImage] = useState<ImageData | null>(null);
  const [visualizationImage, setVisualizationImage] = useState<ImageData | null>(null);
  const [processingStats, setProcessingStats] = useState<any>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [parameters, setParameters] = useState({ ...defaultParams });
  const [debounceTimeout, setDebounceTimeout] = useState<number | null>(null);
  const [manualWhitelistMask, setManualWhitelistMask] = useState<boolean[] | undefined>(undefined);

  const handleImageSelected = (file: File) => {
    const reader = new FileReader();
    
    reader.onload = (e) => {
      if (e.target?.result) {
        setOriginalImage(e.target.result as string);
      }
    };
    
    reader.readAsDataURL(file);
  };

  // Load image data from the original image URL
  useEffect(() => {
    if (originalImage) {
      const img = new Image();
      
      img.onload = () => {
        const canvas = document.createElement('canvas');
        canvas.width = img.width;
        canvas.height = img.height;
        
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(img, 0, 0);
          const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
          setOriginalImageData(imageData);
        }
      };
      
      img.src = originalImage;
    }
  }, [originalImage]);

  // Process the image when parameters or original image data change
  const processImageWithParams = useCallback(async () => {
    if (originalImageData) {
      setIsProcessing(true);
      try {
        // Add a small delay to ensure the UI can update with "Processing..." indicator
        await new Promise(resolve => setTimeout(resolve, 10));
        console.log("Starting image processing with parameters:", parameters);
        
        // Include the manual whitelist mask in the parameters if it exists
        const paramsWithWhitelist = {
          ...parameters,
          manualWhitelistMask: manualWhitelistMask
        };
        
        const result = await processImage(originalImageData, paramsWithWhitelist);
        setProcessedImage(result.processedImage);
        setVisualizationImage(result.visualizationImage);
        setProcessingStats(result.stats);
        console.log("Processing complete with stats:", result.stats);
      } catch (error) {
        console.error('Error processing image:', error);
      } finally {
        setIsProcessing(false);
      }
    }
  }, [originalImageData, parameters, manualWhitelistMask]);

  useEffect(() => {
    if (originalImageData) {
      // Clear any existing timeout
      if (debounceTimeout) {
        clearTimeout(debounceTimeout);
      }
      
      // Set a new timeout to debounce processing
      const timeoutId = setTimeout(() => {
        processImageWithParams();
      }, 300); // 300ms debounce
      
      setDebounceTimeout(timeoutId);
      
      // Cleanup on unmount
      return () => {
        if (timeoutId) {
          clearTimeout(timeoutId);
        }
      };
    }
  }, [originalImageData, parameters, processImageWithParams]);

  const handleParameterChange = (name: keyof typeof defaultParams, value: number) => {
    console.log(`Parameter changed: ${name} = ${value}`);
    setParameters((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const downloadProcessedImage = () => {
    if (processedImage) {
      // Create a new canvas with the original dimensions
      const exportCanvas = document.createElement('canvas');
      exportCanvas.width = processedImage.width;
      exportCanvas.height = processedImage.height;
      const exportCtx = exportCanvas.getContext('2d');
      
      if (exportCtx) {
        exportCtx.putImageData(processedImage, 0, 0);
        const dataUrl = exportCanvas.toDataURL('image/png');
        
        const link = document.createElement('a');
        link.download = 'processed-image.png';
        link.href = dataUrl;
        link.click();
      }
    }
  };

  const handleManualWhitelist = (mask: boolean[]) => {
    setManualWhitelistMask(mask);
    // No need to call processImageWithParams here as the useEffect with its dependencies
    // will trigger the processing
  };

  return (
    <div className="app">
      <header className="app-header">
        <h1>Scanned Image Cleaner</h1>
        <p>Clean up artifacts from scanned images</p>
      </header>
      
      <main className="app-content">
        {!originalImage ? (
          <ImageUploader onImageSelected={handleImageSelected} />
        ) : (
          <div className="editor-container">
            <div className="sidebar">
              <ParameterControls 
                parameters={parameters} 
                onChange={handleParameterChange} 
                isProcessing={isProcessing}
              />
              <button 
                className="reset-button" 
                onClick={() => setParameters({ ...defaultParams })}
                disabled={isProcessing}
              >
                Reset Parameters
              </button>
              <button 
                className="new-image-button" 
                onClick={() => {
                  setOriginalImage(null);
                  setOriginalImageData(null);
                  setProcessedImage(null);
                  setVisualizationImage(null);
                  setProcessingStats(null);
                  setManualWhitelistMask(undefined);
                }}
                disabled={isProcessing}
              >
                Upload New Image
              </button>
              
              {processedImage && (
                <button 
                  className="new-image-button" 
                  onClick={downloadProcessedImage}
                  disabled={isProcessing}
                >
                  Download Processed Image
                </button>
              )}
              
              {processingStats && (
                <div className="stats-container">
                  <h3>Processing Stats</h3>
                  <table className="stats-table">
                    <tbody>
                      <tr>
                        <td>Candidate artifacts:</td>
                        <td>{processingStats.candidateArtifacts}</td>
                      </tr>
                      <tr>
                        <td>Low saturation areas:</td>
                        <td>{processingStats.lowSaturationAreas}</td>
                      </tr>
                      <tr>
                        <td>Near black pixels:</td>
                        <td>{processingStats.nearBlackPixels}</td>
                      </tr>
                      <tr>
                        <td>Manually whitelisted:</td>
                        <td>{processingStats.manuallyWhitelistedPixels}</td>
                      </tr>
                      <tr>
                        <td>Replaced pixels:</td>
                        <td>{processingStats.replacedPixels}</td>
                      </tr>
                      <tr>
                        <td>Black pixels:</td>
                        <td>{processingStats.blackPixels}</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              )}
            </div>
            
            <div className="main-content">
              <ImageDisplay 
                originalImage={originalImage} 
                processedImage={processedImage}
                visualizationImage={visualizationImage}
                isProcessing={isProcessing}
                onManualWhitelist={handleManualWhitelist}
              />
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

export default App;
