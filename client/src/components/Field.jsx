export default function Field({ label, error, id, name, className = "", ...props }) {
  const inputId = id ?? name;
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={inputId} className="text-sm font-medium text-ink/80">
        {label}
      </label>
      <input
        id={inputId}
        name={name}
        className={`rounded-md border border-navy-950/15 bg-white px-3.5 py-2.5 text-sm text-ink placeholder:text-ink/40 focus:border-amber-500 focus:ring-1 focus:ring-amber-500 ${className}`}
        {...props}
      />
      {error && <p className="text-sm text-stub-500">{error}</p>}
    </div>
  );
}
