import React from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faQrcode } from '@fortawesome/free-solid-svg-icons';

interface FloatingScannerButtonProps {
  onClick: () => void;
}

const FloatingScannerButton: React.FC<FloatingScannerButtonProps> = ({ onClick }) => {
  return (
    <button
      onClick={onClick}
      className="fixed bottom-4 right-4 p-4 rounded-full text-gray-500 hover:text-gray-900 bg-white shadow-lg transition-colors"
      title="Scanner un produit"
    >
      <FontAwesomeIcon icon={faQrcode} className="w-6 h-6" />
    </button>
  );
};

export default FloatingScannerButton; 