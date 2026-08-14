/**
 * Development seed: 1 admin, 5 employees across departments, 5 projects covering
 * technical and non-technical work, and a spread of tasks (including overdue and
 * completed ones) so every dashboard number and filter has data to show.
 *
 *   npm run seed         → adds seed data, skipping anything that already exists
 *   npm run seed:fresh   → wipes users/projects/tasks first, then seeds
 */
import { connectDatabase, disconnectDatabase } from '../config/db.js';
import { env } from '../config/env.js';
import { Project } from '../models/Project.js';
import { Task } from '../models/Task.js';
import { User } from '../models/User.js';

const FRESH = process.argv.includes('--fresh');

/** Dates relative to today keep the seed's overdue/upcoming mix meaningful over time. */
const daysFromNow = (days) => {
  const date = new Date();
  date.setHours(12, 0, 0, 0);
  date.setDate(date.getDate() + days);
  return date;
};

const EMPLOYEES = [
  { name: 'Priya Sharma', email: 'priya@office.com', department: 'technology' },
  { name: 'Arjun Mehta', email: 'arjun@office.com', department: 'marketing' },
  { name: 'Neha Verma', email: 'neha@office.com', department: 'sales' },
  { name: 'Rahul Nair', email: 'rahul@office.com', department: 'hr' },
  { name: 'Divya Rao', email: 'divya@office.com', department: 'operations' },
];

const PROJECTS = [
  {
    key: 'lms',
    name: 'LMS Development',
    type: 'technology',
    description:
      'Build the internal learning management system: course delivery, registration and access control.',
    ownerEmail: 'priya@office.com',
    startDate: daysFromNow(-30),
    endDate: daysFromNow(45),
    status: 'active',
  },
  {
    key: 'aicard',
    name: 'AI Card Campaign',
    type: 'marketing',
    description:
      'Independence Day AI card campaign — creatives, influencer outreach and daily lead tracking.',
    ownerEmail: 'arjun@office.com',
    startDate: daysFromNow(-14),
    endDate: daysFromNow(10),
    status: 'active',
  },
  {
    key: 'outreach',
    name: 'Sales Outreach — Q3',
    type: 'sales',
    description: 'Structured outreach to 500 prospects with follow-up cadence and reporting.',
    ownerEmail: 'neha@office.com',
    startDate: daysFromNow(-20),
    endDate: daysFromNow(25),
    status: 'active',
  },
  {
    key: 'hiring',
    name: 'Recruitment Drive',
    type: 'hr',
    description: 'Hire 6 people across technology and operations before the next quarter.',
    ownerEmail: 'rahul@office.com',
    startDate: daysFromNow(-7),
    endDate: daysFromNow(60),
    status: 'planning',
  },
  {
    key: 'office',
    name: 'Office Operations Revamp',
    type: 'operations',
    description: 'Vendor consolidation, seating plan and facilities checklist for the new floor.',
    ownerEmail: 'divya@office.com',
    startDate: daysFromNow(-45),
    endDate: daysFromNow(-5),
    status: 'on_hold',
  },
];

