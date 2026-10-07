import PDFDocument from 'pdfkit';

function toBuffer(build) {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ margin: 48, size: 'A4' });
    const chunks = [];
    doc.on('data', c => chunks.push(c));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);
    build(doc);
    doc.end();
  });
}
function line(doc, label, value) { doc.font('Helvetica-Bold').text(`${label}: `, { continued: true }).font('Helvetica').text(String(value ?? '—')); }
function heading(doc, title) { doc.moveDown(0.8).fontSize(15).font('Helvetica-Bold').text(title).fontSize(10).font('Helvetica'); }

export async function studentPdf(data) {
  return toBuffer(doc => {
    doc.fontSize(20).font('Helvetica-Bold').text('BoardTrack + Junior Learning Report');
    doc.fontSize(10).font('Helvetica').text(new Date().toLocaleString());
    heading(doc, 'Student');
    line(doc, 'Name', data.user?.profile?.name || data.user?.name);
    line(doc, 'Email', data.user?.email);
    line(doc, 'Grade', data.user?.profile?.grade);
    line(doc, 'School', data.user?.profile?.school);
    heading(doc, 'Learning summary');
    Object.entries(data.summary || {}).forEach(([k, v]) => line(doc, k.replaceAll('_', ' '), v));
    heading(doc, 'Recent prediction history');
    (data.progress || []).slice(0, 20).forEach(row => doc.text(`${new Date(row.createdAt || row.created_at).toLocaleDateString()}  Predicted ${row.total_predicted_marks ?? '—'}  Risk ${row.risk_level || '—'}`));
    heading(doc, 'Recent tests');
    (data.tests || []).slice(0, 20).forEach(row => doc.text(`${new Date(row.createdAt || row.created_at).toLocaleDateString()}  ${row.test_type || 'Assessment'}  ${row.score ?? '—'}/${row.total_marks ?? '—'}  ${row.difficulty || ''}`));
  });
}

export async function studentsPdf(rows) {
  return toBuffer(doc => {
    doc.fontSize(20).font('Helvetica-Bold').text('BoardTrack + Junior Student Portfolio');
    doc.fontSize(10).font('Helvetica').text(`Generated ${new Date().toLocaleString()}`);
    heading(doc, 'Students');
    rows.forEach((row, i) => {
      const p = row.profile || {};
      doc.font('Helvetica-Bold').text(`${i + 1}. ${p.name || row.name || row.email}`).font('Helvetica');
      doc.text(`${row.email} · Grade ${p.grade || '—'} · Risk ${row.latest_progress?.risk_level || '—'} · Tests ${row.test_stats?.count || 0} · Avg ${row.test_stats?.average_score || 0}%`);
      doc.moveDown(0.4);
    });
  });
}
