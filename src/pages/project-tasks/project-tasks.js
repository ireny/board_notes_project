import './project-tasks.css';
import template from './project-tasks.html?raw';
import { Modal } from 'bootstrap';
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
  let pointerX = 0;
  let pointerY = 0;
  let activeStageBody = null;
  let autoScrollRaf = null;

  const stopAutoScroll = () => {
    if (autoScrollRaf) {
      cancelAnimationFrame(autoScrollRaf);
      autoScrollRaf = null;
    }
  };

  const runAutoScroll = () => {
    if (!draggedTask) {
      stopAutoScroll();
      return;
    }

    const boardRect = boardEl.getBoundingClientRect();
    const boardEdgeThreshold = 52;
    const boardScrollStep = 14;

    if (pointerX < boardRect.left + boardEdgeThreshold) {
      boardEl.scrollLeft -= boardScrollStep;
    } else if (pointerX > boardRect.right - boardEdgeThreshold) {
      boardEl.scrollLeft += boardScrollStep;
    }

    if (activeStageBody) {
      const bodyRect = activeStageBody.getBoundingClientRect();
      const bodyEdgeThreshold = 44;
      const bodyScrollStep = 12;

      if (pointerY < bodyRect.top + bodyEdgeThreshold) {
        activeStageBody.scrollTop -= bodyScrollStep;
      } else if (pointerY > bodyRect.bottom - bodyEdgeThreshold) {
        activeStageBody.scrollTop += bodyScrollStep;
      }
    }

    autoScrollRaf = requestAnimationFrame(runAutoScroll);
  };

  const startAutoScroll = () => {
    if (autoScrollRaf) return;
    autoScrollRaf = requestAnimationFrame(runAutoScroll);
  };

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
      startAutoScroll();
    });

    taskCard.addEventListener('dragend', async () => {
      taskCard.classList.remove('is-dragging');
      draggedTask = null;
      activeStageBody = null;
      stopAutoScroll();
      syncEmptyPlaceholders(boardEl);
      updateStageCounts(boardEl);
      await saveOrderIfChanged();
    });
  });

  stageBodies.forEach((stageBody) => {
    stageBody.addEventListener('dragover', (event) => {
      if (!draggedTask || isSaving) return;

      event.preventDefault();
      pointerX = event.clientX;
      pointerY = event.clientY;
      activeStageBody = stageBody;
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
                const titleEscaped = escapeHtml(task.title);
                const descEscaped = escapeHtml(task.description_html || '');
                return `
                  <article
                    class="page-project-tasks__task"
                    data-task-id="${task.id}"
                    data-task-title="${titleEscaped}"
                    data-task-desc="${descEscaped}"
                    data-task-done="${task.done ? '1' : '0'}"
                    data-stage-id="${task.stage_id}"
                    draggable="true"
                  >
                    <div class="page-project-tasks__task-actions">
                      <button
                        type="button"
                        class="page-project-tasks__task-action-btn is-edit"
                        data-action="edit-task"
                        data-task-id="${task.id}"
                        title="Edit task"
                      >&#9998;</button>
                      <button
                        type="button"
                        class="page-project-tasks__task-action-btn is-delete"
                        data-action="delete-task"
                        data-task-id="${task.id}"
                        data-task-title="${titleEscaped}"
                        title="Delete task"
                      >&#128465;</button>
                    </div>
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
          <div class="px-2 pb-2">
            <button
              type="button"
              class="page-project-tasks__create-btn"
              data-action="create-task"
              data-stage-id="${stage.id}"
            >
              <span style="font-size:1rem;line-height:1">+</span> Create New Task
            </button>
          </div>
        </section>
      `;
    })
    .join('');
}

async function createTask(projectId, stageId, title, descriptionHtml, done) {
  const supabase = getSupabaseClient();

  const { data: existingTasks } = await supabase
    .from('tasks')
    .select('order_position')
    .eq('project_id', projectId)
    .eq('stage_id', stageId)
    .order('order_position', { ascending: false })
    .limit(1);

  const maxPos = existingTasks && existingTasks.length > 0 ? (existingTasks[0].order_position ?? 0) : 0;

  const { error } = await supabase.from('tasks').insert({
    project_id: projectId,
    stage_id: stageId,
    title,
    description_html: descriptionHtml || null,
    done: done ?? false,
    order_position: maxPos + 1
  });

  if (error) throw error;
}

async function updateTask(taskId, projectId, title, descriptionHtml, done) {
  const supabase = getSupabaseClient();

  const { error } = await supabase
    .from('tasks')
    .update({ title, description_html: descriptionHtml || null, done: done ?? false })
    .eq('id', taskId)
    .eq('project_id', projectId);

  if (error) throw error;
}

async function deleteTask(taskId, projectId) {
  const supabase = getSupabaseClient();

  const { error } = await supabase
    .from('tasks')
    .delete()
    .eq('id', taskId)
    .eq('project_id', projectId);

  if (error) throw error;
}

async function refreshBoard(projectId, boardEl, titleEl, descriptionEl, content, authAlert) {
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

export async function onMountProjectTasksPage(projectId) {
  const authAlert = document.querySelector('#project-tasks-auth-alert');
  const content = document.querySelector('#project-tasks-content');
  const titleEl = document.querySelector('#project-tasks-title');
  const descriptionEl = document.querySelector('#project-tasks-description');
  const boardEl = document.querySelector('#project-tasks-board');
  const usersLink = document.querySelector('#project-tasks-users-link');

  if (!authAlert || !content || !titleEl || !descriptionEl || !boardEl || !usersLink) {
    return;
  }

  usersLink.setAttribute('href', `/projects/${projectId}/users`);

  // Modal instances
  const taskFormModalEl = document.querySelector('#taskFormModal');
  const deleteTaskModalEl = document.querySelector('#deleteTaskModal');

  if (!taskFormModalEl || !deleteTaskModalEl) {
    return;
  }

  const taskFormModal = Modal.getOrCreateInstance(taskFormModalEl);
  const deleteTaskModal = Modal.getOrCreateInstance(deleteTaskModalEl);

  // Form elements
  const taskForm = document.querySelector('#task-form');
  const taskFormTaskIdInput = document.querySelector('#task-form-task-id');
  const taskFormStageIdInput = document.querySelector('#task-form-stage-id');
  const taskFormTitle = document.querySelector('#task-form-title');
  const taskFormDescription = document.querySelector('#task-form-description');
  const taskFormDone = document.querySelector('#task-form-done');
  const taskFormSubmitBtn = document.querySelector('#task-form-submit');
  const taskFormModalLabel = document.querySelector('#taskFormModalLabel');

  const deleteTaskTitleDisplay = document.querySelector('#delete-task-title-display');
  const deleteTaskIdInput = document.querySelector('#delete-task-id');
  const deleteTaskConfirmBtn = document.querySelector('#delete-task-confirm-btn');

  // Wire up events only once (guard with a flag on the board element)
  if (!boardEl.dataset.crudWired) {
    boardEl.dataset.crudWired = '1';

    // Track drag state to avoid opening modal on drop
    let isDragging = false;

    function openCreateModal(stageId) {
      taskFormTaskIdInput.value = '';
      taskFormStageIdInput.value = stageId;
      taskFormTitle.value = '';
      taskFormDescription.value = '';
      taskFormDone.checked = false;
      taskFormModalLabel.textContent = 'New Task';
      taskFormSubmitBtn.textContent = 'Create Task';
      taskFormSubmitBtn.disabled = false;
      taskForm.classList.remove('was-validated');
      taskFormModal.show();
    }

    function openEditModal(taskEl) {
      const taskId = taskEl.getAttribute('data-task-id');
      const stageId = taskEl.getAttribute('data-stage-id');
      const rawTitle = taskEl.getAttribute('data-task-title') || '';
      const rawDesc = taskEl.getAttribute('data-task-desc') || '';
      const done = taskEl.getAttribute('data-task-done') === '1';

      taskFormTaskIdInput.value = taskId;
      taskFormStageIdInput.value = stageId;
      taskFormTitle.value = rawTitle;
      taskFormDescription.value = stripHtml(rawDesc);
      taskFormDone.checked = done;
      taskFormModalLabel.textContent = 'Edit Task';
      taskFormSubmitBtn.textContent = 'Save Changes';
      taskFormSubmitBtn.disabled = false;
      taskForm.classList.remove('was-validated');
      taskFormModal.show();
    }

    function openDeleteModal(taskId, taskTitle) {
      deleteTaskIdInput.value = taskId;
      deleteTaskTitleDisplay.textContent = taskTitle;
      deleteTaskConfirmBtn.disabled = false;
      deleteTaskConfirmBtn.textContent = 'Delete';
      deleteTaskModal.show();
    }

    // Delegated click on the wrapper section (not boardEl, which gets replaced on refresh)
    const pageSection = document.querySelector('.page-project-tasks');
    pageSection.addEventListener('click', (event) => {
      if (isDragging) return;

      const editBtn = event.target.closest('[data-action="edit-task"]');
      const deleteBtn = event.target.closest('[data-action="delete-task"]');
      const createBtn = event.target.closest('[data-action="create-task"]');
      const taskCard = event.target.closest('.page-project-tasks__task[data-task-id]');

      if (editBtn) {
        event.stopPropagation();
        const taskEl = editBtn.closest('.page-project-tasks__task[data-task-id]');
        if (taskEl) openEditModal(taskEl);
        return;
      }

      if (deleteBtn) {
        event.stopPropagation();
        const taskId = deleteBtn.getAttribute('data-task-id');
        const taskTitle = deleteBtn.getAttribute('data-task-title') || 'this task';
        openDeleteModal(taskId, taskTitle);
        return;
      }

      if (createBtn) {
        const stageId = createBtn.getAttribute('data-stage-id');
        openCreateModal(stageId);
        return;
      }

      // Clicking the card body (not action buttons) opens edit
      if (taskCard && !editBtn && !deleteBtn) {
        openEditModal(taskCard);
      }
    });

    // Track drag state via event delegation on the section too
    pageSection.addEventListener('dragstart', () => { isDragging = true; });
    pageSection.addEventListener('dragend', () => {
      // Small delay so click event fired after dragend sees the flag still set
      setTimeout(() => { isDragging = false; }, 150);
    });

    // Form submit (create or update)
    taskForm.addEventListener('submit', async (event) => {
      event.preventDefault();
      event.stopPropagation();

      taskForm.classList.add('was-validated');
      if (!taskForm.checkValidity()) return;

      const taskId = taskFormTaskIdInput.value.trim();
      const stageId = taskFormStageIdInput.value.trim();
      const title = taskFormTitle.value.trim();
      const description = taskFormDescription.value.trim();
      const done = taskFormDone.checked;

      taskFormSubmitBtn.disabled = true;
      taskFormSubmitBtn.textContent = 'Saving…';

      try {
        if (taskId) {
          await updateTask(taskId, projectId, title, description, done);
        } else {
          await createTask(projectId, stageId, title, description, done);
        }
        taskFormModal.hide();
        await refreshBoard(projectId, boardEl, titleEl, descriptionEl, content, authAlert);
      } catch (error) {
        alert(`Failed to save task: ${error.message}`);
        taskFormSubmitBtn.disabled = false;
        taskFormSubmitBtn.textContent = taskId ? 'Save Changes' : 'Create Task';
      }
    });

    // Delete confirm
    deleteTaskConfirmBtn.addEventListener('click', async () => {
      const taskId = deleteTaskIdInput.value.trim();
      if (!taskId) return;

      deleteTaskConfirmBtn.disabled = true;
      deleteTaskConfirmBtn.textContent = 'Deleting…';

      try {
        await deleteTask(taskId, projectId);
        deleteTaskModal.hide();
        await refreshBoard(projectId, boardEl, titleEl, descriptionEl, content, authAlert);
      } catch (error) {
        alert(`Failed to delete task: ${error.message}`);
        deleteTaskConfirmBtn.disabled = false;
        deleteTaskConfirmBtn.textContent = 'Delete';
      }
    });
  }

  await refreshBoard(projectId, boardEl, titleEl, descriptionEl, content, authAlert);
}
