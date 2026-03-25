
import { STORAGE_KEYS } from './constants';
import { api } from './api';

export const formatCurrency = (amount: number) => {
  return new Intl.NumberFormat('fr-FR', {
    style: 'currency',
    currency: 'EUR',
  }).format(amount);
};

export const generateInvoiceNumber = async () => {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');

  // Get current preferences from DB
  const prefs = await api.preferences.get();
  const currentCounter = prefs.invoiceCounter || 0;
  const nextCounter = currentCounter + 1;

  // Save updated counter back to DB
  await api.preferences.save({
    ...prefs,
    invoiceCounter: nextCounter
  });

  return `F-${year}${month}-${String(nextCounter).padStart(4, '0')}`;
};

export const getCurrentDate = () => {
  return new Date().toLocaleDateString('fr-FR');
};

import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';

export const generatePDF = async (elementId: string): Promise<Blob> => {
  const element = document.getElementById(elementId);
  if (!element) throw new Error('Element not found');

  const canvas = await html2canvas(element, {
    scale: 2,
    logging: false,
    useCORS: true
  });

  const imgData = canvas.toDataURL('image/png');
  const pdf = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4'
  });

  const imgProps = pdf.getImageProperties(imgData);
  const pdfWidth = pdf.internal.pageSize.getWidth();
  const pdfHeight = (imgProps.height * pdfWidth) / imgProps.width;

  pdf.addImage(imgData, 'PNG', 0, 0, pdfWidth, pdfHeight);
  return pdf.output('blob');
};
