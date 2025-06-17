// netlify/functions/confirm.js
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

export async function handler(event, context) {
  const params = new URLSearchParams(event.rawUrl.split('?')[1]);
  const email = params.get('email');
  const token = params.get('token');
  const uid = params.get('uid');

  const redirect = (reason = 'default') => ({
    statusCode: 302,
    headers: {
      Location: `https://accounts.rekietalabs.com/email/failed?reason=${reason}`
    }
  });

  if (!email || !token || !uid) return redirect('default');

  try {
    const { data: user, error } = await supabase.auth.admin.getUserById(uid);

    if (error || !user || user.email !== email) return redirect('nomatch');

    const { email_token, email_token_expiry } = user.user_metadata || {};

    if (!email_token || !email_token_expiry) return redirect('revoked');

    const now = new Date();
    const expiryDate = new Date(email_token_expiry);

    if (token !== email_token || now > expiryDate) return redirect('expired');

    if (user.email_confirmed_at) return redirect('already');

    const update = await supabase.auth.admin.updateUserById(uid, {
      email_confirm: true,
      user_metadata: {
        ...user.user_metadata,
        email_token: null,
        email_token_expiry: null
      }
    });

    if (update.error) return redirect('supabasefail');

    return {
      statusCode: 302,
      headers: {
        Location: 'https://accounts.rekietalabs.com/email/confirmed'
      }
    };
  } catch (err) {
    console.error('Unexpected confirm error:', err);
    return redirect('default');
  }
}
