import './project-form.css';
import template from './project-form.html?raw';
import {
  getAuthenticatedSupabaseClient,
  getSupabaseClient,
  hasSupabaseCredentials
} from '../../lib/supabase-client.js';
import { navigateTo } from '../../app.js';

export function renderProjectFormPage() {
  return template;
}

async function checkAuth() {
  if (!hasSupabaseCredentials()) {
    return null;
  }

  const supabase = getSupabaseClient();
  const { data: userData, error: userError } = await supabase.auth.getUser();

  if (userError) {
    return null;
  }

  return userData.user ?? null;
}

async function loadProject(projectId) {
  const supabase = await getAuthenticatedSupabaseClient();
  const { data: project } = await supabase
    .from('projects')
    .select('id, title, description')
    .eq('id', projectId)
    .single();

  return project;
}

async function createProject(title, description) {
  const supabase = await getAuthenticatedSupabaseClient();

  const user = await checkAuth();
  if (!user) {
    throw new Error('Not authenticated');
  }

  const { data, error } = await supabase.rpc('create_project', {
    project_title: title,
    project_description: description || null
  });

  if (error) {
    throw error;
  }

  return data;
}

async function updateProject(projectId, title, description) {
  const supabase = await getAuthenticatedSupabaseClient();

  const { data, error } = await supabase
    .from('projects')
    .update({
      title,
      description: description || null
    })
    .eq('id', projectId)
    .select()
    .single();

  if (error) {
    throw error;
  }

  return data;
}

function setFeedback(message, status) {
  const feedback = document.querySelector('#form-feedback');

  if (!feedback) {
    return;
  }

  feedback.className = 'alert';
  feedback.classList.add(status === 'error' ? 'alert-danger' : 'alert-success');
  feedback.classList.remove('d-none');
  feedback.textContent = message;
}

export async function onMountProjectFormPage(mode, projectId = null) {
  const authAlert = document.querySelector('#form-auth-alert');
  const formContent = document.querySelector('#form-content');
  const form = document.querySelector('#project-form');
  const submitButton = document.querySelector('#form-submit');
  const heading = document.querySelector('#form-heading');
  const titleInput = document.querySelector('#project-title');
  const descriptionInput = document.querySelector('#project-description');

  if (!authAlert || !formContent || !form || !submitButton || !heading) {
    return;
  }

  const user = await checkAuth();

  if (!user) {
    authAlert.classList.remove('d-none');
    return;
  }

  formContent.classList.remove('d-none');

  // Configure for edit mode
  if (mode === 'edit' && projectId) {
    heading.textContent = 'Edit Project';
    submitButton.textContent = 'Save Changes';

    const project = await loadProject(projectId);
    if (!project) {
      setFeedback('Project not found', 'error');
      return;
    }

    titleInput.value = project.title;
    descriptionInput.value = project.description || '';
  }

  form.addEventListener('submit', async (e) => {
    e.preventDefault();

    const title = titleInput.value.trim();
    const description = descriptionInput.value.trim();

    if (!title) {
      setFeedback('Please enter a project title.', 'error');
      return;
    }

    submitButton.disabled = true;
    const originalText = submitButton.textContent;
    submitButton.textContent = mode === 'edit' ? 'Saving...' : 'Creating...';

    try {
      if (mode === 'edit' && projectId) {
        await updateProject(projectId, title, description);
        navigateTo(`/projects/${projectId}`);
      } else {
        const newProject = await createProject(title, description);
        navigateTo(`/projects/${newProject.id}`);
      }
    } catch (error) {
      if ((error.message ?? '').toLowerCase().includes('row-level security policy')) {
        setFeedback('Your session appears expired. Please login again and try creating the project.', 'error');
      } else {
        setFeedback(error.message ?? 'Failed to save project.', 'error');
      }
      submitButton.disabled = false;
      submitButton.textContent = originalText;
    }
  });
}
