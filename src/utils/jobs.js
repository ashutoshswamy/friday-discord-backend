const JOBS = {
    // ── Tier 1: No requirements ───────────────────────────────────────
    cashier:    { key: 'cashier',    name: 'Cashier',            emoji: '🛒', tier: 1, levelRequired: 1,  minPay: 60,  maxPay: 120, xpBonus: 0,  description: 'Scan items and manage the checkout lane at a local store.' },
    performer:  { key: 'performer',  name: 'Street Performer',   emoji: '🎸', tier: 1, levelRequired: 1,  minPay: 30,  maxPay: 180, xpBonus: 0,  description: 'Entertain passersby for tips — high-risk, high-reward busking.' },
    delivery:   { key: 'delivery',   name: 'Delivery Driver',    emoji: '🚗', tier: 1, levelRequired: 1,  minPay: 70,  maxPay: 130, xpBonus: 5,  description: 'Deliver packages across the city on a tight schedule.' },

    // ── Tier 2: Level 5+ ──────────────────────────────────────────────
    chef:       { key: 'chef',       name: 'Chef',               emoji: '👨‍🍳', tier: 2, levelRequired: 5,  minPay: 120, maxPay: 210, xpBonus: 10, description: 'Cook gourmet dishes in a busy restaurant kitchen.' },
    mechanic:   { key: 'mechanic',   name: 'Mechanic',           emoji: '🔧', tier: 2, levelRequired: 5,  minPay: 130, maxPay: 220, xpBonus: 0,  description: 'Repair vehicles and heavy machinery at the local garage.' },
    guard:      { key: 'guard',      name: 'Security Guard',     emoji: '💂', tier: 2, levelRequired: 5,  minPay: 110, maxPay: 190, xpBonus: 0,  description: 'Patrol premises and maintain order at venues.' },

    // ── Tier 3: Level 10+ ─────────────────────────────────────────────
    engineer:   { key: 'engineer',   name: 'Software Engineer',  emoji: '💻', tier: 3, levelRequired: 10, minPay: 200, maxPay: 360, xpBonus: 20, description: 'Build and ship software products at a tech company.' },
    doctor:     { key: 'doctor',     name: 'Doctor',             emoji: '🩺', tier: 3, levelRequired: 10, minPay: 220, maxPay: 390, xpBonus: 15, description: 'Treat patients and perform procedures at a hospital.' },
    lawyer:     { key: 'lawyer',     name: 'Lawyer',             emoji: '⚖️', tier: 3, levelRequired: 10, minPay: 210, maxPay: 370, xpBonus: 10, description: 'Argue cases and draft contracts for high-profile clients.' },

    // ── Tier 4: Level 20+ ─────────────────────────────────────────────
    ceo:        { key: 'ceo',        name: 'CEO',                emoji: '🏢', tier: 4, levelRequired: 20, minPay: 360, maxPay: 620, xpBonus: 25, description: 'Lead a corporation and make high-stakes strategic decisions.' },
    banker:     { key: 'banker',     name: 'Investment Banker',  emoji: '💰', tier: 4, levelRequired: 20, minPay: 300, maxPay: 660, xpBonus: 15, description: 'Manage portfolios and execute major financial deals.' },
    gamedev:    { key: 'gamedev',    name: 'Game Developer',     emoji: '🎮', tier: 4, levelRequired: 20, minPay: 280, maxPay: 600, xpBonus: 30, description: 'Design and ship immersive games at an indie studio.' },
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
