import { jsPDF } from "jspdf";
import { format } from "date-fns";
import { pdfMoney, pdfText } from "@contracts/pdf-text";

export interface CertificateData {
  propertyName: string;
  propertyType: string;
  address: string;
  ownerName: string;
  ownerCID: string;
  sellingPrice: string;
  finalSellingPrice: string | null;
  realEstateFee: string;
  listedByName: string;
  completedAt: Date;
  propertyId: number;
}

export function generateCompletionCertificate(data: CertificateData): Buffer {
  const doc = new jsPDF({
    orientation: "portrait",
    unit: "mm",
    format: "a4",
  });

  const pageWidth = doc.internal.pageSize.getWidth();
  const margin = 20;
  let y = margin;

  doc.setFontSize(24);
  doc.setFont("helvetica", "bold");
  doc.text("PHOJAA95 REAL ESTATE", pageWidth / 2, y, { align: "center" });
  y += 15;

  doc.setFontSize(18);
  doc.setFont("helvetica", "bold");
  doc.text("PROPERTY COMPLETION CERTIFICATE", pageWidth / 2, y, { align: "center" });
  y += 20;

  doc.setDrawColor(0);
  doc.setLineWidth(0.5);
  doc.line(margin, y, pageWidth - margin, y);
  y += 15;

  doc.setFontSize(12);
  doc.setFont("helvetica", "normal");

  const addField = (label: string, value: string) => {
    doc.setFont("helvetica", "bold");
    doc.text(`${label}:`, margin, y);
    doc.setFont("helvetica", "normal");
    doc.text(pdfText(value) || "-", margin + 45, y);
    y += 8;
  };

  addField("Certificate ID", `CERT-${data.propertyId}-${format(data.completedAt, "yyyyMMdd")}`);
  addField("Property Name", data.propertyName);
  addField("Property Type", data.propertyType);
  addField("Address", data.address);
  addField("Owner Name", data.ownerName);
  addField("Owner CID", data.ownerCID);
  const displayPrice = data.finalSellingPrice && data.finalSellingPrice !== data.sellingPrice
    ? data.finalSellingPrice
    : data.sellingPrice;
  addField("Selling Price", `Nu. ${pdfMoney(displayPrice)}`);
  if (data.finalSellingPrice && data.finalSellingPrice !== data.sellingPrice) {
    addField("Gross Price", `Nu. ${pdfMoney(data.sellingPrice)}`);
  }
  addField("Commission Fee", `Nu. ${pdfMoney(data.realEstateFee)}`);
  addField("Listed By", data.listedByName);
  addField("Completion Date", format(data.completedAt, "MMMM dd, yyyy"));

  y += 15;
  doc.setDrawColor(0);
  doc.setLineWidth(0.5);
  doc.line(margin, y, pageWidth - margin, y);
  y += 10;

  doc.setFontSize(10);
  doc.setFont("helvetica", "italic");
  doc.text("This certificate confirms that the above property has completed all verification", pageWidth / 2, y, { align: "center" });
  y += 5;
  doc.text("processes and is approved for transaction through PHOJAA95 Real Estate System.", pageWidth / 2, y, { align: "center" });

  y += 20;
  doc.setFont("helvetica", "normal");
  doc.text("_____________________________", margin + 30, y);
  y += 5;
  doc.text("Authorized Signature", margin + 30, y);

  doc.text("_____________________________", pageWidth - margin - 60, y);
  y += 5;
  doc.text("Date", pageWidth - margin - 60, y);

  const pdfBuffer = doc.output("arraybuffer") as ArrayBuffer;
  return Buffer.from(pdfBuffer);
}

export function generateCertificatePdfBase64(data: CertificateData): string {
  const doc = new jsPDF({
    orientation: "portrait",
    unit: "mm",
    format: "a4",
  });

  const pageWidth = doc.internal.pageSize.getWidth();
  const margin = 20;
  let y = margin;

  doc.setFontSize(24);
  doc.setFont("helvetica", "bold");
  doc.text("PHOJAA95 REAL ESTATE", pageWidth / 2, y, { align: "center" });
  y += 15;

  doc.setFontSize(18);
  doc.setFont("helvetica", "bold");
  doc.text("PROPERTY COMPLETION CERTIFICATE", pageWidth / 2, y, { align: "center" });
  y += 20;

  doc.setDrawColor(0);
  doc.setLineWidth(0.5);
  doc.line(margin, y, pageWidth - margin, y);
  y += 15;

  doc.setFontSize(12);
  doc.setFont("helvetica", "normal");

  const addField = (label: string, value: string) => {
    doc.setFont("helvetica", "bold");
    doc.text(`${label}:`, margin, y);
    doc.setFont("helvetica", "normal");
    doc.text(pdfText(value) || "-", margin + 45, y);
    y += 8;
  };

  addField("Certificate ID", `CERT-${data.propertyId}-${format(data.completedAt, "yyyyMMdd")}`);
  addField("Property Name", data.propertyName);
  addField("Property Type", data.propertyType);
  addField("Address", data.address);
  addField("Owner Name", data.ownerName);
  addField("Owner CID", data.ownerCID);
  const displayPrice = data.finalSellingPrice && data.finalSellingPrice !== data.sellingPrice
    ? data.finalSellingPrice
    : data.sellingPrice;
  addField("Selling Price", `Nu. ${pdfMoney(displayPrice)}`);
  if (data.finalSellingPrice && data.finalSellingPrice !== data.sellingPrice) {
    addField("Gross Price", `Nu. ${pdfMoney(data.sellingPrice)}`);
  }
  addField("Commission Fee", `Nu. ${pdfMoney(data.realEstateFee)}`);
  addField("Listed By", data.listedByName);
  addField("Completion Date", format(data.completedAt, "MMMM dd, yyyy"));

  y += 15;
  doc.setDrawColor(0);
  doc.setLineWidth(0.5);
  doc.line(margin, y, pageWidth - margin, y);
  y += 10;

  doc.setFontSize(10);
  doc.setFont("helvetica", "italic");
  doc.text("This certificate confirms that the above property has completed all verification", pageWidth / 2, y, { align: "center" });
  y += 5;
  doc.text("processes and is approved for transaction through PHOJAA95 Real Estate System.", pageWidth / 2, y, { align: "center" });

  y += 20;
  doc.setFont("helvetica", "normal");
  doc.text("_____________________________", margin + 30, y);
  y += 5;
  doc.text("Authorized Signature", margin + 30, y);

  doc.text("_____________________________", pageWidth - margin - 60, y);
  y += 5;
  doc.text("Date", pageWidth - margin - 60, y);

  // Return only the raw base64 portion (strip "data:application/pdf;base64," prefix).
  // The exportBilling handler does the same split on line 2318 of property-router.ts —
  // keep both consistent so callers always receive pure base64, not a full Data-URI.
  return doc.output("datauristring").split(",")[1];
}
