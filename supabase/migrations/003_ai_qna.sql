-- Add AI Q&A support: AI auto-answers student questions, students can escalate to professor

-- forum_replies table (may not exist yet from initial migration)
CREATE TABLE IF NOT EXISTS forum_replies (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    question_id UUID REFERENCES forum_questions(id) ON DELETE CASCADE,
    reply_text TEXT NOT NULL,
    is_professor BOOLEAN DEFAULT false,
    is_ai BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- Add is_ai column if table already existed without it
ALTER TABLE forum_replies ADD COLUMN IF NOT EXISTS is_ai BOOLEAN DEFAULT false;

-- Track whether a question has been escalated to the professor
ALTER TABLE forum_questions ADD COLUMN IF NOT EXISTS escalated_to_prof BOOLEAN DEFAULT false;
