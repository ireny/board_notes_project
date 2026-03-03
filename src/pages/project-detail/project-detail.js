import './project-detail.css';
import template from './project-detail.html?raw';
import { getSupabaseClient, hasSupabaseCredentials } from '../../lib/supabase-client.js';

export function renderProjectDetailPage() {
  return template;
}

async function loadProjectData(projectId) {
  if (!hasSupabaseCredentials()) {
    return { user: null, project: null };
  }

  const supabase = getSupabaseClient();
  const { data: sessionData } = await supabase.auth.getSession();

  if (!sessionData.session) {
    return { user: null, project: null };
  }

  const { data: project } = await supabase
    .from('projects')
    .select('id, title, description')
    .eq('id', projectId)
    .single();

  return {
    user: sessionData.session.user,
    project
  };
}

export async function onMountProjectDetailPage(projectId) {
  const authAlert = document.querySelector('#project-auth-alert');
  const projectContent = document.querySelector('#project-content');
  const titleEl = document.querySelector('#project-title');
  const descriptionEl = document.querySelector('#project-description');

  if (!authAlert || !projectContent || !titleEl || !descriptionEl) {
    return;
  }

  const data = await loadProjectData(projectId);

  if (!data.user) {
    authAlert.classList.remove('d-none');
    return;
  }

  if (!data.project) {
    titleEl.textContent = 'Project not found';
    descriptionEl.textContent = '';
    projectContent.classList.remove('d-none');
    return;
  }

  titleEl.textContent = data.project.title;
  descriptionEl.textContent = data.project.description || '';
  projectContent.classList.remove('d-none');
}
