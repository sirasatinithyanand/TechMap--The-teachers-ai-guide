CREATE TABLE lecture_resources (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    lecture_id UUID REFERENCES lectures(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    url TEXT,
    description TEXT,
    resource_type TEXT DEFAULT 'reading' CHECK (resource_type IN ('reading', 'video', 'exercise', 'reference')),
    created_at TIMESTAMPTZ DEFAULT now()
);
