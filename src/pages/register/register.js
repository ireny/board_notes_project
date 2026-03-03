import './register.css';
import template from './register.html?raw';
import { getSupabaseClient, hasSupabaseCredentials } from '../../lib/supabase-client.js';
import { navigateTo } from '../../app.js';

export function renderRegisterPage() {
  return template;
}

function setFeedback(message, status) {
  const feedback = document.querySelector('#register-feedback');

  if (!feedback) {
    return;
  }

  feedback.className = 'alert';
  feedback.classList.add(status === 'error' ? 'alert-danger' : 'alert-success');
  feedback.textContent = message;
}

export function onMountRegisterPage() {
  const form = document.querySelector('#register-form');
  const submitButton = document.querySelector('#register-submit');
  const configAlert = document.querySelector('#register-config-alert');

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
    const displayName = String(formData.get('displayName') ?? '').trim();
    const email = String(formData.get('email') ?? '').trim();
    const password = String(formData.get('password') ?? '');
    const confirmPassword = String(formData.get('confirmPassword') ?? '');

    if (!email || !password || !confirmPassword) {
      setFeedback('Please fill all required fields.', 'error');
      return;
    }

    if (password !== confirmPassword) {
      setFeedback('Passwords do not match.', 'error');
      return;
    }

    submitButton.disabled = true;
    submitButton.textContent = 'Creating account...';

    try {
      const supabase = getSupabaseClient();
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: displayName ? { display_name: displayName } : undefined
        }
      });

      if (error) {
        setFeedback(error.message, 'error');
        return;
      }

      if (data.session) {
        navigateTo('/dashboard');
        return;
      }

      setFeedback('Registration successful. Check your email to confirm your account, then login.', 'success');
      form.reset();
    } catch (error) {
      setFeedback(error.message ?? 'Unable to register right now.', 'error');
    } finally {
      submitButton.disabled = false;
      submitButton.textContent = 'Register';
    }
  });
}
