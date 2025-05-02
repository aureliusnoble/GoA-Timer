import React, { useState, useRef, useEffect, useCallback } from 'react';
import { useDevice } from '../../hooks/useDevice';

interface EnhancedTooltipProps {
  text: string;
  children: React.ReactNode;
  position?: 'top' | 'bottom' | 'left' | 'right';
  className?: string;
  maxWidth?: string;
  disableMobileTooltip?: boolean; // New prop to disable tooltip on mobile
}

const EnhancedTooltip: React.FC<EnhancedTooltipProps> = ({
  text,
  children,
  position = 'top',
  className = '',
  maxWidth = 'max-w-xs',
  disableMobileTooltip = false, // Default to false for backward compatibility
}) => {
  const { isMobile } = useDevice();
  const [isVisible, setIsVisible] = useState(false);
  const [adjustedPosition, setAdjustedPosition] = useState(position);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const tooltipRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  
  // Check viewport boundaries and adjust tooltip position
  const adjustTooltipPosition = useCallback(() => {
    if (!isVisible || !tooltipRef.current || !containerRef.current) return;
    
    const tooltipRect = tooltipRef.current.getBoundingClientRect();
    const containerRect = containerRef.current.getBoundingClientRect();
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;
    
    let newPosition = position;
    
    // Check horizontal overflow
    if ((position === 'left' && containerRect.left < tooltipRect.width + 10) ||
        (position === 'right' && containerRect.right + tooltipRect.width + 10 > viewportWidth)) {
      // If overflow, flip horizontal position
      newPosition = position === 'left' ? 'right' : 'left';
    }
    
    // Check vertical overflow
    if ((position === 'top' && containerRect.top < tooltipRect.height + 10) ||
        (position === 'bottom' && containerRect.bottom + tooltipRect.height + 10 > viewportHeight)) {
      // If overflow, flip vertical position
      newPosition = position === 'top' ? 'bottom' : 'top';
    }
    
    setAdjustedPosition(newPosition);
  }, [isVisible, position]);
  
  // Run position adjustment when tooltip becomes visible
  useEffect(() => {
    if (isVisible) {
      // Wait for tooltip to render before measuring
      setTimeout(adjustTooltipPosition, 0);
    }
  }, [isVisible, adjustTooltipPosition]);
  
  // Mobile click handler - now respects disableMobileTooltip
  const handleMobileToggle = useCallback((e: React.MouseEvent) => {
    if (disableMobileTooltip) return; // Skip if mobile tooltips are disabled
    
    e.stopPropagation();
    setIsVisible(!isVisible);
  }, [isVisible, disableMobileTooltip]);
  
  // Desktop hover handlers
  const showTooltip = useCallback(() => {
    if (isMobile) return;
    
    timeoutRef.current = setTimeout(() => {
      setIsVisible(true);
    }, 300);
  }, [isMobile]);
  
  const hideTooltip = useCallback(() => {
    if (isMobile) return;
    
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
    setIsVisible(false);
  }, [isMobile]);
  
  // Click outside handler for mobile
  useEffect(() => {
    if (!isMobile || !isVisible) return;
    
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsVisible(false);
      }
    };
    
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
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
      ref={containerRef}
      className={`relative inline-block ${className}`}
      onMouseEnter={showTooltip}
      onMouseLeave={hideTooltip}
      onClick={isMobile && !disableMobileTooltip ? handleMobileToggle : undefined} // Only show tooltips on mobile if not disabled
    >
      {children}
      
      {isVisible && (
        <div 
          ref={tooltipRef}
          className={`absolute z-50 px-3 py-2 text-sm bg-gray-900 text-white rounded shadow-lg w-auto min-w-[160px] ${positionClasses[adjustedPosition]} ${maxWidth}`}
          onClick={(e) => isMobile && !disableMobileTooltip && e.stopPropagation()}
        >
          {text}
          <div className={`absolute w-0 h-0 ${arrowClasses[adjustedPosition]}`}></div>
        </div>
      )}
    </div>
  );
};

export default EnhancedTooltip;