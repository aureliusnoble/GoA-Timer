import React from 'react';
import { Crown, Flag, Skull } from 'lucide-react';
import { VictoryProfileEntry, WinStyleBadge, VictoryType } from '../../../types';

interface VictoryProfileTabProps {
  victoryProfile: VictoryProfileEntry[];
  winStyleBadge: WinStyleBadge | null;
  heroName: string;
}

interface VictoryTypeConfig {
  icon: React.ReactNode;
  label: string;
  textColor: string;
  bgColor: string;
}

const victoryTypeConfigs: Record<VictoryType, VictoryTypeConfig> = {
  throne: {
    icon: <Crown className="w-5 h-5" />,
    label: 'Throne Victories',
    textColor: 'text-yellow-400',
    bgColor: 'bg-yellow-500',
  },
  wave: {
    icon: <Flag className="w-5 h-5" />,
    label: 'Final Wave Victories',
    textColor: 'text-blue-400',
    bgColor: 'bg-blue-500',
  },
  kills: {
    icon: <Skull className="w-5 h-5" />,
    label: 'Kill Victories',
    textColor: 'text-red-400',
    bgColor: 'bg-red-500',
  },
};

const winStyleDescriptions: Record<WinStyleBadge, string> = {
  pusher: 'Skews toward throne victories',
  control: 'Skews toward final wave victories',
  assassin: 'Skews toward kill victories',
};

const winStyleLabels: Record<WinStyleBadge, string> = {
  pusher: 'Pusher',
  control: 'Control',
  assassin: 'Assassin',
};

export const VictoryProfileTab: React.FC<VictoryProfileTabProps> = ({
  victoryProfile,
  winStyleBadge,
  heroName,
}) => {
  if (victoryProfile.length === 0) {
    return (
      <div className="p-6 bg-gray-700 rounded-lg text-center text-gray-300">
        <p>Not enough victory type data</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {victoryProfile.map((entry) => {
        const config = victoryTypeConfigs[entry.type];
        const heroPercentage = entry.heroRate * 100;
        const averagePercentage = entry.baselineRate * 100;
        const delta = heroPercentage - averagePercentage;
        const isAboveAverage = delta >= 0;

        return (
          <div key={entry.type} className="bg-gray-700 rounded-lg p-4">
            <div className="flex items-center gap-2 mb-4">
              <span className={config.textColor}>{config.icon}</span>
              <h3 className="text-sm font-semibold text-white">{config.label}</h3>
            </div>

            <div className="space-y-3">
              {/* Hero Rate Bar */}
              <div>
                <div className="flex justify-between items-center mb-1">
                  <span className="text-xs text-gray-300">{heroName}</span>
                  <span className="text-xs font-semibold text-white">
                    {heroPercentage.toFixed(1)}%
                  </span>
                </div>
                <div className="w-full h-2 bg-gray-600 rounded-full overflow-hidden">
                  <div
                    className={`h-full ${config.bgColor} rounded-full`}
                    style={{ width: `${heroPercentage}%` }}
                  />
                </div>
              </div>

              {/* Average Rate Bar */}
              <div>
                <div className="flex justify-between items-center mb-1">
                  <span className="text-xs text-gray-300">All Heroes Average</span>
                  <span className="text-xs font-semibold text-white">
                    {averagePercentage.toFixed(1)}%
                  </span>
                </div>
                <div className="w-full h-2 bg-gray-600 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-gray-600 rounded-full"
                    style={{ width: `${averagePercentage}%` }}
                  />
                </div>
              </div>

              {/* Delta Callout */}
              <div className="mt-2">
                <span
                  className={`text-xs font-semibold ${
                    isAboveAverage ? 'text-green-400' : 'text-yellow-400'
                  }`}
                >
                  {isAboveAverage ? '+' : ''}
                  {delta.toFixed(1)}% {isAboveAverage ? 'above' : 'below'} average
                </span>
              </div>
            </div>
          </div>
        );
      })}

      {/* Win Style Signature Section */}
      {winStyleBadge && (
        <div className="bg-gray-700 rounded-lg p-4">
          <h3 className="text-sm font-semibold text-white mb-3">Win Style Signature</h3>
          <div className="flex items-center gap-3">
            <div className="bg-purple-600 text-white px-3 py-1 rounded-full text-xs font-semibold">
              {winStyleLabels[winStyleBadge]}
            </div>
            <p className="text-sm text-gray-300">
              {winStyleDescriptions[winStyleBadge]}
            </p>
          </div>
        </div>
      )}
    </div>
  );
};
