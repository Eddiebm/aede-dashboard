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
const db = drizzle(connection);

const brands = [
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
  },
];

console.log("Seeding brands...");

for (const brand of brands) {
  try {
    await connection.execute(
      `INSERT INTO brands (brandId, name, description, audience, tone, url, schedule, accentColor, active, cta, createdAt, updatedAt)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())
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
      ]
    );
    console.log(`  ✓ ${brand.name}`);
  } catch (err) {
    console.error(`  ✗ ${brand.name}:`, err.message);
  }
}

await connection.end();
console.log("Done.");
