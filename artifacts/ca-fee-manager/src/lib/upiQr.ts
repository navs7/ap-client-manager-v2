import QRCode from 'qrcode';

/**
 * Generates a UPI deep-link QR code PNG and triggers a browser download.
 * @param upiId     – Payee VPA e.g. "yourname@upi"
 * @param amountINR – Pending amount in INR; omitted from URI when null / 0
 * @param clientName – Used in the download filename
 */
export async function downloadUpiQr(
  upiId: string,
  amountINR: number | null,
  clientName: string,
): Promise<void> {
  const params: Record<string, string> = { pa: upiId, pn: 'Payment', cu: 'INR' };
  if (amountINR !== null && amountINR > 0) params.am = String(amountINR);

  const uri = `upi://pay?${new URLSearchParams(params).toString()}`;

  const dataUrl = await QRCode.toDataURL(uri, {
    width: 400,
    margin: 2,
    color: { dark: '#000000', light: '#ffffff' },
  });

  const safe = clientName.replace(/[^a-zA-Z0-9_\- ]/g, '').trim() || 'client';
  const a = document.createElement('a');
  a.href = dataUrl;
  a.download = `UPI_QR_${safe}.png`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
}
