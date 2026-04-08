import io
import json
import re
import zipfile

from fpdf import FPDF


# ── helpers ──────────────────────────────────────────────────────────────────

def _safe_title(title: str) -> str:
    return "".join(c if c.isalnum() or c in " _-" else "_" for c in title)


def _clean(text: str) -> str:
    """Normalize unicode to latin-1-safe equivalents."""
    replacements = {
        "\u2014": "-", "\u2013": "-",
        "\u2018": "'", "\u2019": "'",
        "\u201c": '"', "\u201d": '"',
        "\u2022": "-", "\u2026": "...",
        "\u00a0": " ", "\u2192": "->",
        "\u2190": "<-", "\u2265": ">=",
        "\u2264": "<=", "\u2260": "!=",
        "\u03b1": "alpha", "\u03b2": "beta",
        "\u03b3": "gamma", "\u03b4": "delta",
        "\u03a9": "Omega", "\u221e": "inf",
    }
    for char, sub in replacements.items():
        text = text.replace(char, sub)
    # Strip markdown bold markers like **text**
    text = re.sub(r"\*\*(.*?)\*\*", r"\1", text)
    return text.encode("latin-1", errors="replace").decode("latin-1")


# ── text export ───────────────────────────────────────────────────────────────

def _lecture_txt(
    course_name: str,
    lecture: dict,
    note: str,
    sections: set[str] | None = None,
    resources: list[dict] | None = None,
    guide: dict | None = None,
) -> str:
    ALL = {"revision", "outcomes", "concepts", "content", "resources", "guide", "notes"}
    inc = sections if sections else ALL

    num = lecture.get("lecture_number", lecture.get("id", "?"))
    title = lecture.get("title", f"Lecture {num}")
    content = lecture.get("content", {})
    revision = lecture.get("revision_content")

    lines = [
        f"Course: {course_name}",
        f"Lecture {num}: {title}",
        "=" * 60,
    ]

    if "revision" in inc and revision:
        lines += ["", "REVISION - PREVIOUS LECTURE", "-" * 40]
        lines += [f"  - {p}" for p in revision.get("recap_points", [])]
        if revision.get("weak_areas"):
            lines += ["", "  Areas to revisit:"]
            lines += [f"    - {a}" for a in revision["weak_areas"]]

    if "outcomes" in inc:
        lines += ["", "LEARNING OUTCOMES", "-" * 40]
        lines += [f"  - {o}" for o in content.get("learning_outcomes", [])]

    if "concepts" in inc:
        lines += ["", "KEY CONCEPTS", "-" * 40]
        lines += ["  " + "  |  ".join(content.get("key_concepts", []))]

    if "content" in inc:
        lines += ["", "LECTURE CONTENT", "-" * 40, content.get("main_content", "")]

    if "resources" in inc and resources:
        lines += ["", "PRE-LECTURE RESOURCES", "-" * 40]
        for r in resources:
            lines += [f"  [{r.get('resource_type','').upper()}] {r.get('title','')}"]
            if r.get("description"):
                lines += [f"    {r['description']}"]
            if r.get("url"):
                lines += [f"    {r['url']}"]

    if "guide" in inc and guide:
        lines += ["", "TEACHING GUIDE — SLIDES", "-" * 40]
        for s in guide.get("slides", []):
            lines += [f"  Slide {s.get('number','')}: {s.get('title','')}  ({s.get('duration_minutes','')}m)"]
            for pt in s.get("content_points", []):
                lines += [f"    - {pt}"]
            if s.get("suggested_visual"):
                lines += [f"    Visual: {s['suggested_visual']}"]
            if s.get("teaching_note"):
                lines += [f"    Note: {s['teaching_note']}"]
        lines += ["", "TEACHING GUIDE — CLASS FLOW", "-" * 40]
        for phase in guide.get("class_flow", []):
            lines += [f"  {phase.get('phase','')}  ({phase.get('duration','')})"]
            lines += [f"    {phase.get('description','')}"]

    if "notes" in inc and note:
        lines += ["", "PROFESSOR NOTES", "-" * 40, note]

    return "\n".join(lines)


