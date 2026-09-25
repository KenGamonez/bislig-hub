import type { ReactNode } from "react";

export function DriverPage({
  title,
  kicker,
  children,
}: {
  title: string;
  kicker?: string;
  children: ReactNode;
}) {
  return (
    <div className="hub-driver__page">
      <div className="hub-driver__page-head">
        {kicker ? <p className="hub-driver__kicker">{kicker}</p> : null}
        <h1 className="hub-driver__title">{title}</h1>
      </div>
      {children}
    </div>
  );
}
