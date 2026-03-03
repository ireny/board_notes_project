import { onMountIndexPage, renderIndexPage } from '../pages/index/index.js';
import { onMountDashboardPage, renderDashboardPage } from '../pages/dashboard/dashboard.js';
import { onMountLoginPage, renderLoginPage } from '../pages/login/login.js';
import { onMountRegisterPage, renderRegisterPage } from '../pages/register/register.js';
import {
  onMountProjectDetailPage,
  renderProjectDetailPage
} from '../pages/project-detail/project-detail.js';
import { onMountProjectTasksPage, renderProjectTasksPage } from '../pages/project-tasks/project-tasks.js';
import { onMountProjectsPage, renderProjectsPage } from '../pages/projects/projects.js';
import { onMountProjectFormPage, renderProjectFormPage } from '../pages/project-form/project-form.js';

const notFoundRoute = {
  path: '*',
  title: '404 Not Found | Board Notes',
  render: () => `
    <section class="text-center py-5">
      <h1 class="h3 mb-3">404 Not Found</h1>
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
    onMount: onMountIndexPage
  },
  {
    path: '/dashboard',
    title: 'Dashboard',
    render: renderDashboardPage,
    onMount: onMountDashboardPage
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
  },
  {
    path: '/projects',
    title: 'Projects | Board Notes',
    render: renderProjectsPage,
    onMount: onMountProjectsPage
  }
];

export function resolveRoute(pathname) {
  const exactRoute = routes.find((route) => route.path === pathname);
  if (exactRoute) {
    return exactRoute;
  }

  // /projects/new
  if (pathname === '/projects/new') {
    return {
      path: pathname,
      title: 'Create Project | Board Notes',
      render: renderProjectFormPage,
      onMount: () => onMountProjectFormPage('create')
    };
  }

  // /projects/{id}/edit
  const editMatch = pathname.match(/^\/projects\/([a-f0-9-]+)\/edit$/);
  if (editMatch) {
    const projectId = editMatch[1];
    return {
      path: pathname,
      title: 'Edit Project | Board Notes',
      render: renderProjectFormPage,
      onMount: () => onMountProjectFormPage('edit', projectId)
    };
  }

  // /projects/{id}
  const projectMatch = pathname.match(/^\/projects\/([a-f0-9-]+)$/);
  if (projectMatch) {
    const projectId = projectMatch[1];
    return {
      path: pathname,
      title: 'Project | Board Notes',
      render: renderProjectDetailPage,
      onMount: () => onMountProjectDetailPage(projectId)
    };
  }

  // /project/{id}/tasks
  const projectTasksMatch = pathname.match(/^\/project\/([a-f0-9-]+)\/tasks$/);
  if (projectTasksMatch) {
    const projectId = projectTasksMatch[1];
    return {
      path: pathname,
      title: 'Tasks | Board Notes',
      render: renderProjectTasksPage,
      onMount: () => onMountProjectTasksPage(projectId)
    };
  }

  return notFoundRoute;
}