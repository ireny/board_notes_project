import './projects.css';
import template from './projects.html?raw';
import { getSupabaseClient, hasSupabaseCredentials } from '../../lib/supabase-client.js';
import { navigateTo } from '../../app.js';

export function renderProjectsPage() {
  return template;
}

async function loadProjects() {
  if (!hasSupabaseCredentials()) {
    return { user: null, projects: [] };
  }

  const supabase = getSupabaseClient();
  const { data: sessionData } = await supabase.auth.getSession();

  if (!sessionData.session) {
    return { user: null, projects: [] };
  }

  const { data: projects } = await supabase
    .from('projects')
    .select('id, title, description, created_at')
    .order('created_at', { ascending: false });

  return {
    user: sessionData.session.user,
    projects: projects ?? []
  };
}

async function deleteProject(projectId) {
  const supabase = getSupabaseClient();
  const { error } = await supabase.from('projects').delete().eq('id', projectId);

  if (error) {
    throw error;
  }
}

function formatDate(dateString) {
  const date = new Date(dateString);
  return new Intl.DateTimeFormat('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric'
  }).format(date);
}

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

function renderProjectsTable(projects) {
  const tbody = document.querySelector('#projects-table-body');
  if (!tbody) return;

  if (projects.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="4" class="text-center py-4 text-secondary">
          No projects yet. <a href="/projects/new" data-link>Create your first project</a>
        </td>
      </tr>
    `;
    return;
  }

  tbody.innerHTML = projects
    .map(
      (project) => `
    <tr>
      <td class="ps-4">
        <strong>${escapeHtml(project.title)}</strong>
      </td>
      <td class="text-secondary">
        ${project.description ? escapeHtml(project.description) : '—'}
      </td>
      <td class="text-secondary">
        ${formatDate(project.created_at)}
      </td>
      <td class="text-end pe-4">
        <a href="/projects/${project.id}" data-link class="action-icon" title="View">
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" viewBox="0 0 16 16">
            <path d="M16 8s-3-5.5-8-5.5S0 8 0 8s3 5.5 8 5.5S16 8 16 8M1.173 8a13 13 0 0 1 1.66-2.043C4.12 4.668 5.88 3.5 8 3.5s3.879 1.168 5.168 2.457A13 13 0 0 1 14.828 8q-.086.13-.195.288c-.335.48-.83 1.12-1.465 1.755C11.879 11.332 10.119 12.5 8 12.5s-3.879-1.168-5.168-2.457A13 13 0 0 1 1.172 8z"/>
            <path d="M8 5.5a2.5 2.5 0 1 0 0 5 2.5 2.5 0 0 0 0-5M4.5 8a3.5 3.5 0 1 1 7 0 3.5 3.5 0 0 1-7 0"/>
          </svg>
        </a>
        <a href="/projects/${project.id}/edit" data-link class="action-icon" title="Edit">
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" viewBox="0 0 16 16">
            <path d="M12.146.146a.5.5 0 0 1 .708 0l3 3a.5.5 0 0 1 0 .708l-10 10a.5.5 0 0 1-.168.11l-5 2a.5.5 0 0 1-.65-.65l2-5a.5.5 0 0 1 .11-.168zM11.207 2.5 13.5 4.793 14.793 3.5 12.5 1.207zm1.586 3L10.5 3.207 4 9.707V10h.5a.5.5 0 0 1 .5.5v.5h.5a.5.5 0 0 1 .5.5v.5h.293zm-9.761 5.175-.106.106-1.528 3.821 3.821-1.528.106-.106A.5.5 0 0 1 5 12.5V12h-.5a.5.5 0 0 1-.5-.5V11h-.5a.5.5 0 0 1-.468-.325"/>
          </svg>
        </a>
        <a href="#" class="action-icon delete-icon" data-project-id="${project.id}" data-project-title="${escapeHtml(
        project.title
      )}" title="Delete">
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" viewBox="0 0 16 16">
            <path d="M5.5 5.5A.5.5 0 0 1 6 6v6a.5.5 0 0 1-1 0V6a.5.5 0 0 1 .5-.5m2.5 0a.5.5 0 0 1 .5.5v6a.5.5 0 0 1-1 0V6a.5.5 0 0 1 .5-.5m3 .5a.5.5 0 0 0-1 0v6a.5.5 0 0 0 1 0z"/>
            <path d="M14.5 3a1 1 0 0 1-1 1H13v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V4h-.5a1 1 0 0 1-1-1V2a1 1 0 0 1 1-1H6a1 1 0 0 1 1-1h2a1 1 0 0 1 1 1h3.5a1 1 0 0 1 1 1zM4.118 4 4 4.059V13a1 1 0 0 0 1 1h6a1 1 0 0 0 1-1V4.059L11.882 4zM2.5 3h11V2h-11z"/>
          </svg>
        </a>
      </td>
    </tr>
  `
    )
    .join('');

  // Attach delete handlers
  const deleteModal = new bootstrap.Modal(document.getElementById('deleteProjectModal'));
  const deleteProjectName = document.getElementById('delete-project-name');
  const confirmDeleteBtn = document.getElementById('confirm-delete-btn');
  let currentDeleteId = null;

  document.querySelectorAll('.delete-icon').forEach((deleteBtn) => {
    deleteBtn.addEventListener('click', (e) => {
      e.preventDefault();
      currentDeleteId = deleteBtn.getAttribute('data-project-id');
      const projectTitle = deleteBtn.getAttribute('data-project-title');
      
      deleteProjectName.textContent = projectTitle;
      deleteModal.show();
    });
  });

  // Handle actual delete confirmation
  confirmDeleteBtn.onclick = async () => {
    if (!currentDeleteId) return;

    confirmDeleteBtn.disabled = true;
    confirmDeleteBtn.textContent = 'Deleting...';

    try {
      await deleteProject(currentDeleteId);
      deleteModal.hide();
      // Reload the page data
      await onMountProjectsPage();
    } catch (error) {
      alert(`Failed to delete project: ${error.message}`);
    } finally {
      confirmDeleteBtn.disabled = false;
      confirmDeleteBtn.textContent = 'Delete Project';
      currentDeleteId = null;
    }
  };
}

export async function onMountProjectsPage() {
  const authAlert = document.querySelector('#projects-auth-alert');
  const projectsContent = document.querySelector('#projects-content');

  if (!authAlert || !projectsContent) {
    return;
  }

  const data = await loadProjects();

  if (!data.user) {
    authAlert.classList.remove('d-none');
    return;
  }

  projectsContent.classList.remove('d-none');
  renderProjectsTable(data.projects);
}
