import { useRef, useEffect, useState, MouseEvent } from 'react';
import { createCircularWhitelistMask } from '../utils/imageProcessing';

interface ImageDisplayProps {
  originalImage: string | null;
  processedImage: ImageData | null;
  visualizationImage?: ImageData | null;
  isProcessing?: boolean;
  onManualWhitelist?: (mask: boolean[]) => void;
}

export default function ImageDisplay({ 
  originalImage, 
  processedImage,
  visualizationImage,
  isProcessing = false,
  onManualWhitelist
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

  // Whitelist brush state
  const [isWhitelistBrushActive, setIsWhitelistBrushActive] = useState(false);
  const [whitelistBrushSize, setWhitelistBrushSize] = useState(30);
  const [manualWhitelistMask, setManualWhitelistMask] = useState<boolean[]>([]);
  const [isDrawing, setIsDrawing] = useState(false);
  const lastDrawPositionRef = useRef<{ x: number, y: number } | null>(null);
  const [brushCursor, setBrushCursor] = useState<string>('default');
  
  // History for undo/redo
  const [history, setHistory] = useState<boolean[][]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  
  // Save right tab selection to localStorage whenever it changes
  useEffect(() => {
    localStorage.setItem('rightActiveImageTab', rightActiveTab);
  }, [rightActiveTab]);
  
  // Save zoom level to localStorage whenever it changes
  useEffect(() => {
    localStorage.setItem('imageZoomLevel', zoomLevel.toString());
  }, [zoomLevel]);

  // Initialize the whitelist mask when image dimensions change
  useEffect(() => {
    if (imageDimensions.width > 0 && imageDimensions.height > 0) {
      const emptyMask = new Array(imageDimensions.width * imageDimensions.height).fill(false);
      setManualWhitelistMask(emptyMask);
      // Reset history
      setHistory([emptyMask]);
      setHistoryIndex(0);
      setHasUnsavedChanges(false);
    }
  }, [imageDimensions]);

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
          
          // Overlay the whitelisted pixels with a purple tint
          if (manualWhitelistMask.some(v => v)) {
            for (let y = 0; y < imageDimensions.height; y++) {
              for (let x = 0; x < imageDimensions.width; x++) {
                const pixelIndex = y * imageDimensions.width + x;
                if (manualWhitelistMask[pixelIndex]) {
                  const scaledX = Math.floor(x * zoomLevel);
                  const scaledY = Math.floor(y * zoomLevel);
                  ctx.fillStyle = 'rgba(200, 0, 255, 0.3)';
                  ctx.fillRect(scaledX, scaledY, Math.ceil(zoomLevel), Math.ceil(zoomLevel));
                }
              }
            }
          }
          
          // If we're not drawing but hovering, show a preview of the brush size
          if (isWhitelistBrushActive && !isDrawing && lastDrawPositionRef.current) {
            const { x, y } = lastDrawPositionRef.current;
            const scaledX = Math.floor(x * zoomLevel);
            const scaledY = Math.floor(y * zoomLevel);
            // Use the full brush size scaled by zoom
            const scaledRadius = Math.floor(whitelistBrushSize * zoomLevel);
            
            ctx.beginPath();
            ctx.arc(scaledX, scaledY, scaledRadius / 2, 0, Math.PI * 2);
            ctx.strokeStyle = 'rgba(200, 0, 255, 0.6)';
            ctx.lineWidth = 1;
            ctx.stroke();
          }
        };
        img.src = originalImage;
      }
    }
  }, [originalImage, zoomLevel, imageDimensions, isWhitelistBrushActive, manualWhitelistMask, isDrawing, whitelistBrushSize]);

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

  // Update the cursor whenever the brush size changes or zoom changes
  useEffect(() => {
    if (isWhitelistBrushActive) {
      // Create a custom cursor that's a circle with the same size as the brush
      // Scale by zoom level since the cursor needs to match what will be drawn on screen
      // The brush size represents the diameter of the brush in image coordinates
      const visibleSize = Math.max(Math.ceil(whitelistBrushSize * zoomLevel), 10);
      const cursorUrl = createCircleCursor(visibleSize);
      setBrushCursor(`url(${cursorUrl}) ${visibleSize/2} ${visibleSize/2}, auto`);
    } else {
      setBrushCursor('default');
    }
  }, [whitelistBrushSize, isWhitelistBrushActive, zoomLevel]);

  // Function to create a circular cursor with the full brush size
  const createCircleCursor = (size: number): string => {
    // Create a canvas to draw the cursor
    const canvas = document.createElement('canvas');
    const centerOffset = Math.ceil(size / 2);
    // Make canvas slightly larger than the circle
    const canvasSize = size + 4; // Add some padding
    canvas.width = canvasSize;
    canvas.height = canvasSize;
    
    const ctx = canvas.getContext('2d');
    if (!ctx) return '';
    
    // Make the canvas transparent
    ctx.clearRect(0, 0, canvasSize, canvasSize);
    
    // Draw the cursor circle using the full radius (size/2)
    ctx.beginPath();
    ctx.arc(centerOffset, centerOffset, size / 2, 0, Math.PI * 2);
    ctx.strokeStyle = 'rgba(200, 0, 255, 0.8)'; // Purple stroke matching our highlight color
    ctx.lineWidth = 1.5;
    ctx.stroke();
    
    // Add a small crosshair in the center for precise positioning
    const crosshairSize = 3;
    ctx.beginPath();
    // Horizontal line
    ctx.moveTo(centerOffset - crosshairSize, centerOffset);
    ctx.lineTo(centerOffset + crosshairSize, centerOffset);
    // Vertical line
    ctx.moveTo(centerOffset, centerOffset - crosshairSize);
    ctx.lineTo(centerOffset, centerOffset + crosshairSize);
    ctx.strokeStyle = 'rgba(200, 0, 255, 0.9)';
    ctx.lineWidth = 1;
    ctx.stroke();
    
    // Convert to data URL
    return canvas.toDataURL();
  };

  const handleZoomIn = () => {
    setZoomLevel(prev => Math.min(prev + 0.1, 3.0)); // Maximum zoom: 300%
  };

  const handleZoomOut = () => {
    setZoomLevel(prev => Math.max(prev - 0.1, 0.2)); // Minimum zoom: 20%
  };

  const handleResetZoom = () => {
    setZoomLevel(0.5); // Reset to default 50%
  };

  const handleWhitelistBrushToggle = () => {
    setIsWhitelistBrushActive(!isWhitelistBrushActive);
  };

  const handleWhitelistBrushSizeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const size = parseInt(e.target.value, 10);
    setWhitelistBrushSize(size);
  };

  // Add keyboard shortcut listeners for undo/redo
  useEffect(() => {
    const handleKeyDown = (e: globalThis.KeyboardEvent) => {
      // Check if whitelist brush is active and we're not processing
      if (!isWhitelistBrushActive || isProcessing) return;
      
      // Undo: Ctrl+Z
      if (e.ctrlKey && e.key === 'z') {
        e.preventDefault();
        handleUndo();
      }
      
      // Redo: Ctrl+Y or Ctrl+Shift+Z
      if ((e.ctrlKey && e.key === 'y') || (e.ctrlKey && e.shiftKey && e.key === 'z')) {
        e.preventDefault();
        handleRedo();
      }
    };
    
    // Add global event listener
    document.addEventListener('keydown', handleKeyDown);
    
    // Clean up
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isWhitelistBrushActive, isProcessing, history, historyIndex]);

  // Save changes to history when drawing is complete
  useEffect(() => {
    if (hasUnsavedChanges && !isDrawing && onManualWhitelist) {
      // Add current state to history
      const updatedHistory = history.slice(0, historyIndex + 1);
      updatedHistory.push([...manualWhitelistMask]);
      
      setHistory(updatedHistory);
      setHistoryIndex(updatedHistory.length - 1);
      setHasUnsavedChanges(false);
      
      // Notify parent component
      onManualWhitelist(manualWhitelistMask);
    }
  }, [isDrawing, hasUnsavedChanges, manualWhitelistMask, history, historyIndex, onManualWhitelist]);

  const handleUndo = () => {
    if (historyIndex > 0 && !isDrawing && !isProcessing) {
      const newIndex = historyIndex - 1;
      const previousState = history[newIndex];
      
      setManualWhitelistMask([...previousState]);
      setHistoryIndex(newIndex);
      
      if (onManualWhitelist) {
        onManualWhitelist(previousState);
      }
    }
  };
  
  const handleRedo = () => {
    if (historyIndex < history.length - 1 && !isDrawing && !isProcessing) {
      const newIndex = historyIndex + 1;
      const nextState = history[newIndex];
      
      setManualWhitelistMask([...nextState]);
      setHistoryIndex(newIndex);
      
      if (onManualWhitelist) {
        onManualWhitelist(nextState);
      }
    }
  };

  const handleCanvasMouseDown = (e: MouseEvent<HTMLCanvasElement>) => {
    if (!isWhitelistBrushActive || isProcessing) return;
    
    const canvas = originalCanvasRef.current;
    if (!canvas) return;
    
    setIsDrawing(true);
    setHasUnsavedChanges(true);
    
    // Get mouse position in canvas coordinates
    const rect = canvas.getBoundingClientRect();
    // Convert screen coordinates to image coordinates by dividing by zoom level
    const imageX = (e.clientX - rect.left) / zoomLevel;
    const imageY = (e.clientY - rect.top) / zoomLevel;
    
    // Apply the brush stroke at these image coordinates
    applyBrushAtPosition(imageX, imageY);
    lastDrawPositionRef.current = { x: imageX, y: imageY };
  };

  const handleCanvasMouseMove = (e: MouseEvent<HTMLCanvasElement>) => {
    const canvas = originalCanvasRef.current;
    if (!canvas) return;
    
    // Get mouse position in canvas coordinates
    const rect = canvas.getBoundingClientRect();
    // Convert screen coordinates to image coordinates by dividing by zoom level
    const imageX = (e.clientX - rect.left) / zoomLevel;
    const imageY = (e.clientY - rect.top) / zoomLevel;
    
    // Store the current position for brush preview
    lastDrawPositionRef.current = { x: imageX, y: imageY };
    
    if (!isDrawing || !isWhitelistBrushActive || isProcessing) return;
    
    // If we have a last position, draw lines between points for continuous strokes
    if (lastDrawPositionRef.current) {
      const { x: lastX, y: lastY } = lastDrawPositionRef.current;
      
      // Calculate the distance in image coordinate space
      const distance = Math.sqrt(Math.pow(imageX - lastX, 2) + Math.pow(imageY - lastY, 2));
      
      // Determine how many points to sample along the line
      // More points needed for faster movements or larger brush sizes
      const points = Math.max(1, Math.ceil(distance / (whitelistBrushSize * 0.25)));
      
      // Draw intermediate points to create a smooth line
      for (let i = 0; i <= points; i++) {
        const stepX = lastX + ((imageX - lastX) * i) / points;
        const stepY = lastY + ((imageY - lastY) * i) / points;
        applyBrushAtPosition(stepX, stepY);
      }
    } else {
      applyBrushAtPosition(imageX, imageY);
    }
    
    // Update the last position to the current position
    lastDrawPositionRef.current = { x: imageX, y: imageY };
  };

  const handleCanvasMouseUp = () => {
    if (isDrawing) {
      setIsDrawing(false);
      // The useEffect will handle adding to history and notifying parent
    }
    // Don't clear lastDrawPositionRef as we use it for hover preview
  };

  const handleCanvasMouseLeave = () => {
    handleCanvasMouseUp();
    lastDrawPositionRef.current = null;
  };

  /**
   * Apply the whitelist brush at a specific image position
   * @param x X position in IMAGE coordinates (not screen coordinates)
   * @param y Y position in IMAGE coordinates (not screen coordinates)
   */
  const applyBrushAtPosition = (x: number, y: number) => {
    if (imageDimensions.width === 0 || imageDimensions.height === 0) return;
    
    // Create a circular mask at the image coordinates using the brush size
    // whitelistBrushSize represents the diameter of the brush in image coordinates
    const updatedMask = createCircularWhitelistMask(
      Math.round(x), 
      Math.round(y), 
      whitelistBrushSize / 2, // Convert from diameter to radius for the mask function
      imageDimensions.width,
      imageDimensions.height,
      [...manualWhitelistMask]
    );
    
    setManualWhitelistMask(updatedMask);
  };

  const handleClearWhitelist = () => {
    if (imageDimensions.width > 0 && imageDimensions.height > 0 && !isProcessing) {
      const clearMask = new Array(imageDimensions.width * imageDimensions.height).fill(false);
      
      // Add to history
      const updatedHistory = history.slice(0, historyIndex + 1);
      updatedHistory.push(clearMask);
      
      setManualWhitelistMask(clearMask);
      setHistory(updatedHistory);
      setHistoryIndex(updatedHistory.length - 1);
      
      if (onManualWhitelist) {
        onManualWhitelist(clearMask);
      }
    }
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

  const brushControlsStyle: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    marginLeft: '20px',
    gap: '10px'
  };

  const sliderContainerStyle: React.CSSProperties = {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '4px'
  };

  const sliderLabelStyle: React.CSSProperties = {
    fontSize: '12px',
    color: '#555'
  };

  const whiteBrushButtonStyle: React.CSSProperties = {
    ...zoomButtonStyle,
    backgroundColor: isWhitelistBrushActive ? '#f0c0ff' : '#f0f0f0',
    borderColor: isWhitelistBrushActive ? '#a040a0' : '#ccc',
  };

  // Style for disabled buttons
  const disabledButtonStyle: React.CSSProperties = {
    ...zoomButtonStyle,
    opacity: 0.5,
    cursor: 'not-allowed'
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

        <div style={brushControlsStyle}>
          <button 
            style={whiteBrushButtonStyle} 
            onClick={handleWhitelistBrushToggle}
            title={isWhitelistBrushActive ? "Disable whitelist brush" : "Enable whitelist brush"}
            disabled={isProcessing}
          >
            Whitelist Brush
          </button>
          
          {isWhitelistBrushActive && (
            <>
              <div style={sliderContainerStyle}>
                <input
                  type="range"
                  min="1"
                  max="100"
                  value={whitelistBrushSize}
                  onChange={handleWhitelistBrushSizeChange}
                  disabled={isProcessing}
                />
                <div style={sliderLabelStyle}>
                  <div>Brush Diameter: {whitelistBrushSize} px in image</div>
                  <div>Screen Diameter: {Math.round(whitelistBrushSize * zoomLevel)} px at {Math.round(zoomLevel * 100)}% zoom</div>
                </div>
              </div>
              
              <button 
                style={historyIndex > 0 ? zoomButtonStyle : disabledButtonStyle} 
                onClick={handleUndo}
                title="Undo (Ctrl+Z)"
                disabled={historyIndex <= 0 || isProcessing}
              >
                Undo
              </button>
              
              <button 
                style={historyIndex < history.length - 1 ? zoomButtonStyle : disabledButtonStyle} 
                onClick={handleRedo}
                title="Redo (Ctrl+Y)"
                disabled={historyIndex >= history.length - 1 || isProcessing}
              >
                Redo
              </button>
              
              <button 
                style={zoomButtonStyle} 
                onClick={handleClearWhitelist}
                title="Clear all manually whitelisted pixels"
                disabled={isProcessing}
              >
                Clear
              </button>
            </>
          )}
        </div>
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
                  style={{...canvasStyle, cursor: brushCursor}}
                  onMouseDown={handleCanvasMouseDown}
                  onMouseMove={handleCanvasMouseMove}
                  onMouseUp={handleCanvasMouseUp}
                  onMouseLeave={handleCanvasMouseLeave}
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