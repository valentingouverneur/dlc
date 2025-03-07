import React from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faBarcode } from '@fortawesome/free-solid-svg-icons';

interface FloatingScannerButtonProps {
  onClick: () => void;
}

const FloatingScannerButton: React.FC<FloatingScannerButtonProps> = ({ onClick }) => {
  return (
    <button
      onClick={onClick}
      className="fixed bottom-6 left-1/2 transform -translate-x-1/2 w-20 h-20 bg-black text-white rounded-full shadow-lg hover:bg-gray-800 transition-colors flex items-center justify-center z-50"
      aria-label="Scanner un produit"
    >
      <FontAwesomeIcon icon={faBarcode} className="w-8 h-8" />
    </button>
  );
};

export default FloatingScannerButton; 