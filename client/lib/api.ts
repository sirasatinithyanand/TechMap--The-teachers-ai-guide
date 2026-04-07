const BASE = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'

async function req<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    headers: { 'Content-Type': 'application/json', ...options?.headers },
    ...options,
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err.detail || `Request failed: ${res.status}`)
  }
  return res.json()
}

// ---- Types ----

export interface ParsedCourse {
  university_name: string
  course_name: string
  course_code: string | null
  grade_level: string | null
}

export interface Course {
  id: string
  professor_id: string
  university_name: string
  course_name: string
  course_code: string | null
  grade_level: string | null
  status: string
  created_at: string
}

export interface Chapter {
  number: number
  title: string
  description?: string
  learning_outcomes: string[]
  topics: string[]
}

export interface Curriculum {
  id: string
  course_id: string
  version: number
  content: { chapters: Chapter[] }
  is_final: boolean
  source: string
  created_at: string
}

export interface Lecture {
  id: string
  course_id: string
  curriculum_id: string
  lecture_number: number
  title: string
  content: {
    main_content: string
    learning_outcomes: string[]
    key_concepts: string[]
  }
  revision_content?: {
    from_lecture: number
    recap_points: string[]
    weak_areas: string[]
  } | null
  status: string
  created_at: string
}

export interface LectureResource {
  id: string
  lecture_id: string
  title: string
  url: string | null
  description: string
  resource_type: 'reading' | 'video' | 'exercise' | 'reference'
  created_at: string
}

export interface Question {
  id: string
  lecture_id: string
  question_text: string
  upvotes: number
  escalated_to_prof: boolean
  created_at: string
}

export interface QuizQuestion {
  q: string
  type: 'mcq' | 'short'
  options?: string[]
}

export interface QuizReviewItem {
  question: string
  your_answer: string
  correct_answer: string
  is_correct: boolean
  explanation: string
  options: string[]
}

export interface Reply {
  id: string
  question_id: string
  reply_text: string
  is_professor: boolean
  is_ai: boolean
  created_at: string
}

export interface FeedbackSummary {
  avg_rating: number
  total_responses: number
  comments: string[]
}

export interface QuizResult {
  quiz_id: string
  total_submissions: number
  avg_score: number
  question_stats: { question: string; correct_count: number; total: number; avg_correct: number }[]
}

// ---- Auth ----

export const authRegister = (name: string, password: string) =>
  req<{ professor_id: string; name: string }>('/api/auth/register', {
    method: 'POST',
    body: JSON.stringify({ name, password }),
  })

export const authLogin = (name: string, password: string) =>
  req<{ professor_id: string; name: string }>('/api/auth/login', {
    method: 'POST',
    body: JSON.stringify({ name, password }),
  })

export const getProfessorCourses = (professorId: string) =>
  req<Course[]>(`/api/professors/${professorId}/courses`)

// ---- Courses ----

export const parseCourse = (sentence: string) =>
  req<ParsedCourse>('/api/courses/parse', {
    method: 'POST',
    body: JSON.stringify({ sentence }),
  })

export const createCourse = (data: {
  professor_name?: string
  university_name: string
  course_name: string
  course_code?: string | null
  grade_level?: string | null
  raw_input?: string
}) =>
  req<Course>('/api/courses', { method: 'POST', body: JSON.stringify(data) })

export const getCourse = (id: string) => req<Course>(`/api/courses/${id}`)

export const deleteCourse = (id: string) =>
  fetch(`${BASE}/api/courses/${id}`, { method: 'DELETE' }).then((r) => {
    if (!r.ok && r.status !== 204) throw new Error(`Delete failed: ${r.status}`)
  })

// ---- Curriculum ----

export const generateBaseline = (courseId: string) =>
  req<Curriculum>(`/api/courses/${courseId}/curriculum/baseline`, { method: 'POST' })

export const searchUniversity = (uni: string, course: string) =>
  req<{ university: string; course: string; chapters: Chapter[] }>(
    `/api/universities/search?uni=${encodeURIComponent(uni)}&course=${encodeURIComponent(course)}`
  )

export const blendCurriculum = (
  courseId: string,
  inspiredUniversity: string,
  inspiredChapters: Chapter[]
) =>
  req<{ chapters: Chapter[] }>(`/api/courses/${courseId}/curriculum/blend`, {
    method: 'POST',
    body: JSON.stringify({ inspired_university: inspiredUniversity, inspired_chapters: inspiredChapters }),
  })

export const saveInspiration = (
  courseId: string,
  sourceUniversity: string,
  sourceCourse: string,
  chapters: Chapter[]
) =>
  req(`/api/courses/${courseId}/curriculum/inspire`, {
    method: 'POST',
    body: JSON.stringify({
      source_university: sourceUniversity,
      source_course: sourceCourse,
      content_snapshot: { chapters },
    }),
  })

