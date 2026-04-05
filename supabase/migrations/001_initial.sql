-- TeachMap Supabase Schema
-- Run this in the Supabase SQL Editor to set up the database

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================
-- Table: fingerprints
-- Stores the classroom context (fingerprint) for each teacher session
-- ============================================================
CREATE TABLE IF NOT EXISTS fingerprints (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  year_level TEXT NOT NULL,
  class_description TEXT NOT NULL,
  topic TEXT NOT NULL,
  esl_percentage INTEGER NOT NULL DEFAULT 0,
  class_size INTEGER NOT NULL DEFAULT 25,
  ability_level TEXT NOT NULL DEFAULT 'mixed',
  location TEXT NOT NULL DEFAULT 'Australia',
  special_needs TEXT[] DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- Table: resources
-- Stores scored teaching resources linked to a fingerprint
-- ============================================================
CREATE TABLE IF NOT EXISTS resources (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  fingerprint_id UUID REFERENCES fingerprints(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  url TEXT NOT NULL,
  description TEXT,
  curriculum_alignment INTEGER NOT NULL DEFAULT 50,
  local_relevance INTEGER NOT NULL DEFAULT 50,
  esl_accessibility INTEGER NOT NULL DEFAULT 50,
  source_reliability INTEGER NOT NULL DEFAULT 50,
  avg_score INTEGER NOT NULL DEFAULT 50,
  why_recommended TEXT,
  latitude FLOAT,
  longitude FLOAT,
  is_imported BOOLEAN NOT NULL DEFAULT FALSE,
  imported_from TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- Table: saved_resources
-- Teacher's personal saved resource list
-- ============================================================
CREATE TABLE IF NOT EXISTS saved_resources (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  resource_id UUID REFERENCES resources(id) ON DELETE CASCADE,
  fingerprint_id UUID REFERENCES fingerprints(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- Table: pulse_feedback
-- Class pulse ratings after a teacher uses a resource
-- ============================================================
CREATE TABLE IF NOT EXISTS pulse_feedback (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  resource_id UUID REFERENCES resources(id) ON DELETE CASCADE,
  fingerprint_id UUID REFERENCES fingerprints(id) ON DELETE CASCADE,
  rating TEXT NOT NULL CHECK (rating IN ('great', 'partial', 'missed')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- Indexes for performance
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_resources_fingerprint_id ON resources(fingerprint_id);
CREATE INDEX IF NOT EXISTS idx_pulse_resource_id ON pulse_feedback(resource_id);
CREATE INDEX IF NOT EXISTS idx_pulse_fingerprint_id ON pulse_feedback(fingerprint_id);
CREATE INDEX IF NOT EXISTS idx_saved_fingerprint_id ON saved_resources(fingerprint_id);

-- ============================================================
-- Row Level Security (RLS)
-- For a production app, enable RLS with proper auth policies.
-- For demo/development, we disable it and use the service role key.
-- ============================================================
ALTER TABLE fingerprints DISABLE ROW LEVEL SECURITY;
ALTER TABLE resources DISABLE ROW LEVEL SECURITY;
ALTER TABLE saved_resources DISABLE ROW LEVEL SECURITY;
ALTER TABLE pulse_feedback DISABLE ROW LEVEL SECURITY;
