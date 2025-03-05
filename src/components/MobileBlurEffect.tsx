import React from 'react';

const MobileBlurEffect: React.FC = () => {
  return (
    <div className="fixed bottom-0 left-0 right-0 h-24 bg-gradient-to-t from-white/90 via-white/50 to-transparent backdrop-blur-[2px] md:hidden z-40" />
  );
};

export default MobileBlurEffect; 