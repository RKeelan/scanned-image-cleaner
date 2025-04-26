import { useRef, useEffect, useState } from 'react';

interface ImageDisplayProps {
  originalImage: string | null;
  processedImage: ImageData | null;
  visualizationImage?: ImageData | null;
  isProcessing?: boolean;
}

export default function ImageDisplay({ 
  originalImage, 
  processedImage,
  visualizationImage,
  isProcessing = false
}: ImageDisplayProps) {
  const originalCanvasRef = useRef<HTMLCanvasElement>(null);
  const processedCanvasRef = useRef<HTMLCanvasElement>(null);
  const visualizationCanvasRef = useRef<HTMLCanvasElement>(null);
  
  // Refs for the scroll containers
  const originalScrollContainerRef = useRef<HTMLDivElement>(null);
  const rightScrollContainerRef = useRef<HTMLDivElement>(null);
  
  // Flag to prevent scroll loops
  const isScrollingSynced = useRef(false);
  
  // For the right side tab control
  const [rightActiveTab, setRightActiveTab] = useState<'processed' | 'visualization'>(() => {
    // Initialize from localStorage if available
    const savedTab = localStorage.getItem('rightActiveImageTab');
    if (savedTab === 'visualization') {
      return 'visualization';
    }
    return 'processed'; // Default to processed
  });
  
  const previousImagesRef = useRef<{
    processedImage: ImageData | null;
    visualizationImage: ImageData | null;
  }>({ processedImage: null, visualizationImage: visualizationImage || null });
  
  // Add zoom functionality
  const [zoomLevel, setZoomLevel] = useState(() => {
    const savedZoom = localStorage.getItem('imageZoomLevel');
    return savedZoom ? parseFloat(savedZoom) : 0.5; // Default to 50% scale
  });
  
  // Track original image dimensions once loaded
  const [imageDimensions, setImageDimensions] = useState({ width: 0, height: 0 });
  
  // Save right tab selection to localStorage whenever it changes
  useEffect(() => {
    localStorage.setItem('rightActiveImageTab', rightActiveTab);
  }, [rightActiveTab]);
  
  // Save zoom level to localStorage whenever it changes
  useEffect(() => {
    localStorage.setItem('imageZoomLevel', zoomLevel.toString());
  }, [zoomLevel]);

  // Load the original image and get its dimensions
  useEffect(() => {
    if (originalImage) {
      const img = new Image();
      img.onload = () => {
        setImageDimensions({ width: img.width, height: img.height });
      };
      img.src = originalImage;
    }
  }, [originalImage]);

  // Setup synchronized scrolling
  useEffect(() => {
    const originalContainer = originalScrollContainerRef.current;
    const rightContainer = rightScrollContainerRef.current;
    
    if (!originalContainer || !rightContainer) return;
    
    const handleOriginalScroll = () => {
      if (isScrollingSynced.current) return;
      
      isScrollingSynced.current = true;
      rightContainer.scrollLeft = originalContainer.scrollLeft;
      rightContainer.scrollTop = originalContainer.scrollTop;
      setTimeout(() => {
        isScrollingSynced.current = false;
      }, 50);
    };
    
    const handleRightScroll = () => {
      if (isScrollingSynced.current) return;
      
      isScrollingSynced.current = true;
      originalContainer.scrollLeft = rightContainer.scrollLeft;
      originalContainer.scrollTop = rightContainer.scrollTop;
      setTimeout(() => {
        isScrollingSynced.current = false;
      }, 50);
    };
    
    originalContainer.addEventListener('scroll', handleOriginalScroll);
    rightContainer.addEventListener('scroll', handleRightScroll);
    
    return () => {
      originalContainer.removeEventListener('scroll', handleOriginalScroll);
      rightContainer.removeEventListener('scroll', handleRightScroll);
    };
  }, []);

  // Persist active tab when images update
  useEffect(() => {
    // Only update if we previously didn't have images but now we do
    const hasProcessed = processedImage !== null;
    const hasVisualization = visualizationImage !== null;

    // If the active tab on the right is on a now-disabled view, adjust the tab
    if (rightActiveTab === 'processed' && !hasProcessed && hasVisualization) {
      setRightActiveTab('visualization');
    } else if (rightActiveTab === 'visualization' && !hasVisualization && hasProcessed) {
      setRightActiveTab('processed');
    }

    // Save current images to the ref for maintaining view during processing
    if (!isProcessing && (processedImage !== null || visualizationImage !== null)) {
      previousImagesRef.current = { 
        processedImage, 
        visualizationImage: visualizationImage || null 
      };
    }
  }, [processedImage, visualizationImage, rightActiveTab, isProcessing]);

  // Draw the original image whenever it changes or zoom changes
  useEffect(() => {
    if (originalImage && originalCanvasRef.current && imageDimensions.width > 0) {
      const canvas = originalCanvasRef.current;
      const ctx = canvas.getContext('2d');
      
      if (ctx) {
        const img = new Image();
        img.onload = () => {
          // Set canvas size to scaled dimensions
          const scaledWidth = Math.floor(imageDimensions.width * zoomLevel);
          const scaledHeight = Math.floor(imageDimensions.height * zoomLevel);
          
          canvas.width = scaledWidth;
          canvas.height = scaledHeight;
          
          // Clear canvas
          ctx.clearRect(0, 0, canvas.width, canvas.height);
          
          // Draw the image at the scaled size
          ctx.drawImage(img, 0, 0, scaledWidth, scaledHeight);
        };
        img.src = originalImage;
      }
    }
  }, [originalImage, zoomLevel, imageDimensions]);

  // Draw the processed image whenever it changes or when the right tab becomes active or zoom changes
  useEffect(() => {
    // Use current or previous image based on processing state
    const imageToUse = isProcessing && processedImage === null ? 
      previousImagesRef.current.processedImage : processedImage;
      
    if (imageToUse && processedCanvasRef.current && imageDimensions.width > 0 && 
        (rightActiveTab === 'processed' || document.querySelector(':root'))) {
      const canvas = processedCanvasRef.current;
      const ctx = canvas.getContext('2d');
      
      if (ctx) {
        // Set canvas size to scaled dimensions - use original image dimensions
        const scaledWidth = Math.floor(imageDimensions.width * zoomLevel);
        const scaledHeight = Math.floor(imageDimensions.height * zoomLevel);
        
        canvas.width = scaledWidth;
        canvas.height = scaledHeight;
        
        // Create a temporary canvas to hold the original ImageData
        const tempCanvas = document.createElement('canvas');
        tempCanvas.width = imageToUse.width;
        tempCanvas.height = imageToUse.height;
        const tempCtx = tempCanvas.getContext('2d');
        
        if (tempCtx) {
          tempCtx.putImageData(imageToUse, 0, 0);
          
          // Clear canvas
          ctx.clearRect(0, 0, canvas.width, canvas.height);
          
          // Draw the image at the scaled size, ensuring we maintain aspect ratio
          ctx.drawImage(tempCanvas, 0, 0, scaledWidth, scaledHeight);
        }
      }
    }
  }, [processedImage, rightActiveTab, zoomLevel, imageDimensions, isProcessing]);

  // Draw the visualization image whenever it changes or when the right tab becomes active or zoom changes
  useEffect(() => {
    // Use current or previous image based on processing state
    const imageToUse = isProcessing && visualizationImage === null ? 
      previousImagesRef.current.visualizationImage : visualizationImage;
    
    if (imageToUse && visualizationCanvasRef.current && imageDimensions.width > 0 && 
        (rightActiveTab === 'visualization' || document.querySelector(':root'))) {
      const canvas = visualizationCanvasRef.current;
      const ctx = canvas.getContext('2d');
      
      if (ctx) {
        // Set canvas size to scaled dimensions - use original image dimensions
        const scaledWidth = Math.floor(imageDimensions.width * zoomLevel);
        const scaledHeight = Math.floor(imageDimensions.height * zoomLevel);
        
        canvas.width = scaledWidth;
        canvas.height = scaledHeight;
        
        // Create a temporary canvas to hold the original ImageData
        const tempCanvas = document.createElement('canvas');
        tempCanvas.width = imageToUse.width;
        tempCanvas.height = imageToUse.height;
        const tempCtx = tempCanvas.getContext('2d');
        
        if (tempCtx) {
          tempCtx.putImageData(imageToUse, 0, 0);
          
          // Clear canvas
          ctx.clearRect(0, 0, canvas.width, canvas.height);
          
          // Draw the image at the scaled size, ensuring we maintain aspect ratio
          ctx.drawImage(tempCanvas, 0, 0, scaledWidth, scaledHeight);
        }
      }
    }
  }, [visualizationImage, rightActiveTab, zoomLevel, imageDimensions, isProcessing]);

  const handleZoomIn = () => {
    setZoomLevel(prev => Math.min(prev + 0.1, 3.0)); // Maximum zoom: 300%
  };

  const handleZoomOut = () => {
    setZoomLevel(prev => Math.max(prev - 0.1, 0.2)); // Minimum zoom: 20%
  };

  const handleResetZoom = () => {
    setZoomLevel(0.5); // Reset to default 50%
  };

  if (!originalImage) {
    return null;
  }

  // Styles for the tabs
  const tabContainerStyle: React.CSSProperties = {
    display: 'flex',
    borderBottom: '1px solid #ccc',
    marginBottom: '16px',
    width: '100%'
  };
  
  const tabButtonBaseStyle: React.CSSProperties = {
    padding: '8px 16px',
    border: '1px solid #ccc',
    borderBottom: 'none',
    borderRadius: '4px 4px 0 0',
    backgroundColor: '#f0f0f0',
    color: '#333',
    fontSize: '14px',
    fontWeight: 'normal',
    cursor: 'pointer',
    marginRight: '2px',
    position: 'relative',
    bottom: '-1px',
    transition: 'all 0.2s ease'
  };
  
  const activeTabStyle: React.CSSProperties = {
    ...tabButtonBaseStyle,
    backgroundColor: '#fff',
    borderBottom: '1px solid #fff',
    fontWeight: 'bold',
    color: '#000'
  };

  const disabledTabStyle: React.CSSProperties = {
    ...tabButtonBaseStyle,
    opacity: 0.5,
    cursor: 'not-allowed'
  };
  
  const contentPanelStyle: React.CSSProperties = {
    flex: 1,
    border: '1px solid #ccc',
    borderRadius: '4px',
    padding: '16px',
    backgroundColor: '#fff',
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'flex-start',
    alignItems: 'center',
    overflow: 'auto',
    minHeight: '200px',
    maxHeight: 'calc(100% - 20px)',
    marginTop: '0',
    position: 'relative'
  };
  
  const rightTabContentStyle: React.CSSProperties = {
    ...contentPanelStyle,
    borderTop: 'none',
    borderRadius: '0 0 4px 4px',
    marginTop: '0'
  };

  const zoomControlsStyle: React.CSSProperties = {
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: '16px',
    gap: '10px'
  };

  const zoomButtonStyle: React.CSSProperties = {
    padding: '4px 12px',
    border: '1px solid #ccc',
    borderRadius: '4px',
    backgroundColor: '#f0f0f0',
    color: '#333',
    fontSize: '14px',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center'
  };

  const zoomDisplayStyle: React.CSSProperties = {
    padding: '4px 8px',
    border: '1px solid #ccc',
    borderRadius: '4px',
    backgroundColor: '#fff',
    color: '#333',
    fontSize: '14px',
    minWidth: '60px',
    textAlign: 'center'
  };

  const canvasContainerStyle: React.CSSProperties = {
    overflow: 'auto',
    flex: 1,
    width: '100%',
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'flex-start',
    padding: '20px',
    backgroundColor: '#f5f5f5',
    borderRadius: '4px',
    maxHeight: 'calc(100% - 60px)',
    position: 'relative'
  };

  const canvasWrapperStyle: React.CSSProperties = {
    display: 'inline-block',
    backgroundColor: '#eaeaea',
    border: '1px solid #ccc',
    padding: '10px',
    transition: 'all 0.2s ease',
    boxShadow: '0 0 5px rgba(0, 0, 0, 0.1)',
    position: 'relative'
  };

  const canvasStyle: React.CSSProperties = {
    display: 'block',
    border: '1px solid #aaa'
  };

  const sideBySideContainerStyle: React.CSSProperties = {
    display: 'flex',
    width: '100%',
    height: '100%',
    gap: '16px'
  };

  const sideContainerStyle: React.CSSProperties = {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    minWidth: 0, // Needed for proper flexbox sizing with overflow
    maxWidth: '50%'
  };

  const panelTitleStyle: React.CSSProperties = {
    margin: '0 0 16px 0',
    fontWeight: 'bold',
    fontSize: '16px',
    color: '#333',
    textAlign: 'center'
  };
  
  const processingOverlayStyle: React.CSSProperties = {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(255, 255, 255, 0.7)',
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 10
  };
  
  const processingIndicatorStyle: React.CSSProperties = {
    padding: '8px 16px',
    backgroundColor: 'rgba(52, 152, 219, 0.9)',
    color: 'white',
    borderRadius: '4px',
    fontWeight: 'bold',
    boxShadow: '0 2px 4px rgba(0, 0, 0, 0.2)'
  };

  return (
    <div className="image-display" style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column' }}>
      <div style={zoomControlsStyle}>
        <button style={zoomButtonStyle} onClick={handleZoomOut} title="Zoom out">
          −
        </button>
        <div style={zoomDisplayStyle}>
          {Math.round(zoomLevel * 100)}%
        </div>
        <button style={zoomButtonStyle} onClick={handleZoomIn} title="Zoom in">
          +
        </button>
        <button style={zoomButtonStyle} onClick={handleResetZoom} title="Reset zoom">
          Reset
        </button>
      </div>
    
      <div style={sideBySideContainerStyle}>
        {/* Left side - Original Image */}
        <div style={sideContainerStyle}>
          <div style={contentPanelStyle}>
            <h3 style={panelTitleStyle}>Original Image</h3>
            <div 
              ref={originalScrollContainerRef}
              style={canvasContainerStyle}
            >
              <div style={canvasWrapperStyle}>
                <canvas 
                  ref={originalCanvasRef}
                  style={canvasStyle}
                ></canvas>
              </div>
            </div>
          </div>
        </div>
        
        {/* Right side - Tab control for Processed and Visualization */}
        <div style={sideContainerStyle}>
          <div className="tab-buttons" style={tabContainerStyle}>
            <button 
              style={rightActiveTab === 'processed' ? activeTabStyle : tabButtonBaseStyle}
              onClick={() => setRightActiveTab('processed')}
              disabled={!processedImage && !previousImagesRef.current.processedImage}
            >
              Processed Image
            </button>
            <button 
              style={rightActiveTab === 'visualization' 
                ? activeTabStyle 
                : (!visualizationImage && !previousImagesRef.current.visualizationImage)
                  ? disabledTabStyle 
                  : tabButtonBaseStyle}
              onClick={() => setRightActiveTab('visualization')}
              disabled={!visualizationImage && !previousImagesRef.current.visualizationImage}
            >
              Visualization
            </button>
          </div>
          
          <div className="tab-content" style={rightTabContentStyle}>
            <div 
              ref={rightScrollContainerRef}
              style={canvasContainerStyle}
            >
              {/* Always render both canvases but show/hide based on active tab */}
              <div style={{
                ...canvasWrapperStyle,
                display: rightActiveTab === 'processed' ? 'inline-block' : 'none'
              }}>
                <canvas 
                  ref={processedCanvasRef}
                  style={canvasStyle}
                ></canvas>
                
                {/* Processing overlay for the processed image */}
                {isProcessing && rightActiveTab === 'processed' && (
                  <div style={processingOverlayStyle}>
                    <div style={processingIndicatorStyle}>
                      Processing...
                    </div>
                  </div>
                )}
              </div>
              
              <div style={{
                ...canvasWrapperStyle,
                display: rightActiveTab === 'visualization' ? 'inline-block' : 'none'
              }}>
                <canvas 
                  ref={visualizationCanvasRef}
                  style={canvasStyle}
                ></canvas>
                
                {/* Processing overlay for the visualization */}
                {isProcessing && rightActiveTab === 'visualization' && (
                  <div style={processingOverlayStyle}>
                    <div style={processingIndicatorStyle}>
                      Processing...
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
} 