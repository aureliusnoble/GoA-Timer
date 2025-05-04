// src/components/common/ConnectionModal.tsx
import React, { useEffect, useRef } from 'react';
import { ConnectionSetup } from './ConnectionSetup';
import { useSound } from '../../context/SoundContext';

interface ConnectionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onDataReceived?: () => void;
}

export const ConnectionModal: React.FC<ConnectionModalProps> = ({ 
  isOpen, 
  onClose,
  onDataReceived
}) => {
  const { playSound } = useSound();
  const modalRef = useRef<HTMLDivElement>(null);
  
  // Handle click outside modal
  const handleBackdropClick = (e: React.MouseEvent) => {
    if (modalRef.current && !modalRef.current.contains(e.target as Node)) {
      handleClose();
    }
  };
  
  // Handle closing the modal
  const handleClose = () => {
    playSound('buttonClick');
    onClose();
  };
  
  // Trap focus inside modal and add ESC key handler
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        handleClose();
      }
    };
    
    if (isOpen) {
      document.addEventListener('keydown', handleKeyDown);
      
      // Prevent scrolling of background content
      document.body.style.overflow = 'hidden';
    }
    
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      
      // Re-enable scrolling when modal is closed
      document.body.style.overflow = '';
    };
  }, [isOpen]);
  
  if (!isOpen) return null;
  
  return (
    <div 
      className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4 backdrop-blur-sm"
      onClick={handleBackdropClick}
    >
      <div 
        ref={modalRef}
        className="max-w-md w-full"
      >
        <ConnectionSetup onClose={handleClose} onDataReceived={onDataReceived} />
      </div>
    </div>
  );
};