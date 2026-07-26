import {
  getIntegrationProviderIcon,
  integrationProviderPaths,
} from "./integrationProviderIcons";

interface IntegrationProviderIconProps {
  provider: string;
  className?: string;
}

export function IntegrationProviderIcon({
  provider,
  className = "",
}: IntegrationProviderIconProps) {
  const icon = getIntegrationProviderIcon(provider);
  const paths = integrationProviderPaths(icon);
  const viewBox = icon.viewBox ?? "0 0 24 24";

  return (
    <span
      className={`up-connected-icon up-connected-icon--brand ${className}`.trim()}
      style={{ backgroundColor: icon.color }}
      aria-hidden
    >
      <svg width="18" height="18" viewBox={viewBox} fill="currentColor">
        {paths.map((path) => (
          <path key={path.slice(0, 24)} d={path} />
        ))}
      </svg>
    </span>
  );
}
