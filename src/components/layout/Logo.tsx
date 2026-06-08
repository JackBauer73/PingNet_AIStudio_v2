import React from 'react';

interface LogoProps {
  className?: string;
  size?: number | string;
}

export default function Logo({ className = "w-10 h-10", size }: LogoProps) {
  return (
    <img
      src="/logo.png"
      alt="Ping Manager"
      width={size}
      height={size}
      className={`${className} object-contain`}
    />
  );
}
