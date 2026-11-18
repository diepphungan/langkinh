import { useState } from 'react';
import { Newspaper } from 'lucide-react';
import { DESK_ASSETS } from '../lib/editorialAssets';
import type { VisualDesk } from '../types/news';

interface EditorialImageProps {
  desk: VisualDesk;
  alt: string;
  className?: string;
  aspectClass?: string;
  caption?: string;
}

export function EditorialImage({
  desk,
  alt,
  className = '',
  aspectClass = 'aspect-[4/3]',
  caption,
}: EditorialImageProps) {
  const [failed, setFailed] = useState(false);
  const asset = DESK_ASSETS[desk] || DESK_ASSETS.world;

  return (
    <figure className={`flex flex-col ${className}`}>
      <div
        className={`relative overflow-hidden bg-slate-200 dark:bg-slate-800 ${aspectClass}`}
      >
        {!failed ? (
          <img
            src={asset.src}
            alt={alt}
            referrerPolicy="no-referrer"
            loading="lazy"
            onError={() => setFailed(true)}
            className="h-full w-full object-cover transition-transform duration-500 ease-out group-hover:scale-[1.02]"
          />
        ) : (
          <div
            className={`flex h-full w-full flex-col items-center justify-center bg-gradient-to-br p-6 text-center ${asset.fallbackClass}`}
          >
            <Newspaper className="mb-2 h-7 w-7 text-slate-500 dark:text-slate-400" strokeWidth={1.5} />
            <span className="text-xs font-medium text-slate-600 dark:text-slate-300">
              {asset.label}
            </span>
          </div>
        )}
      </div>
      {caption && (
        <figcaption className="mt-2 font-sans tracking-tight text-xs italic text-slate-500 dark:text-slate-400">
          {caption}
        </figcaption>
      )}
    </figure>
  );
}
