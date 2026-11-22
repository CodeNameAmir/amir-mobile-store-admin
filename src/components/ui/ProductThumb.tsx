import { useState } from 'react';
import { Smartphone } from 'lucide-react';

export function ProductThumb({
  src,
  alt,
  sizeClass = 'h-10 w-10',
}: {
  src?: string | null;
  alt: string;
  sizeClass?: string;
}) {
  const [failed, setFailed] = useState(false);

  if (!src || failed) {
    return (
      <div
        className={`${sizeClass} rounded-lg bg-[#f1f2f4] border border-black/[0.08] flex items-center justify-center text-[#7c818c] shrink-0`}
        aria-hidden="true"
      >
        <Smartphone className="h-4 w-4" strokeWidth={1.5} />
      </div>
    );
  }

  return (
    <img
      src={src}
      alt={alt}
      referrerPolicy="no-referrer"
      onError={() => setFailed(true)}
      className={`${sizeClass} rounded-lg object-cover bg-[#f1f2f4] border border-black/[0.08] shrink-0`}
    />
  );
}
