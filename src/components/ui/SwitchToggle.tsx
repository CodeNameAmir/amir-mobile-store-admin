interface SwitchToggleProps {
  id?: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
  label: string;
  description?: string;
  disabled?: boolean;
}

export function SwitchToggle({
  id,
  checked,
  onChange,
  label,
  description,
  disabled = false,
}: SwitchToggleProps) {
  return (
    <div className="flex items-center justify-between gap-3 py-1">
      <div className="min-w-0">
        <label
          htmlFor={id}
          className="block text-xs font-medium text-[#111315] cursor-pointer"
        >
          {label}
        </label>
        {description && (
          <p className="text-[11px] text-[#52565e] mt-0.5">{description}</p>
        )}
      </div>
      <button
        id={id}
        type="button"
        role="switch"
        aria-checked={checked}
        disabled={disabled}
        onClick={() => onChange(!checked)}
        className={`relative inline-flex h-5 w-9 shrink-0 items-center rounded-full border transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0f49bd] ${
          checked
            ? 'bg-[#0f49bd] border-[#0f49bd]'
            : 'bg-[#e8eaee] border-black/[0.12]'
        } ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
      >
        <span
          className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow-sm transition-transform duration-150 ${
            checked ? '-translate-x-4.5' : '-translate-x-0.5'
          }`}
        />
      </button>
    </div>
  );
}
