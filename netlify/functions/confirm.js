// netlify/functions/confirm.js
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

export default async (req, res) => {
  const { email, token, uid } = req.query;

  if (!email || !token || !uid) {
    return res.redirect(
      `https://accounts.rekietalabs.com/email/failed?error=default`
    );
  }

  try {
    // Fetch the user by ID
    const { data: user, error } = await supabase.auth.admin.getUserById(uid);

    if (error || !user || user.email !== email) {
      return res.redirect(
        `https://accounts.rekietalabs.com/email/failed?error=nomatch`
      );
    }

    const { email_token, email_token_expiry } = user.user_metadata || {};

    if (!email_token || !email_token_expiry) {
      return res.redirect(
        `https://accounts.rekietalabs.com/email/failed?reason=revoked`
      );
    }

    // Check token validity
    const now = new Date();
    const expiryDate = new Date(email_token_expiry);

    if (token !== email_token || now > expiryDate) {
      return res.redirect(
        `https://accounts.rekietalabs.com/email/failed?reason=expired`
      );
    }

    // Already verified
    if (user.email_confirmed_at) {
      return res.redirect(
        `https://accounts.rekietalabs.com/email/failed?reason=already`
      );
    }

    // Update user: mark email as confirmed
    const update = await supabase.auth.admin.updateUserById(uid, {
      email_confirm: true,
      user_metadata: {
        ...user.user_metadata,
        email_token: null,
        email_token_expiry: null
      }
    });

    if (update.error) {
      return res.redirect(
        `https://accounts.rekietalabs.com/email/failed?reason=supabasefail`
      );
    }

    return res.redirect(
      `https://accounts.rekietalabs.com/email/confirmed`
    );
  } catch (err) {
    console.error('Unexpected confirm error:', err);
    return res.redirect(
      `https://accounts.rekietalabs.com/email/failed?reason=default`
    );
  }
};
