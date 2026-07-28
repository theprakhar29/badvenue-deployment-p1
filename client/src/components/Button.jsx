const variantClasses = {
  primary: "bg-amber-500 text-navy-950 hover:bg-amber-600 disabled:bg-amber-500/50",
  secondary: "bg-navy-950 text-paper hover:bg-navy-800 disabled:bg-navy-950/50",
  ghost: "bg-transparent text-navy-950 border border-navy-950/20 hover:bg-navy-950/5",
  danger: "bg-stub-500 text-paper hover:bg-stub-600 disabled:bg-stub-500/50",
};

export default function Button({ variant = "primary", className = "", ...props }) {
  return (
    <button
      className={`inline-flex items-center justify-center rounded-md px-5 py-2.5 font-body font-medium text-sm transition-colors disabled:cursor-not-allowed ${variantClasses[variant]} ${className}`}
      {...props}
    />
  );
}
