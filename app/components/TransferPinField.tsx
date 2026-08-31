export function TransferPinField({
  value,
  onChange,
}: {
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-sm text-[var(--muted)]">Transfer PIN</span>
      <input
        type="password"
        inputMode="numeric"
        autoComplete="off"
        value={value}
        onChange={(event) => onChange(event.target.value.replace(/\D/g, "").slice(0, 6))}
        className="field"
        placeholder="4–6 digit PIN"
      />
    </label>
  );
}

export function pinError(required: string | undefined, entered: string) {
  if (!required) return "";
  if (!entered.trim()) return "Enter your transfer PIN.";
  if (entered !== required) return "That transfer PIN is not correct.";
  return "";
}

export function holdMessage() {
  return "This account is on restricted access. Contact support to reactivate your account.";
}
