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

function buildTaskStateMap(tasks) {
  return new Map(
    tasks.map((task) => [task.id, { stageId: task.stage_id, orderPosition: task.order_position ?? 0 }])
  );
}

function collectBoardOrder(boardEl) {
  const ordered = [];
  const stageBodies = boardEl.querySelectorAll('.page-project-tasks__stage-body[data-stage-id]');

  stageBodies.forEach((stageBody) => {
    const stageId = stageBody.getAttribute('data-stage-id');
    const cards = stageBody.querySelectorAll('.page-project-tasks__task[data-task-id]');

    cards.forEach((card, index) => {
      const taskId = card.getAttribute('data-task-id');
      ordered.push({ id: taskId, stageId, orderPosition: index + 1 });
    });
  });

  return ordered;
}

function getChangedTasks(orderedTasks, stateMap) {
  return orderedTasks.filter((task) => {
    const current = stateMap.get(task.id);
    if (!current) return false;
    return current.stageId !== task.stageId || current.orderPosition !== task.orderPosition;
  });
}

function updateStateMap(stateMap, changes) {
  changes.forEach((task) => {
    stateMap.set(task.id, { stageId: task.stageId, orderPosition: task.orderPosition });
  });
}

function updateStageCounts(boardEl) {
  const stages = boardEl.querySelectorAll('.page-project-tasks__stage');

  stages.forEach((stageEl) => {
    const stageBody = stageEl.querySelector('.page-project-tasks__stage-body');
    const countEl = stageEl.querySelector('.page-project-tasks__stage-count');
    if (!stageBody || !countEl) return;

    const count = stageBody.querySelectorAll('.page-project-tasks__task[data-task-id]').length;
    countEl.textContent = `${count} task${count === 1 ? '' : 's'}`;
  });
}

function syncEmptyPlaceholders(boardEl) {
  const stageBodies = boardEl.querySelectorAll('.page-project-tasks__stage-body');

  stageBodies.forEach((stageBody) => {
    const hasTasks = stageBody.querySelectorAll('.page-project-tasks__task[data-task-id]').length > 0;
    let placeholder = stageBody.querySelector('.page-project-tasks__task-empty');

    if (hasTasks) {
      if (placeholder) {
        placeholder.remove();
      }
      return;
    }

    if (!placeholder) {
      placeholder = document.createElement('div');
      placeholder.className = 'page-project-tasks__task-empty';
      placeholder.textContent = 'No tasks in this stage';
      stageBody.appendChild(placeholder);
    }
  });
}

function getDragAfterElement(container, mouseY) {
  const draggableElements = [...container.querySelectorAll('.page-project-tasks__task:not(.is-dragging)')];

  return draggableElements.reduce(
    (closest, child) => {
      const box = child.getBoundingClientRect();
      const offset = mouseY - box.top - box.height / 2;

      if (offset < 0 && offset > closest.offset) {
        return { offset, element: child };
      }

      return closest;
    },
    { offset: Number.NEGATIVE_INFINITY, element: null }
  ).element;
}

async function persistTaskMoves(projectId, changes) {
  if (changes.length === 0) {
    return;
  }

  const supabase = getSupabaseClient();

  const temporaryChanges = changes.map((task, index) => ({
    ...task,
    tempOrderPosition: -1 * (index + 1)
  }));

  const tempUpdates = await Promise.all(
    temporaryChanges.map((task) =>
      supabase
        .from('tasks')
        .update({ order_position: task.tempOrderPosition })
        .eq('id', task.id)
        .eq('project_id', projectId)
    )
  );

  const tempError = tempUpdates.find((result) => result.error)?.error;
  if (tempError) {
    throw tempError;
  }

  const finalUpdates = await Promise.all(
    changes.map((task) =>
      supabase
        .from('tasks')
        .update({ stage_id: task.stageId, order_position: task.orderPosition })
        .eq('id', task.id)
        .eq('project_id', projectId)
    )
  );

  const finalError = finalUpdates.find((result) => result.error)?.error;
  if (finalError) {
    throw finalError;
  }
}

function enableTaskDragging(boardEl, projectId, taskStateMap) {
  const stageBodies = boardEl.querySelectorAll('.page-project-tasks__stage-body[data-stage-id]');
  const taskCards = boardEl.querySelectorAll('.page-project-tasks__task[data-task-id]');

  let draggedTask = null;
  let isSaving = false;

  const setDraggingEnabled = (enabled) => {
    taskCards.forEach((task) => {
      task.draggable = enabled;
    });
  };

  setDraggingEnabled(true);

  const saveOrderIfChanged = async () => {
    const ordered = collectBoardOrder(boardEl);
    const changedTasks = getChangedTasks(ordered, taskStateMap);

    if (changedTasks.length === 0) {
      return;
    }

    isSaving = true;
    boardEl.classList.add('is-saving');
    setDraggingEnabled(false);

    try {
      await persistTaskMoves(projectId, changedTasks);
      updateStateMap(taskStateMap, changedTasks);
    } catch (error) {
      await onMountProjectTasksPage(projectId);
      alert(`Failed to move task: ${error.message}`);
      return;
    } finally {
      isSaving = false;
      boardEl.classList.remove('is-saving');
      setDraggingEnabled(true);
    }
  };

  taskCards.forEach((taskCard) => {
    taskCard.addEventListener('dragstart', (event) => {
      if (isSaving) {
        event.preventDefault();
        return;
      }

      draggedTask = taskCard;
      taskCard.classList.add('is-dragging');
      event.dataTransfer.effectAllowed = 'move';
    });

    taskCard.addEventListener('dragend', async () => {
      taskCard.classList.remove('is-dragging');
      draggedTask = null;
      syncEmptyPlaceholders(boardEl);
      updateStageCounts(boardEl);
      await saveOrderIfChanged();
    });
  });

  stageBodies.forEach((stageBody) => {
    stageBody.addEventListener('dragover', (event) => {
      if (!draggedTask || isSaving) return;

      event.preventDefault();
      stageBody.classList.add('is-drop-target');

      const afterElement = getDragAfterElement(stageBody, event.clientY);
      if (!afterElement) {
        stageBody.appendChild(draggedTask);
      } else {
        stageBody.insertBefore(draggedTask, afterElement);
      }

      syncEmptyPlaceholders(boardEl);
      updateStageCounts(boardEl);
    });

    stageBody.addEventListener('dragleave', () => {
      stageBody.classList.remove('is-drop-target');
    });

    stageBody.addEventListener('drop', () => {
      stageBody.classList.remove('is-drop-target');
    });
  });
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
                  <article class="page-project-tasks__task" data-task-id="${task.id}" draggable="true">
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
          <div class="page-project-tasks__stage-body" data-stage-id="${stage.id}">
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
    enableTaskDragging(boardEl, projectId, buildTaskStateMap(data.tasks));
    content.classList.remove('d-none');
  } catch (error) {
    titleEl.textContent = 'Unable to load tasks';
    descriptionEl.textContent = '';
    boardEl.innerHTML = `<div class="page-project-tasks__stage-empty">${escapeHtml(error.message || 'An unexpected error occurred.')}</div>`;
    content.classList.remove('d-none');
  }
}
