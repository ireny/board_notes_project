import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_PUBLISHABLE_KEY =
  process.env.SUPABASE_PUBLISHABLE_KEY ?? process.env.SUPABASE_ANON_KEY;

if (!SUPABASE_URL || !SUPABASE_PUBLISHABLE_KEY) {
  throw new Error(
    'Missing SUPABASE_URL or SUPABASE_PUBLISHABLE_KEY/SUPABASE_ANON_KEY environment variables.'
  );
}

function createSeedClient() {
  return createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
      detectSessionInUrl: false
    }
  });
}

function createAuthenticatedDataClient(accessToken) {
  return createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
    global: {
      headers: {
        Authorization: `Bearer ${accessToken}`
      }
    },
    auth: {
      autoRefreshToken: false,
      persistSession: false,
      detectSessionInUrl: false
    }
  });
}

const supabase = createSeedClient();

const usersToSeed = [
  { email: 'zoya@gmail.com', password: 'pass1234', displayName: 'Zoya' },
  { email: 'natasha@gmail.com', password: 'pass1234', displayName: 'Natasha' },
  { email: 'dancho@gmail.com', password: 'pass1234', displayName: 'Dancho' }
];

const stageTemplates = [
  { title: 'Not Started', position: 1 },
  { title: 'In Progress', position: 2 },
  { title: 'Done', position: 3 }
];

function buildTaskTemplate(taskNumber) {
  const padded = String(taskNumber).padStart(2, '0');
  return {
    title: `Task ${padded}`,
    description_html: `<p><strong>Sample task ${padded}</strong> created by seed script.</p><p>Edit this rich text as needed.</p>`
  };
}

function isUserAlreadyRegisteredError(message) {
  const text = (message ?? '').toLowerCase();
  return text.includes('already registered') || text.includes('user already registered');
}

async function signInWithPassword(client, email, password) {
  const { data, error } = await client.auth.signInWithPassword({ email, password });

  if (error) {
    return { session: null, user: null, error };
  }

  return {
    session: data.session ?? null,
    user: data.user ?? null,
    error: null
  };
}

async function getOrCreateUserSession(user) {
  const client = createSeedClient();
  const initialSignIn = await signInWithPassword(client, user.email, user.password);

  if (initialSignIn.user && initialSignIn.session) {
    return {
      client: createAuthenticatedDataClient(initialSignIn.session.access_token),
      authUser: initialSignIn.user
    };
  }

  const { error: signUpError } = await client.auth.signUp({
    email: user.email,
    password: user.password,
    options: {
      data: {
        display_name: user.displayName
      }
    }
  });

  if (signUpError && !isUserAlreadyRegisteredError(signUpError.message)) {
    throw signUpError;
  }

  const retrySignIn = await signInWithPassword(client, user.email, user.password);
  if (retrySignIn.user && retrySignIn.session) {
    return {
      client: createAuthenticatedDataClient(retrySignIn.session.access_token),
      authUser: retrySignIn.user
    };
  }

  throw new Error(
    `Unable to sign in user ${user.email}. Check if email confirmation is required in Supabase Auth settings.`
  );
}

async function getOrCreateUsers() {
  const result = [];

  for (const user of usersToSeed) {
    const seeded = await getOrCreateUserSession(user);

    result.push({
      client: seeded.client,
      authUser: seeded.authUser,
      displayName: user.displayName,
      email: user.email
    });
  }

  return result;
}

async function ensureProjectsForOwner(client, ownerId, ownerName) {
  const targetProjects = [
    {
      title: `${ownerName} Project 1`,
      description: `${ownerName}'s seeded project 1`
    },
    {
      title: `${ownerName} Project 2`,
      description: `${ownerName}'s seeded project 2`
    }
  ];

  const { data: existingProjects, error: projectReadError } = await client
    .from('projects')
    .select('id,title')
    .eq('owner_id', ownerId)
    .in(
      'title',
      targetProjects.map((project) => project.title)
    );

  if (projectReadError) {
    throw projectReadError;
  }

  const existingByTitle = new Map((existingProjects ?? []).map((project) => [project.title, project]));
  const missing = targetProjects.filter((project) => !existingByTitle.has(project.title));

  if (missing.length > 0) {
    const { error: insertError } = await client
      .from('projects')
      .insert(
        missing.map((project) => ({
          ...project,
          owner_id: ownerId
        }))
      );

    if (insertError) {
      throw insertError;
    }

    const { data: refreshedProjects, error: refreshError } = await client
      .from('projects')
      .select('id,title')
      .eq('owner_id', ownerId)
      .in(
        'title',
        targetProjects.map((project) => project.title)
      );

    if (refreshError) {
      throw refreshError;
    }

    for (const project of refreshedProjects ?? []) {
      existingByTitle.set(project.title, project);
    }
  }

  return targetProjects.map((project) => existingByTitle.get(project.title));
}

