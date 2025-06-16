import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

export async function handler(event) {
  const url = new URL(event.rawUrl);
  const email = url.searchParams.get('email');
  const user_id = url.searchParams.get('user_id');
  const token = url.searchParams.get('token');

  if (!email || !user_id || !token) {
    return redirectToFailure('default');
  }

  try {
    const { data: users, error: fetchError } = await supabase
      .from('auth.users')
      .select('id, email, email_confirmed_at, raw_app_meta_data')
      .eq('email', email)
      .limit(1);

    if (fetchError) {
      console.error('Supabase fetch error:', fetchError);
      return redirectToFailure('supabasefail');
    }

    if (!users || users.length === 0) {
      return redirectToFailure('notfound');
    }

    const user = users[0];

    // Already confirmed
    if (user.email_confirmed_at) {
      return redirectToFailure('already');
    }

    const meta = user.raw_app_meta_data || {};
    const storedToken = meta.verify_token;
    const storedTokenExpiresAt = meta.verify_token_expires_at;
    const manuallyRevoked = meta.verify_token_revoked === true;

    // Tampered or missing token
    if (!storedToken || typeof storedToken !== 'string') {
      return redirectToFailure('tampered');
    }

    // Token mismatch
    if (storedToken !== token || user.id !== user_id) {
      return redirectToFailure('nomatch');
    }

    // Expired
    if (storedTokenExpiresAt && Date.now() > new Date(storedTokenExpiresAt).getTime()) {
      return redirectToFailure('expired');
    }

    // Revoked
    if (manuallyRevoked) {
      return redirectToFailure('revoked');
    }

    // Confirm email
    const { error: updateError } = await supabase.auth.admin.updateUserById(user.id, {
      email_confirm: true
    });

    if (updateError) {
      console.error('Supabase update error:', updateError);
      return redirectToFailure('supabasefail');
    }

    // Success
    return {
      statusCode: 302,
      headers: {
        Location: '/email/confirmed.html'
      }
    };

  } catch (err) {
    console.error('Unexpected error:', err);
    return redirectToFailure('default');
  }
}

function redirectToFailure(errorKey) {
  return {
    statusCode: 302,
    headers: {
      Location: `/email/failed.html?error=${errorKey}`
    }
  };
}
