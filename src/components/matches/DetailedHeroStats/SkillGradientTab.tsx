import React from 'react';
import {
  ResponsiveContainer, ComposedChart, Line, XAxis, YAxis,
  ReferenceLine, Tooltip, CartesianGrid, Area,
} from 'recharts';
import { GradientPoint, GradientBadge } from '../../../types';
import { Info } from 'lucide-react';

interface SkillGradientTabProps {
  gradient: GradientPoint[];
  gradientBadge: GradientBadge;
  heroName: string;
}

const percentileLabels: Record<number, string> = {
  10: '10th',
  25: '25th',
  50: '50th',
  75: '75th',
  90: '90th',
};

export const SkillGradientTab: React.FC<SkillGradientTabProps> = ({
  gradient,
  heroName,
}) => {
  // Show "Not enough data" message if gradient is empty
  if (!gradient || gradient.length === 0) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-gray-400">Not enough data</p>
      </div>
    );
  }

  // Transform gradient data for Recharts
  const chartData = gradient.map((point) => ({
    percentile: percentileLabels[point.percentile] || `${point.percentile}th`,
    ate: point.ate * 100, // Convert to percentage
    ciUpper: point.ciUpper * 100,
    ciLower: point.ciLower * 100,
    rawPercentile: point.percentile,
  }));

  // Get min and max for Y-axis
  const allValues = gradient.flatMap((p) => [p.ate * 100, p.ciUpper * 100, p.ciLower * 100]);
  const minValue = Math.min(...allValues, 0);
  const maxValue = Math.max(...allValues, 0);

  // Calculate insight text
  const firstAte = gradient[0].ate * 100;
  const lastAte = gradient[gradient.length - 1].ate * 100;

  const performanceText =
    Math.abs(lastAte - firstAte) < 5
      ? `${heroName} performs consistently`
      : lastAte > firstAte
        ? `${heroName} rewards skilled teams`
        : `${heroName} is more effective with less experienced teams`;

  const impactDirection = lastAte > firstAte ? 'rises' : 'falls';
  const impactText = `Impact ${impactDirection} from ${Math.round(firstAte)}% at 10th to ${Math.round(lastAte)}% at 90th.`;

  return (
    <div className="space-y-6">
      {/* Chart */}
      <div className="bg-gray-700 rounded-lg p-6">
        <ResponsiveContainer width="100%" height={400}>
          <ComposedChart
            data={chartData}
            margin={{ top: 20, right: 30, left: 0, bottom: 60 }}
          >
            <CartesianGrid stroke="#374151" strokeDasharray="5 5" />

            {/* X-Axis */}
            <XAxis
              dataKey="percentile"
              stroke="#9ca3af"
              tick={{ fontSize: 12, fill: '#d1d5db' }}
              label={{
                value: 'Team Skill Percentile',
                position: 'bottom',
                offset: 40,
                fill: '#d1d5db',
                fontSize: 14,
              }}
            />

            {/* Y-Axis */}
            <YAxis
              stroke="#9ca3af"
              tick={{ fontSize: 12, fill: '#d1d5db' }}
              tickFormatter={(value) => `${value > 0 ? '+' : ''}${value.toFixed(0)}%`}
              domain={[Math.floor(minValue / 10) * 10, Math.ceil(maxValue / 10) * 10]}
            />

            {/* Reference line at y=0 */}
            <ReferenceLine
              y={0}
              stroke="#9ca3af"
              strokeDasharray="5 5"
              label={{
                value: 'no effect',
                position: 'right',
                fill: '#9ca3af',
                fontSize: 12,
              }}
            />

            {/* Confidence band - mask using dark fill for ciLower */}
            <Area
              type="monotone"
              dataKey="ciUpper"
              fill="#c084fc"
              stroke="none"
              fillOpacity={0.12}
              isAnimationActive={false}
            />
            <Area
              type="monotone"
              dataKey="ciLower"
              fill="#1f2937"
              stroke="none"
              fillOpacity={1}
              isAnimationActive={false}
            />

            {/* ATE line */}
            <Line
              type="monotone"
              dataKey="ate"
              stroke="#c084fc"
              strokeWidth={3}
              dot={{ fill: '#c084fc', r: 4 }}
              isAnimationActive={false}
            />

            {/* Tooltip */}
            <Tooltip
              contentStyle={{
                backgroundColor: '#1f2937',
                border: '1px solid #374151',
                borderRadius: '6px',
              }}
              labelStyle={{ color: '#d1d5db' }}
              formatter={(value: number) => [
                `${value > 0 ? '+' : ''}${value.toFixed(1)}%`,
                '',
              ]}
            />
          </ComposedChart>
        </ResponsiveContainer>

        {/* Axis labels below chart */}
        <div className="flex justify-between mt-4 px-4 text-sm text-gray-400">
          <span>← Weaker teams</span>
          <span>Stronger teams →</span>
        </div>
      </div>

      {/* Insight Text */}
      <div className="bg-gray-700 rounded-lg p-4">
        <p className="text-gray-300 text-sm">
          <span className="font-semibold">{performanceText}.</span> {impactText}
        </p>
      </div>

      {/* Interpretation Note */}
      <div className="bg-gray-700 rounded-lg p-4 flex gap-3">
        <Info className="w-5 h-5 text-gray-400 flex-shrink-0 mt-0.5" />
        <p className="text-gray-400 text-sm">
          Team skill = average rating of all players in the team. Skills that reward
          stronger teams may excel in competitive environments.
        </p>
      </div>
    </div>
  );
};
