
import React from 'react';

export const Diamond3D: React.FC<{ size?: string; animate?: boolean }> = ({ size = '120px', animate = true }) => {
  return (
    <div 
      className="relative mx-auto pointer-events-none"
      style={{ width: size, height: size, perspective: '1200px' }}
    >
      <div 
        className={`relative w-full h-full transform-gpu ${animate ? 'animate-[spin_12s_linear_infinite]' : ''}`}
        style={{ transformStyle: 'preserve-3d' }}
      >
        {[0, 45, 90, 135, 180, 225, 270, 315].map((deg) => (
          <div
            key={deg}
            className="absolute top-0 left-0 w-full h-full border border-silver-300 opacity-40 shadow-[0_0_20px_rgba(192,192,192,0.2)]"
            style={{
              transform: `rotateY(${deg}deg) rotateX(45deg)`,
              background: 'linear-gradient(135deg, rgba(255,255,255,0.6), rgba(192,192,192,0.2))',
              clipPath: 'polygon(50% 0%, 100% 50%, 50% 100%, 0% 50%)'
            }}
          />
        ))}
      </div>
      <div className="absolute inset-0 flex items-center justify-center">
        <div className="w-2/3 h-2/3 bg-white blur-[60px] opacity-30 rounded-full" />
      </div>
    </div>
  );
};
