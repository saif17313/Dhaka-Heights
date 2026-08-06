'use client';

import { STATUS_LABELS, typeMeta } from '@/lib/inquiryTypes';

const NAVY = '0B1B3D';
const GOLD = 'B59410';
const ROW_STRIPE = 'F8FAFC';

const EXPORT_COLUMNS = [
  { key: 'type', header: 'Type', width: 22 },
  { key: 'name', header: 'Name', width: 24 },
  { key: 'email', header: 'Email', width: 28 },
  { key: 'phone', header: 'Phone', width: 18 },
  { key: 'project', header: 'Project', width: 22 },
  { key: 'subject', header: 'Subject', width: 30 },
  { key: 'message', header: 'Message', width: 50 },
  { key: 'status', header: 'Status', width: 14 },
  { key: 'notes', header: 'Internal Notes', width: 30 },
  { key: 'submittedAt', header: 'Submitted At', width: 20 },
];

function toRow(inquiry) {
  return {
    type: typeMeta(inquiry.submission_type).label,
    name: inquiry.full_name || '-',
    email: inquiry.email || '-',
    phone: inquiry.phone || '-',
    project: inquiry.projects?.name || '-',
    subject: inquiry.subject || '-',
    message: inquiry.message || '-',
    status: STATUS_LABELS[inquiry.status] || inquiry.status,
    notes: inquiry.admin_notes || '-',
    submittedAt: inquiry.created_at ? new Date(inquiry.created_at).toLocaleString() : '-',
  };
}

function triggerDownload(blob, filename) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

function filenameStamp() {
  const now = new Date();
  const pad = (value) => String(value).padStart(2, '0');
  return `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}-${pad(now.getHours())}${pad(now.getMinutes())}`;
}

export async function downloadInquiriesExcel(inquiries, { statusLabel = 'All', typeLabel = 'All Types' } = {}) {
  const { default: ExcelJS } = await import('exceljs');
  const rows = inquiries.map(toRow);

  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'Dhaka Heights Properties Limited';
  workbook.created = new Date();

  const sheet = workbook.addWorksheet('Inquiries', { views: [{ state: 'frozen', ySplit: 4 }] });
  sheet.columns = EXPORT_COLUMNS.map((column) => ({ key: column.key, width: column.width }));

  sheet.mergeCells('A1', `${sheet.getColumn(EXPORT_COLUMNS.length).letter}1`);
  const titleCell = sheet.getCell('A1');
  titleCell.value = 'Dhaka Heights Properties Limited — Customer Inquiries Export';
  titleCell.font = { bold: true, size: 14, color: { argb: `FF${NAVY}` } };

  sheet.mergeCells('A2', `${sheet.getColumn(EXPORT_COLUMNS.length).letter}2`);
  const subtitleCell = sheet.getCell('A2');
  subtitleCell.value = `Filter: Status = ${statusLabel} · Type = ${typeLabel} · Generated ${new Date().toLocaleString()} · ${rows.length} record(s)`;
  subtitleCell.font = { italic: true, size: 10, color: { argb: 'FF64748B' } };

  const headerRow = sheet.getRow(4);
  EXPORT_COLUMNS.forEach((column, index) => {
    const cell = headerRow.getCell(index + 1);
    cell.value = column.header;
    cell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: `FF${NAVY}` } };
    cell.alignment = { vertical: 'middle', horizontal: 'left' };
    cell.border = { bottom: { style: 'medium', color: { argb: `FF${GOLD}` } } };
  });
  headerRow.height = 20;

  rows.forEach((row, rowIndex) => {
    const excelRow = sheet.getRow(5 + rowIndex);
    EXPORT_COLUMNS.forEach((column, columnIndex) => {
      const cell = excelRow.getCell(columnIndex + 1);
      cell.value = row[column.key];
      cell.alignment = { vertical: 'top', wrapText: true };
      if (rowIndex % 2 === 1) cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: `FF${ROW_STRIPE}` } };
    });
  });

  const buffer = await workbook.xlsx.writeBuffer();
  triggerDownload(
    new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }),
    `dhaka-heights-inquiries-${filenameStamp()}.xlsx`
  );
}

export async function downloadInquiriesPdf(inquiries, { statusLabel = 'All', typeLabel = 'All Types' } = {}) {
  const [{ jsPDF }, { default: autoTable }] = await Promise.all([import('jspdf'), import('jspdf-autotable')]);
  const rows = inquiries.map(toRow);

  const doc = new jsPDF({ orientation: 'landscape', unit: 'pt', format: 'a4' });
  const pageWidth = doc.internal.pageSize.getWidth();

  doc.setFillColor(11, 27, 61);
  doc.rect(0, 0, pageWidth, 54, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(16);
  doc.text('Dhaka Heights Properties Limited', 24, 24);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.text('Customer Inquiries Export', 24, 40);

  doc.setTextColor(30, 41, 59);
  doc.setFontSize(9);
  doc.text(`Filter: Status = ${statusLabel}  ·  Type = ${typeLabel}`, 24, 70);
  doc.text(`Generated: ${new Date().toLocaleString()}  ·  Total records: ${rows.length}`, 24, 84);

  autoTable(doc, {
    startY: 96,
    head: [EXPORT_COLUMNS.map((column) => column.header)],
    body: rows.map((row) => EXPORT_COLUMNS.map((column) => row[column.key])),
    theme: 'grid',
    styles: { fontSize: 8, cellPadding: 6, valign: 'top', overflow: 'linebreak', lineColor: [226, 232, 240], lineWidth: 0.5 },
    headStyles: { fillColor: [11, 27, 61], textColor: [255, 255, 255], fontStyle: 'bold' },
    alternateRowStyles: { fillColor: [248, 250, 252] },
    columnStyles: { 6: { cellWidth: 170 } },
    margin: { left: 24, right: 24, top: 24 },
  });

  doc.save(`dhaka-heights-inquiries-${filenameStamp()}.pdf`);
}
