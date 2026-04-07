import io
import json
import zipfile

from fpdf import FPDF


# ── helpers ──────────────────────────────────────────────────────────────────

def _safe_title(title: str) -> str:
    return "".join(c if c.isalnum() or c in " _-" else "_" for c in title)


def _latin1(text: str) -> str:
    """Strip/replace characters outside latin-1 so fpdf core fonts don't choke."""
    return text.encode("latin-1", errors="replace").decode("latin-1")


# ── text export ───────────────────────────────────────────────────────────────

def _lecture_txt(course_name: str, lecture: dict, note: str) -> str:
    num = lecture.get("lecture_number", lecture.get("id", "?"))
    title = lecture.get("title", f"Lecture {num}")
    content = lecture.get("content", {})
    revision = lecture.get("revision_content")

    lines = [
        f"Course: {course_name}",
        f"Lecture {num}: {title}",
        "=" * 60,
    ]

    if revision:
        lines += [
            "",
            "REVISION — Previous Lecture",
            "-" * 40,
            *[f"  • {p}" for p in revision.get("recap_points", [])],
        ]
        if revision.get("weak_areas"):
            lines += ["", "  Areas to revisit:"]
            lines += [f"    - {a}" for a in revision["weak_areas"]]

    lines += [
        "",
        "LEARNING OUTCOMES",
        "-" * 40,
        *[f"  • {o}" for o in content.get("learning_outcomes", [])],
        "",
        "KEY CONCEPTS",
        "-" * 40,
        "  " + ", ".join(content.get("key_concepts", [])),
        "",
        "CONTENT",
        "-" * 40,
        content.get("main_content", ""),
    ]

    if note:
        lines += [
            "",
            "PROFESSOR NOTES",
            "-" * 40,
            note,
        ]

    return "\n".join(lines)


# ── PDF export ────────────────────────────────────────────────────────────────

def _lecture_pdf(course_name: str, lecture: dict, note: str) -> bytes:
    num = lecture.get("lecture_number", lecture.get("id", "?"))
    title = lecture.get("title", f"Lecture {num}")
    content = lecture.get("content", {})
    revision = lecture.get("revision_content")

    pdf = FPDF()
    pdf.set_margins(22, 22, 22)
    pdf.add_page()
    pdf.set_auto_page_break(auto=True, margin=22)
    W = pdf.epw

    # ── Page header strip ──────────────────────────────────────────
    pdf.set_fill_color(24, 24, 24)
    pdf.rect(0, 0, 210, 38, style="F")

    pdf.set_xy(22, 10)
    pdf.set_font("Helvetica", "", 8)
    pdf.set_text_color(180, 180, 180)
    pdf.cell(W, 5, _latin1(course_name.upper()))

    pdf.set_xy(22, 16)
    pdf.set_font("Helvetica", "B", 9)
    pdf.set_text_color(200, 200, 200)
    pdf.cell(W, 5, _latin1(f"LECTURE {num}"))

    pdf.set_xy(22, 23)
    pdf.set_font("Helvetica", "B", 13)
    pdf.set_text_color(255, 255, 255)
    pdf.multi_cell(W, 7, _latin1(title))

    pdf.set_y(46)
    pdf.set_text_color(24, 24, 24)

    # ── helpers ────────────────────────────────────────────────────
    def section_header(label: str):
        pdf.ln(4)
        pdf.set_x(pdf.l_margin)
        pdf.set_font("Helvetica", "B", 9)
        pdf.set_text_color(24, 24, 24)
        pdf.multi_cell(W, 6, _latin1(label))
        # underline via line
        y = pdf.get_y()
        pdf.set_draw_color(200, 200, 200)
        pdf.line(pdf.l_margin, y, pdf.l_margin + W, y)
        pdf.ln(3)
        pdf.set_text_color(40, 40, 40)

    def body_text(text: str):
        pdf.set_x(pdf.l_margin)
        pdf.set_font("Helvetica", "", 10)
        pdf.set_text_color(40, 40, 40)
        pdf.multi_cell(W, 5.5, _latin1(text))

    def bullet(text: str):
        pdf.set_x(pdf.l_margin + 3)
        pdf.set_font("Helvetica", "", 10)
        pdf.set_text_color(40, 40, 40)
        pdf.multi_cell(W - 3, 5.5, _latin1(f"-  {text}"))

    def numbered_heading(text: str):
        pdf.ln(2)
        pdf.set_x(pdf.l_margin)
        pdf.set_font("Helvetica", "B", 11)
        pdf.set_text_color(24, 24, 24)
        pdf.multi_cell(W, 6, _latin1(text))
        pdf.set_text_color(40, 40, 40)

    # ── Revision ───────────────────────────────────────────────────
    if revision:
        section_header("Revision — Previous Lecture")
        for p in revision.get("recap_points", []):
            bullet(p)
        if revision.get("weak_areas"):
            pdf.ln(2)
            pdf.set_x(pdf.l_margin)
            pdf.set_font("Helvetica", "BI", 9)
            pdf.set_text_color(100, 100, 100)
            pdf.multi_cell(W, 5, "Areas to revisit:")
            for a in revision["weak_areas"]:
                bullet(a)

    # ── Learning outcomes ──────────────────────────────────────────
    section_header("Learning Outcomes")
    for o in content.get("learning_outcomes", []):
        bullet(o)

    # ── Key concepts ───────────────────────────────────────────────
    section_header("Key Concepts")
    concepts = content.get("key_concepts", [])
    if concepts:
        pdf.set_x(pdf.l_margin)
        pdf.set_font("Helvetica", "B", 10)
        pdf.set_text_color(40, 40, 40)
        pdf.multi_cell(W, 5.5, _latin1("  ".join(f"[{c}]" for c in concepts)))

    # ── Main content ───────────────────────────────────────────────
    section_header("Lecture Content")
    import re
    for line in content.get("main_content", "").split("\n"):
        stripped = line.strip()
        if not stripped:
            pdf.ln(2)
        elif re.match(r"^\d+\.\s", stripped):
            numbered_heading(stripped)
        elif stripped.startswith("- "):
            bullet(stripped[2:])
        else:
            body_text(stripped)

    # ── Professor notes ────────────────────────────────────────────
    if note:
        section_header("Professor Notes")
        body_text(note)

    return bytes(pdf.output())


# ── zip builders ──────────────────────────────────────────────────────────────

def build_lectures_zip(
    course_name: str,
    lectures: list[dict],
    notes: dict[str, str] | None = None,
    fmt: str = "txt",
) -> bytes:
    buf = io.BytesIO()
    with zipfile.ZipFile(buf, "w", zipfile.ZIP_DEFLATED) as zf:
        for lecture in lectures:
            num = lecture.get("lecture_number", lecture.get("id", "?"))
            title = lecture.get("title", f"Lecture {num}")
            safe = _safe_title(title)
            note = (notes or {}).get(str(lecture.get("id", "")), "").strip()

            if fmt == "pdf":
                filename = f"Lecture_{num:02d}_{safe}.pdf"
                zf.writestr(filename, _lecture_pdf(course_name, lecture, note))
            else:
                filename = f"Lecture_{num:02d}_{safe}.txt"
                zf.writestr(filename, _lecture_txt(course_name, lecture, note))

        # JSON summary always included
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
