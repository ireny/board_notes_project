import { renderHeadre } from './components/headre/headre.js';
import { renderFooter } from './components/footer/footer.js';
import { routes, resolveRoute } from './router/routes.js';

function onNavigate(event) {
  const anchor = event.target.closest('[data-link]');

  if (!anchor) {
    return;
  }

  event.preventDefault();
  const href = anchor.getAttribute('href');
  window.history.pushState({}, '', href);
  renderApp();
}

function onPopState() {
  renderApp();
}

function renderApp() {
  const appRoot = document.querySelector('#app');
  const currentPath = window.location.pathname;
  const route = resolveRoute(currentPath);

  document.title = route.title ?? 'Board Notes';

  appRoot.innerHTML = `
    ${renderHeadre(currentPath)}
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
  renderApp();
}

export { routes };