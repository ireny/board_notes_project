import './project-users.css';
import template from './project-users.html?raw';
import { Modal } from 'bootstrap';
import { getSupabaseClient, hasSupabaseCredentials } from '../../lib/supabase-client.js';

export function renderProjectUsersPage() {
  return template;
}

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

function formatDate(dateString) {
  const date = new Date(dateString);
  return new Intl.DateTimeFormat('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric'
  }).format(date);
}

async function fetchProjectAndSession(projectId) {
  if (!hasSupabaseCredentials()) {
    return { user: null, project: null, isOwner: false };
  }

  const supabase = getSupabaseClient();
  const { data: sessionData } = await supabase.auth.getSession();

  if (!sessionData.session) {
    return { user: null, project: null, isOwner: false };
  }

  const user = sessionData.session.user;

  const { data: project, error } = await supabase
    .from('projects')
    .select('id, title, description, owner_id')
    .eq('id', projectId)
    .single();

  if (error) {
    throw error;
  }

  return {
    user,
    project: project ?? null,
    isOwner: Boolean(project && project.owner_id === user.id)
  };
}

async function listProjectMembers(projectId) {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase.rpc('list_project_members', {
    p_project_id: projectId
  });

  if (error) {
    throw error;
  }

  return data ?? [];
}

async function listAssignableUsers(projectId, search) {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase.rpc('list_assignable_project_users', {
    p_project_id: projectId,
    p_search: search || null
  });

  if (error) {
    throw error;
  }

  return data ?? [];
}

async function addProjectUser(projectId, userId, role) {
  const supabase = getSupabaseClient();
  const { error } = await supabase.rpc('add_project_member', {
    p_project_id: projectId,
    p_user_id: userId,
    p_role: role
  });

  if (error) {
    throw error;
  }
}

async function updateProjectUserRole(projectId, userId, role) {
  const supabase = getSupabaseClient();
  const { error } = await supabase.rpc('update_project_member_role', {
    p_project_id: projectId,
    p_user_id: userId,
    p_role: role
  });

  if (error) {
    throw error;
  }
}

async function removeProjectUser(projectId, userId) {
  const supabase = getSupabaseClient();
  const { error } = await supabase.rpc('remove_project_member', {
    p_project_id: projectId,
    p_user_id: userId
  });

  if (error) {
    throw error;
  }
}

