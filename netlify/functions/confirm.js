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
      Location: `https://accounts.rekietalabs.com/email/failed?error={reason}`
    }
  });

  // 1. Ensure required fields are present
  if (!email || !uid) return redirect('default');

  try {
    // 2. Fetch user from Supabase
    const { data: user, error } = await supabase.auth.admin.getUserById(uid);

    if (error || !user) return redirect('notfound');
    if (user.email !== email) return redirect('nomatch');

    // 3. Check if already verified
    if (user.email_confirmed_at) return redirect('already');

    // 4. Confirm the email
    const update = await supabase.auth.admin.updateUserById(uid, {
      email_confirm: true
    });

    if (update.error) return redirect('supabasefail');

    // 5. Success
    return {
      statusCode: 302,
      headers: {
        Location: 'https://accounts.rekietalabs.com/email/confirmed'
      }
    };

  } catch (err) {
    console.error('Confirm error:', err);
    return redirect('default');
  }
}
