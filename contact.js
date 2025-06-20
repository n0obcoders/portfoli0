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
    // NOTE: For free plans, only your Resend signup email is allowed as "to"
    // To use your own domain, verify it in Resend and change the "from" address
    const data = await resend.emails.send({
      from: 'onboarding@resend.dev',
      to: 'nitinshukla7944@gmail.com', // Must be your Resend-verified email for testing
      subject: `Portfolio Contact Form: ${name}`,
      reply_to: email,
      html: `<p><strong>Name:</strong> ${name}</p>
             <p><strong>Email:</strong> ${email}</p>
             <p><strong>Message:</strong><br>${message}</p>`
    });
    res.status(200).json({ success: true, data });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message, details: err });
  }
}
