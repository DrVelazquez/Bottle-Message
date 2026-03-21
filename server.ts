import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import { createClient } from "@supabase/supabase-js";
import crypto from "crypto";
import { Filter } from "bad-words";

// Lazy initialize Supabase
let supabaseClient: any = null;
const getSupabase = () => {
  if (!supabaseClient) {
    const supabaseUrl = process.env.SUPABASE_URL || "";
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || "";
    if (!supabaseUrl || !supabaseServiceKey) {
      throw new Error("SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required");
    }
    supabaseClient = createClient(supabaseUrl, supabaseServiceKey);
  }
  return supabaseClient;
};

const filter = new Filter();
const app = express();
app.use(express.json());

// Helper to hash IP
const hashIP = (ip: string) => {
  return crypto.createHash("sha256").update(ip + (process.env.IP_SALT || "bottle-salt")).digest("hex");
};

// --- API Routes (Synchronous for Vercel/Serverless) ---

// Submit Message
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

    // Security Filters
    const emojiRegex = /[\u{1F600}-\u{1F64F}\u{1F300}-\u{1F5FF}\u{1F680}-\u{1F6FF}\u{1F1E6}-\u{1F1FF}]/u;
    if (emojiRegex.test(content)) {
      return res.status(400).json({ error: "Emojis are not allowed" });
    }

    const urlRegex = /(https?:\/\/[^\s]+)/g;
    if (urlRegex.test(content)) {
      return res.status(400).json({ error: "Links are not allowed" });
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
    console.error("API Error:", err);
    res.status(500).json({ error: err.message || "Internal Server Error" });
  }
});

// Get Last Message
app.get("/api/my-last-message", async (req, res) => {
  try {
    const supabase = getSupabase();
    const { userId } = req.query;
    const ip = req.headers["x-forwarded-for"] || req.socket.remoteAddress || "unknown";
    const senderHash = userId || hashIP(ip as string);

    const { data, error } = await supabase
      .from("messages")
      .select("*")
      .eq("sender_hash", senderHash)
      .order("created_at", { ascending: false })
      .limit(1);

    if (error) throw error;
    res.json({ message: data?.[0] || null });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ESP32 API
app.get("/api/get-message", async (req, res) => {
  try {
    const supabase = getSupabase();
    const apiKey = req.headers["x-api-key"];
    if (apiKey !== process.env.DEVICE_API_KEY) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    const { data, error } = await supabase.rpc("consume_random_message", {
      p_delivered_location: req.query.location || "Unknown",
      p_device_id: req.query.deviceId || "Unknown"
    });

    if (error) throw error;
    res.json({ message: data || null });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

async function startServer() {
  const PORT = 3000;

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
    
    app.listen(PORT, "0.0.0.0", () => {
      console.log(`Server running on http://localhost:${PORT}`);
    });
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }
}

startServer();

export default app;
