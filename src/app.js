import { renderHeadre } from './components/headre/headre.js';
import { renderFooter } from './components/footer/footer.js';
import { routes, resolveRoute } from './router/routes.js';
import { getSupabaseClient, hasSupabaseCredentials } from './lib/supabase-client.js';
import { onUnmountIndexPage } from './pages/index/index.js';

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

async function getCurrentUser() {
  if (!hasSupabaseCredentials()) {
    return null;
  }

  const supabase = getSupabaseClient();
  const { data, error } = await supabase.auth.getUser();

  if (error) {
    return null;
  }

  return data.user ?? null;
}

async function renderApp() {
  onUnmountIndexPage();

  const appRoot = document.querySelector('#app');
  const currentPath = window.location.pathname;
  const route = resolveRoute(currentPath);
  const currentUser = await getCurrentUser();
  const isAuthenticated = Boolean(currentUser);
  const isHomePage = currentPath === '/';
  const mainClass = isHomePage ? 'container py-4' : 'container py-4 app-main-shell';

  document.title = route.title ?? 'Board Notes';

  appRoot.innerHTML = `
    ${renderHeadre(currentPath, isAuthenticated, currentUser)}
    <main class="${mainClass}" id="page-root"></main>
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