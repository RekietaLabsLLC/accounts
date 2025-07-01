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

    console.log(`[${time}] User fetched from Supabase:`, user);

    if (!user.email) {
      console.log(`[${time}] User object exists but has no email:`, user);
      return redirect('notfound');
    }

    const userEmail = user.email.toLowerCase();
    const providedEmail = email.toLowerCase();

    console.log(`[${time}] Comparing emails:`, {
      userEmail,
      providedEmail
    });

    if (userEmail !== providedEmail) {
      console.log(`[${time}] Emails do not match.`);
      return redirect('nomatch');
    }

    if (user.email_confirmed_at) {
      console.log(`[${time}] User email already confirmed at:`, user.email_confirmed_at);
      return redirect('already');
    }

    console.log(`[${time}] Proceeding to mark email as confirmed.`);

    const { data: updatedUser, error: updateError } =
      await supabase.auth.admin.updateUserById(uid, {
        email_confirm: true
      });

    if (updateError) {
      console.log(`[${time}] Error updating user to confirm email:`, updateError);
      return redirect('supabasefail');
    }

    console.log(`[${time}] Email successfully confirmed for user:`, updatedUser);

    return {
      statusCode: 302,
      headers: {
        Location: 'https://accounts.rekietalabs.com/email/confirmed'
      }
    };

  } catch (err) {
    console.error(`[${time}] Unexpected error in confirm.js:`, err);
    return redirect('default');
  }
}