async function ensureStagesForProject(client, projectId) {
  const { data: existingStages, error: stageReadError } = await client
    .from('project_stages')
    .select('id,title,position')
    .eq('project_id', projectId);

  if (stageReadError) {
    throw stageReadError;
  }

  const existingByTitle = new Map((existingStages ?? []).map((stage) => [stage.title, stage]));
  const missingStages = stageTemplates.filter((stage) => !existingByTitle.has(stage.title));

  if (missingStages.length > 0) {
    const { error: stageInsertError } = await client
      .from('project_stages')
      .insert(
        missingStages.map((stage) => ({
          project_id: projectId,
          title: stage.title,
          position: stage.position
        }))
      );

    if (stageInsertError) {
      throw stageInsertError;
    }

    const { data: refreshedStages, error: refreshStageError } = await client
      .from('project_stages')
      .select('id,title,position')
      .eq('project_id', projectId);

    if (refreshStageError) {
      throw refreshStageError;
    }

    for (const stage of refreshedStages ?? []) {
      existingByTitle.set(stage.title, stage);
    }
  }

  return stageTemplates
    .map((stageTemplate) => existingByTitle.get(stageTemplate.title))
    .filter(Boolean);
}

async function getTaskPositionMap(client, projectId) {
  const { data, error } = await client
    .from('tasks')
    .select('stage_id,order_position')
    .eq('project_id', projectId);

  if (error) {
    throw error;
  }

  const positionMap = new Map();
  for (const row of data ?? []) {
    const current = positionMap.get(row.stage_id) ?? 0;
    positionMap.set(row.stage_id, Math.max(current, row.order_position ?? 0));
  }

  return positionMap;
}

async function ensureTasksForProject(client, projectId, stageList) {
  const stageByTitle = new Map(stageList.map((stage) => [stage.title, stage]));
  const orderedStages = [
    stageByTitle.get('Not Started'),
    stageByTitle.get('In Progress'),
    stageByTitle.get('Done')
  ].filter(Boolean);

  if (orderedStages.length !== 3) {
    throw new Error(`Project ${projectId} does not have the 3 required stages.`);
  }

  const taskTemplates = Array.from({ length: 10 }, (_, index) => buildTaskTemplate(index + 1));
  const titles = taskTemplates.map((task) => task.title);

  const { data: existingTasks, error: taskReadError } = await client
    .from('tasks')
    .select('id,title')
    .eq('project_id', projectId)
    .in('title', titles);

  if (taskReadError) {
    throw taskReadError;
  }

  const existingTitles = new Set((existingTasks ?? []).map((task) => task.title));
  const stageOrderCounters = await getTaskPositionMap(client, projectId);
  const missingRows = [];

  for (let index = 0; index < taskTemplates.length; index += 1) {
    const taskTemplate = taskTemplates[index];
    if (existingTitles.has(taskTemplate.title)) {
      continue;
    }

    const targetStage = orderedStages[index % orderedStages.length];
    const nextPosition = (stageOrderCounters.get(targetStage.id) ?? 0) + 1;
    stageOrderCounters.set(targetStage.id, nextPosition);

    missingRows.push({
      project_id: projectId,
      stage_id: targetStage.id,
      title: taskTemplate.title,
      description_html: taskTemplate.description_html,
      order_position: nextPosition,
      done: targetStage.title === 'Done'
    });
  }

  if (missingRows.length > 0) {
    const { error: taskInsertError } = await client.from('tasks').insert(missingRows);
    if (taskInsertError) {
      throw taskInsertError;
    }
  }
}

async function run() {
  console.log('Seeding sample users/projects/stages/tasks...');

  const seededUsers = await getOrCreateUsers();

  for (const seeded of seededUsers) {
    const ownerId = seeded.authUser?.id;
    if (!ownerId) {
      throw new Error(`Missing auth user id for ${seeded.email}`);
    }

    const projects = await ensureProjectsForOwner(seeded.client, ownerId, seeded.displayName);
    for (const project of projects) {
      const stages = await ensureStagesForProject(seeded.client, project.id);
      await ensureTasksForProject(seeded.client, project.id, stages);
    }
  }

  console.log('Sample data seed completed successfully.');
}

run().catch((error) => {
  console.error('Sample data seed failed:', error.message ?? error);
  process.exit(1);
});