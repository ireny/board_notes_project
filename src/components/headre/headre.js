import './headre.css';
import template from './headre.html?raw';

export function renderHeadre(pathname) {
  const homeActive = pathname === '/' ? 'active' : '';
  const dashActive = pathname === '/dashboard' ? 'active' : '';
  const loginActive = pathname === '/login' ? 'active' : '';
  const registerActive = pathname === '/register' ? 'active' : '';

  return template
    .replace('__HOME_ACTIVE__', homeActive)
    .replace('__DASH_ACTIVE__', dashActive)
    .replace('__LOGIN_ACTIVE__', loginActive)
    .replace('__REGISTER_ACTIVE__', registerActive);
}