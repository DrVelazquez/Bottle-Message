import express from "express";
import { createClient } from "@supabase/supabase-js";
import crypto from "crypto";
import { Filter } from "bad-words";
import cors from "cors";

// Lazy initialize Supabase
let supabaseClient: any = null;
const getSupabase = () => {
  if (!supabaseClient) {
    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    
    if (!supabaseUrl || !supabaseServiceKey) {
      console.error("Missing Supabase environment variables");
      throw new Error("SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required");
    }
    supabaseClient = createClient(supabaseUrl, supabaseServiceKey);
  }
  return supabaseClient;
};

// Robust Filter initialization with Spanish support
let filter: any;
try {
  filter = new Filter();
  // Add some common Spanish bad words to the filter
  const spanishBadWords = [
    "boludo", "pelotudo", "concha", "puto", "puta", "mierda", "carajo", 
    "culiao", "pendejo", "chingar", "joder", "gilipollas"
  ];
  filter.addWords(...spanishBadWords);
} catch (e) {
  console.warn("Failed to initialize bad-words filter, using fallback:", e);
  filter = { isProfane: () => false };
}

const app = express();

// --- Strict Content Filtering Logic ---
const isStrictlyClean = (text: string): { clean: boolean; reason?: string } => {
  const content = text.toLowerCase();

  // 1. Basic Profanity (English + Spanish)
  if (filter.isProfane(content)) {
    return { clean: false, reason: "Obscene content detected" };
  }

  // 2. No URLs/Links (Spam prevention)
  const urlRegex = /(https?:\/\/[^\s]+)|(www\.[^\s]+)|([^\s]+\.(com|net|org|io|me|tk|ml|ga|cf|gq|xyz|biz|info|es|ar|cl|mx))/i;
  if (urlRegex.test(content)) {
    return { clean: false, reason: "Links and URLs are not allowed" };
  }

  // 3. No Emails (Privacy/Spam)
  const emailRegex = /[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/i;
  if (emailRegex.test(content)) {
    return { clean: false, reason: "Email addresses are not allowed" };
  }

  // 4. No excessive emojis (Visual spam)
  const emojiRegex = /[\u{1F300}-\u{1F9FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}]/gu;
  const emojiCount = (content.match(emojiRegex) || []).length;
  if (emojiCount > 3) {
    return { clean: false, reason: "Too many emojis (max 3)" };
  }

  // 5. No repetitive characters (e.g., "aaaaaaa")
  const repetitiveRegex = /(.)\1{5,}/;
  if (repetitiveRegex.test(content)) {
    return { clean: false, reason: "Repetitive characters detected" };
  }

  // 6. No phone numbers (Privacy)
  const phoneRegex = /(\+?\d{1,3}[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4,}/;
  if (phoneRegex.test(content)) {
    return { clean: false, reason: "Phone numbers are not allowed" };
  }

  return { clean: true };
};

// Enable CORS for all origins
app.use(cors());
app.use(express.json());

// Helper to hash IP
const hashIP = (ip: string) => {
  const salt = process.env.IP_SALT || "bottle-salt";
  return crypto.createHash("sha256").update(ip + salt).digest("hex");
};

// --- API Routes ---

app.get("/api/health", (req, res) => {
  res.json({ status: "ok", env: process.env.NODE_ENV });
});

app.post("/api/messages", async (req, res) => {
  try {
    const supabase = getSupabase();
    const { content, userId } = req.body;
    const ip = req.headers["x-forwarded-for"] || req.socket.remoteAddress || "unknown";
    const senderHash = userId || hashIP(ip as string);

    if (!content || typeof content !== "string") {
      return res.status(400).json({ error: "Content is required" });
    }

    if (content.length > 140) {
      return res.status(400).json({ error: "Message too long (max 140 chars)" });
    }

    const filterResult = isStrictlyClean(content);
    if (!filterResult.clean) {
      return res.status(400).json({ error: filterResult.reason });
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const { data: recentMessages, error: quotaError } = await supabase
      .from("messages")
      .select("id")
      .eq("sender_hash", senderHash)
      .gte("created_at", today.toISOString());

    if (quotaError) throw quotaError;

    if (recentMessages && recentMessages.length >= 1) {
      return res.status(429).json({ error: "Daily quota reached (1 message per day)" });
    }

    const { data, error } = await supabase
      .from("messages")
      .insert([{ content, sender_hash: senderHash, status: "pending", created_at: new Date().toISOString() }])
      .select();

    if (error) throw error;
    res.json({ success: true, message: data[0] });
  } catch (err: any) {
    console.error("API Error (POST /api/messages):", err);
    res.status(500).json({ error: err.message || "Internal Server Error" });
  }
});

app.get("/api/my-last-message", async (req, res) => {
  try {
    const supabase = getSupabase();
    const { userId } = req.query;
    const ip = req.headers["x-forwarded-for"] || req.socket.remoteAddress || "unknown";
    const senderHash = (userId as string) || hashIP(ip as string);

    const { data, error } = await supabase
      .from("messages")
      .select("*")
      .eq("sender_hash", senderHash)
      .order("created_at", { ascending: false })
      .limit(1);

    if (error) throw error;
    res.json({ message: data?.[0] || null });
  } catch (err: any) {
    console.error("API Error (GET /api/my-last-message):", err);
    res.status(500).json({ error: err.message });
  }
});

app.get("/api/get-message", async (req, res) => {
  try {
    const supabase = getSupabase();
    const apiKey = req.headers["x-api-key"];
    if (apiKey !== process.env.DEVICE_API_KEY) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const { data, error } = await supabase.rpc("consume_random_message", {
      p_delivered_location: (req.query.location as string) || "Unknown",
      p_device_id: (req.query.deviceId as string) || "Unknown"
    });

    if (error) throw error;
    res.json({ message: data || null });
  } catch (err: any) {
    console.error("API Error (GET /api/get-message):", err);
    res.status(500).json({ error: err.message });
  }
});

// Global error handler
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error("Unhandled Error:", err);
  res.status(500).json({ error: "Internal Server Error" });
});

// 404 handler for API
app.use((req, res) => {
  res.status(404).json({ error: `Route ${req.method} ${req.url} not found. Ensure you are using the base App URL in the simulator.` });
});

export default app;
