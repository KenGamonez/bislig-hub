type SectionHeaderProps = {
  title: string;
  subtitle?: string;
  kicker?: string;
};

export function SectionHeader({ title, subtitle, kicker }: SectionHeaderProps) {
  return (
    <div className="section-header">
      {kicker ? <p className="section-header__kicker">{kicker}</p> : null}
      <h2 className="section-header__title">{title}</h2>
      {subtitle ? <p className="section-header__subtitle">{subtitle}</p> : null}
    </div>
  );
}
