import clsx from 'clsx';

export default function IconButton({
  children,
  onClick,
  active = false,
  size = 'md',
  className,
  ...props
}) {
  return (
    <button
      onClick={onClick}
      className={clsx(
        'rounded-full flex items-center justify-center transition-all active:scale-90',
        size === 'sm' && 'w-10 h-10',
        size === 'md' && 'w-14 h-14',
        size === 'lg' && 'w-18 h-18',
        active
          ? 'bg-primary text-white shadow-lg'
          : 'bg-white text-gray-700 shadow-md hover:bg-gray-50',
        className
      )}
      {...props}
    >
      {children}
    </button>
  );
}
