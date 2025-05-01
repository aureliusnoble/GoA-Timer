import React, { useState } from 'react';
import { MessageSquare, ChevronUp, ChevronDown } from 'lucide-react';

interface CollapsibleFeedbackProps {
  feedbackUrl: string;
}

/**
 * A collapsible feedback bar component that:
 * - Starts collapsed on mobile
 * - Can be expanded/collapsed with a tap/click
 * - Takes minimal screen space when collapsed
 */
const CollapsibleFeedback: React.FC<CollapsibleFeedbackProps> = ({ 
  feedbackUrl 
}) => {
  const [isExpanded, setIsExpanded] = useState(false);
  
  const toggleExpand = () => {
    setIsExpanded(!isExpanded);
  };
  
  return (
    <div className={`fixed ${isExpanded ? 'bottom-0' : 'bottom-2 right-2 sm:bottom-0 sm:right-0 sm:w-full'} transition-all duration-300 z-10`}>
      {isExpanded ? (
        // Expanded state - full width bar
        <div className="w-full bg-white bg-opacity-15 backdrop-blur-sm text-center text-base text-white py-2 px-4 flex items-center justify-between">
          <div className="flex-1"></div>
          <div className="flex-1 text-center">
            <a
              href={feedbackUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="underline hover:text-blue-300"
            >
              Share Feedback
            </a>
          </div>
          <div className="flex-1 flex justify-end">
            <button 
              onClick={toggleExpand}
              className="p-1 rounded-full hover:bg-white/10 transition-colors"
              aria-label="Collapse feedback bar"
            >
              <ChevronDown size={16} />
            </button>
          </div>
        </div>
      ) : (
        // Collapsed state - button only
        <button
          onClick={toggleExpand}
          className="sm:hidden bg-blue-600 hover:bg-blue-500 p-2 rounded-full shadow-lg"
          aria-label="Expand feedback options"
        >
          <MessageSquare size={20} className="text-white" />
          
          {/* Desktop version */}
          <div className="hidden sm:block fixed bottom-0 left-0 w-full bg-white bg-opacity-15 backdrop-blur-sm text-center text-white py-2">
            <div className="flex items-center justify-center">
              <span className="mr-2">Feedback</span>
              <ChevronUp size={16} />
            </div>
          </div>
        </button>
      )}
    </div>
  );
};

export default CollapsibleFeedback;