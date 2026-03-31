import { drizzle } from "drizzle-orm/mysql2";
import mysql from "mysql2/promise";
import dotenv from "dotenv";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const __dirname = dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: join(__dirname, "../.env") });

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  console.error("DATABASE_URL not set");
  process.exit(1);
}

const connection = await mysql.createConnection(DATABASE_URL);

const brands = [
  // ── Original 7 ──────────────────────────────────────────────────────────
  {
    brandId: "frankgrant",
    name: "FrankGrant",
    description: "AI-powered NIH grant writing service. $7M+ in awarded grants. Done-for-you ($2,500) and SaaS ($149/mo).",
    audience: "Researchers, academics, biotech founders, NIH grant applicants",
    tone: "Authoritative, confident, results-driven. Data and outcomes first.",
    url: "https://frankgrant.pages.dev",
    schedule: "0 7 * * *",
    accentColor: "#1a6b3c",
    active: true,
    cta: "Start your grant at frankgrant.pages.dev",
    frequency: "daily",
    postTime: "07:00",
  },
  {
    brandId: "nihpaylines",
    name: "NIHPaylines",
    description: "NIH paylines tracker — funding cutoff percentiles by institute and grant type.",
    audience: "Researchers, grant writers, biotech founders tracking NIH funding",
    tone: "Informative, precise, data-forward. No fluff.",
    url: "https://nihpaylines.com",
    schedule: "0 8 * * *",
    accentColor: "#1a4a8a",
    active: true,
    cta: "Track paylines at nihpaylines.com",
    frequency: "daily",
    postTime: "08:00",
  },
  {
    brandId: "rentlease",
    name: "RentLease",
    description: "Property management app for independent landlords. Leases, tenant screening, eviction guidance. 1–25 units.",
    audience: "Independent landlords, small property owners, real estate investors",
    tone: "Practical, no-nonsense, landlord-first. Straight talk about property management.",
    url: "https://leasingapp.pages.dev",
    schedule: "0 9 * * *",
    accentColor: "#7c3a1a",
    active: true,
    cta: "Manage your properties at leasingapp.pages.dev",
    frequency: "daily",
    postTime: "09:00",
  },
  {
    brandId: "rewbs",
    name: "RealEstateWithoutBullshit",
    description: "Real estate advice and tools without the industry spin. Honest, direct, buyer and seller focused.",
    audience: "Home buyers, sellers, investors tired of vague real estate advice",
    tone: "Blunt, honest, contrarian. Call out the BS. Give real answers.",
    url: "https://realestatewithoutbullshit.com",
    schedule: "0 10 * * *",
    accentColor: "#8a1a1a",
    active: true,
    cta: "Get real at realestatewithoutbullshit.com",
    frequency: "daily",
    postTime: "10:00",
  },
  {
    brandId: "busos",
    name: "BUSOS",
    description: "Content and marketing framework. Bold, Unique, Surprising, Outstanding, Shareable.",
    audience: "Content creators, marketers, entrepreneurs, founders building a brand",
    tone: "Bold, punchy, provocative. Challenge conventional marketing wisdom.",
    url: "https://busos.com",
    schedule: "0 11 * * *",
    accentColor: "#1a1a8a",
    active: true,
    cta: "Apply the BUSOS framework",
    frequency: "daily",
    postTime: "11:00",
  },
  {
    brandId: "coare",
    name: "COARE",
    description: "COARE Holdings — biotechnology company and holding group for multiple ventures.",
    audience: "Biotech investors, life science professionals, research partners",
    tone: "Scientific, authoritative, forward-looking. Innovation and precision.",
    url: "https://coare.com",
    schedule: "0 12 * * *",
    accentColor: "#3a1a8a",
    active: true,
    cta: "Explore COARE Holdings",
    frequency: "daily",
    postTime: "12:00",
  },
  {
    brandId: "chiefmarketingofficer",
    name: "ChiefMarketingOfficer.app",
    description: "AI CMO platform — CMO-level marketing strategy for founders and SMEs without the CMO price tag.",
    audience: "Founders, SMEs, startups needing senior marketing strategy",
    tone: "Strategic, sharp, CMO-grade. Speak like a seasoned marketing executive.",
    url: "https://chiefmarketingofficer.app",
    schedule: "0 13 * * *",
    accentColor: "#1a6b6b",
    active: true,
    cta: "Get your AI CMO at chiefmarketingofficer.app",
    frequency: "daily",
    postTime: "13:00",
  },

  // ── 6 New Brands ─────────────────────────────────────────────────────────
  {
    brandId: "stillhere",
    name: "StillHere",
    description: "Keep your social media alive while you focus on running your business. Automated presence for busy founders.",
    audience: "Founders, solopreneurs, and small business owners who struggle to stay consistent on social media",
    tone: "Empathetic, practical, motivating. Speaks to the overwhelmed founder.",
    url: "https://stillhere.app",
    schedule: "0 14 * * *",
    accentColor: "#2d6a4f",
    active: true,
    cta: "Keep your brand alive at StillHere",
    frequency: "daily",
    postTime: "14:00",
  },
  {
    brandId: "promptangel",
    name: "PromptAngel",
    description: "Get your prompt right before you vibe code. Prompt engineering tool for AI-assisted developers and non-technical founders.",
    audience: "Developers, vibe coders, and non-technical founders using AI to build products",
    tone: "Sharp, witty, insider. Speaks the language of the AI-native builder generation.",
    url: "https://promptangel.app",
    schedule: "0 15 * * *",
    accentColor: "#7b2d8b",
    active: true,
    cta: "Get your prompt right at PromptAngel",
    frequency: "daily",
    postTime: "15:00",
  },
  {
    brandId: "codemama",
    name: "CodeMama",
    description: "Business Development Engine — AI-powered partner outreach and deal pipeline automation for biotech and life science companies.",
    audience: "Biotech and life science companies seeking pharma, investor, and research partners",
    tone: "Professional, strategic, results-focused. The voice of a seasoned BD executive.",
    url: "https://code-mama.vercel.app",
    schedule: "0 16 * * *",
    accentColor: "#c0392b",
    active: true,
    cta: "Automate your BD pipeline at CodeMama",
    frequency: "daily",
    postTime: "16:00",
  },
  {
    brandId: "mfsautopilot",
    name: "MFS Autopilot",
    description: "Marketing Funnel SaaS with AI post generation and Stripe billing. Full marketing funnel on autopilot for founders.",
    audience: "Founders and small business owners who want a full marketing funnel running on autopilot",
    tone: "Direct, results-oriented, no-fluff. Speaks to founders who want outcomes not features.",
    url: "https://mfs-autopilot.vercel.app",
    schedule: "0 17 * * *",
    accentColor: "#e67e22",
    active: true,
    cta: "Put your marketing on autopilot",
    frequency: "daily",
    postTime: "17:00",
  },
  {
    brandId: "mfsolopreneurs",
    name: "MarketingForSoloPreneurs",
    description: "Marketing education and tools specifically built for solopreneurs and one-person businesses.",
    audience: "Solopreneurs, freelancers, and one-person businesses who do their own marketing",
    tone: "Peer-to-peer, practical, encouraging. One solopreneur talking to another.",
    url: "https://marketingforsolopreneurs.com",
    schedule: "0 18 * * *",
    accentColor: "#16a085",
    active: true,
    cta: "Market smarter as a solopreneur",
    frequency: "daily",
    postTime: "18:00",
  },
];

console.log(`Seeding ${brands.length} brands...`);

for (const brand of brands) {
  try {
    await connection.execute(
      `INSERT INTO brands (brandId, name, description, audience, tone, url, schedule, accentColor, active, cta, frequency, postTime, createdAt, updatedAt)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())
       ON DUPLICATE KEY UPDATE
         name = VALUES(name),
         description = VALUES(description),
         audience = VALUES(audience),
         tone = VALUES(tone),
         url = VALUES(url),
         schedule = VALUES(schedule),
         accentColor = VALUES(accentColor),
         active = VALUES(active),
         cta = VALUES(cta),
         frequency = VALUES(frequency),
         postTime = VALUES(postTime),
         updatedAt = NOW()`,
      [
        brand.brandId,
        brand.name,
        brand.description,
        brand.audience,
        brand.tone,
        brand.url,
        brand.schedule,
        brand.accentColor,
        brand.active ? 1 : 0,
        brand.cta,
        brand.frequency,
        brand.postTime,
      ]
    );
    console.log(`  ✓ ${brand.name}`);
  } catch (err) {
    console.error(`  ✗ ${brand.name}:`, err.message);
  }
}

await connection.end();
console.log(`\nDone. ${brands.length} brands seeded.`);
