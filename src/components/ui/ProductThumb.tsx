import { useState } from 'react';
import { Smartphone } from 'lucide-react';

export function ProductThumb({
  src,
  alt,
  sizeClass = 'h-11 w-11',
}: {
  src?: string | null;
  alt: string;
  sizeClass?: string;
}) {
  const [failed, setFailed] = useState(false);

  if (!src || failed) {
    return (
      <div
        className={`${sizeClass} rounded-xl bg-[#eff4ff] border border-[#c3c6d7]/60 flex items-center justify-center text-[#004ac6] shrink-0`}
        aria-hidden="true"
      >
        <Smartphone className="h-5 w-5" />
      </div>
    );
  }

  return (
    <img
      src={src}
      alt={alt}
      referrerPolicy="no-referrer"
      onError={() => setFailed(true)}
      className={`${sizeClass} rounded-xl object-cover bg-[#eff4ff] border border-[#c3c6d7]/60 shrink-0`}
    />
  );
}
