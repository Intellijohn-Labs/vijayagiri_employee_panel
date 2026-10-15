import { cn } from "@/lib/utils";
import { useSettings } from "@/store/settings-store";

const LOGO_URL = "url(/images/vijayagiri-logo.png)";

/**
 * The dealership wordmark. By default: the official corporate-blue artwork in light mode and the same artwork as a light
 * ice-blue silhouette (the PNG used as a mask) in dark mode. If an Admin uploaded logos in Settings, those are shown instead:
 * the light one by day, the dark one at night (or, with no dark variant, the light one turned white).
 */
export function BrandLogo({ className }: { className?: string }) {
  const { legalName, logoLight, logoDark } = useSettings((s) => s.settings.profile);
  return (
    <span className={cn("relative inline-block aspect-[1199/460]", className)}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={logoLight ?? "/images/vijayagiri-logo.png"} alt={legalName} width={1199} height={460} draggable={false} className="absolute inset-0 h-full w-full select-none object-contain object-left dark:hidden" />
      {logoLight || logoDark ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={logoDark ?? logoLight ?? ""} alt={legalName} draggable={false} className={cn("absolute inset-0 hidden h-full w-full select-none object-contain object-left dark:block", !logoDark && "brightness-0 invert")} />
      ) : (
        <span
          role="img"
          aria-label={legalName}
          className="absolute inset-0 hidden bg-[#E6EEFF] drop-shadow-[0_0_10px_rgba(125,170,255,0.25)] dark:block"
          style={{ WebkitMaskImage: LOGO_URL, maskImage: LOGO_URL, WebkitMaskSize: "contain", maskSize: "contain", WebkitMaskRepeat: "no-repeat", maskRepeat: "no-repeat", WebkitMaskPosition: "left center", maskPosition: "left center" }}
        />
      )}
    </span>
  );
}

const MARK_URL = "url(/images/vijayagiri-mark.png)";

/** The bike emblem from the official logo, for the collapsed sidebar. Blue by day; the same shape in light ice-blue at night (or the uploaded light logo's colours are left alone, since this is a separate mark). */
export function LogoMark({ className }: { className?: string }) {
  return (
    <span className={cn("relative inline-block h-8 w-11 shrink-0", className)} role="img" aria-label="Vijayagiri">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src="/images/vijayagiri-mark.png" alt="" width={600} height={354} draggable={false} className="absolute inset-0 h-full w-full select-none object-contain dark:hidden" />
      <span aria-hidden className="absolute inset-0 hidden bg-[#E6EEFF] drop-shadow-[0_0_8px_rgba(125,170,255,0.25)] dark:block" style={{ WebkitMaskImage: MARK_URL, maskImage: MARK_URL, WebkitMaskSize: "contain", maskSize: "contain", WebkitMaskRepeat: "no-repeat", maskRepeat: "no-repeat", WebkitMaskPosition: "center", maskPosition: "center" }} />
    </span>
  );
}
