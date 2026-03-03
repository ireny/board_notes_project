import './headre.css';
import template from './headre.html?raw';

export function renderHeadre(pathname, isAuthenticated) {
  const homeActive = pathname === '/' ? 'active' : '';
  const dashActive = pathname === '/dashboard' ? 'active' : '';
  const loginActive = pathname === '/login' ? 'active' : '';
  const registerActive = pathname === '/register' ? 'active' : '';
  const logoutActive = '';

  const authLinks = isAuthenticated
    ? `
      <li class="nav-item">
        <a class="nav-link ${logoutActive}" href="#" data-logout>Logout</a>
      </li>
    `
    : `
      <li class="nav-item">
        <a class="nav-link ${registerActive}" href="/register" data-link>Register</a>
      </li>
      <li class="nav-item">
        <a class="nav-link ${loginActive}" href="/login" data-link>Login</a>
      </li>
    `;

  return template
    .replace('__HOME_ACTIVE__', homeActive)
    .replace('__DASH_ACTIVE__', dashActive)
    .replace('__AUTH_LINKS__', authLinks);
}