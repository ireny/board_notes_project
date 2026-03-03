import './login.css';
import template from './login.html?raw';
import { getSupabaseClient, hasSupabaseCredentials } from '../../lib/supabase-client.js';
import { navigateTo } from '../../app.js';

export function renderLoginPage() {
  return template;
}

function setFeedback(message, status) {
  const feedback = document.querySelector('#login-feedback');

  if (!feedback) {
    return;
  }

  feedback.className = 'alert';
  feedback.classList.add(status === 'error' ? 'alert-danger' : 'alert-success');
  feedback.textContent = message;
}

export function onMountLoginPage() {
  const form = document.querySelector('#login-form');
  const submitButton = document.querySelector('#login-submit');
  const configAlert = document.querySelector('#login-config-alert');

  if (!form || !submitButton || !configAlert) {
    return;
  }

  if (!hasSupabaseCredentials()) {
    configAlert.classList.remove('d-none');
    submitButton.disabled = true;
    return;
  }

  form.addEventListener('submit', async (event) => {
    event.preventDefault();

    const formData = new FormData(form);
    const email = String(formData.get('email') ?? '').trim();
    const password = String(formData.get('password') ?? '');

    if (!email || !password) {
      setFeedback('Please enter email and password.', 'error');
      return;
    }

    submitButton.disabled = true;
    submitButton.textContent = 'Signing in...';

    try {
      const supabase = getSupabaseClient();
      const { error } = await supabase.auth.signInWithPassword({ email, password });

      if (error) {
        setFeedback(error.message, 'error');
        return;
      }

      navigateTo('/dashboard');
    } catch (error) {
      setFeedback(error.message ?? 'Unable to login right now.', 'error');
    } finally {
      submitButton.disabled = false;
      submitButton.textContent = 'Login';
    }
  });
}
