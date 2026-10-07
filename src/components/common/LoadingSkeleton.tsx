import "../../styles/base/skeleton.css";
export function LoadingSkeleton({ label, messages = false }: { label: string; messages?: boolean }) {
  return <div className={`loading-skeleton${messages ? " loading-skeleton--messages" : ""}`} role="status" aria-label={label}><span className="loading-skeleton__sr">{label}</span>{Array.from({length: messages ? 5 : 4}, (_, index) => <div key={index} className="loading-skeleton__row" aria-hidden="true"><div className="loading-skeleton__avatar" /><div className="loading-skeleton__lines"><div /><div /></div></div>)}</div>;
}
