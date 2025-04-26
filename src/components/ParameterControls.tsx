import { ChangeEvent, useEffect, useState } from 'react';
import { defaultParams } from '../utils/imageProcessing';

interface ParameterControlsProps {
  parameters: typeof defaultParams;
  onChange: (name: keyof typeof defaultParams, value: number) => void;
  isProcessing: boolean;
}

export default function ParameterControls({ 
  parameters, 
  onChange, 
  isProcessing 
}: ParameterControlsProps) {
  // Create local state to show immediate feedback while sliding
  const [localValues, setLocalValues] = useState(parameters);

  // Update local values when parameters change from outside
  useEffect(() => {
    setLocalValues(parameters);
  }, [parameters]);

  const handleSliderChange = (e: ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    const numValue = Number(value);
    const paramName = name as keyof typeof defaultParams;
    
    // Update local state immediately
    setLocalValues(prev => ({
      ...prev,
      [paramName]: numValue
    }));
    
    // Pass change to parent component
    onChange(paramName, numValue);
  };

  const handleTextInputChange = (e: ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    const rawName = name.replace('Text', '');
    const paramName = rawName as keyof typeof defaultParams;
    
    // Convert to number, handle empty string
    let numValue = value === '' ? 0 : Number(value);
    
    // Apply min/max constraints based on the parameter
    switch (paramName) {
      case 'brightnessThreshold':
        numValue = Math.min(Math.max(numValue, 0), 100);
        break;
      case 'saturationThreshold':
      case 'meanSaturationThreshold':
      case 'blackPixelBrightnessThreshold':
      case 'blackPixelSaturationThreshold':
        numValue = Math.min(Math.max(numValue, 0), 100);
        break;
      case 'structuringElementSize':
      case 'blurKernelSize':
      case 'morphOpeningKernelSize':
        // Ensure odd values for kernel sizes
        numValue = Math.max(numValue, 3);
        if (numValue % 2 === 0) numValue += 1;
        break;
    }
    
    // Update local state immediately
    setLocalValues(prev => ({
      ...prev,
      [paramName]: numValue
    }));
    
    // Pass change to parent component
    onChange(paramName, numValue);
  };

  return (
    <div className="parameter-controls">
      <h3>Algorithm Parameters</h3>
      
      <div className="parameter-group">
        <label htmlFor="brightnessThreshold">
          Brightness Threshold:
        </label>
        <div className="input-group">
          <input
            type="range"
            id="brightnessThreshold"
            name="brightnessThreshold"
            min="0"
            max="100"
            value={localValues.brightnessThreshold}
            onChange={handleSliderChange}
            disabled={isProcessing}
          />
          <input 
            type="number" 
            id="brightnessThresholdText"
            name="brightnessThresholdText"
            min="0"
            max="100"
            value={localValues.brightnessThreshold}
            onChange={handleTextInputChange}
            disabled={isProcessing}
          />
        </div>
      </div>

      <div className="parameter-group">
        <label htmlFor="saturationThreshold">
          Saturation Threshold:
        </label>
        <div className="input-group">
          <input
            type="range"
            id="saturationThreshold"
            name="saturationThreshold"
            min="0"
            max="100"
            value={localValues.saturationThreshold}
            onChange={handleSliderChange}
            disabled={isProcessing}
          />
          <input 
            type="number" 
            id="saturationThresholdText"
            name="saturationThresholdText"
            min="0"
            max="100"
            value={localValues.saturationThreshold}
            onChange={handleTextInputChange}
            disabled={isProcessing}
          />
        </div>
      </div>

      <div className="parameter-group">
        <label htmlFor="meanSaturationThreshold">
          Mean Saturation Threshold:
        </label>
        <div className="input-group">
          <input
            type="range"
            id="meanSaturationThreshold"
            name="meanSaturationThreshold"
            min="0"
            max="100"
            value={localValues.meanSaturationThreshold}
            onChange={handleSliderChange}
            disabled={isProcessing}
          />
          <input 
            type="number" 
            id="meanSaturationThresholdText"
            name="meanSaturationThresholdText"
            min="0"
            max="100"
            value={localValues.meanSaturationThreshold}
            onChange={handleTextInputChange}
            disabled={isProcessing}
          />
        </div>
      </div>

      <div className="parameter-group">
        <label htmlFor="blackPixelBrightnessThreshold">
          Black Pixel Brightness Threshold:
        </label>
        <div className="input-group">
          <input
            type="range"
            id="blackPixelBrightnessThreshold"
            name="blackPixelBrightnessThreshold"
            min="0"
            max="100"
            value={localValues.blackPixelBrightnessThreshold}
            onChange={handleSliderChange}
            disabled={isProcessing}
          />
          <input 
            type="number" 
            id="blackPixelBrightnessThresholdText"
            name="blackPixelBrightnessThresholdText"
            min="0"
            max="100"
            value={localValues.blackPixelBrightnessThreshold}
            onChange={handleTextInputChange}
            disabled={isProcessing}
          />
        </div>
      </div>

      <div className="parameter-group">
        <label htmlFor="blackPixelSaturationThreshold">
          Black Pixel Saturation Threshold:
        </label>
        <div className="input-group">
          <input
            type="range"
            id="blackPixelSaturationThreshold"
            name="blackPixelSaturationThreshold"
            min="0"
            max="100"
            value={localValues.blackPixelSaturationThreshold}
            onChange={handleSliderChange}
            disabled={isProcessing}
          />
          <input 
            type="number" 
            id="blackPixelSaturationThresholdText"
            name="blackPixelSaturationThresholdText"
            min="0"
            max="100"
            value={localValues.blackPixelSaturationThreshold}
            onChange={handleTextInputChange}
            disabled={isProcessing}
          />
        </div>
      </div>

      <div className="parameter-group">
        <label htmlFor="structuringElementSize">
          Structuring Element Size:
        </label>
        <div className="input-group">
          <input
            type="range"
            id="structuringElementSize"
            name="structuringElementSize"
            min="3"
            max="51"
            step="2"
            value={localValues.structuringElementSize}
            onChange={handleSliderChange}
            disabled={isProcessing}
          />
          <input 
            type="number" 
            id="structuringElementSizeText"
            name="structuringElementSizeText"
            min="3"
            max="51"
            step="2"
            value={localValues.structuringElementSize}
            onChange={handleTextInputChange}
            disabled={isProcessing}
          />
        </div>
      </div>

      <div className="parameter-group">
        <label htmlFor="blurKernelSize">
          Blur Kernel Size:
        </label>
        <div className="input-group">
          <input
            type="range"
            id="blurKernelSize"
            name="blurKernelSize"
            min="3"
            max="51"
            step="2"
            value={localValues.blurKernelSize}
            onChange={handleSliderChange}
            disabled={isProcessing}
          />
          <input 
            type="number" 
            id="blurKernelSizeText"
            name="blurKernelSizeText"
            min="3"
            max="51"
            step="2"
            value={localValues.blurKernelSize}
            onChange={handleTextInputChange}
            disabled={isProcessing}
          />
        </div>
      </div>

      <div className="parameter-group">
        <label htmlFor="morphOpeningKernelSize">
          Morphological Opening Kernel Size:
        </label>
        <div className="input-group">
          <input
            type="range"
            id="morphOpeningKernelSize"
            name="morphOpeningKernelSize"
            min="3"
            max="21"
            step="2"
            value={localValues.morphOpeningKernelSize}
            onChange={handleSliderChange}
            disabled={isProcessing}
          />
          <input 
            type="number" 
            id="morphOpeningKernelSizeText"
            name="morphOpeningKernelSizeText"
            min="3"
            max="21"
            step="2"
            value={localValues.morphOpeningKernelSize}
            onChange={handleTextInputChange}
            disabled={isProcessing}
          />
        </div>
      </div>
    </div>
  );
} 