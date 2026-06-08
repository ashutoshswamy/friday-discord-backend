const JOBS = {
    // ── Tier 1 — Starter (Level 1+) · ~min wage · 50–300 coins/shift ──
    cashier:    { key: 'cashier',    name: 'Cashier',            tier: 1, levelRequired: 1,  minPay: 60,  maxPay: 130, xpBonus: 0,  description: 'Scan items and manage the checkout lane at a local store.' },
    performer:  { key: 'performer',  name: 'Street Performer',   tier: 1, levelRequired: 1,  minPay: 20,  maxPay: 300, xpBonus: 5,  description: 'Entertain passersby for tips — volatile but potentially lucrative.' },
    delivery:   { key: 'delivery',   name: 'Delivery Driver',    tier: 1, levelRequired: 1,  minPay: 80,  maxPay: 180, xpBonus: 5,  description: 'Deliver packages across the city on a tight schedule.' },
    janitor:    { key: 'janitor',    name: 'Janitor',            tier: 1, levelRequired: 1,  minPay: 50,  maxPay: 110, xpBonus: 0,  description: 'Keep facilities spotless — steady, reliable, unglamorous.' },
    barista:    { key: 'barista',    name: 'Barista',            tier: 1, levelRequired: 1,  minPay: 70,  maxPay: 160, xpBonus: 0,  description: 'Craft espresso drinks and charm café regulars for tips.' },
    farmhand:   { key: 'farmhand',   name: 'Farmhand',           tier: 1, levelRequired: 1,  minPay: 55,  maxPay: 140, xpBonus: 8,  description: 'Work the fields from dawn to dusk — honest outdoor labour.' },

    // ── Tier 2 — Skilled (Level 5+) · ~$30–50/hr · 400–900 coins/shift ─
    chef:       { key: 'chef',       name: 'Chef',               tier: 2, levelRequired: 5,  minPay: 420, maxPay: 780, xpBonus: 12, description: 'Cook gourmet dishes under pressure in a busy restaurant kitchen.' },
    mechanic:   { key: 'mechanic',   name: 'Mechanic',           tier: 2, levelRequired: 5,  minPay: 450, maxPay: 850, xpBonus: 10, description: 'Diagnose and repair vehicles and heavy machinery at the garage.' },
    guard:      { key: 'guard',      name: 'Security Guard',     tier: 2, levelRequired: 5,  minPay: 400, maxPay: 680, xpBonus: 0,  description: 'Patrol premises and maintain order at venues and events.' },
    plumber:    { key: 'plumber',    name: 'Plumber',            tier: 2, levelRequired: 5,  minPay: 480, maxPay: 900, xpBonus: 10, description: 'Fix leaks, install pipework, and keep water flowing.' },
    electrician:{ key: 'electrician',name: 'Electrician',        tier: 2, levelRequired: 5,  minPay: 500, maxPay: 920, xpBonus: 12, description: 'Wire buildings, replace fuses, and troubleshoot circuits.' },
    nurse:      { key: 'nurse',      name: 'Nurse',              tier: 2, levelRequired: 5,  minPay: 440, maxPay: 820, xpBonus: 15, description: 'Care for patients, administer medication, and assist surgeons.' },

    // ── Tier 3 — Professional (Level 10+) · ~$80–150/hr · 1200–3500 coins/shift
    engineer:   { key: 'engineer',   name: 'Software Engineer',  tier: 3, levelRequired: 10, minPay: 1400, maxPay: 2800, xpBonus: 25, description: 'Build and ship software products at a fast-growing tech company.' },
    doctor:     { key: 'doctor',     name: 'Doctor',             tier: 3, levelRequired: 10, minPay: 1800, maxPay: 3500, xpBonus: 20, description: 'Treat patients, run diagnostics, and perform clinical procedures.' },
    lawyer:     { key: 'lawyer',     name: 'Lawyer',             tier: 3, levelRequired: 10, minPay: 1600, maxPay: 3200, xpBonus: 15, description: 'Argue high-profile cases and draft watertight contracts.' },
    architect:  { key: 'architect',  name: 'Architect',          tier: 3, levelRequired: 10, minPay: 1200, maxPay: 2400, xpBonus: 20, description: 'Design striking buildings and oversee construction projects.' },
    pharmacist: { key: 'pharmacist', name: 'Pharmacist',         tier: 3, levelRequired: 10, minPay: 1300, maxPay: 2600, xpBonus: 18, description: 'Dispense medication, counsel patients, and manage drug inventory.' },
    analyst:    { key: 'analyst',    name: 'Financial Analyst',  tier: 3, levelRequired: 10, minPay: 1250, maxPay: 2500, xpBonus: 15, description: 'Model markets, build forecasts, and advise on financial strategy.' },

    // ── Tier 4 — Elite (Level 20+) · ~$300–2000+/hr · 5000–20000 coins/shift
    ceo:        { key: 'ceo',        name: 'CEO',                tier: 4, levelRequired: 20, minPay: 8000,  maxPay: 16000, xpBonus: 30, description: 'Lead a corporation, close deals, and drive shareholder value.' },
    banker:     { key: 'banker',     name: 'Investment Banker',  tier: 4, levelRequired: 20, minPay: 6000,  maxPay: 14000, xpBonus: 20, description: 'Execute M&A deals, IPOs, and large-scale financial transactions.' },
    gamedev:    { key: 'gamedev',    name: 'Game Developer',     tier: 4, levelRequired: 20, minPay: 5000,  maxPay: 10000, xpBonus: 35, description: 'Design and ship immersive games that top the download charts.' },
    surgeon:    { key: 'surgeon',    name: 'Surgeon',            tier: 4, levelRequired: 20, minPay: 9000,  maxPay: 18000, xpBonus: 25, description: 'Perform complex surgical procedures with precision and composure.' },
    aerospace:  { key: 'aerospace',  name: 'Aerospace Engineer', tier: 4, levelRequired: 20, minPay: 5500,  maxPay: 11000, xpBonus: 30, description: 'Design spacecraft, propulsion systems, and aerospace hardware.' },
    hedgefund:  { key: 'hedgefund',  name: 'Hedge Fund Manager', tier: 4, levelRequired: 20, minPay: 5000,  maxPay: 20000, xpBonus: 20, description: 'Run a multi-billion fund — extreme volatility, extreme rewards.' },
};

const TIER_LABELS = { 1: 'Starter', 2: 'Skilled', 3: 'Professional', 4: 'Elite' };
const TIER_COLORS = { 1: '#9CA3AF', 2: '#60A5FA', 3: '#A78BFA', 4: '#FBBF24' };

function getJobByKey(key) {
    return JOBS[key] || null;
}

function getJobsByTier(tier) {
    return Object.values(JOBS).filter(j => j.tier === tier);
}

function calcPay(job) {
    return Math.floor(Math.random() * (job.maxPay - job.minPay + 1)) + job.minPay;
}

module.exports = { JOBS, TIER_LABELS, TIER_COLORS, getJobByKey, getJobsByTier, calcPay };
