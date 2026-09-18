// Vercel serverless function: verwerkt het contactformulier en verstuurt de e-mail via Resend.
// Vereist de omgevingsvariabele RESEND_API_KEY in de Vercel-projectinstellingen.
// Optioneel: CONTACT_TO_EMAIL (ontvangend adres) en CONTACT_FROM_EMAIL (verzendend adres,
// moet een geverifieerd domein in Resend zijn) — zonder deze twee wordt teruggevallen op
// verkoop@ultimabedden.nl resp. het Resend-testadres.

const ONDERWERP_LABELS = {
  algemeen: 'Algemene vraag',
  product: 'Vraag over een product',
  dealer: 'Wil dealer worden',
  overig: 'Overig',
};

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Alleen POST-verzoeken toegestaan.' });
  }

  try {
    const body = typeof req.body === 'string' ? JSON.parse(req.body || '{}') : (req.body || {});
    const { voornaam, achternaam, email, onderwerp, bericht, website } = body;

    // Honeypot-veld: onzichtbaar voor mensen, wordt vaak automatisch ingevuld door bots.
    if (website) {
      return res.status(200).json({ ok: true });
    }

    if (!voornaam || !achternaam || !email || !bericht) {
      return res.status(400).json({ error: 'Vul alle verplichte velden in.' });
    }
    if (!EMAIL_PATTERN.test(email)) {
      return res.status(400).json({ error: 'Vul een geldig e-mailadres in.' });
    }

    const onderwerpLabel = ONDERWERP_LABELS[onderwerp] || 'Algemene vraag';
    const apiKey = process.env.RESEND_API_KEY;

    if (!apiKey) {
      console.error('RESEND_API_KEY ontbreekt in de omgevingsvariabelen.');
      return res.status(500).json({
        error: 'Het formulier is nog niet volledig geconfigureerd. Neem contact op via e-mail.',
      });
    }

    const toEmail = process.env.CONTACT_TO_EMAIL || 'verkoop@ultimabedden.nl';
    const fromEmail = process.env.CONTACT_FROM_EMAIL || 'Ultima website <onboarding@resend.dev>';

    const textBody =
      `Naam: ${voornaam} ${achternaam}\n` +
      `E-mail: ${email}\n` +
      `Onderwerp: ${onderwerpLabel}\n\n` +
      `Bericht:\n${bericht}`;

    const htmlBody =
      `<p><strong>Naam:</strong> ${escapeHtml(voornaam)} ${escapeHtml(achternaam)}</p>` +
      `<p><strong>E-mail:</strong> ${escapeHtml(email)}</p>` +
      `<p><strong>Onderwerp:</strong> ${escapeHtml(onderwerpLabel)}</p>` +
      `<p><strong>Bericht:</strong></p><p>${escapeHtml(bericht).replace(/\n/g, '<br>')}</p>`;

    const resendResponse = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: fromEmail,
        to: [toEmail],
        reply_to: email,
        subject: `[Contactformulier] ${onderwerpLabel} — ${voornaam} ${achternaam}`,
        text: textBody,
        html: htmlBody,
      }),
    });

    if (!resendResponse.ok) {
      const errText = await resendResponse.text();
      console.error('Resend-fout:', resendResponse.status, errText);
      return res.status(502).json({ error: 'Het bericht kon niet worden verzonden. Probeer het later opnieuw.' });
    }

    return res.status(200).json({ ok: true });
  } catch (err) {
    console.error('Contactformulier-fout:', err);
    return res.status(500).json({ error: 'Er ging iets mis. Probeer het later opnieuw.' });
  }
}
