import React from 'react';

interface NasjahLogoProps {
  className?: string;
  variant?: 'full' | 'emblem' | 'icon' | 'mark';
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
  showText?: boolean;
}

export default function NasjahLogo({ 
  className = '', 
  variant = 'full', 
  size = 'md',
  showText = true 
}: NasjahLogoProps) {
  // Dimension mapping
  const sizeMap = {
    xs: 'w-6 h-6',
    sm: 'w-8 h-8',
    md: 'w-10 h-10',
    lg: 'w-16 h-16',
    xl: 'w-24 h-24',
  };

  // When variant is 'icon' or 'emblem', we show the emblem badge
  if (variant === 'icon' || variant === 'emblem') {
    return (
      <div 
        className={`relative overflow-hidden rounded-xl flex items-center justify-center shadow-xs select-none border border-[#C7B895]/30 ${sizeMap[size]} ${className}`}
        title="شعار نَسْجَة"
      >
        <img 
          src="/nasjah-logo.png" 
          alt="شعار نَسْجَة" 
          className="w-full h-full object-cover" 
          referrerPolicy="no-referrer"
        />
      </div>
    );
  }

  // When variant is 'mark', we show emblem + typography in a horizontal badge
  if (variant === 'mark') {
    return (
      <div className={`flex items-center gap-2.5 select-none ${className}`}>
        <div className="w-9 h-9 rounded-xl overflow-hidden flex items-center justify-center shadow-xs flex-shrink-0 border border-[#C7B895]/30">
          <img 
            src="/nasjah-logo.png" 
            alt="أيقونة نَسْجَة" 
            className="w-full h-full object-cover" 
            referrerPolicy="no-referrer"
          />
        </div>
        {showText && (
          <div className="min-w-0">
            <div className="flex items-center">
              <span className="font-black text-sm tracking-wide text-[#FAF7F0] font-sans">
                نَسْجَة
              </span>
            </div>
            <p className="text-[10px] text-[#C7B895] font-semibold truncate">
              أقمشة رجالية فاخرة
            </p>
          </div>
        )}
      </div>
    );
  }

  // Default 'full': The complete brand logo card
  return (
    <div className={`relative flex flex-col items-center justify-center select-none ${className}`}>
      <img 
        src="/nasjah-logo.png" 
        alt="شعار نَسْجَة" 
        className="w-full h-auto max-w-[280px] rounded-2xl shadow-xl border border-[#C7B895]/50 object-contain"
        referrerPolicy="no-referrer"
      />
    </div>
  );
}