# ── PDF export ────────────────────────────────────────────────────────────────

def _lecture_pdf(
    course_name: str,
    lecture: dict,
    note: str,
    sections: set[str] | None = None,
    resources: list[dict] | None = None,
    guide: dict | None = None,
) -> bytes:
    ALL = {"revision", "outcomes", "concepts", "content", "resources", "guide", "notes"}
    inc = sections if sections else ALL

    num = lecture.get("lecture_number", lecture.get("id", "?"))
    title = lecture.get("title", f"Lecture {num}")
    content = lecture.get("content", {})
    revision = lecture.get("revision_content")

    pdf = FPDF()
    pdf.set_margins(22, 22, 22)
    pdf.add_page()
    pdf.set_auto_page_break(auto=True, margin=24)
    W = pdf.epw

    # ── Cover typography ─────────────────────────────────────────────
    pdf.set_y(18)
    # Course name
    pdf.set_x(22)
    pdf.set_font("Helvetica", "", 7.5)
    pdf.set_text_color(130, 130, 130)
    pdf.multi_cell(W, 5, _clean(course_name.upper()))

    # Lecture number
    pdf.set_x(22)
    pdf.set_font("Helvetica", "B", 8)
    pdf.set_text_color(90, 90, 90)
    pdf.multi_cell(W, 6, _clean(f"LECTURE  {num}"))

    # Title — large bold
    pdf.ln(1)
    pdf.set_x(22)
    pdf.set_font("Helvetica", "B", 18)
    pdf.set_text_color(15, 15, 15)
    pdf.multi_cell(W, 9, _clean(title))

    # Separator rule
    pdf.ln(2)
    rule_y = pdf.get_y()
    pdf.set_draw_color(200, 200, 200)
    pdf.line(22, rule_y, 22 + W, rule_y)
    pdf.ln(8)

    # ── Typography helpers ──────────────────────────────────────────

    def section_header(label: str):
        """Bold uppercase label + thin underline rule."""
        pdf.ln(4)
        pdf.set_x(22)
        pdf.set_font("Helvetica", "B", 8.5)
        pdf.set_text_color(20, 20, 20)
        pdf.multi_cell(W, 6, _clean(label.upper()))
        rule_y = pdf.get_y()
        pdf.set_draw_color(210, 210, 210)
        pdf.line(22, rule_y, 22 + W, rule_y)
        pdf.ln(5)

    def body(text: str):
        pdf.set_x(22)
        pdf.set_font("Helvetica", "", 10)
        pdf.set_text_color(40, 40, 40)
        pdf.multi_cell(W, 5.5, _clean(text))

    def bullet_item(text: str):
        # Small dash indent
        pdf.set_x(22)
        pdf.set_font("Helvetica", "", 10)
        pdf.set_text_color(40, 40, 40)
        pdf.multi_cell(W, 5.5, _clean(f"  -  {text}"))

    def subheading(text: str):
        """Bold inline subheading for numbered content sections."""
        pdf.ln(3)
        pdf.set_x(22)
        pdf.set_font("Helvetica", "B", 10.5)
        pdf.set_text_color(20, 20, 20)
        pdf.multi_cell(W, 6, _clean(text))
        pdf.ln(1)

    def italic_note(text: str):
        pdf.ln(1)
        pdf.set_x(24)
        pdf.set_font("Helvetica", "I", 9.5)
        pdf.set_text_color(80, 80, 80)
        pdf.multi_cell(W - 2, 5.5, _clean(text))

    # ── Revision ────────────────────────────────────────────────────
    if "revision" in inc and revision:
        section_header("Revision - Previous Lecture")
        for p in revision.get("recap_points", []):
            bullet_item(p)
        if revision.get("weak_areas"):
            pdf.ln(2)
            pdf.set_x(22)
            pdf.set_font("Helvetica", "BI", 9)
            pdf.set_text_color(100, 70, 30)
            pdf.cell(W, 5, "Areas to reinforce:")
            pdf.ln(1)
            for a in revision["weak_areas"]:
                bullet_item(a)
        pdf.ln(2)

    # ── Learning outcomes ────────────────────────────────────────────
    if "outcomes" in inc:
        section_header("Learning Outcomes")
        for o in content.get("learning_outcomes", []):
            bullet_item(o)
        pdf.ln(2)

    # ── Key concepts ─────────────────────────────────────────────────
    if "concepts" in inc:
        section_header("Key Concepts")
        for concept in content.get("key_concepts", []):
            cleaned = _clean(concept)
            if ":" in cleaned:
                label, _, rest = cleaned.partition(":")
                # Bold label line
                pdf.set_x(22)
                pdf.set_font("Helvetica", "B", 9.5)
                pdf.set_text_color(20, 20, 20)
                pdf.multi_cell(W, 5.5, label.strip() + ":")
                # Description indented below
                pdf.set_x(28)
                pdf.set_font("Helvetica", "", 9.5)
                pdf.set_text_color(60, 60, 60)
                pdf.multi_cell(W - 6, 5.5, rest.strip())
            else:
                pdf.set_x(22)
                pdf.set_font("Helvetica", "B", 9.5)
                pdf.set_text_color(20, 20, 20)
                pdf.multi_cell(W, 5.5, cleaned)
            pdf.ln(1)
        pdf.ln(1)

    # ── Main content ─────────────────────────────────────────────────
    if "content" in inc:
        section_header("Lecture Content")
        for line in content.get("main_content", "").split("\n"):
            stripped = line.strip()
            # Strip markdown bold **...**
            stripped = re.sub(r"\*\*(.*?)\*\*", r"\1", stripped)
            if not stripped:
                pdf.ln(2)
            elif re.match(r"^\d+\.\s", stripped):
                subheading(stripped)
            elif stripped.startswith("- "):
                bullet_item(stripped[2:])
            else:
                body(stripped)
        pdf.ln(2)

    # ── Pre-lecture resources ─────────────────────────────────────────
    if "resources" in inc and resources:
        section_header("Pre-Lecture Resources")
        type_order = ["video", "reading", "exercise", "reference"]
        by_type: dict[str, list] = {}
        for r in resources:
            by_type.setdefault(r.get("resource_type", "reading"), []).append(r)
        for rtype in type_order:
            if rtype not in by_type:
                continue
            # Type sub-label
            pdf.set_x(22)
            pdf.set_font("Helvetica", "BI", 8.5)
            pdf.set_text_color(80, 80, 80)
            pdf.multi_cell(W, 5, _clean(rtype.upper() + "S"))
            for r in by_type[rtype]:
                # Title bold
                pdf.set_x(22)
                pdf.set_font("Helvetica", "B", 9.5)
                pdf.set_text_color(20, 20, 20)
                pdf.multi_cell(W, 5.5, _clean(r.get("title", "")))
                if r.get("description"):
                    pdf.set_x(25)
                    pdf.set_font("Helvetica", "", 9)
                    pdf.set_text_color(60, 60, 60)
                    pdf.multi_cell(W - 3, 5, _clean(r["description"]))
                if r.get("url"):
                    pdf.set_x(25)
                    pdf.set_font("Helvetica", "I", 8.5)
                    pdf.set_text_color(100, 100, 100)
                    pdf.multi_cell(W - 3, 5, _clean(r["url"]))
                pdf.ln(1)
        pdf.ln(1)

    # ── Teaching guide ────────────────────────────────────────────────
    if "guide" in inc and guide:
        slides = guide.get("slides", [])
        flow = guide.get("class_flow", [])

        if slides:
            section_header("Teaching Guide — Slides")
            for s in slides:
                num_s = s.get("number", "")
                title_s = _clean(s.get("title", ""))
                dur = s.get("duration_minutes", "")
                # Slide heading
                pdf.set_x(22)
                pdf.set_font("Helvetica", "B", 10)
                pdf.set_text_color(20, 20, 20)
                pdf.multi_cell(W, 6, f"{num_s:02d}.  {title_s}  ({dur}m)")
                for pt in s.get("content_points", []):
                    bullet_item(pt)
                if s.get("suggested_visual"):
                    pdf.set_x(22)
                    pdf.set_font("Helvetica", "I", 9)
                    pdf.set_text_color(100, 100, 100)
                    pdf.multi_cell(W, 5, _clean("Visual: " + s["suggested_visual"]))
                if s.get("teaching_note"):
                    pdf.set_x(22)
                    pdf.set_font("Helvetica", "BI", 8.5)
                    pdf.set_text_color(80, 80, 80)
                    pdf.multi_cell(W, 5, _clean("Note: " + s["teaching_note"]))
                pdf.ln(3)

        if flow:
            section_header("Teaching Guide — Class Flow")
            for phase in flow:
                pdf.set_x(22)
                pdf.set_font("Helvetica", "B", 9.5)
                pdf.set_text_color(20, 20, 20)
                pdf.multi_cell(W, 5.5, _clean(f"{phase.get('phase','')}  ({phase.get('duration','')})"))
                pdf.set_x(26)
                pdf.set_font("Helvetica", "", 9.5)
                pdf.set_text_color(50, 50, 50)
                pdf.multi_cell(W - 4, 5.5, _clean(phase.get("description", "")))
                pdf.ln(2)
        pdf.ln(1)

    # ── Professor notes ───────────────────────────────────────────────
    if "notes" in inc and note:
        section_header("Professor Notes")
        italic_note(note)

    return bytes(pdf.output())


