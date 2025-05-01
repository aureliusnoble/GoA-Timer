// src/components/HeroRoleExplanation.tsx
import React, { useState } from 'react';
import { ChevronDown, ChevronUp } from 'lucide-react';

interface RoleExplanation {
  role: string;
  description: string;
}

const HeroRoleExplanation: React.FC = () => {
  const [isExpanded, setIsExpanded] = useState<boolean>(false);

  const roleExplanations: RoleExplanation[] = [
    {
      role: "Damager",
      description: "Damagers are heroes adept at forcing their opponents to discard cards. This weakens enemy heroes, making it easier for your allies to take them down."
    },
    {
      role: "Disabler",
      description: "Disablers possess the power to weaken enemy heroes by preventing or limiting their ability to perform certain actions."
    },
    {
      role: "Durable",
      description: "Durable heroes are best equipped to withstand the heat of battle and survive, usually achieve this through a combination of a high defense stat and self-healing abilities."
    },
    {
      role: "Farming",
      description: "Heroes with farming abilities can generate extra coins for themselves or their allies, enabling faster leveling and setting up stronger late game."
    },
    {
      role: "Healer",
      description: "Healers help their allies by letting them retrieve discarded cards, greatly increasing their chances of surviving the fight."
    },
    {
      role: "Melee",
      description: "These heroes are focused on attacking in close quarters. A team composed entirely of melee fighters is formidable in a brawl, but may struggle against fast ranged heroes and heroes capable of placing tokens."
    },
    {
      role: "Pusher",
      description: "These heroes are able to deal with more than two enemy minions each round, or protect and respawn their own minions, giving them an edge at pushing the lane."
    },
    {
      role: "Sniper",
      description: "Most heroes have access to some form of ranged attacks, while Snipers are capable of attacking enemy heroes and minions at a much longer range."
    },
    {
      role: "Tactician",
      description: "Tacticians specialize in controlling the battlefield by moving, pushing, or repositioning units. Their versatile abilities allow them to support allies and hinder enemies."
    },
    {
      role: "Tokens",
      description: "These heroes are capable of placing tokens — temporary obstacles with special qualities. Each such hero uses their own type of tokens and the icon will correspond to the ones used by this particular hero."
    }
  ];

  return (
    <div className="bg-gray-700 rounded-lg mb-4 overflow-hidden">
      <button 
        className="w-full px-4 py-3 flex items-center justify-between bg-gray-800 hover:bg-gray-700 transition-colors text-left"
        onClick={() => setIsExpanded(!isExpanded)}
        aria-expanded={isExpanded}
      >
        <span className="font-semibold flex items-center">
          <span className="mr-2 text-yellow-400">ℹ</span>
          Hero Role Explanations
        </span>
        {isExpanded ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
      </button>
      
      {isExpanded && (
        <div className="p-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {roleExplanations.map((item) => (
              <div key={item.role} className="bg-gray-800 p-3 rounded">
                <h4 className="text-yellow-400 font-semibold mb-1">{item.role}</h4>
                <p className="text-sm text-gray-300">{item.description}</p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default HeroRoleExplanation;