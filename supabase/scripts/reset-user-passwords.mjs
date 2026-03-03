import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.SUPABASE_URL ?? process.env.VITE_SUPABASE_URL;
const SUPABASE_PUBLISHABLE_KEY =
  process.env.SUPABASE_PUBLISHABLE_KEY ??
  process.env.SUPABASE_ANON_KEY ??
  process.env.VITE_SUPABASE_PUBLISHABLE_KEY ??
  process.env.VITE_SUPABASE_ANON_KEY;

if (!SUPABASE_URL || !SUPABASE_PUBLISHABLE_KEY) {
  throw new Error(
    'Missing SUPABASE_URL or SUPABASE_PUBLISHABLE_KEY/SUPABASE_ANON_KEY (or VITE_* equivalents).'
  );
}

const users = ['natasha@gmail.com', 'dancho@gmail.com', 'zoya@gmail.com'];
const targetPassword = '1234567';
const knownPasswords = ['1234567', 'pass1234'];

function createAuthClient() {
  return createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
      detectSessionInUrl: false
    }
  });
}

async function signInWithKnownPassword(client, email) {
  for (const password of knownPasswords) {
    const { data, error } = await client.auth.signInWithPassword({ email, password });

    if (!error && data.user) {
      return { passwordUsed: password, signedIn: true };
    }
  }

  return { passwordUsed: null, signedIn: false };
}

async function resetPassword(email) {
  const client = createAuthClient();
  const signInResult = await signInWithKnownPassword(client, email);

  if (!signInResult.signedIn) {
    return { email, ok: false, message: 'Unable to sign in with known password values.' };
  }

  const { error: updateError } = await client.auth.updateUser({
    password: targetPassword
  });

  await client.auth.signOut();

  if (updateError) {
    return { email, ok: false, message: updateError.message };
  }

  return {
    email,
    ok: true,
    message:
      signInResult.passwordUsed === targetPassword
        ? 'Password already set to 1234567.'
        : 'Password updated to 1234567.'
  };
}

const results = [];
for (const email of users) {
  results.push(await resetPassword(email));
}

for (const result of results) {
  const prefix = result.ok ? '✅' : '❌';
  console.log(`${prefix} ${result.email}: ${result.message}`);
}

if (results.some((item) => !item.ok)) {
  process.exitCode = 1;
}
