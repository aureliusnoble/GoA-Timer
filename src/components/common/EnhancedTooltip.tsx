import React, { useState, useRef, useCallback } from 'react';
import { useDevice } from '../../hooks/useDevice';

interface EnhancedTooltipProps {
  text: string;
  children: React.ReactNode;
  position?: 'top' | 'bottom' | 'left' | 'right';
  className?: string;
  maxWidth?: string;
}

/**
 * Enhanced tooltip component that behaves differently based on device type:
 * - Mobile: Click/tap to show tooltip, click elsewhere to dismiss
 * - Desktop: Hover to show tooltip
 */
const EnhancedTooltip: React.FC<EnhancedTooltipProps> = ({
  text,
  children,
  position = 'top',
  className = '',
  maxWidth = 'max-w-xs',
}) => {
  const { isMobile } = useDevice();
  const [isVisible, setIsVisible] = useState(false);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const tooltipRef = useRef<HTMLDivElement>(null);
  
  // Mobile click handler
  const handleMobileToggle = useCallback((e: React.MouseEvent) => {
    e.stopPropagation(); // Prevent clicks from propagating
    setIsVisible(!isVisible);
  }, [isVisible]);
  
  // Desktop hover handlers
  const showTooltip = useCallback(() => {
    if (isMobile) return; // Don't use hover on mobile
    
    timeoutRef.current = setTimeout(() => {
      setIsVisible(true);
    }, 300); // Small delay to prevent flickering
  }, [isMobile]);
  
  const hideTooltip = useCallback(() => {
    if (isMobile) return; // Don't use hover on mobile
    
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
    setIsVisible(false);
  }, [isMobile]);
  
  // Click outside handler for mobile
  React.useEffect(() => {
    if (!isMobile || !isVisible) return;
    
    const handleClickOutside = (event: MouseEvent) => {
      if (tooltipRef.current && !tooltipRef.current.contains(event.target as Node)) {
        setIsVisible(false);
      }
    };
    
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.addEventListener('mousedown', handleClickOutside);
    };
  }, [isMobile, isVisible]);
  
  // Position classes
  const positionClasses = {
    top: 'bottom-full left-1/2 transform -translate-x-1/2 mb-2',
    bottom: 'top-full left-1/2 transform -translate-x-1/2 mt-2',
    left: 'right-full top-1/2 transform -translate-y-1/2 mr-2',
    right: 'left-full top-1/2 transform -translate-y-1/2 ml-2',
  };
  
  // Arrow classes
  const arrowClasses = {
    top: 'top-full left-1/2 transform -translate-x-1/2 border-t-4 border-r-4 border-l-4 border-transparent border-t-gray-900',
    bottom: 'bottom-full left-1/2 transform -translate-x-1/2 border-b-4 border-r-4 border-l-4 border-transparent border-b-gray-900',
    left: 'left-full top-1/2 transform -translate-y-1/2 border-l-4 border-t-4 border-b-4 border-transparent border-l-gray-900',
    right: 'right-full top-1/2 transform -translate-y-1/2 border-r-4 border-t-4 border-b-4 border-transparent border-r-gray-900',
  };

  return (
    <div 
      ref={tooltipRef}
      className={`relative inline-block ${className}`}
      onMouseEnter={showTooltip}
      onMouseLeave={hideTooltip}
      onClick={isMobile ? handleMobileToggle : undefined}
      onTouchStart={isMobile ? () => {} : undefined} // Prevent default touch behavior on mobile
    >
      {children}
      
      {isVisible && (
        <div 
          className={`absolute z-50 px-3 py-2 text-sm bg-gray-900 text-white rounded shadow-lg ${positionClasses[position]} ${maxWidth}`}
          onClick={(e) => isMobile && e.stopPropagation()} // Prevent clicks inside tooltip from closing it
        >
          {text}
          <div className={`absolute w-0 h-0 ${arrowClasses[position]}`}></div>
        </div>
      )}
    </div>
  );
};

export default EnhancedTooltip;