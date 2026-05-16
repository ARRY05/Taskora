const bcrypt = require('bcryptjs');
const { createClient } = require('@supabase/supabase-js');
const WebSocket = require('ws');
const { getSupabaseAnonKey, getSupabaseUrl } = require('./config');

let supabase = null;
let seeded = false;

function getSupabaseClient() {
  if (supabase) return supabase;

  const url = getSupabaseUrl();
  const anonKey = getSupabaseAnonKey();

  if (!url || !anonKey) {
    throw new Error('Supabase configuration is missing. Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY.');
  }

  supabase = createClient(url, anonKey, {
    auth: { persistSession: false },
    realtime: { transport: WebSocket },
  });

  return supabase;
}

async function runQuery(query) {
  const { data, error, count } = await query;
  if (error) throw error;
  return { data, count };
}

async function insertOne(table, payload) {
  const { data } = await runQuery(
    getSupabaseClient().from(table).insert(payload).select().single()
  );
  return data;
}

async function seedIfEmpty() {
  if (seeded) return;

  const db = getSupabaseClient();
  const { count } = await runQuery(
    db.from('users').select('id', { count: 'exact', head: true })
  );

  if (count && count > 0) {
    seeded = true;
    return;
  }

  console.log('Seeding Supabase database with demo data...');
  const hash = password => bcrypt.hashSync(password, 10);
  const password = hash('Password@123');

  const aryan = await insertOne('users', { name: 'Aryan Kumar', email: 'aryan@taskora.app', password });
  const priya = await insertOne('users', { name: 'Priya Patel', email: 'priya@taskora.app', password });
  const rahul = await insertOne('users', { name: 'Rahul Verma', email: 'rahul@taskora.app', password });
  const sneha = await insertOne('users', { name: 'Sneha Iyer', email: 'sneha@taskora.app', password });
  const kiran = await insertOne('users', { name: 'Kiran Mehta', email: 'kiran@taskora.app', password });

  const ecommerce = await insertOne('projects', {
    name: 'E-Commerce Platform Redesign',
    description: 'Revamping the online shopping portal for better UX and performance.',
    created_by: aryan.id,
  });

  const hrms = await insertOne('projects', {
    name: 'HR Management System',
    description: 'Internal portal for employee records, payroll, and leave management.',
    created_by: priya.id,
  });

  await runQuery(db.from('project_members').insert([
    { project_id: ecommerce.id, user_id: aryan.id, role: 'Admin' },
    { project_id: ecommerce.id, user_id: priya.id, role: 'Member' },
    { project_id: ecommerce.id, user_id: rahul.id, role: 'Member' },
    { project_id: hrms.id, user_id: priya.id, role: 'Admin' },
    { project_id: hrms.id, user_id: sneha.id, role: 'Member' },
    { project_id: hrms.id, user_id: kiran.id, role: 'Member' },
  ]));

  await runQuery(db.from('tasks').insert([
    {
      project_id: ecommerce.id,
      title: 'Design new homepage wireframes',
      description: 'Create low-fi and hi-fi wireframes for the homepage.',
      priority: 'HIGH',
      status: 'DONE',
      due_date: '2026-04-30',
      assigned_to: priya.id,
      created_by: aryan.id,
    },
    {
      project_id: ecommerce.id,
      title: 'Implement product listing page',
      description: 'Build responsive product grid with filters and sorting.',
      priority: 'HIGH',
      status: 'IN_PROGRESS',
      due_date: '2026-05-20',
      assigned_to: rahul.id,
      created_by: aryan.id,
    },
    {
      project_id: ecommerce.id,
      title: 'Integrate payment gateway',
      description: 'Set up checkout flow and payment status handling.',
      priority: 'HIGH',
      status: 'TODO',
      due_date: '2026-05-25',
      assigned_to: priya.id,
      created_by: aryan.id,
    },
    {
      project_id: ecommerce.id,
      title: 'SEO optimisation for product pages',
      description: 'Add meta tags, structured data, and sitemap.',
      priority: 'MEDIUM',
      status: 'TODO',
      due_date: '2026-06-01',
      assigned_to: rahul.id,
      created_by: aryan.id,
    },
    {
      project_id: hrms.id,
      title: 'Employee onboarding module',
      description: 'Build form for new joiner details and document upload.',
      priority: 'HIGH',
      status: 'IN_PROGRESS',
      due_date: '2026-05-18',
      assigned_to: sneha.id,
      created_by: priya.id,
    },
    {
      project_id: hrms.id,
      title: 'Leave management workflow',
      description: 'Implement leave apply, approve, reject flow.',
      priority: 'MEDIUM',
      status: 'TODO',
      due_date: '2026-05-28',
      assigned_to: kiran.id,
      created_by: priya.id,
    },
  ]));

  seeded = true;
  console.log('Seeded! Login: aryan@taskora.app / Password@123');
}

async function initDb() {
  const db = getSupabaseClient();
  await seedIfEmpty();
  return db;
}

module.exports = {
  getSupabaseClient,
  initDb,
  runQuery,
};
