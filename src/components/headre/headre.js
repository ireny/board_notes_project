import './headre.css';
import template from './headre.html?raw';

function getDisplayName(user) {
  if (!user) return '';

  const fullName = user.user_metadata?.full_name?.trim();
  if (fullName) return fullName;

  const name = user.user_metadata?.name?.trim();
  if (name) return name;

  if (user.email) {
    const [emailPrefix] = user.email.split('@');
    return emailPrefix || user.email;
  }

  return 'User';
}

export function renderHeadre(pathname, isAuthenticated, user = null) {
  const homeActive = pathname === '/' ? 'active' : '';
  const dashActive = pathname === '/dashboard' ? 'active' : '';
  const loginActive = pathname === '/login' ? 'active' : '';
  const registerActive = pathname === '/register' ? 'active' : '';
  const logoutActive = '';
  const displayName = getDisplayName(user);
  const dashLink = isAuthenticated
    ? `
      <li class="nav-item">
        <a class="nav-link ${dashActive}" href="/dashboard" data-link>Dashboard</a>
      </li>
    `
    : '';

  const authLinks = isAuthenticated
    ? `
      <li class="nav-item">
        <span class="nav-link app-header__user-badge" aria-label="Logged in user">${displayName}</span>
      </li>
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
    .replace('__DASH_LINK__', dashLink)
    .replace('__AUTH_LINKS__', authLinks);
}