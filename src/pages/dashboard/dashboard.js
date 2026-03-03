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
    navigateTo('/login');
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
    <div class="row g-3">
      ${data.projects
        .map(
          (project) => `
        <div class="col-12 col-md-6 col-xl-4">
          <a href="/project/${project.id}/tasks" data-link class="card border-0 shadow-sm text-decoration-none h-100 page-dashboard__project-card">
            <div class="card-body">
              <h3 class="h6 mb-2 page-dashboard__project-title">${escapeHtml(project.title)}</h3>
              <p class="mb-0 text-secondary small page-dashboard__project-description">${
                project.description ? escapeHtml(project.description) : 'No description yet.'
              }</p>
            </div>
          </a>
        </div>
      `
        )
        .join('')}
    </div>
  `;
}

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}
