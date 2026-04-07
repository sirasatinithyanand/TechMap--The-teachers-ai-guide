-- TeachMap initial schema

CREATE TABLE professors (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    email TEXT,
    created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE courses (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    professor_id UUID REFERENCES professors(id),
    university_name TEXT NOT NULL,
    course_name TEXT NOT NULL,
    course_code TEXT,
    grade_level TEXT,
    raw_input TEXT,
    status TEXT DEFAULT 'draft' CHECK (status IN ('draft', 'active', 'archived')),
    created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE curricula (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    course_id UUID REFERENCES courses(id) ON DELETE CASCADE,
    version INT DEFAULT 1,
    content JSONB NOT NULL,
    is_final BOOLEAN DEFAULT false,
    source TEXT DEFAULT 'baseline' CHECK (source IN ('baseline', 'modified')),
    created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE curriculum_inspirations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    curriculum_id UUID REFERENCES curricula(id) ON DELETE CASCADE,
    source_university TEXT NOT NULL,
    source_course TEXT,
    content_snapshot JSONB,
    created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE uploaded_files (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    course_id UUID REFERENCES courses(id) ON DELETE CASCADE,
    file_name TEXT NOT NULL,
    file_path TEXT NOT NULL,
    file_type TEXT,
    processed_content JSONB,
    created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE lectures (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    curriculum_id UUID REFERENCES curricula(id) ON DELETE CASCADE,
    course_id UUID REFERENCES courses(id) ON DELETE CASCADE,
    lecture_number INT NOT NULL,
    title TEXT NOT NULL,
    content JSONB NOT NULL,
    revision_content JSONB,
    status TEXT DEFAULT 'draft' CHECK (status IN ('draft', 'published')),
    created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE forum_questions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    lecture_id UUID REFERENCES lectures(id) ON DELETE CASCADE,
    question_text TEXT NOT NULL,
    upvotes INT DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE quizzes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    lecture_id UUID REFERENCES lectures(id) ON DELETE CASCADE,
    questions JSONB NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE quiz_responses (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    quiz_id UUID REFERENCES quizzes(id) ON DELETE CASCADE,
    answers JSONB NOT NULL,
    score FLOAT,
    submitted_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE feedback (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    lecture_id UUID REFERENCES lectures(id) ON DELETE CASCADE,
    rating INT CHECK (rating BETWEEN 1 AND 5),
    comment TEXT,
    submitted_at TIMESTAMPTZ DEFAULT now()
);

-- RPC for atomic upvote increment
CREATE OR REPLACE FUNCTION increment_upvotes(question_id UUID)
RETURNS void AS $$
  UPDATE forum_questions SET upvotes = upvotes + 1 WHERE id = question_id;
$$ LANGUAGE sql;

-- Supabase Storage bucket (run via dashboard or CLI, not SQL)
-- Bucket name: course-files (private)
