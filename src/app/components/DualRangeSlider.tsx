import { useState, useRef, useEffect } from "react";

interface DualRangeSliderProps {
  min: number;
  max: number;
  minValue: number;
  maxValue: number;
  step?: number;
  onChange: (min: number, max: number) => void;
}

export function DualRangeSlider({
  min,
  max,
  minValue,
  maxValue,
  step = 1,
  onChange,
}: DualRangeSliderProps) {
  const [localMinValue, setLocalMinValue] = useState(minValue);
  const [localMaxValue, setLocalMaxValue] = useState(maxValue);
  const rangeRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setLocalMinValue(minValue);
    setLocalMaxValue(maxValue);
  }, [minValue, maxValue]);

  const handleMinChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = Math.min(Number(e.target.value), localMaxValue - step);
    setLocalMinValue(value);
    onChange(value, localMaxValue);
  };

  const handleMaxChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = Math.max(Number(e.target.value), localMinValue + step);
    setLocalMaxValue(value);
    onChange(localMinValue, value);
  };

  const minPercent = ((localMinValue - min) / (max - min)) * 100;
  const maxPercent = ((localMaxValue - min) / (max - min)) * 100;

  return (
    <div className="relative pt-2 pb-6">
      <div ref={rangeRef} className="relative h-2 bg-gray-200 rounded-full">
        <div
          className="absolute h-2 rounded-full"
          style={{
            left: `${minPercent}%`,
            right: `${100 - maxPercent}%`,
            backgroundColor: "#D4AF37",
          }}
        />
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={localMinValue}
        onChange={handleMinChange}
        className="absolute w-full h-2 bg-transparent appearance-none pointer-events-none"
        style={{
          top: "8px",
          zIndex: localMinValue > max - 100 ? 5 : 3,
        }}
      />
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={localMaxValue}
        onChange={handleMaxChange}
        className="absolute w-full h-2 bg-transparent appearance-none pointer-events-none"
        style={{
          top: "8px",
          zIndex: 4,
        }}
      />
      <style>{`
        input[type="range"]::-webkit-slider-thumb {
          appearance: none;
          pointer-events: auto;
          width: 20px;
          height: 20px;
          border-radius: 50%;
          background: #D4AF37;
          cursor: pointer;
          border: 2px solid white;
          box-shadow: 0 2px 4px rgba(0,0,0,0.2);
        }
        input[type="range"]::-moz-range-thumb {
          pointer-events: auto;
          width: 20px;
          height: 20px;
          border-radius: 50%;
          background: #D4AF37;
          cursor: pointer;
          border: 2px solid white;
          box-shadow: 0 2px 4px rgba(0,0,0,0.2);
        }
      `}</style>
    </div>
  );
}
