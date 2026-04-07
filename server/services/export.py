import io
import json
import zipfile


def build_lectures_zip(course_name: str, lectures: list[dict], notes: dict[str, str] | None = None) -> bytes:
    buf = io.BytesIO()
    with zipfile.ZipFile(buf, "w", zipfile.ZIP_DEFLATED) as zf:
        for lecture in lectures:
            num = lecture.get("lecture_number", lecture.get("id", "?"))
            title = lecture.get("title", f"Lecture {num}")
            safe_title = "".join(c if c.isalnum() or c in " _-" else "_" for c in title)
            filename = f"Lecture_{num:02d}_{safe_title}.txt"

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
                *[f"  • {c}" for c in content.get("key_concepts", [])],
                "",
                "CONTENT",
                "-" * 40,
                content.get("main_content", ""),
            ]

            lecture_id = str(lecture.get("id", ""))
            professor_note = (notes or {}).get(lecture_id, "").strip()
            if professor_note:
                lines += [
                    "",
                    "PROFESSOR NOTES",
                    "-" * 40,
                    professor_note,
                ]

            zf.writestr(filename, "\n".join(lines))

        # also write a JSON summary
        zf.writestr(
            "course_summary.json",
            json.dumps(
                {
                    "course": course_name,
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