function renderMembersTable(members) {
  const tbody = document.querySelector('#project-users-table-body');
  if (!tbody) return;

  if (members.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="4" class="text-center py-4 text-secondary">No project members yet.</td>
      </tr>
    `;
    return;
  }

  tbody.innerHTML = members
    .map(
      (member) => `
      <tr>
        <td class="ps-4">${escapeHtml(member.user_email || 'Unknown')}</td>
        <td class="text-capitalize">${escapeHtml(member.role)}</td>
        <td>${formatDate(member.created_at)}</td>
        <td class="text-end pe-4">
          ${
            member.is_owner
              ? '<span class="badge text-bg-secondary">Owner</span>'
              : `
            <button type="button" class="page-project-users__action" data-action="edit" data-user-id="${member.user_id}" data-user-email="${escapeHtml(
                  member.user_email || ''
                )}" data-role="${member.role}" title="Modify">
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" viewBox="0 0 16 16">
                <path d="M12.146.146a.5.5 0 0 1 .708 0l3 3a.5.5 0 0 1 0 .708l-10 10a.5.5 0 0 1-.168.11l-5 2a.5.5 0 0 1-.65-.65l2-5a.5.5 0 0 1 .11-.168zM11.207 2.5 13.5 4.793 14.793 3.5 12.5 1.207zm1.586 3L10.5 3.207 4 9.707V10h.5a.5.5 0 0 1 .5.5v.5h.5a.5.5 0 0 1 .5.5v.5h.293zm-9.761 5.175-.106.106-1.528 3.821 3.821-1.528.106-.106A.5.5 0 0 1 5 12.5V12h-.5a.5.5 0 0 1-.5-.5V11h-.5a.5.5 0 0 1-.468-.325"/>
              </svg>
            </button>
            <button type="button" class="page-project-users__action page-project-users__action--remove" data-action="remove" data-user-id="${
              member.user_id
            }" data-user-email="${escapeHtml(member.user_email || '')}" title="Remove">
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" viewBox="0 0 16 16">
                <path d="M5.5 5.5A.5.5 0 0 1 6 6v6a.5.5 0 0 1-1 0V6a.5.5 0 0 1 .5-.5m2.5 0a.5.5 0 0 1 .5.5v6a.5.5 0 0 1-1 0V6a.5.5 0 0 1 .5-.5m3 .5a.5.5 0 0 0-1 0v6a.5.5 0 0 0 1 0z"/>
                <path d="M14.5 3a1 1 0 0 1-1 1H13v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V4h-.5a1 1 0 0 1-1-1V2a1 1 0 0 1 1-1H6a1 1 0 0 1 1-1h2a1 1 0 0 1 1 1h3.5a1 1 0 0 1 1 1zM4.118 4 4 4.059V13a1 1 0 0 0 1 1h6a1 1 0 0 0 1-1V4.059L11.882 4zM2.5 3h11V2h-11z"/>
              </svg>
            </button>
          `
          }
        </td>
      </tr>
    `
    )
    .join('');
}

export async function onMountProjectUsersPage(projectId) {
  const authAlert = document.querySelector('#project-users-auth-alert');
  const ownerAlert = document.querySelector('#project-users-owner-alert');
  const content = document.querySelector('#project-users-content');
  const addBtn = document.querySelector('#project-users-add-btn');
  const titleEl = document.querySelector('#project-users-title');
  const descriptionEl = document.querySelector('#project-users-description');
  const tbody = document.querySelector('#project-users-table-body');

  if (!authAlert || !ownerAlert || !content || !addBtn || !titleEl || !descriptionEl || !tbody) {
    return;
  }

  const addModal = new Modal(document.getElementById('addProjectUserModal'));
  const editModal = new Modal(document.getElementById('editProjectUserModal'));
  const removeModal = new Modal(document.getElementById('removeProjectUserModal'));

  const addForm = document.getElementById('add-project-user-form');
  const addSubmit = document.getElementById('add-project-user-submit');
  const userSearchInput = document.getElementById('project-user-search');
  const userSelect = document.getElementById('project-user-select');
  const roleSelect = document.getElementById('project-user-role');

  const editForm = document.getElementById('edit-project-user-form');
  const editSubmit = document.getElementById('edit-project-user-submit');
  const editUserEmail = document.getElementById('edit-project-user-email');
  const editRoleSelect = document.getElementById('edit-project-user-role');

  const removeSubmit = document.getElementById('remove-project-user-submit');
  const removeUserEmail = document.getElementById('remove-project-user-email');

  let currentMembers = [];
  let editingUserId = null;
  let removingUserId = null;

  const refreshMembers = async () => {
    currentMembers = await listProjectMembers(projectId);
    renderMembersTable(currentMembers);
  };

  const refreshAssignableUsers = async (searchTerm = '') => {
    const users = await listAssignableUsers(projectId, searchTerm);

    if (users.length === 0) {
      userSelect.innerHTML = '<option value="">No users available</option>';
      return;
    }

    userSelect.innerHTML = `
      <option value="">Select user...</option>
      ${users
        .map((user) => `<option value="${user.user_id}">${escapeHtml(user.user_email || '')}</option>`)
        .join('')}
    `;
  };

  try {
    const { user, project, isOwner } = await fetchProjectAndSession(projectId);

    if (!user) {
      authAlert.classList.remove('d-none');
      return;
    }

    if (!project) {
      titleEl.textContent = 'Project not found';
      descriptionEl.textContent = '';
      content.classList.remove('d-none');
      tbody.innerHTML = '<tr><td colspan="4" class="text-center py-4 text-secondary">Project not found.</td></tr>';
      return;
    }

    titleEl.textContent = `${project.title} — Members`;
    descriptionEl.textContent = project.description || '';

    if (!isOwner) {
      ownerAlert.classList.remove('d-none');
      content.classList.remove('d-none');
      tbody.innerHTML = '<tr><td colspan="4" class="text-center py-4 text-secondary">You do not have permission to manage members for this project.</td></tr>';
      return;
    }

    addBtn.classList.remove('d-none');
    content.classList.remove('d-none');

    await refreshMembers();
    await refreshAssignableUsers();

    addBtn.addEventListener('click', async () => {
      userSearchInput.value = '';
      roleSelect.value = 'member';
      await refreshAssignableUsers('');
      addModal.show();
    });

    let searchDebounce = null;
    userSearchInput.addEventListener('input', () => {
      if (searchDebounce) {
        clearTimeout(searchDebounce);
      }
      searchDebounce = setTimeout(async () => {
        await refreshAssignableUsers(userSearchInput.value.trim());
      }, 250);
    });

    addForm.addEventListener('submit', async (event) => {
      event.preventDefault();

      const userId = userSelect.value;
      const role = roleSelect.value;
      if (!userId) return;

      if (!window.confirm('Assign this user to the project?')) {
        return;
      }

      addSubmit.disabled = true;
      addSubmit.textContent = 'Saving...';

      try {
        await addProjectUser(projectId, userId, role);
        addModal.hide();
        await refreshMembers();
      } catch (error) {
        alert(`Failed to add member: ${error.message}`);
      } finally {
        addSubmit.disabled = false;
        addSubmit.textContent = 'Add User';
      }
    });

    tbody.addEventListener('click', (event) => {
      const actionButton = event.target.closest('[data-action]');
      if (!actionButton) return;

      const action = actionButton.getAttribute('data-action');
      const userId = actionButton.getAttribute('data-user-id');
      const userEmail = actionButton.getAttribute('data-user-email') || '';

      if (action === 'edit') {
        const role = actionButton.getAttribute('data-role') || 'member';
        editingUserId = userId;
        editUserEmail.textContent = userEmail;
        editRoleSelect.value = role;
        editModal.show();
      }

      if (action === 'remove') {
        removingUserId = userId;
        removeUserEmail.textContent = userEmail;
        removeModal.show();
      }
    });

    editForm.addEventListener('submit', async (event) => {
      event.preventDefault();
      if (!editingUserId) return;

      if (!window.confirm('Save role changes for this member?')) {
        return;
      }

      editSubmit.disabled = true;
      editSubmit.textContent = 'Saving...';

      try {
        await updateProjectUserRole(projectId, editingUserId, editRoleSelect.value);
        editModal.hide();
        await refreshMembers();
      } catch (error) {
        alert(`Failed to update role: ${error.message}`);
      } finally {
        editSubmit.disabled = false;
        editSubmit.textContent = 'Save Changes';
        editingUserId = null;
      }
    });

    removeSubmit.addEventListener('click', async () => {
      if (!removingUserId) return;

      removeSubmit.disabled = true;
      removeSubmit.textContent = 'Removing...';

      try {
        await removeProjectUser(projectId, removingUserId);
        removeModal.hide();
        await refreshMembers();
      } catch (error) {
        alert(`Failed to remove member: ${error.message}`);
      } finally {
        removeSubmit.disabled = false;
        removeSubmit.textContent = 'Remove';
        removingUserId = null;
      }
    });
  } catch (error) {
    content.classList.remove('d-none');
    titleEl.textContent = 'Unable to load project members';
    descriptionEl.textContent = '';
    tbody.innerHTML = `<tr><td colspan="4" class="text-center py-4 text-danger">${escapeHtml(error.message || 'Unexpected error')}</td></tr>`;
  }
}
