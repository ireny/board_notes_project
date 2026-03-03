import './task-editor.css';
import template from './task-editor.html?raw';
import { Modal } from 'bootstrap';
import { getSupabaseClient } from '../../lib/supabase-client.js';

const TASK_ATTACHMENTS_BUCKET = 'task-attachments';

export function renderTaskEditor() {
  return template;
}

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text ?? '';
  return div.innerHTML;
}

function formatFileSize(bytes) {
  if (!Number.isFinite(bytes) || bytes < 0) return '0 B';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`;
}

function sanitizeFileName(name) {
  const fallback = 'file';
  const normalized = (name || fallback).trim();
  return normalized.replace(/[^a-zA-Z0-9._-]+/g, '_');
}

function isImageAttachment(attachment) {
  return (attachment.mime_type || '').toLowerCase().startsWith('image/');
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

async function listTaskAttachments(projectId, taskId) {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from('task_attachments')
    .select('id, file_name, file_size, mime_type, bucket_path, created_at')
    .eq('project_id', projectId)
    .eq('task_id', taskId)
    .order('created_at', { ascending: false });

  if (error) throw error;
  return data ?? [];
}

async function uploadTaskAttachments(projectId, taskId, files) {
  const supabase = getSupabaseClient();

  for (const file of files) {
    const uniqueName = `${Date.now()}-${crypto.randomUUID()}-${sanitizeFileName(file.name)}`;
    const bucketPath = `${projectId}/${taskId}/${uniqueName}`;

    const uploadResult = await supabase.storage.from(TASK_ATTACHMENTS_BUCKET).upload(bucketPath, file, {
      upsert: false,
      contentType: file.type || undefined
    });

    if (uploadResult.error) {
      throw uploadResult.error;
    }

    const { error: insertError } = await supabase.from('task_attachments').insert({
      project_id: projectId,
      task_id: taskId,
      file_name: file.name,
      mime_type: file.type || null,
      file_size: file.size,
      bucket_path: bucketPath
    });

    if (insertError) {
      await supabase.storage.from(TASK_ATTACHMENTS_BUCKET).remove([bucketPath]);
      throw insertError;
    }
  }
}

async function getSignedUrl(bucketPath, expiresIn = 600) {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase.storage.from(TASK_ATTACHMENTS_BUCKET).createSignedUrl(bucketPath, expiresIn);
  if (error) throw error;
  return data.signedUrl;
}

async function deleteAttachmentRecord(attachmentId, bucketPath) {
  const supabase = getSupabaseClient();

  const { error: storageError } = await supabase.storage.from(TASK_ATTACHMENTS_BUCKET).remove([bucketPath]);
  if (storageError) throw storageError;

  const { error: dbError } = await supabase.from('task_attachments').delete().eq('id', attachmentId);
  if (dbError) throw dbError;
}

export function mountTaskEditor({ projectId, onSaved }) {
  const taskFormModalEl = document.querySelector('#taskFormModal');
  if (!taskFormModalEl) return null;

  const taskFormModal = Modal.getOrCreateInstance(taskFormModalEl);
  const taskForm = document.querySelector('#task-form');
  const taskFormTaskIdInput = document.querySelector('#task-form-task-id');
  const taskFormStageIdInput = document.querySelector('#task-form-stage-id');
  const taskFormTitle = document.querySelector('#task-form-title');
  const taskFormDescription = document.querySelector('#task-form-description');
  const taskFormDone = document.querySelector('#task-form-done');
  const taskFormSubmitBtn = document.querySelector('#task-form-submit');
  const taskFormModalLabel = document.querySelector('#taskFormModalLabel');
  const attachmentsInput = document.querySelector('#task-attachments-input');
  const attachmentsUploadBtn = document.querySelector('#task-attachments-upload-btn');
  const attachmentsStatus = document.querySelector('#task-attachments-status');
  const attachmentsList = document.querySelector('#task-attachments-list');

  if (!taskForm || !taskFormTaskIdInput || !taskFormStageIdInput || !taskFormTitle || !taskFormDescription || !taskFormDone || !taskFormSubmitBtn || !taskFormModalLabel || !attachmentsInput || !attachmentsUploadBtn || !attachmentsStatus || !attachmentsList) {
    return null;
  }

  const setAttachmentsEnabled = (enabled) => {
    attachmentsInput.disabled = !enabled;
    attachmentsUploadBtn.disabled = !enabled;
    if (!enabled) {
      attachmentsStatus.textContent = 'Save task first to enable attachments.';
    }
  };

  const renderAttachments = (attachments) => {
    if (attachments.length === 0) {
      attachmentsList.innerHTML = '<li class="list-group-item small text-secondary">No attachments yet.</li>';
      return;
    }

    attachmentsList.innerHTML = attachments
      .map((attachment) => {
        const preview = attachment.previewUrl
          ? `<img src="${escapeHtml(attachment.previewUrl)}" class="task-editor__attachment-preview" alt="${escapeHtml(attachment.file_name)}">`
          : '<div class="task-editor__attachment-preview-placeholder">FILE</div>';

        return `
          <li class="list-group-item task-editor__attachment-item">
            <div class="task-editor__attachment-main">
              ${preview}
              <div class="task-editor__attachment-text">
                <div class="task-editor__attachment-name" title="${escapeHtml(attachment.file_name)}">${escapeHtml(attachment.file_name)}</div>
                <div class="task-editor__attachment-meta">${formatFileSize(attachment.file_size)}${attachment.mime_type ? ` • ${escapeHtml(attachment.mime_type)}` : ''}</div>
              </div>
            </div>
            <div class="task-editor__attachment-actions">
              <button
                type="button"
                class="btn btn-sm btn-outline-secondary"
                data-action="open-attachment"
                data-attachment-url="${escapeHtml(attachment.previewUrl || '')}"
                data-attachment-path="${escapeHtml(attachment.bucket_path)}"
              >Open</button>
              <button
                type="button"
                class="btn btn-sm btn-outline-danger"
                data-action="delete-attachment"
                data-attachment-id="${attachment.id}"
                data-attachment-path="${escapeHtml(attachment.bucket_path)}"
              >Delete</button>
            </div>
          </li>
        `;
      })
      .join('');
  };

  const refreshAttachments = async () => {
    const taskId = taskFormTaskIdInput.value.trim();
    if (!taskId) {
      setAttachmentsEnabled(false);
      attachmentsList.innerHTML = '';
      return;
    }

    setAttachmentsEnabled(true);
    attachmentsStatus.textContent = 'Loading attachments…';

    try {
      const attachments = await listTaskAttachments(projectId, taskId);
      const withPreviews = await Promise.all(
        attachments.map(async (attachment) => {
          if (!isImageAttachment(attachment)) {
            return { ...attachment, previewUrl: '' };
          }

          try {
            const signedPreviewUrl = await getSignedUrl(attachment.bucket_path, 3600);
            return { ...attachment, previewUrl: signedPreviewUrl };
          } catch {
            return { ...attachment, previewUrl: '' };
          }
        })
      );

      renderAttachments(withPreviews);
      attachmentsStatus.textContent = 'Upload files or images to attach to this task.';
    } catch (error) {
      attachmentsStatus.textContent = `Failed to load attachments: ${error.message}`;
      attachmentsList.innerHTML = '';
    }
  };

  const openCreate = (stageId) => {
    taskFormTaskIdInput.value = '';
    taskFormStageIdInput.value = stageId;
    taskFormTitle.value = '';
    taskFormDescription.value = '';
    taskFormDone.checked = false;
    taskFormModalLabel.textContent = 'New Task';
    taskFormSubmitBtn.textContent = 'Create Task';
    taskFormSubmitBtn.disabled = false;
    taskForm.classList.remove('was-validated');
    attachmentsInput.value = '';
    setAttachmentsEnabled(false);
    attachmentsList.innerHTML = '';
    taskFormModal.show();
  };

  const openEdit = async ({ id, stageId, title, description, done }) => {
    taskFormTaskIdInput.value = id;
    taskFormStageIdInput.value = stageId;
    taskFormTitle.value = title || '';
    taskFormDescription.value = description || '';
    taskFormDone.checked = Boolean(done);
    taskFormModalLabel.textContent = 'Edit Task';
    taskFormSubmitBtn.textContent = 'Save Changes';
    taskFormSubmitBtn.disabled = false;
    taskForm.classList.remove('was-validated');
    taskFormModal.show();
    await refreshAttachments();
  };

  if (!taskForm.dataset.wired) {
    taskForm.dataset.wired = '1';

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
        if (typeof onSaved === 'function') {
          await onSaved();
        }
      } catch (error) {
        alert(`Failed to save task: ${error.message}`);
        taskFormSubmitBtn.disabled = false;
        taskFormSubmitBtn.textContent = taskId ? 'Save Changes' : 'Create Task';
      }
    });

    attachmentsUploadBtn.addEventListener('click', async () => {
      const taskId = taskFormTaskIdInput.value.trim();
      if (!taskId) return;

      const files = [...attachmentsInput.files];
      if (files.length === 0) {
        attachmentsStatus.textContent = 'Choose one or more files to upload.';
        return;
      }

      attachmentsUploadBtn.disabled = true;
      attachmentsUploadBtn.textContent = 'Uploading…';
      attachmentsStatus.textContent = `Uploading ${files.length} file${files.length === 1 ? '' : 's'}…`;

      try {
        await uploadTaskAttachments(projectId, taskId, files);
        attachmentsInput.value = '';
        attachmentsStatus.textContent = 'Upload complete.';
        await refreshAttachments();
      } catch (error) {
        attachmentsStatus.textContent = `Upload failed: ${error.message}`;
      } finally {
        attachmentsUploadBtn.disabled = false;
        attachmentsUploadBtn.textContent = 'Upload';
      }
    });

    attachmentsList.addEventListener('click', async (event) => {
      const openBtn = event.target.closest('[data-action="open-attachment"]');
      const deleteBtn = event.target.closest('[data-action="delete-attachment"]');

      if (openBtn) {
        const existingUrl = openBtn.getAttribute('data-attachment-url');
        const attachmentPath = openBtn.getAttribute('data-attachment-path');
        if (!attachmentPath) return;

        try {
          const url = existingUrl || (await getSignedUrl(attachmentPath, 600));
          window.open(url, '_blank', 'noopener,noreferrer');
        } catch (error) {
          attachmentsStatus.textContent = `Failed to open attachment: ${error.message}`;
        }

        return;
      }

      if (deleteBtn) {
        const attachmentId = deleteBtn.getAttribute('data-attachment-id');
        const attachmentPath = deleteBtn.getAttribute('data-attachment-path');
        if (!attachmentId || !attachmentPath) return;

        const confirmed = window.confirm('Delete this attachment?');
        if (!confirmed) return;

        try {
          await deleteAttachmentRecord(attachmentId, attachmentPath);
          attachmentsStatus.textContent = 'Attachment deleted.';
          await refreshAttachments();
        } catch (error) {
          attachmentsStatus.textContent = `Failed to delete attachment: ${error.message}`;
        }
      }
    });
  }

  return {
    openCreate,
    openEdit
  };
}
