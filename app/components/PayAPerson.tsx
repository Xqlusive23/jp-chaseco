export const PAY_A_PERSON = "Zelle®";

export function PayAPersonMark({ className = "" }: { className?: string }) {
  return (
    <span className={className}>
      Zelle
      <sup className="ml-0.5 text-[0.65em] font-semibold leading-none">®</sup>
    </span>
  );
}
