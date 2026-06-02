export type SiteBranding = {
  site_name?: string;
  site_logo?: string;
  site_tagline?: string;
};

/** Normalize logo URLs from site settings (Cloudinary, relative uploads, protocol-relative). */
export function normalizeSiteLogoUrl(url?: string | null): string {
  const trimmed = (url || "").trim();
  if (!trimmed) return "";

  const fixed = trimmed.replace(/\/f_auto(?=\/,)/g, "/f_jpg");

  if (/^https?:\/\//i.test(fixed)) return fixed;
  if (fixed.startsWith("//")) return `https:${fixed}`;

  const origin = typeof window !== "undefined" ? window.location.origin : "";
  return `${origin}${fixed.startsWith("/") ? fixed : `/${fixed}`}`;
}

/** Load site logo the same way as Payroll PDF export (direct Image → jsPDF). */
export async function loadSiteLogoImage(url?: string | null): Promise<HTMLImageElement | null> {
  const src = normalizeSiteLogoUrl(url);
  if (!src) return null;

  const loadOnce = (crossOrigin?: string) =>
    new Promise<HTMLImageElement>((resolve, reject) => {
      const img = new Image();
      if (crossOrigin) img.crossOrigin = crossOrigin;
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error("Logo failed to load"));
      img.src = src;
      setTimeout(() => reject(new Error("Logo load timeout")), 3000);
    });

  const isRemote = /^https?:\/\//i.test(src);

  try {
    const img = await loadOnce(isRemote ? "anonymous" : undefined);
    if (img.naturalWidth) return img;
  } catch {
    if (isRemote) {
      try {
        const img = await loadOnce(undefined);
        if (img.naturalWidth) return img;
      } catch {
        return null;
      }
    }
  }

  return null;
}

/** Fetch logo as data URL for HTML embeds (print preview iframe) and PDF export. */
export async function loadSiteLogoDataUrl(url?: string | null): Promise<string | null> {
  const src = normalizeSiteLogoUrl(url);
  if (!src) return null;

  // Same-origin uploads and CORS-enabled URLs: fetch → blob is most reliable.
  try {
    const response = await fetch(src);
    if (response.ok) {
      const blob = await response.blob();
      if (blob.size > 0) {
        const fromBlob = await new Promise<string | null>((resolve) => {
          const reader = new FileReader();
          reader.onload = () => resolve(typeof reader.result === "string" ? reader.result : null);
          reader.onerror = () => resolve(null);
          reader.readAsDataURL(blob);
        });
        if (fromBlob) return fromBlob;
      }
    }
  } catch {
    // Fall back to canvas conversion below.
  }

  const img = await loadSiteLogoImage(url);
  if (!img) return normalizeSiteLogoUrl(url) || null;

  try {
    const canvas = document.createElement("canvas");
    canvas.width = img.naturalWidth;
    canvas.height = img.naturalHeight;
    const ctx = canvas.getContext("2d");
    if (!ctx) return normalizeSiteLogoUrl(url);
    ctx.drawImage(img, 0, 0);
    return canvas.toDataURL("image/png");
  } catch {
    return normalizeSiteLogoUrl(url);
  }
}

/** Preferred logo source for certificate HTML/PDF — always from site settings. */
export async function resolveSiteLogoForCertificate(branding: SiteBranding): Promise<string | null> {
  if (!branding.site_logo?.trim()) return null;
  return loadSiteLogoDataUrl(branding.site_logo);
}
