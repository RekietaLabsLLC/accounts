// netlify/functions/confirm.js

import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

export async function handler(event, context) {
  try {
    // Extract query params
    const params = new URLSearchParams(event.rawUrl.split('?')[1]);
    const email = params.get('email');
    const uid = params.get('uid');

    console.log('Confirm endpoint called with:', { uid, email });

    const redirect = (reason = 'default') => ({
      statusCode: 302,
      headers: {
        Location: `https://accounts.rekietalabs.com/email/failed?reason=${reason}`
      }
    });

    if (!email || !uid) {
      console.log('Missing required parameters.');
      return redirect('default');
    }

    // Fetch user by Supabase user ID
    const { data: user, error } = await supabase.auth.admin.getUserById(uid);

    console.log('Supabase user result:', { user, error });

    if (error || !user) {
      console.log('No user found for provided UID.');
      return redirect('notfound');
    }

    // Compare email case-insensitively
    if (
      user.email.toLowerCase() !== email.toLowerCase()
    ) {
      console.log(
        `Email mismatch. Supabase has "${user.email}", but link provided "${email}".`
      );
      return redirect('nomatch');
    }

    // Check if already verified
    if (user.email_confirmed_at) {
      console.log('Email already confirmed.');
      return redirect('already');
    }

    // Update user to mark email as confirmed
    const update = await supabase.auth.admin.updateUserById(uid, {
      email_confirm: true,
    });

    if (update.error) {
      console.error('Error updating user confirmation:', update.error);
      return redirect('supabasefail');
    }

    console.log('Email successfully confirmed for user:', uid);

    // Success — redirect to confirmed page
    return {
      statusCode: 302,
      headers: {
        Location: 'https://accounts.rekietalabs.com/email/confirmed'
      }
    };

  } catch (err) {
    console.error('Unexpected confirm.js error:', err);
    return {
      statusCode: 302,
      headers: {
        Location: 'https://accounts.rekietalabs.com/email/failed?reason=default'
      }
    };
  }
}
