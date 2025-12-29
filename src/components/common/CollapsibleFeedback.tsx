import React, { useState } from 'react';
import { ChevronUp, ChevronDown } from 'lucide-react';

interface CollapsibleFeedbackProps {
  feedbackUrl: string;
}

const CollapsibleFeedback: React.FC<CollapsibleFeedbackProps> = ({ feedbackUrl }) => {
  // Load initial state from localStorage, default to expanded
  const [isExpanded, setIsExpanded] = useState(() => {
    const saved = localStorage.getItem('feedbackBar_expanded');
    return saved !== null ? saved === 'true' : true;
  });

  const toggleExpand = () => {
    setIsExpanded((prev) => {
      const newValue = !prev;
      localStorage.setItem('feedbackBar_expanded', String(newValue));
      return newValue;
    });
  };

  return (
    <div className="fixed bottom-0 left-0 z-50 transition-all duration-300">
      {isExpanded ? (
        // Expanded: full‐width bar at bottom
        <div className="w-full bg-gray-800 bg-opacity-90 backdrop-blur-sm text-center text-base text-white py-3 px-4 flex items-center justify-between shadow-lg">
          <div className="flex-1" />

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
        // Collapsed: just an up arrow in bottom‐left
        <button
          onClick={toggleExpand}
          className="fixed bottom-2 left-2 bg-blue-600 hover:bg-blue-500 p-2 rounded-full shadow-lg"
          aria-label="Expand feedback bar"
        >
          <ChevronUp size={20} className="text-white" />
        </button>
      )}
    </div>
  );
};

export default CollapsibleFeedback;
