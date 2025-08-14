// POST /api/audit/send-diagnostic
export async function sendDiagnostic(req, res) {
  try {
    const { id, url, email, subject, pdf } = req.body || {};
    if (!id && !url) return res.status(400).json({ error: 'Falta id o url' });

    let doc = null;
    if (id) doc = await Audit.findById(id).lean();
    else    doc = await Audit.findOne({ url }).sort({ fecha: -1 }).lean();
    if (!doc) return res.status(404).json({ error: 'No hay diagnóstico para ese criterio' });

    const toEmail = email || doc.email;
    if (!toEmail) return res.status(400).json({ error: 'No hay email disponible (ni en body ni en el diagnóstico)' });

    // --- helpers para armar listas con estilos inline (email-safe) ---
    const escapeHtml = (s='') => String(s)
      .replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
    // Convierte [texto](url) a <a>
    const mdLinkify = (s='') =>
      s.replace(/\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g, '<a href="$2" style="color:#2563EB;text-decoration:underline">$1</a>');

    // Extraer audits Lighthouse (fallback robusto)
    const auditsObj =
      doc?.audit?.pagespeed?.raw?.lighthouseResult?.audits ||
      doc?.audit?.pagespeed?.audits ||
      doc?.audit?.unlighthouse?.audits ||
      {};

    const audits = Object.entries(auditsObj)
      .map(([id, a]) => ({ id, ...a }))
      .filter(a => a && a.scoreDisplayMode !== 'notApplicable' && a.scoreDisplayMode !== 'manual');

    const errors = [];
    const improvements = [];
    for (const a of audits) {
      if (typeof a.score !== 'number') continue;
      const item = {
        id: a.id,
        title: a.title || a.id,
        // displayValue/description pueden tener markdown
        displayValue: a.displayValue || '',
        description: a.description || ''
      };
      if (a.score < 0.5) errors.push(item);
      else if (a.score < 1) improvements.push(item);
    }
    errors.sort((x, y) => (x.title||'').localeCompare(y.title||''));
    improvements.sort((x, y) => (x.title||'').localeCompare(y.title||''));

    // Métricas y oportunidades
    const metrics = readMetrics(doc);
    const opps    = extractOpportunities(doc).slice(0, 10);

    const pct   = (v) => (v == null ? 'N/A' : `${Math.round(v)}%`);
    const fmtS  = (s) => (s == null ? 'N/A' : `${Number(s).toFixed(2)}s`);
    const fmtMs = (ms)=> (ms== null ? 'N/A' : `${Math.round(ms)}ms`);

    const fecha = new Date(doc.fecha).toLocaleString();
    const title = subject || `Diagnóstico de ${doc.url}`;
    const kpi = (label, val) =>
      `<div style="flex:1;min-width:120px;border:1px solid #E5E7EB;border-radius:12px;padding:12px;text-align:center">
         <div style="font-size:12px;color:#6B7280">${escapeHtml(label)}</div>
         <div style="font-size:20px;font-weight:700;color:#111827;margin-top:4px">${escapeHtml(val)}</div>
       </div>`;

    const oppLi = opps.map(o => {
      const savings = o.savingsLabel ? ` · Ahorro: ${escapeHtml(o.savingsLabel)}` : '';
      const reco = o.recommendation ? `<div style="color:#374151;margin-top:4px">${mdLinkify(escapeHtml(o.recommendation))}</div>` : '';
      return `<li style="margin:0 0 10px 0">
        <div style="font-weight:600;color:#111827">${escapeHtml(o.title || o.id)}${savings}</div>
        ${reco}
      </li>`;
    }).join('');

    // 🔹 Secciones “Errores detectados” y “Mejoras” con estilos inline
    const findingsSection = (titleTxt, items) => `
      <div style="border:1px solid #E5E7EB;border-radius:12px;margin:18px 0">
        <div style="display:flex;justify-content:space-between;align-items:center;padding:10px 12px;
                    background:${titleTxt.startsWith('Error') ? '#FEF2F2' : '#FFFBEB'};
                    color:${titleTxt.startsWith('Error') ? '#991B1B' : '#92400E'};
                    border-bottom:1px solid #E5E7EB;border-radius:12px 12px 0 0">
          <strong>${titleTxt}</strong>
          <span style="font-size:12px;color:#6B7280">${items.length}</span>
        </div>
        <div style="padding:12px;background:#FFFFFF;border-radius:0 0 12px 12px">
          ${items.length ? `
            <ul style="padding-left:18px;margin:0;list-style:disc;">
              ${items.map(it => `
                <li style="margin:0 0 10px 0">
                  <div style="font-weight:600;color:#111827">${escapeHtml(it.title)}</div>
                  ${ (it.displayValue || it.description)
                    ? `<div style="color:#374151;margin-top:4px">${mdLinkify(escapeHtml(it.displayValue || it.description))}</div>`
                    : '' }
                </li>
              `).join('')}
            </ul>` : `<p style="color:#374151;margin:0">Sin elementos.</p>`
          }
        </div>
      </div>`;

    const html = `
      <div style="font-family:Arial,Helvetica,sans-serif;color:#111827;line-height:1.45">
        <h2 style="text-align:center;color:#2563EB;margin:0 0 4px 0">${escapeHtml(title)}</h2>
        <div style="text-align:center;font-size:12px;color:#6B7280">Generado: ${escapeHtml(fecha)} · Estrategia: ${escapeHtml(doc.strategy || 'mobile')}</div>
        <div style="text-align:center;font-size:12px;color:#6B7280;margin-bottom:16px">Fuente: ${escapeHtml(doc.audit?.pagespeed?.meta?.source || 'desconocida')}</div>

        <div style="display:flex;gap:8px;flex-wrap:wrap;margin:16px 0">
          ${kpi('Performance', pct(metrics.performance))}
          ${kpi('FCP', fmtS(metrics.fcp))}
          ${kpi('LCP', fmtS(metrics.lcp))}
          ${kpi('TBT', fmtMs(metrics.tbt))}
          ${kpi('Speed Index', fmtS(metrics.si))}
          ${kpi('TTFB', fmtS(metrics.ttfb))}
        </div>

        ${findingsSection('Errores detectados', errors)}
        ${findingsSection('Mejoras', improvements)}

        <h3 style="margin:20px 0 8px;color:#111827">Plan de acción sugerido</h3>
        <div style="border:1px solid #E5E7EB;border-radius:12px;padding:12px">
          ${opps.length
            ? `<ul style="padding-left:18px;margin:0;list-style:disc;">${oppLi}</ul>`
            : `<p style="color:#374151;margin:0">No se detectaron oportunidades relevantes.</p>`
          }
        </div>

        <p style="text-align:right;font-size:12px;color:#6B7280;margin-top:24px">
          URL: <a href="${escapeHtml(doc.url)}" style="color:#2563EB">${escapeHtml(doc.url)}</a>
        </p>
      </div>
    `;

    const transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: { user: process.env.EMAIL_USER, pass: process.env.EMAIL_PASS }
    });

    const mailOptions = {
      from:    process.env.EMAIL_USER,
      to:      toEmail,
      subject: title,
      html
    };

    if (pdf?.base64 && pdf?.filename) {
      mailOptions.attachments = [{
        filename: pdf.filename,
        content: Buffer.from(pdf.base64, 'base64'),
        contentType: pdf.contentType || 'application/pdf'
      }];
    }

    await transporter.sendMail(mailOptions);
    return res.status(200).json({ message: 'Informe de diagnóstico enviado correctamente' });
  } catch (err) {
    console.error('❌ Error al enviar el diagnóstico:', err);
    return res.status(500).json({ error: 'Error al enviar el diagnóstico', detail: err.message });
  }
}