/**
 * Fake data for the public demo site (used by scripts/reset-demo.js).
 * Every person and email here is invented; emails use the reserved
 * example.com domain so they can never belong to a real user.
 */

const categories = [
  { name: 'Education', description: 'Projects related to education and training' },
  { name: 'Environment', description: 'Environmental conservation and protection projects' },
  { name: 'Health', description: 'Projects related to health and wellness' },
  { name: 'Community', description: 'Community support and development projects' },
  { name: 'Technology', description: 'Technology innovation and development projects' },
  { name: 'Human Rights', description: 'Human rights defense and promotion projects' },
];

// startInDays / durationDays are relative to the moment of the reset.
// owner = responsible coordinator (SEC-17); "Smiles for All" has none, so
// only admins can manage it.
const projects = [
  {
    name: 'Planting trees',
    owner: 'demo-coordinator@example.com',
    description: 'Help reforest the mountains of Gran Canaria by planting native trees, preparing the soil and learning about sustainable forestry.',
    location: 'Tejeda, Gran Canaria',
    capacity: 30,
    filename: 'project-planting-trees.jpg',
    category: 'Environment',
    startInDays: 7,
    durationDays: 2,
  },
  {
    name: 'Community Support Program',
    owner: 'leo.santana@example.com',
    description: 'Support local families, organise community activities and help at community centres in Vegueta.',
    location: 'Vegueta, Gran Canaria',
    capacity: 25,
    filename: 'project-community-support.jpg',
    category: 'Community',
    startInDays: 14,
    durationDays: 30,
  },
  {
    name: 'Beach Clean-Up',
    owner: 'demo-coordinator@example.com',
    description: 'Collect waste, sort recyclables and raise awareness about marine conservation at Playa de Las Canteras.',
    location: 'Playa de Las Canteras, Gran Canaria',
    capacity: 30,
    filename: 'project-beach-clean-up.png',
    category: 'Environment',
    startInDays: 3,
    durationDays: 1,
  },
  {
    name: 'Smiles for All',
    description: 'Accompany children and elderly people in hospitals and care homes with games, music and conversation.',
    location: 'Telde, Gran Canaria',
    capacity: 25,
    filename: 'project-smiles-for-all.png',
    category: 'Health',
    startInDays: 10,
    durationDays: 60,
  },
  {
    name: 'Living Libraries',
    owner: 'demo-coordinator@example.com',
    description: 'Run reading workshops and storytelling sessions to bring books closer to rural communities.',
    location: 'San Mateo, Gran Canaria',
    capacity: 25,
    filename: 'project-living-libraries.png',
    category: 'Education',
    startInDays: 21,
    durationDays: 14,
  },
];

// Extra (non-demo) fake users so the dashboards have something to show
const extraUsers = [
  { name: 'Alex Rivera', email: 'alex.rivera@example.com', role: 'volunteer' },
  { name: 'Sam Torres', email: 'sam.torres@example.com', role: 'volunteer' },
  { name: 'Noa Martin', email: 'noa.martin@example.com', role: 'volunteer' },
  { name: 'Leo Santana', email: 'leo.santana@example.com', role: 'coordinator' },
];

// Registrations: user email -> project names
const registrations = {
  'demo-volunteer@example.com': ['Beach Clean-Up', 'Planting trees'],
  'alex.rivera@example.com': ['Beach Clean-Up', 'Living Libraries'],
  'sam.torres@example.com': ['Smiles for All'],
  'noa.martin@example.com': ['Community Support Program', 'Beach Clean-Up'],
};

const reviews = [
  {
    author: 'alex.rivera@example.com',
    content: 'The beach clean-up was a great experience: friendly team, good organisation and a visibly cleaner beach after a few hours.',
    image: '/images/beach-cleanup.png',
  },
  {
    author: 'noa.martin@example.com',
    content: 'I met wonderful people in the community programme. Highly recommended if you want to help close to home.',
    image: null,
  },
  {
    author: 'demo-volunteer@example.com',
    content: 'Signing up for projects is really easy and the coordinators answer quickly through the chat.',
    image: null,
  },
];

const contacts = [
  {
    name: 'Jordan Example',
    email: 'jordan@example.com',
    subject: 'Group volunteering',
    message: 'Hi! We are a group of five friends. Can we join the same project together?',
  },
];

const messages = [
  { from: 'demo-volunteer@example.com', to: 'demo-coordinator@example.com', content: 'Hello! What should I bring to the beach clean-up?' },
  { from: 'demo-coordinator@example.com', to: 'demo-volunteer@example.com', content: 'Hi! Water, sunscreen and comfortable shoes. Gloves and bags are provided.' },
];

module.exports = { categories, projects, extraUsers, registrations, reviews, contacts, messages };
