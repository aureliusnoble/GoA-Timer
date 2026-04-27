import React from 'react';

interface ForestPlotProps {
  ate: number;
  ciLower: number;
  ciUpper: number;
  sufficient: boolean;
  size?: 'small' | 'large';
}

const ForestPlot: React.FC<ForestPlotProps> = ({
  ate,
  ciLower,
  ciUpper,
  sufficient,
  size = 'small'
}) => {
  const SCALE_MIN = -0.50;
  const SCALE_MAX = 0.50;

  const toPercent = (value: number): number => {
    const clamped = Math.max(SCALE_MIN, Math.min(SCALE_MAX, value));
    return ((clamped - SCALE_MIN) / (SCALE_MAX - SCALE_MIN)) * 100;
  };

  const getColor = (): { r: number; g: number; b: number } => {
    if (!sufficient) return { r: 107, g: 114, b: 128 };
    if (ciLower > 0) return { r: 74, g: 222, b: 128 };
    if (ciUpper < 0) return { r: 251, g: 191, b: 36 };
    return { r: 107, g: 114, b: 128 };
  };

  const ciWidth = ciUpper - ciLower;
  const maxReasonableWidth = SCALE_MAX - SCALE_MIN;
  const confidence = Math.max(0, 1 - ciWidth / maxReasonableWidth);
  const barOpacity = 0.15 + confidence * 0.55;

  const color = getColor();
  const atePercent = toPercent(ate);
  const ciLeftPercent = toPercent(ciLower);
  const ciRightPercent = toPercent(ciUpper);
  const zeroPercent = toPercent(0);

  const isSmall = size === 'small';
  const trackHeight = isSmall ? 'h-5' : 'h-8';
  const dotSize = isSmall ? 10 : 14;

  const formatPercent = (value: number): string => {
    const pct = Math.round(value * 100);
    return pct >= 0 ? `+${pct}%` : `${pct}%`;
  };

  return (
    <div className="w-full">
      <div className="relative mb-1">
        <div className={`${trackHeight} bg-gray-800 rounded w-full relative`}>
          {/* CI Bar */}
          <div
            className="absolute h-full rounded"
            style={{
              left: `${ciLeftPercent}%`,
              right: `${100 - ciRightPercent}%`,
              backgroundColor: `rgba(${color.r}, ${color.g}, ${color.b}, ${barOpacity})`,
              border: `1px solid rgba(${color.r}, ${color.g}, ${color.b}, ${barOpacity + 0.15})`,
            }}
          />

          {/* Zero reference line */}
          <div
            className="absolute w-0.5 h-full bg-gray-500"
            style={{ left: `${zeroPercent}%` }}
          />

          {/* ATE Dot */}
          <div
            className="absolute rounded-full transform -translate-x-1/2 -translate-y-1/2 top-1/2"
            style={{
              left: `${atePercent}%`,
              width: `${dotSize}px`,
              height: `${dotSize}px`,
              backgroundColor: `rgb(${color.r}, ${color.g}, ${color.b})`,
              boxShadow: `0 0 4px rgba(${color.r}, ${color.g}, ${color.b}, 0.6)`,
            }}
          />
        </div>
      </div>

      {/* Scale Labels */}
      <div className="relative w-full" style={{ height: '20px' }}>
        {isSmall ? (
          <>
            <div className="absolute text-xs text-gray-500" style={{ left: '0%', transform: 'translateX(0)' }}>
              -50%
            </div>
            <div className="absolute text-xs text-gray-400 transform -translate-x-1/2" style={{ left: '50%' }}>
              0
            </div>
            <div className="absolute text-xs text-gray-500" style={{ right: '0%' }}>
              +50%
            </div>
          </>
        ) : (
          <>
            <div className="absolute text-xs text-gray-500" style={{ left: '0%', transform: 'translateX(0)' }}>
              -50%
            </div>
            <div className="absolute text-xs text-gray-500 transform -translate-x-1/2" style={{ left: '25%' }}>
              -25%
            </div>
            <div className="absolute text-xs text-gray-400 transform -translate-x-1/2" style={{ left: '50%' }}>
              0
            </div>
            <div className="absolute text-xs text-gray-500 transform -translate-x-1/2" style={{ left: '75%' }}>
              +25%
            </div>
            <div className="absolute text-xs text-gray-500" style={{ right: '0%' }}>
              +50%
            </div>
          </>
        )}
      </div>

      {sufficient && (
        <div className="mt-2 text-center text-xs text-gray-400">
          ATE: {formatPercent(ate)} (95% CI: {formatPercent(ciLower)} to {formatPercent(ciUpper)})
        </div>
      )}
    </div>
  );
};

export default ForestPlot;
