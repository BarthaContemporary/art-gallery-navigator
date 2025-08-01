import React from 'react';
import { cn } from "@/lib/utils";

interface MaterialIconProps {
  icon: string;
  className?: string;
  size?: number | string;
  fill?: boolean;
  weight?: 100 | 200 | 300 | 400 | 500 | 600 | 700;
  grade?: -25 | 0 | 200;
  opticalSize?: 20 | 24 | 40 | 48;
  style?: React.CSSProperties;
  onClick?: () => void;
}

export const MaterialIcon: React.FC<MaterialIconProps> = ({
  icon,
  className,
  size = 24,
  fill = false,
  weight = 400,
  grade = 0,
  opticalSize = 24,
  style,
  onClick,
}) => {
  const iconStyle: React.CSSProperties = {
    fontVariationSettings: `'FILL' ${fill ? 1 : 0}, 'wght' ${weight}, 'GRAD' ${grade}, 'opsz' ${opticalSize}`,
    fontSize: typeof size === 'number' ? `${size}px` : size,
    ...style,
  };

  return (
    <span
      className={cn("material-symbols-outlined select-none", className)}
      style={iconStyle}
      onClick={onClick}
    >
      {icon}
    </span>
  );
};

export default MaterialIcon;