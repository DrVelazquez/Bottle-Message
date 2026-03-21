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

// Robust Filter initialization
let filter: any;
try {
  filter = new Filter();
} catch (e) {
  console.warn("Failed to initialize bad-words filter, using fallback:", e);
  filter = { isProfane: () => false };
}

const app = express();

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

    if (filter.isProfane(content)) {
      return res.status(400).json({ error: "Obscene content is not allowed" });
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

export default app;
