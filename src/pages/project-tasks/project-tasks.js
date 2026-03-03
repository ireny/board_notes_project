import './project-tasks.css';
import template from './project-tasks.html?raw';
import { getSupabaseClient, hasSupabaseCredentials } from '../../lib/supabase-client.js';

export function renderProjectTasksPage() {
  return template;
}

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

function stripHtml(value) {
  if (!value) return '';
  const div = document.createElement('div');
  div.innerHTML = value;
  return div.textContent || div.innerText || '';
}

function truncate(text, maxLength = 120) {
  if (!text) return '';
  if (text.length <= maxLength) return text;
  return `${text.slice(0, maxLength - 1)}…`;
}

async function loadProjectTasksData(projectId) {
  if (!hasSupabaseCredentials()) {
    return { user: null, project: null, stages: [], tasks: [] };
  }

  const supabase = getSupabaseClient();
  const { data: sessionData } = await supabase.auth.getSession();

  if (!sessionData.session) {
    return { user: null, project: null, stages: [], tasks: [] };
  }

  const [{ data: project, error: projectError }, { data: stages, error: stagesError }, { data: tasks, error: tasksError }] =
    await Promise.all([
      supabase.from('projects').select('id, title, description').eq('id', projectId).single(),
      supabase.from('project_stages').select('id, title, position').eq('project_id', projectId).order('position', { ascending: true }),
      supabase
        .from('tasks')
        .select('id, title, description_html, stage_id, order_position, done')
        .eq('project_id', projectId)
        .order('order_position', { ascending: true })
    ]);

  if (projectError) {
    throw projectError;
  }

  if (stagesError) {
    throw stagesError;
  }

  if (tasksError) {
    throw tasksError;
  }

  return {
    user: sessionData.session.user,
    project: project ?? null,
    stages: stages ?? [],
    tasks: tasks ?? []
  };
}

function renderBoard(stages, tasks) {
  if (stages.length === 0) {
    return '<div class="page-project-tasks__stage-empty">No stages in this project yet.</div>';
  }

  const tasksByStageId = new Map(stages.map((stage) => [stage.id, []]));

  tasks.forEach((task) => {
    if (!tasksByStageId.has(task.stage_id)) return;
    tasksByStageId.get(task.stage_id).push(task);
  });

  stages.forEach((stage) => {
    const list = tasksByStageId.get(stage.id);
    list.sort((a, b) => (a.order_position ?? 0) - (b.order_position ?? 0));
  });

  return stages
    .map((stage) => {
      const stageTasks = tasksByStageId.get(stage.id) ?? [];
      const stageCards =
        stageTasks.length > 0
          ? stageTasks
              .map((task) => {
                const text = truncate(stripHtml(task.description_html));
                return `
                  <article class="page-project-tasks__task">
                    <h3 class="page-project-tasks__task-title">${escapeHtml(task.title)}</h3>
                    ${text ? `<p class="page-project-tasks__task-desc">${escapeHtml(text)}</p>` : ''}
                    <div class="page-project-tasks__task-meta">${task.done ? 'Done' : 'Open'}</div>
                  </article>
                `;
              })
              .join('')
          : '<div class="page-project-tasks__task-empty">No tasks in this stage</div>';

      return `
        <section class="page-project-tasks__stage">
          <header class="page-project-tasks__stage-head">
            <h2 class="page-project-tasks__stage-title">${escapeHtml(stage.title)}</h2>
            <div class="page-project-tasks__stage-count">${stageTasks.length} task${stageTasks.length === 1 ? '' : 's'}</div>
          </header>
          <div class="page-project-tasks__stage-body">
            ${stageCards}
          </div>
        </section>
      `;
    })
    .join('');
}

export async function onMountProjectTasksPage(projectId) {
  const authAlert = document.querySelector('#project-tasks-auth-alert');
  const content = document.querySelector('#project-tasks-content');
  const titleEl = document.querySelector('#project-tasks-title');
  const descriptionEl = document.querySelector('#project-tasks-description');
  const boardEl = document.querySelector('#project-tasks-board');

  if (!authAlert || !content || !titleEl || !descriptionEl || !boardEl) {
    return;
  }

  try {
    const data = await loadProjectTasksData(projectId);

    if (!data.user) {
      authAlert.classList.remove('d-none');
      return;
    }

    if (!data.project) {
      titleEl.textContent = 'Project not found';
      descriptionEl.textContent = '';
      boardEl.innerHTML = '<div class="page-project-tasks__stage-empty">This project does not exist or you do not have access.</div>';
      content.classList.remove('d-none');
      return;
    }

    titleEl.textContent = data.project.title;
    descriptionEl.textContent = data.project.description || 'Tasks by stage';
    boardEl.innerHTML = renderBoard(data.stages, data.tasks);
    content.classList.remove('d-none');
  } catch (error) {
    titleEl.textContent = 'Unable to load tasks';
    descriptionEl.textContent = '';
    boardEl.innerHTML = `<div class="page-project-tasks__stage-empty">${escapeHtml(error.message || 'An unexpected error occurred.')}</div>`;
    content.classList.remove('d-none');
  }
}
