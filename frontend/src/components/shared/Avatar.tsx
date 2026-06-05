import React from 'react';
import clsx from 'clsx';

interface AvatarProps {
  src?: string | null;
  name: string;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  className?: string;
}

const Avatar: React.FC<AvatarProps> = ({ src, name, size = 'md', className }) => {
  const sizes = { sm: 'h-7 w-7 text-xs', md: 'h-9 w-9 text-sm', lg: 'h-12 w-12 text-base', xl: 'h-16 w-16 text-xl' };
  const initials = name.split(' ').map((n) => n[0]).join('').toUpperCase().slice(0, 2);

  if (src) {
    return (
      <img
        src={src}
        alt={name}
        className={clsx('rounded-full object-cover', sizes[size], className)}
      />
    );
  }

  return (
    <div className={clsx('rounded-full bg-blue-700 text-white flex items-center justify-center font-semibold', sizes[size], className)}>
      {initials}
    </div>
  );
};

export default Avatar;
