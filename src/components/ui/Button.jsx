import clsx from 'clsx';

export default function Button({
  children,
  onClick,
  variant = 'primary',
  className,
  ...props
}) {
  return (
    <button
      onClick={onClick}
      className={clsx(
        'rounded-2xl px-6 py-3 font-bold text-lg transition-all active:scale-95',
        variant === 'primary' && 'bg-primary text-white hover:bg-primary-dark',
        variant === 'accent' && 'bg-accent text-white hover:bg-amber-600',
        variant === 'ghost' && 'bg-transparent text-gray-600 hover:bg-gray-100',
        variant === 'danger' && 'bg-red-500 text-white hover:bg-red-600',
        className
      )}
      {...props}
    >
      {children}
    </button>
  );
}
