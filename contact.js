import { Resend } from 'resend';

const resend = new Resend(process.env.RESEND_API_KEY);

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }
  const { name, email, message } = req.body;
  if (!name || !email || !message) {
    return res.status(400).json({ error: 'Missing fields' });
  }

  try {
    const data = await resend.emails.send({
      from: 'onboarding@resend.dev', // Only works for test, and only to your signup address.
      to: 'nitinshukla7944@gmail.com', // Must match your Resend signup address for free plan/testing.
      subject: `Portfolio Contact Form: ${name}`,
      reply_to: email,
      html: `<p><strong>Name:</strong> ${name}</p>
             <p><strong>Email:</strong> ${email}</p>
             <p><strong>Message:</strong><br>${message}</p>`
    });
    res.status(200).json({ success: true, data });
  } } catch (err) {
  console.error(err);
  res.status(500).json({ error: err.message || 'Failed to send email' });
}
}
