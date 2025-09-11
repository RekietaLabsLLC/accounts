// netlify/functions/confirm.js

import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

export async function handler(event, context) {
  const time = new Date().toISOString();
  console.log(`[${time}] Incoming confirm.js request.`);

  const params = new URLSearchParams(event.rawUrl.split('?')[1] || '');
  const email = params.get('email');
  const uid = params.get('uid');

  console.log(`[${time}] Extracted query params:`, { uid, email });

  const redirect = (reason = 'default') => {
    console.log(`[${time}] Redirecting to failed page. Reason:`, reason);
    return {
      statusCode: 302,
      headers: {
        Location: `https://accounts.rekietalabs.com/email/failed?reason=${reason}`
      }
    };
  };

  if (!email || !uid) {
    console.log(`[${time}] Missing uid or email in query params.`);
    return redirect('default');
  }

  try {
    console.log(`[${time}] Fetching user from Supabase... uid = ${uid}`);
    const { data, error } = await supabase.auth.admin.getUserById(uid);

    if (error) {
      console.log(`[${time}] Supabase error while fetching user:`, error);
      return redirect('notfound');
    }

    if (!data || !data.user) {
      console.log(`[${time}] No user found in Supabase for uid:`, uid);
      return redirect('notfound');
    }

    const user = data.user;

    if (!user.email) {
      console.log(`[${time}] User has no email.`);
      return redirect('notfound');
    }

    const userEmail = user.email.toLowerCase();
    const providedEmail = email.toLowerCase();

    if (userEmail !== providedEmail) {
      console.log(`[${time}] Emails do not match.`);
      return redirect('nomatch');
    }

    if (user.email_confirmed_at) {
      console.log(`[${time}] Already confirmed at: ${user.email_confirmed_at}`);
      return redirect('already');
    }

    console.log(`[${time}] Marking email as confirmed...`);
    const { error: updateError } = await supabase.auth.admin.updateUserById(uid, {
      email_confirmed_at: new Date().toISOString()
    });

    if (updateError) {
      console.log(`[${time}] Error updating user:`, updateError);
      return redirect('supabasefail');
    }

    console.log(`[${time}] Email successfully confirmed for UID: ${uid}`);
    return {
      statusCode: 302,
      headers: {
        Location: 'https://accounts.rekietalabs.com/email/confirmed'
      }
    };

  } catch (err) {
    console.error(`[${time}] Unexpected error:`, err);
    return redirect('default');
  }
}
