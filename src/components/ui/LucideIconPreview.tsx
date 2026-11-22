import {
  Cable,
  Camera,
  Folder,
  Gamepad2,
  Headphones,
  Laptop,
  Shield,
  Smartphone,
  Speaker,
  Tablet,
  Watch,
  Zap,
  type LucideIcon,
} from 'lucide-react';

const ICON_MAP: Record<string, LucideIcon> = {
  Smartphone,
  Camera,
  Tablet,
  Watch,
  Headphones,
  Zap,
  Shield,
  Gamepad2,
  Folder,
  Laptop,
  Speaker,
  Cable,
};

export function LucideIconPreview({
  name,
  className = 'h-4 w-4',
}: {
  name?: string | null;
  className?: string;
}) {
  const IconComponent = (name && ICON_MAP[name]) || Folder;
  return <IconComponent className={className} strokeWidth={1.5} aria-hidden="true" />;
}