# ── zip builders ──────────────────────────────────────────────────────────────

def build_lectures_zip(
    course_name: str,
    lectures: list[dict],
    notes: dict[str, str] | None = None,
    fmt: str = "txt",
    sections: list[str] | None = None,
    resources_by_lecture: dict[str, list] | None = None,
    guides_by_lecture: dict[str, dict] | None = None,
) -> bytes:
    inc = set(sections) if sections else None

    buf = io.BytesIO()
    with zipfile.ZipFile(buf, "w", zipfile.ZIP_DEFLATED) as zf:
        for lecture in lectures:
            num = lecture.get("lecture_number", lecture.get("id", "?"))
            title = lecture.get("title", f"Lecture {num}")
            safe = _safe_title(title)
            note = (notes or {}).get(str(lecture.get("id", "")), "").strip()
            lec_id = str(lecture.get("id", ""))
            lec_resources = (resources_by_lecture or {}).get(lec_id)
            lec_guide = (guides_by_lecture or {}).get(lec_id)

            if fmt == "pdf":
                filename = f"Lecture_{num:02d}_{safe}.pdf"
                zf.writestr(filename, _lecture_pdf(course_name, lecture, note, inc, lec_resources, lec_guide))
            else:
                filename = f"Lecture_{num:02d}_{safe}.txt"
                zf.writestr(filename, _lecture_txt(course_name, lecture, note, inc, lec_resources, lec_guide))

        zf.writestr(
            "course_summary.json",
            json.dumps(
                {
                    "course": course_name,
                    "format": fmt,
                    "total_lectures": len(lectures),
                    "lectures": [
                        {
                            "number": l.get("lecture_number"),
                            "title": l.get("title"),
                            "key_concepts": l.get("content", {}).get("key_concepts", []),
                        }
                        for l in lectures
                    ],
                },
                indent=2,
            ),
        )

    buf.seek(0)
    return buf.read()
