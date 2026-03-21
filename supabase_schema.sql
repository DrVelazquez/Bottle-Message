-- SQL Schema for Supabase

-- 1. Messages Table
CREATE TABLE messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  content VARCHAR(140) NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  status TEXT CHECK (status IN ('pending', 'delivered')) DEFAULT 'pending',
  sender_hash TEXT NOT NULL,
  sender_location TEXT,
  delivered_at TIMESTAMP WITH TIME ZONE,
  delivered_location TEXT
);

-- 2. Deliveries Table (Optional but better for tracking)
CREATE TABLE deliveries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id UUID REFERENCES messages(id),
  device_id TEXT,
  location TEXT,
  delivered_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 3. Stored Procedure for Atomic Consumption
-- This ensures only one device gets the message and marks it delivered in one transaction.
CREATE OR REPLACE FUNCTION consume_random_message(p_delivered_location TEXT, p_device_id TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_message_id UUID;
  v_content TEXT;
  v_result JSONB;
BEGIN
  -- Select a random pending message and lock it
  SELECT id, content INTO v_message_id, v_content
  FROM messages
  WHERE status = 'pending'
  ORDER BY random()
  LIMIT 1
  FOR UPDATE SKIP LOCKED;

  IF v_message_id IS NULL THEN
    RETURN NULL;
  END IF;

  -- Mark as delivered
  UPDATE messages
  SET 
    status = 'delivered',
    delivered_at = NOW(),
    delivered_location = p_delivered_location
  WHERE id = v_message_id;

  -- Log delivery
  INSERT INTO deliveries (message_id, device_id, location, delivered_at)
  VALUES (v_message_id, p_device_id, p_delivered_location, NOW());

  v_result := jsonb_build_object(
    'id', v_message_id,
    'content', v_content
  );

  RETURN v_result;
END;
$$;

-- 4. Row Level Security (RLS)
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;

-- Allow anyone to read their own messages (based on hash)
-- Note: In a real app, you'd use auth.uid() if logged in.
-- For anonymous, we rely on the server-side hash which is passed.
-- Since the server uses service_role, it bypasses RLS for submissions.
-- We can add a policy for public read if needed, but feedback is handled via API.

CREATE POLICY "Users can view their own messages" ON messages
  FOR SELECT USING (true); -- Simplified for this demo, usually filtered by hash

-- 5. Indexes
CREATE INDEX idx_messages_status ON messages(status);
CREATE INDEX idx_messages_sender_hash ON messages(sender_hash);
CREATE INDEX idx_messages_created_at ON messages(created_at);