export const updateCurriculum = (courseId: string, chapters: Chapter[]) =>
  req<Curriculum>(`/api/courses/${courseId}/curriculum`, {
    method: 'PUT',
    body: JSON.stringify({ content: { chapters } }),
  })

export const finalizeCurriculum = (courseId: string) =>
  req<Curriculum>(`/api/courses/${courseId}/curriculum/finalize`, { method: 'POST' })

export const uploadFile = (courseId: string, file: File) => {
  const form = new FormData()
  form.append('file', file)
  return fetch(`${BASE}/api/courses/${courseId}/files/upload`, {
    method: 'POST',
    body: form,
  }).then(async (r) => {
    if (!r.ok) throw new Error((await r.json()).detail)
    return r.json() as Promise<{ file_id: string; extracted_chapters: Chapter[] }>
  })
}

// ---- Lectures ----

export const generateLectures = (courseId: string, teachingStyle?: string) =>
  req<{ generated: number; lectures: Lecture[] }>(`/api/courses/${courseId}/lectures/generate`, {
    method: 'POST',
    body: JSON.stringify({ teaching_style: teachingStyle || 'balanced' }),
  })

export const exportLecturesWithNotes = (courseId: string, notes: Record<string, string>) =>
  fetch(`${BASE}/api/courses/${courseId}/export`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ notes }),
  }).then((r) => {
    if (!r.ok) throw new Error('Export failed')
    return r.blob()
  })

export const listLectures = (courseId: string) =>
  req<Lecture[]>(`/api/courses/${courseId}/lectures`)

export const getLecture = (lectureId: string) => req<Lecture>(`/api/lectures/${lectureId}`)

export const generateQuiz = (lectureId: string) =>
  req(`/api/lectures/${lectureId}/quiz/generate`, { method: 'POST' })

export const getQuiz = (lectureId: string) =>
  req<{ id: string; lecture_id: string; questions: QuizQuestion[] }>(
    `/api/lectures/${lectureId}/quiz`
  )

export const submitQuiz = (quizId: string, answers: string[]) =>
  req<{ submission_id: string; score: number; correct: number; total_mcq: number; review: QuizReviewItem[] }>(
    `/api/quizzes/${quizId}/submit`,
    { method: 'POST', body: JSON.stringify({ answers }) }
  )

export const getQuizResults = (quizId: string) =>
  req<QuizResult>(`/api/quizzes/${quizId}/results`)

export const prepareNextLecture = (lectureId: string) =>
  req<Lecture>(`/api/lectures/${lectureId}/next/prepare`, { method: 'POST' })

export const exportLectures = (courseId: string) =>
  `${BASE}/api/courses/${courseId}/export`

// ---- Resources ----

export const generateResources = (lectureId: string) =>
  req<LectureResource[]>(`/api/lectures/${lectureId}/resources/generate`, { method: 'POST' })

export const getResources = (lectureId: string) =>
  req<LectureResource[]>(`/api/lectures/${lectureId}/resources`)

// ---- Forum ----

export const postQuestion = (lectureId: string, text: string) =>
  req<Question>(`/api/lectures/${lectureId}/questions`, {
    method: 'POST',
    body: JSON.stringify({ question_text: text }),
  })

export const listQuestions = (lectureId: string) =>
  req<Question[]>(`/api/lectures/${lectureId}/questions`)

export const shareResourceToForum = (lectureId: string, resource: LectureResource) =>
  req<Question>(`/api/lectures/${lectureId}/questions`, {
    method: 'POST',
    body: JSON.stringify({
      question_text: `📎 Resource shared by your professor:\n\n*${resource.title}*\n${resource.description ? resource.description + '\n' : ''}🔗 ${resource.url}`,
    }),
  })

export const upvoteQuestion = (questionId: string) =>
  req(`/api/questions/${questionId}/upvote`, { method: 'POST' })

export const postReply = (questionId: string, replyText: string, isProfessor = false) =>
  req<Reply>(`/api/questions/${questionId}/replies`, {
    method: 'POST',
    body: JSON.stringify({ reply_text: replyText, is_professor: isProfessor }),
  })

export const getReplies = (questionId: string) =>
  req<Reply[]>(`/api/questions/${questionId}/replies`)

export const escalateQuestion = (questionId: string) =>
  req<{ escalated: boolean }>(`/api/questions/${questionId}/escalate`, { method: 'POST' })

// ---- Feedback ----

export const submitFeedback = (lectureId: string, rating: number, comment?: string) =>
  req(`/api/lectures/${lectureId}/feedback`, {
    method: 'POST',
    body: JSON.stringify({ rating, comment }),
  })

export const getFeedbackSummary = (lectureId: string) =>
  req<FeedbackSummary>(`/api/lectures/${lectureId}/feedback/summary`)
