import './dashboard.css';
import template from './dashboard.html?raw';
import { getSupabaseClient, hasSupabaseCredentials } from '../../lib/supabase-client.js';
import { navigateTo } from '../../app.js';

export function renderDashboardPage() {
  return template;
}

async function loadDashboardData() {
  if (!hasSupabaseCredentials()) {
    return { user: null, projects: [], tasks: [] };
  }

  const supabase = getSupabaseClient();
  const { data: sessionData } = await supabase.auth.getSession();

  if (!sessionData.session) {
    return { user: null, projects: [], tasks: [] };
  }

  const user = sessionData.session.user;

  const [projectsResult, tasksResult] = await Promise.all([
    supabase.from('projects').select('id, title, description, created_at').order('created_at', { ascending: false }),
    supabase.from('tasks').select('id, done')
  ]);

  return {
    user,
    projects: projectsResult.data ?? [],
    tasks: tasksResult.data ?? []
  };
}

export async function onMountDashboardPage() {
  const authAlert = document.querySelector('#dashboard-auth-alert');
  const dashboardContent = document.querySelector('#dashboard-content');
  const projectsList = document.querySelector('#projects-list');

  if (!authAlert || !dashboardContent || !projectsList) {
    return;
  }

  const data = await loadDashboardData();

  if (!data.user) {
    authAlert.classList.remove('d-none');
    return;
  }

  dashboardContent.classList.remove('d-none');

  const totalTasks = data.tasks.length;
  const doneTasks = data.tasks.filter((task) => task.done).length;
  const pendingTasks = totalTasks - doneTasks;

  document.querySelector('#stat-projects').textContent = String(data.projects.length);
  document.querySelector('#stat-tasks-total').textContent = String(totalTasks);
  document.querySelector('#stat-tasks-pending').textContent = String(pendingTasks);
  document.querySelector('#stat-tasks-done').textContent = String(doneTasks);

  if (data.projects.length === 0) {
    projectsList.innerHTML = '<p class="text-secondary mb-0">No projects yet.</p>';
    return;
  }

  projectsList.innerHTML = `
    <ul class="list-group list-group-flush">
      ${data.projects
        .map(
          (project) => `
        <li class="list-group-item px-0">
          <a href="/projects/${project.id}" data-link class="text-decoration-none d-block">
            <h3 class="h6 mb-1">${escapeHtml(project.title)}</h3>
            ${project.description ? `<p class="mb-0 text-secondary small">${escapeHtml(project.description)}</p>` : ''}
          </a>
        </li>
      `
        )
        .join('')}
    </ul>
  `;
}

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}
