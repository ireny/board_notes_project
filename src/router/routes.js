import { renderIndexPage } from '../pages/index/index.js';
import { renderDashboardPage } from '../pages/dashboard/dashboard.js';
import { onMountLoginPage, renderLoginPage } from '../pages/login/login.js';
import { onMountRegisterPage, renderRegisterPage } from '../pages/register/register.js';

const notFoundRoute = {
  path: '*',
  title: 'Not Found | Board Notes',
  render: () => `
    <section class="text-center py-5">
      <h1 class="h3 mb-3">Page not found</h1>
      <a class="btn btn-primary" href="/" data-link>Go to Home</a>
    </section>
  `,
  onMount: undefined
};

export const routes = [
  {
    path: '/',
    title: 'Home',
    render: renderIndexPage,
    onMount: undefined
  },
  {
    path: '/dashboard',
    title: 'Dashboard',
    render: renderDashboardPage,
    onMount: undefined
  },
  {
    path: '/login',
    title: 'Login | Board Notes',
    render: renderLoginPage,
    onMount: onMountLoginPage
  },
  {
    path: '/register',
    title: 'Register | Board Notes',
    render: renderRegisterPage,
    onMount: onMountRegisterPage
  }
];

export function resolveRoute(pathname) {
  return routes.find((route) => route.path === pathname) ?? notFoundRoute;
}