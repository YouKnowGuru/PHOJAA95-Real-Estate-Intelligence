/**
 * Public property landing page (/p/:id).
 *
 * Opened by email campaign recipients who have no account — no auth, no app
 * shell. Shows only marketing-safe data served by trpc.publicProperty.get.
 */
import { useMemo } from "react";
import { useParams } from "react-router";
import { MapPin, Calendar, Check, Home, Mail } from "lucide-react";
import { trpc } from "@/lib/trpc";

/** Absolute URL for a stored image path (handles relative /uploads/...). */
function resolveImageUrl(url: string): string {
  const raw = (url || "").trim();
  if (!raw) return "";
  if (/^https?:\/\//i.test(raw)) return raw;
  const base = window.location.origin.replace(/\/+$/, "");
  return `${base}${raw.startsWith("/") ? "" : "/"}${raw}`;
}

function formatPrice(value?: string | null): string {
  const n = Number(value ?? 0);
  if (!Number.isFinite(n) || n <= 0) return "Price on request";
  return `Nu. ${n.toLocaleString("en-US", { maximumFractionDigits: 2 })}`;
}

/** features json column: object map or string array → [label, value] pairs. */
function parseFeatures(features: unknown): Array<[string, string]> {
  let value = features;
  if (typeof value === "string") {
    try {
      value = JSON.parse(value);
    } catch {
      return [];
    }
  }
  if (Array.isArray(value)) {
    return value
      .filter((item): item is string => typeof item === "string" && item.trim().length > 0)
      .map((item) => [item, ""]);
  }
  if (value && typeof value === "object") {
    return Object.entries(value as Record<string, unknown>)
      .filter(([, v]) => v !== null && String(v).trim().length > 0)
      .map(([k, v]) => [k, String(v)]);
  }
  return [];
}

export default function PublicProperty() {
  const { id } = useParams<{ id: string }>();
  const propertyId = Number(id);

  const { data: branding } = trpc.settings.getPublicSettings.useQuery();
  const {
    data: property,
    isLoading,
    isError,
  } = trpc.publicProperty.get.useQuery(
    { id: propertyId },
    { enabled: Number.isFinite(propertyId) && propertyId > 0 },
  );

  const siteName = branding?.site_name || "PHOJAA95";
  const siteLogo = branding?.site_logo || "";
  const features = useMemo(() => parseFeatures(property?.features), [property?.features]);
  const images = (property?.imageUrls ?? []).map(resolveImageUrl).filter(Boolean);

  if (Number.isFinite(propertyId) === false || propertyId <= 0 || isError || property == null) {
    return (
      <PublicShell siteName={siteName} siteLogo={siteLogo}>
        <div className="mx-auto max-w-xl rounded-2xl border border-border bg-card p-10 text-center">
          <Home className="mx-auto h-10 w-10 text-muted-foreground/50" />
          <h1 className="mt-4 text-xl font-bold text-foreground">Property not available</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            This listing doesn't exist or is no longer publicly visible. If you received this link
            in an email, reply to it and we'll share the details with you directly.
          </p>
        </div>
      </PublicShell>
    );
  }

  const price = formatPrice(property.finalSellingPrice ?? property.sellingPrice);
  const meta: string[] = [];
  if (property.typeName) meta.push(property.typeName);
  if (property.yearOfConstruction) meta.push(`Built ${property.yearOfConstruction}`);

  return (
    <PublicShell siteName={siteName} siteLogo={siteLogo}>
      <div className="mx-auto max-w-2xl">
        {isLoading ? (
          <div className="animate-pulse space-y-4">
            <div className="h-64 rounded-2xl bg-muted" />
            <div className="h-8 w-3/4 rounded-lg bg-muted" />
            <div className="h-6 w-1/3 rounded-lg bg-muted" />
          </div>
        ) : (
          <article className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
            {/* Cover image */}
            {images[0] ? (
              <img
                src={images[0]}
                alt={property.propertyName}
                className="h-64 w-full object-cover sm:h-80"
              />
            ) : (
              <div className="flex h-48 flex-col items-center justify-center bg-primary/5 text-primary">
                <Home className="h-12 w-12" />
                <span className="mt-2 text-xs font-semibold uppercase tracking-widest">
                  Photo coming soon
                </span>
              </div>
            )}

            <div className="p-6 sm:p-8">
              {/* Gallery thumbnails */}
              {images.length > 1 && (
                <div className="mb-6 flex gap-2 overflow-x-auto pb-1">
                  {images.slice(1, 6).map((url) => (
                    <img
                      key={url}
                      src={url}
                      alt={property.propertyName}
                      className="h-16 w-24 shrink-0 rounded-lg border border-border object-cover"
                    />
                  ))}
                </div>
              )}

              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <div className="text-[11px] font-bold uppercase tracking-[1.6px] text-primary">
                    Featured Property
                  </div>
                  <h1 className="mt-1 text-2xl font-bold leading-tight text-foreground">
                    {property.propertyName}
                  </h1>
                </div>
                {property.isSold && (
                  <span className="rounded-full bg-red-100 px-3 py-1 text-xs font-bold uppercase tracking-wider text-red-700 dark:bg-red-950/40 dark:text-red-400">
                    Sold
                  </span>
                )}
              </div>

              {meta.length > 0 && (
                <p className="mt-2 flex items-center gap-2 text-sm text-muted-foreground">
                  <Calendar className="h-4 w-4" />
                  {meta.join(" · ")}
                </p>
              )}

              <div className="mt-5 inline-block rounded-xl bg-primary/10 px-4 py-2.5 text-2xl font-extrabold text-primary">
                {price}
              </div>

              <p className="mt-4 flex items-start gap-2 text-sm text-muted-foreground">
                <MapPin className="mt-0.5 h-4 w-4 shrink-0" />
                {property.address}
              </p>

              {features.length > 0 && (
                <div className="mt-6 border-t border-border pt-5">
                  <div className="grid grid-cols-1 gap-x-6 gap-y-2 sm:grid-cols-2">
                    {features.slice(0, 8).map(([label, value]) => (
                      <div key={label} className="flex items-start gap-2 text-sm text-foreground">
                        <Check className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                        <span>
                          {label}
                          {value ? (
                            <>
                              {": "}
                              <strong className="font-semibold">{value}</strong>
                            </>
                          ) : null}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Contact */}
              <div className="mt-8 rounded-xl bg-primary/5 p-5 text-center">
                <Mail className="mx-auto h-6 w-6 text-primary" />
                <h2 className="mt-2 text-base font-bold text-foreground">
                  Interested in this property?
                </h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  Reply to the email you received and we will arrange a viewing for you.
                </p>
              </div>
            </div>
          </article>
        )}
      </div>
    </PublicShell>
  );
}

/** Minimal standalone shell — no app chrome, safe for logged-out visitors. */
function PublicShell({
  siteName,
  siteLogo,
  children,
}: {
  siteName: string;
  siteLogo: string;
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-background px-4 py-8">
      <header className="mx-auto mb-8 flex max-w-2xl items-center justify-between">
        {siteLogo ? (
          <img src={resolveImageUrl(siteLogo)} alt={siteName} className="h-9 max-w-[180px] object-contain" />
        ) : (
          <span className="text-xl font-extrabold tracking-tight text-foreground">{siteName}</span>
        )}
        <span className="rounded-full bg-primary/10 px-3 py-1.5 text-[10px] font-bold uppercase tracking-[1.8px] text-primary">
          Property Update
        </span>
      </header>
      {children}
      <footer className="mx-auto mt-10 max-w-2xl text-center text-xs text-muted-foreground">
        &copy; {new Date().getFullYear()} {siteName}. All rights reserved.
      </footer>
    </div>
  );
}