const TASKS = [
  // LMS Development — technology
  { project: 'lms', title: 'Build login API', description: 'JWT auth with refresh handling and rate limiting.', assignee: 'priya@office.com', priority: 'high', status: 'completed', due: -12 },
  { project: 'lms', title: 'Create course page', description: 'Course detail layout with syllabus, instructor and enrolment CTA.', assignee: 'priya@office.com', priority: 'high', status: 'in_progress', due: 4 },
  { project: 'lms', title: 'Test registration flow', description: 'End-to-end checks for signup, email verification and first login.', assignee: 'divya@office.com', priority: 'medium', status: 'todo', due: 9 },
  { project: 'lms', title: 'Implement course access rules', description: 'Restrict lessons to enrolled learners; handle expiry.', assignee: 'priya@office.com', priority: 'urgent', status: 'todo', due: -2 },
  { project: 'lms', title: 'Write user documentation', description: 'Short guide for learners and admins.', assignee: 'rahul@office.com', priority: 'low', status: 'todo', due: 20 },

  // AI Card Campaign — marketing
  { project: 'aicard', title: 'Create promotional poster', description: 'Main campaign poster in three sizes for print and digital.', assignee: 'arjun@office.com', priority: 'high', status: 'completed', due: -8 },
  { project: 'aicard', title: 'Create Instagram creatives', description: 'Ten story creatives and five feed posts with campaign copy.', assignee: 'arjun@office.com', priority: 'high', status: 'in_progress', due: 2 },
  { project: 'aicard', title: 'Contact influencers', description: 'Shortlist and reach out to 20 regional creators.', assignee: 'neha@office.com', priority: 'medium', status: 'in_progress', due: 5 },
  { project: 'aicard', title: 'Prepare WhatsApp campaign', description: 'Message templates, opt-in list and send schedule.', assignee: 'arjun@office.com', priority: 'urgent', status: 'todo', due: -1 },
  { project: 'aicard', title: 'Track daily leads', description: 'Maintain the daily lead sheet and share a summary each evening.', assignee: 'divya@office.com', priority: 'medium', status: 'todo', due: 7 },

  // Sales Outreach — sales
  { project: 'outreach', title: 'Build prospect list', description: 'Compile and clean 500 qualified contacts.', assignee: 'neha@office.com', priority: 'high', status: 'completed', due: -15 },
  { project: 'outreach', title: 'Write outreach email sequence', description: 'Four-touch sequence with follow-ups.', assignee: 'arjun@office.com', priority: 'medium', status: 'in_progress', due: 3 },
  { project: 'outreach', title: 'Schedule demo calls', description: 'Book 25 demos for the coming fortnight.', assignee: 'neha@office.com', priority: 'high', status: 'todo', due: 11 },
  { project: 'outreach', title: 'Update CRM records', description: 'Log every touchpoint and clean duplicate entries.', assignee: 'divya@office.com', priority: 'low', status: 'todo', due: -3 },

  // Recruitment Drive — HR
  { project: 'hiring', title: 'Publish job descriptions', description: 'Six roles across technology and operations.', assignee: 'rahul@office.com', priority: 'high', status: 'in_progress', due: 6 },
  { project: 'hiring', title: 'Screen applications', description: 'First-round screening for shortlisted candidates.', assignee: 'rahul@office.com', priority: 'medium', status: 'todo', due: 14 },
  { project: 'hiring', title: 'Arrange interview panel', description: 'Confirm interviewers and slots for each role.', assignee: 'priya@office.com', priority: 'medium', status: 'todo', due: 18 },

  // Office Operations — operations
  { project: 'office', title: 'Collect vendor quotes', description: 'Three quotes each for housekeeping, pantry and security.', assignee: 'divya@office.com', priority: 'medium', status: 'completed', due: -30 },
  { project: 'office', title: 'Finalise seating plan', description: 'Team-wise seating for the new floor.', assignee: 'divya@office.com', priority: 'high', status: 'in_progress', due: -4 },
  { project: 'office', title: 'Prepare facilities checklist', description: 'Monthly checklist covering power, network and safety.', assignee: 'rahul@office.com', priority: 'low', status: 'todo', due: 22 },
];

const upsertUser = async ({ name, email, department, role, password }) => {
  const existing = await User.findOne({ email });
  if (existing) return existing;

  return User.create({
    name,
    email,
    passwordHash: await User.hashPassword(password),
    department,
    role,
    status: 'active',
  });
};

const run = async () => {
  await connectDatabase();

  if (FRESH) {
    await Promise.all([Task.deleteMany({}), Project.deleteMany({}), User.deleteMany({})]);
    console.log('· Cleared users, projects and tasks');
  }

  const admin = await upsertUser({
    name: env.seedAdminName,
    email: env.seedAdminEmail,
    department: 'administration',
    role: 'admin',
    password: env.seedAdminPassword,
  });

  const employees = new Map();
  for (const employee of EMPLOYEES) {
    // Sequential on purpose: bcrypt hashing in parallel spikes CPU for no gain here.
    // eslint-disable-next-line no-await-in-loop
    const user = await upsertUser({
      ...employee,
      role: 'employee',
      password: env.seedEmployeePassword,
    });
    employees.set(employee.email, user);
  }
  console.log(`· Users ready: 1 admin, ${employees.size} employees`);

  const projects = new Map();
  for (const { key, ownerEmail, ...rest } of PROJECTS) {
    const owner = employees.get(ownerEmail);
    // eslint-disable-next-line no-await-in-loop
    let project = await Project.findOne({ name: rest.name });
    if (!project) {
      // eslint-disable-next-line no-await-in-loop
      project = await Project.create({ ...rest, owner: owner._id, createdBy: admin._id });
    }
    projects.set(key, project);
  }
  console.log(`· Projects ready: ${projects.size}`);

  let created = 0;
  for (const task of TASKS) {
    const project = projects.get(task.project);
    const assignee = employees.get(task.assignee);
    // eslint-disable-next-line no-await-in-loop
    const existing = await Task.findOne({ title: task.title, project: project._id });
    if (existing) continue;

    // eslint-disable-next-line no-await-in-loop
    await Task.create({
      title: task.title,
      description: task.description,
      project: project._id,
      assignedTo: assignee._id,
      priority: task.priority,
      status: task.status,
      dueDate: daysFromNow(task.due),
      createdBy: admin._id,
    });
    created += 1;
  }
  console.log(`· Tasks created: ${created} (${TASKS.length} defined)`);

  console.log('\nSeed complete. Sign in with:');
  console.log(`  Admin     ${env.seedAdminEmail} / ${env.seedAdminPassword}`);
  console.log(`  Employee  ${EMPLOYEES[0].email} / ${env.seedEmployeePassword}`);

  await disconnectDatabase();
  process.exit(0);
};

run().catch(async (error) => {
  console.error('✖ Seed failed:', error);
  await disconnectDatabase().catch(() => {});
  process.exit(1);
});
