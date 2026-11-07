import type { VisaFlag } from "@/lib/types";

export function ScoreBadge({ score }: { score: number }) {
  const cls = score >= 75 ? "bg-green-100 text-green-800" : score >= 50 ? "bg-amber-100 text-amber-800" : "bg-red-100 text-red-800";
  return <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${cls}`}>{Math.round(score)}%</span>;
}

const VISA: Record<VisaFlag, [string, string]> = {
  ok: ["Visa OK", "bg-green-100 text-green-800"],
  warning: ["Visa unclear", "bg-amber-100 text-amber-800"],
  blocker: ["EU permit required", "bg-red-100 text-red-800"],
};

export function VisaBadge({ flag }: { flag: VisaFlag }) {
  const [label, cls] = VISA[flag] ?? VISA.warning;
  return <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${cls}`}>{label}</span>;
}

export function ErrorBox({ message }: { message: string }) {
  if (!message) return null;
  return <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">{message}</div>;
}

export function Issues({ issues }: { issues: string[] }) {
  if (!issues.length)
    return <div className="rounded-md border border-green-200 bg-green-50 px-3 py-2 text-sm text-green-800">✓ Follows all your writing rules</div>;
  return (
    <ul className="space-y-1 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">
      {issues.map((i) => <li key={i}>⚠ {i}</li>)}
    </ul>
  );
}
