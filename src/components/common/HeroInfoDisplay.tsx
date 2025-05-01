import React, { useRef, useEffect, useState } from 'react';
import { Hero } from '../../types';
import { useDevice } from '../../hooks/useDevice';
import { X } from 'lucide-react';

// allow px positions or "auto"
type TooltipPosition = {
  left: number | 'auto';
  top:  number | 'auto';
  right: number | 'auto';
  bottom: number | 'auto';
};


interface HeroInfoDisplayProps {
  hero: Hero | null;
  onClose: () => void;
  isVisible: boolean;
  // New prop to receive the position of the hero card
  cardPosition?: { x: number; y: number; width: number; height: number; };
}

/**
 * Displays detailed information about a hero
 * - Mobile: Modal dialog with close button
 * - Desktop: Fixed position tooltip that avoids overlapping the source card
 */
const HeroInfoDisplay: React.FC<HeroInfoDisplayProps> = ({ 
  hero, 
  onClose, 
  isVisible,
  cardPosition
}) => {
  const { isMobile } = useDevice();
  const modalRef = useRef<HTMLDivElement>(null);
  const tooltipRef = useRef<HTMLDivElement>(null);
  
  // State to track calculated position
const [tooltipPosition, setTooltipPosition] = useState<TooltipPosition>({
  left:   8,
  bottom: 8,
  right:  'auto',
  top:    'auto',
});

  
  // Calculate optimal tooltip position to avoid overlapping with the hero card
  useEffect(() => {
  if (!isMobile && isVisible && tooltipRef.current && cardPosition) {
    const tooltipRect   = tooltipRef.current.getBoundingClientRect();
    const viewportWidth = window.innerWidth;
    const viewportHeight= window.innerHeight;

    // start with a valid TooltipPosition
    let newPosition: TooltipPosition = {
      left:   8,
      bottom: 8,
      right:  'auto',
      top:    'auto',
    };

    if (cardPosition.x < viewportWidth / 2) {
      newPosition = {
        left:   Math.min(cardPosition.x + cardPosition.width + 20,
                        viewportWidth - tooltipRect.width - 8),
        top:    Math.min(cardPosition.y,
                        viewportHeight - tooltipRect.height - 8),
        right:  'auto',
        bottom: 'auto',
      };
    } else {
      newPosition = {
        right:  Math.min(viewportWidth - cardPosition.x + 20,
                         viewportWidth - 8),
        top:    Math.min(cardPosition.y,
                        viewportHeight - tooltipRect.height - 8),
        left:   'auto',
        bottom: 'auto',
      };
    }

    // if it would overflow the bottom
    if (cardPosition.y + tooltipRect.height > viewportHeight - 20) {
      newPosition.top = Math.max(8,
                                 viewportHeight - tooltipRect.height - 20);
    }

    setTooltipPosition(newPosition);
  }
}, [isMobile, isVisible, cardPosition]);

  
  if (!hero || !isVisible) return null;
  
  // Handle click outside for mobile modal
  const handleBackdropClick = (e: React.MouseEvent) => {
    if (modalRef.current && !modalRef.current.contains(e.target as Node)) {
      onClose();
    }
  };
  
  // Mobile version (modal)
  if (isMobile) {
    return (
      <div 
        className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4"
        onClick={handleBackdropClick}
      >
        <div 
          ref={modalRef}
          className="bg-gray-900 rounded-lg w-full max-w-md p-4 relative"
          onClick={(e) => e.stopPropagation()}
        >
          <button 
            className="absolute top-2 right-2 p-1 bg-gray-800 rounded-full"
            onClick={onClose}
            aria-label="Close hero information"
          >
            <X size={18} />
          </button>
          
          <div className="flex flex-col items-center">
            <div className="w-24 h-24 bg-gray-300 rounded-full overflow-hidden mb-3">
              <img 
                src={hero.icon} 
                alt={hero.name} 
                className="w-full h-full object-cover"
                onError={(e) => {
                  (e.target as HTMLImageElement).src = 'https://via.placeholder.com/96?text=Hero';
                }}
              />
            </div>
            
            <h3 className="text-xl font-bold mb-1">{hero.name}</h3>
            <div className="text-sm text-gray-300 mb-2">{hero.roles.join(' • ')}</div>
            
            <div className="flex mb-3">
              {[...Array(hero.complexity)].map((_, i) => (
                <span key={i} className="text-yellow-400 text-lg">★</span>
              ))}
              {[...Array(4 - hero.complexity)].map((_, i) => (
                <span key={i + hero.complexity} className="text-gray-600 text-lg">★</span>
              ))}
            </div>
            
            <p className="text-sm leading-relaxed">
              {hero.description || "This hero's abilities and playstyle are shrouded in mystery."}
            </p>
          </div>
        </div>
      </div>
    );
  }
  
  // Desktop version (positioned tooltip)
  return (
    <div 
      ref={tooltipRef}
      className="fixed bg-gray-900/95 p-6 rounded-lg shadow-lg max-w-2xl z-50"
      style={{
        left: tooltipPosition.left !== 'auto' ? `${tooltipPosition.left}px` : 'auto',
        right: tooltipPosition.right !== 'auto' ? `${tooltipPosition.right}px` : 'auto',
        top: tooltipPosition.top !== 'auto' ? `${tooltipPosition.top}px` : 'auto',
        bottom: tooltipPosition.bottom !== 'auto' ? `${tooltipPosition.bottom}px` : 'auto',
      }}
    >
      <div className="flex items-start">
        <div className="w-28 h-28 bg-gray-300 rounded-full overflow-hidden mr-6 flex-shrink-0">
          <img 
            src={hero.icon} 
            alt={hero.name} 
            className="w-full h-full object-cover"
            onError={(e) => {
              (e.target as HTMLImageElement).src = 'https://via.placeholder.com/192?text=Hero';
            }}
          />
        </div>
        <div>
          <h3 className="text-2xl font-bold mb-2">{hero.name}</h3>
          <div className="text-lg text-gray-300 mb-2">{hero.roles.join(' • ')}</div>
          <div className="flex mb-3">
            {[...Array(hero.complexity)].map((_, i) => (
              <span key={i} className="text-yellow-400 text-xl">★</span>
            ))}
            {[...Array(4 - hero.complexity)].map((_, i) => (
              <span key={i + hero.complexity} className="text-gray-600 text-xl">★</span>
            ))}
          </div>
          <p className="text-base leading-relaxed">
            {hero.description || "This hero's abilities and playstyle are shrouded in mystery."}
          </p>
        </div>
      </div>
    </div>
  );
};

export default HeroInfoDisplay;