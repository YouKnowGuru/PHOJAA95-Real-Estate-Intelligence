/**
 * Smoke test: renders the campaign + test emails to HTML files so the
 * template can be eyeballed in a browser / email client.
 * Run: npx tsx scripts/smoke-email-template.ts
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import {
  renderCampaignEmail,
  renderTestEmail,
  replacePlaceholders,
} from "../api/lib/email-template";

const outDir = join(dirname(fileURLToPath(import.meta.url)), "tmp-out");
mkdirSync(outDir, { recursive: true });

const property = {
  id: 42,
  name: "Khesar Lingkhang — 5 Bedroom Villa",
  price: "18,500,000.00",
  address: "Khesar Lingkhang, Thimphu",
  typeName: "Villa",
  year: 2021,
  features: {
    Bedrooms: "5",
    Bathrooms: "4",
    "Land size": "0.5 decimal",
    Parking: "2 cars",
    "Facing": "East",
  } as Record<string, string>,
  imageUrls: ["https://images.unsplash.com/photo-1568605114967-8130f3a36994?w=800"],
};

const subject = replacePlaceholders(
  "New listing from {{siteName}} — {{propertyName}} at Nu. {{price}}",
  {
    clientName: "Pema Wangmo",
    propertyName: property.name,
    price: property.price,
    address: property.address,
    siteName: "PHOJAA95",
  },
);

const body = replacePlaceholders(
  "We are pleased to share a new property from our portfolio in {{address}}. Please find the details below — if you or someone you know is interested, reply to this email and we will arrange a viewing.\n\nKind regards,\nPHOJAA95 Team",
  {
    clientName: "Pema Wangmo",
    propertyName: property.name,
    price: property.price,
    address: property.address,
    siteName: "PHOJAA95",
  },
);

const withProperty = renderCampaignEmail({
  siteName: "PHOJAA95",
  logoUrl: null,
  toName: "Pema Wangmo",
  subject,
  body,
  property,
  includeProperty: true,
});

const withoutProperty = renderCampaignEmail({
  siteName: "PHOJAA95",
  logoUrl: "http://localhost:5173/uploads/logo.png",
  toName: "Tshering Dorji",
  subject: "Weekly update from PHOJAA95",
  body: replacePlaceholders(
    "Hello {{clientName}},\n\nJust a short note that our new listings are live on the portal.",
    {
      clientName: "Tshering Dorji",
      propertyName: "",
      price: "",
      address: "",
      siteName: "PHOJAA95",
    },
  ),
  property: null,
  includeProperty: false,
});

const test = renderTestEmail("PHOJAA95", null);

writeFileSync(join(outDir, "email-campaign-property.html"), withProperty, "utf8");
writeFileSync(join(outDir, "email-campaign-plain.html"), withoutProperty, "utf8");
writeFileSync(join(outDir, "email-test.html"), test, "utf8");

console.log("Wrote:");
console.log("  ", join(outDir, "email-campaign-property.html"));
console.log("  ", join(outDir, "email-campaign-plain.html"));
console.log("  ", join(outDir, "email-test.html"));
