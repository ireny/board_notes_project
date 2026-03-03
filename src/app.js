import { renderHeadre } from './components/headre/headre.js';
import { renderFooter } from './components/footer/footer.js';
import { routes, resolveRoute } from './router/routes.js';
import { getSupabaseClient, hasSupabaseCredentials } from './lib/supabase-client.js';

async function onNavigate(event) {
  const logoutLink = event.target.closest('[data-logout]');
  if (logoutLink) {
    event.preventDefault();

    if (hasSupabaseCredentials()) {
      const supabase = getSupabaseClient();
      await supabase.auth.signOut();
    }

    navigateTo('/');
    return;
  }

  const anchor = event.target.closest('[data-link]');

  if (!anchor) {
    return;
  }

  event.preventDefault();
  const href = anchor.getAttribute('href');
  navigateTo(href);
}

function onPopState() {
  renderApp();
}

export function navigateTo(pathname) {
  window.history.pushState({}, '', pathname);
  renderApp();
}

async function getIsAuthenticated() {
  if (!hasSupabaseCredentials()) {
    return false;
  }

  const supabase = getSupabaseClient();
  const { data, error } = await supabase.auth.getUser();

  if (error) {
    return false;
  }

  return Boolean(data.user);
}

async function renderApp() {
  const appRoot = document.querySelector('#app');
  const currentPath = window.location.pathname;
  const route = resolveRoute(currentPath);
  const isAuthenticated = await getIsAuthenticated();

  document.title = route.title ?? 'Board Notes';

  appRoot.innerHTML = `
    ${renderHeadre(currentPath, isAuthenticated)}
    <main class="container py-4" id="page-root"></main>
    ${renderFooter()}
  `;

  const pageRoot = document.querySelector('#page-root');
  pageRoot.innerHTML = route.render();

  route.onMount?.();
}

export function createApp(container) {
  if (!container) {
    return;
  }

  document.addEventListener('click', onNavigate);
  window.addEventListener('popstate', onPopState);
  void renderApp();
}

export { routes };