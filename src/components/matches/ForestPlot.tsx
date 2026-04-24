import React from 'react';

interface ForestPlotProps {
  ate: number;        // -1 to 1 scale (e.g., 0.032 = +3.2%)
  ciLower: number;    // lower bound of 95% CI
  ciUpper: number;    // upper bound of 95% CI
  sufficient: boolean; // enough data?
  size?: 'small' | 'large';
}

const ForestPlot: React.FC<ForestPlotProps> = ({
  ate,
  ciLower,
  ciUpper,
  sufficient,
  size = 'small'
}) => {
  // Scale constants: [-10%, 10%] → [0%, 100%]
  const SCALE_MIN = -0.10;
  const SCALE_MAX = 0.10;

  // Convert value from [-0.10, 0.10] to [0, 100] for CSS positioning
  const toPercent = (value: number): number => {
    const clamped = Math.max(SCALE_MIN, Math.min(SCALE_MAX, value));
    return ((clamped - SCALE_MIN) / (SCALE_MAX - SCALE_MIN)) * 100;
  };

  // Determine dot color based on CI and sufficient data
  const getDotColor = (): string => {
    if (!sufficient) return '#6b7280'; // grey
    if (ciLower > 0) return '#4ade80'; // green - CI entirely positive
    if (ciUpper < 0) return '#fbbf24'; // amber - CI entirely negative
    return '#6b7280'; // grey - CI crosses zero
  };

  // Get CI band color with 25% opacity
  const getCIBandColor = (color: string): string => {
    // Convert hex to rgba with 25% opacity
    const hex = color.replace('#', '');
    const r = parseInt(hex.substring(0, 2), 16);
    const g = parseInt(hex.substring(2, 4), 16);
    const b = parseInt(hex.substring(4, 6), 16);
    return `rgba(${r}, ${g}, ${b}, 0.25)`;
  };

  const dotColor = getDotColor();
  const ciBandColor = getCIBandColor(dotColor);

  // Calculate positions
  const atePercent = toPercent(ate);
  const ciLeftPercent = toPercent(ciLower);
  const ciRightPercent = toPercent(ciUpper);
  const zeroPercent = toPercent(0);

  // Size variants
  const isSmall = size === 'small';
  const trackHeight = isSmall ? 'h-5' : 'h-8';
  const dotSize = isSmall ? 10 : 14;
  const dotSizePx = `${dotSize}px`;

  // Format percentage for labels
  const formatPercent = (value: number): string => {
    const pct = Math.round(value * 100);
    return pct >= 0 ? `+${pct}%` : `${pct}%`;
  };

  return (
    <div className="w-full">
      {/* Track Container */}
      <div className="relative mb-1">
        {/* Background track */}
        <div className={`${trackHeight} bg-gray-800 rounded w-full relative`}>
          {/* CI Band */}
          <div
            className="absolute h-full rounded"
            style={{
              left: `${ciLeftPercent}%`,
              right: `${100 - ciRightPercent}%`,
              backgroundColor: ciBandColor,
            }}
          />

          {/* Zero reference line */}
          <div
            className="absolute w-0.5 h-full bg-gray-500"
            style={{ left: `${zeroPercent}%` }}
          />

          {/* ATE Dot */}
          <div
            className="absolute border-2 border-gray-900 rounded-full transform -translate-x-1/2 -translate-y-1/2 top-1/2"
            style={{
              left: `${atePercent}%`,
              width: dotSizePx,
              height: dotSizePx,
              backgroundColor: dotColor,
            }}
          />
        </div>
      </div>

      {/* Scale Labels */}
      <div className="relative w-full" style={{ height: '20px' }}>
        {isSmall ? (
          // Small variant: -10%, 0, +10%
          <>
            <div
              className="absolute text-xs text-gray-400 transform -translate-x-1/2"
              style={{ left: '0%', top: '0px' }}
            >
              -10%
            </div>
            <div
              className="absolute text-xs text-gray-400 transform -translate-x-1/2"
              style={{ left: '50%', top: '0px' }}
            >
              0
            </div>
            <div
              className="absolute text-xs text-gray-400 transform -translate-x-1/2"
              style={{ left: '100%', top: '0px' }}
            >
              +10%
            </div>
          </>
        ) : (
          // Large variant: -10%, -5%, 0, +5%, +10%
          <>
            <div
              className="absolute text-xs text-gray-400 transform -translate-x-1/2"
              style={{ left: '0%', top: '0px' }}
            >
              -10%
            </div>
            <div
              className="absolute text-xs text-gray-400 transform -translate-x-1/2"
              style={{ left: '25%', top: '0px' }}
            >
              -5%
            </div>
            <div
              className="absolute text-xs text-gray-400 transform -translate-x-1/2"
              style={{ left: '50%', top: '0px' }}
            >
              0
            </div>
            <div
              className="absolute text-xs text-gray-400 transform -translate-x-1/2"
              style={{ left: '75%', top: '0px' }}
            >
              +5%
            </div>
            <div
              className="absolute text-xs text-gray-400 transform -translate-x-1/2"
              style={{ left: '100%', top: '0px' }}
            >
              +10%
            </div>
          </>
        )}
      </div>

      {/* Value Display (optional) */}
      {sufficient && (
        <div className="mt-2 text-center text-xs text-gray-400">
          ATE: {formatPercent(ate)} (95% CI: {formatPercent(ciLower)} to {formatPercent(ciUpper)})
        </div>
      )}
    </div>
  );
};

export default ForestPlot;
