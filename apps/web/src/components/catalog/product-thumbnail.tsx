const SIZE_CLASSES = {
  sm: 'h-8 w-8',
  md: 'h-16 w-16',
  lg: 'h-full w-full',
} as const;

type ProductThumbnailProps = {
  src: string | null | undefined;
  name: string;
  size?: keyof typeof SIZE_CLASSES;
  className?: string;
};

export function ProductThumbnail({ src, name, size = 'sm', className }: ProductThumbnailProps) {
  const initials = name.slice(0, 2).toUpperCase();

  return (
    <div
      className={`aspect-square overflow-hidden rounded-md bg-muted flex items-center justify-center ${SIZE_CLASSES[size]} ${className ?? ''}`}
    >
      {src ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={src} alt={name} className="h-full w-full object-cover" />
      ) : (
        <span className="text-xs font-medium text-muted-foreground select-none">{initials}</span>
      )}
    </div>
  );
}
