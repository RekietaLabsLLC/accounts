import express from 'express';
import { createClient } from '@supabase/supabase-js';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

dotenv.config();
const router = express.Router();

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// Used to resolve the file path to serve the HTML file
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// GET /email/confirm?email=...&token=...&uid=...
router.get('/email/confirm', async (req, res) => {
  const { email, token, uid } = req.query;

  if (!email || !token || !uid) {
    return res.status(400).send('Missing required parameters.');
  }

  // 1. Check token in database
  const { data: tokenData, error: tokenError } = await supabase
    .from('email_tokens')
    .select('*')
    .eq('email', email)
    .eq('token', token)
    .eq('uid', uid)
    .single();

  if (tokenError || !tokenData) {
    return res.status(400).send('Invalid or expired token.');
  }

  const now = new Date();
  const expiresAt = new Date(tokenData.expires_at);
  if (expiresAt < now) {
    return res.status(400).send('Token has expired.');
  }

  // 2. Confirm user's email
  const { error: confirmError } = await supabase.auth.admin.updateUserById(uid, {
    email_confirm: true,
  });

  if (confirmError) {
    console.error('Error confirming email:', confirmError);
    return res.status(500).send('Internal error confirming email.');
  }

  // 3. Delete the token
  await supabase
    .from('email_tokens')
    .delete()
    .eq('uid', uid)
    .eq('email', email)
    .eq('token', token);

  // 4. Send confirmation HTML page
  const confirmationPath = path.join(__dirname, '../public/email-confirmed.html');
  return res.sendFile(confirmationPath);
});

export default router;
