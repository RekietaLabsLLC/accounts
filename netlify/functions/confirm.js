// netlify/functions/confirm.js
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

export async function handler(event, context) {
  const params = new URLSearchParams(event.rawUrl.split('?')[1]);
  const email = params.get('email');
  const uid = params.get('uid');

  const redirect = (reason = 'default') => ({
    statusCode: 302,
    headers: {
      Location: `https://accounts.rekietalabs.com/email/failed?reason=${reason}`
    }
  });

  if (!email || !uid) return redirect('default');

  try {
    const { data: user, error } = await supabase.auth.admin.getUserById(uid);
    if (error || !user) return redirect('notfound');

    if (user.email !== email) return redirect('nomatch');

    if (user.email_confirmed_at) return redirect('already');

    const update = await supabase.auth.admin.updateUserById(uid, {
      email_confirm: true
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
    return {
      statusCode: 500,
      body: JSON.stringify({
        error: err.message,
        stack: err.stack,
      }),
    };
  }
}
