import type { ButtonHTMLAttributes, ReactNode } from "react";
import { Link } from "react-router-dom";

export function PageHeader({
  title,
  subtitle,
  action,
}: {
  title: string;
  subtitle?: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex items-start justify-between gap-3 mb-4">
      <div>
        <h1 className="text-xl font-bold text-slate-900">{title}</h1>
        {subtitle && <p className="text-sm text-slate-500 mt-0.5">{subtitle}</p>}
      </div>
      {action}
    </div>
  );
}

export function Card({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <div className={`bg-white rounded-2xl border border-slate-200 shadow-sm p-4 ${className}`}>
      {children}
    </div>
  );
}

export function Button({
  variant = "primary",
  className = "",
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: "primary" | "secondary" | "danger" | "ghost" }) {
  const base = "rounded-xl font-semibold px-4 py-2.5 text-sm transition-colors disabled:opacity-40";
  const styles = {
    primary: "bg-green-700 text-white active:bg-green-800",
    secondary: "bg-slate-100 text-slate-800 active:bg-slate-200",
    danger: "bg-red-50 text-red-700 active:bg-red-100",
    ghost: "text-green-700",
  };
  return <button className={`${base} ${styles[variant]} ${className}`} {...props} />;
}

export function LinkButton({
  to,
  children,
  variant = "primary",
  className = "",
}: {
  to: string;
  children: ReactNode;
  variant?: "primary" | "secondary";
  className?: string;
}) {
  const base = "rounded-xl font-semibold px-4 py-2.5 text-sm text-center transition-colors block";
  const styles = {
    primary: "bg-green-700 text-white active:bg-green-800",
    secondary: "bg-slate-100 text-slate-800 active:bg-slate-200",
  };
  return (
    <Link to={to} className={`${base} ${styles[variant]} ${className}`}>
      {children}
    </Link>
  );
}

export function EmptyState({
  icon,
  title,
  subtitle,
  action,
}: {
  icon: string;
  title: string;
  subtitle?: string;
  action?: ReactNode;
}) {
  return (
    <div className="text-center py-12 px-4">
      <div className="text-4xl mb-3">{icon}</div>
      <p className="font-semibold text-slate-800">{title}</p>
      {subtitle && <p className="text-sm text-slate-500 mt-1">{subtitle}</p>}
      {action && <div className="mt-4 flex justify-center">{action}</div>}
    </div>
  );
}

export function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="block">
      <span className="block text-sm font-medium text-slate-700 mb-1">{label}</span>
      {children}
    </label>
  );
}

export const inputClass =
  "w-full rounded-xl border border-slate-300 px-3 py-2.5 text-base focus:outline-none focus:ring-2 focus:ring-green-600 focus:border-transparent";

/** Small colored dot marking a tee box (white tees get a border so they stay visible). */
export function TeeDot({ color, className = "" }: { color: string; className?: string }) {
  return (
    <span
      className={`inline-block w-3 h-3 rounded-full border border-slate-300 align-middle ${className}`}
      style={{ backgroundColor: color }}
    />
  );
}
