from reportlab.lib.pagesizes import A4
from reportlab.lib import colors
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import cm
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, HRFlowable
from reportlab.lib.enums import TA_CENTER, TA_LEFT
import io
from datetime import datetime

def generate_meeting_pdf(meeting_data: dict) -> bytes:
    buffer = io.BytesIO()
    doc    = SimpleDocTemplate(buffer, pagesize=A4,
                               rightMargin=2*cm, leftMargin=2*cm,
                               topMargin=2*cm, bottomMargin=2*cm)

    styles  = getSampleStyleSheet()
    # Custom styles
    title_style = ParagraphStyle("Title2", parent=styles["Title"],
                                  fontSize=22, textColor=colors.HexColor("#6366f1"),
                                  spaceAfter=6)
    h2_style    = ParagraphStyle("H2", parent=styles["Heading2"],
                                  fontSize=13, textColor=colors.HexColor("#4f46e5"),
                                  spaceBefore=14, spaceAfter=4)
    body_style  = ParagraphStyle("Body2", parent=styles["Normal"],
                                  fontSize=10, leading=15,
                                  textColor=colors.HexColor("#1e1e2e"))
    meta_style  = ParagraphStyle("Meta", parent=styles["Normal"],
                                  fontSize=9, textColor=colors.grey)
    bullet_style= ParagraphStyle("Bullet", parent=body_style,
                                  leftIndent=12, spaceBefore=2)

    story = []

    # ── Header ──────────────────────────────────────────────
    story.append(Paragraph("🚀 NeroMeet AI — Smart Meeting Report", title_style))

    story.append(Spacer(1, 6))

    # ✨ tagline
    story.append(Paragraph(
        "✨ AI-generated insights • Actionable outcomes • Smart analytics",
        meta_style
    ))

    story.append(Spacer(1, 8))

    # 📅 meeting details
    story.append(Paragraph(
        f"Meeting: <b>{meeting_data.get('title','Untitled')}</b>  |  "
        f"Date: {meeting_data.get('date', datetime.now().strftime('%b %d, %Y'))}  |  "
        f"Duration: {meeting_data.get('duration','N/A')}",
        meta_style
    ))
    story.append(HRFlowable(width="100%", thickness=1, color=colors.HexColor("#e5e7eb"), spaceAfter=10))

    # ── Performance Score ────────────────────────────────────
    score = meeting_data.get("performance_score", 0)
    story.append(Paragraph("📊 Meeting Performance Score", h2_style))
    story.append(Paragraph(f"<b>Overall Score: {score}/10</b>", body_style))
    for fb in meeting_data.get("score_feedback", []):
        story.append(Paragraph(f"• {fb}", bullet_style))
    story.append(Spacer(1, 8))

    # ── Summary ──────────────────────────────────────────────
    if meeting_data.get("full_summary"):
        # 🔥 AI Insights
        story.append(Paragraph("🤖 AI Insights", h2_style))

        score = meeting_data.get("performance_score", 0)

        if score >= 8:
            insight = "Excellent meeting with strong collaboration and clarity."
        elif score >= 5:
            insight = "Moderate meeting — could improve engagement and focus."
        else:
            insight = "Meeting needs improvement — low clarity or participation."

        story.append(Paragraph(insight, body_style))
        story.append(Spacer(1, 6))
        story.append(Paragraph("🧠 Meeting Summary", h2_style))
        story.append(Paragraph(meeting_data["full_summary"], body_style))
        story.append(Spacer(1, 6))

    # ── Key Points ───────────────────────────────────────────
    if meeting_data.get("key_points"):
        story.append(Paragraph("💡 Key Points", h2_style))
        for kp in meeting_data["key_points"]:
            story.append(Paragraph(f"• {kp}", bullet_style))
        story.append(Spacer(1, 6))

    # ── Decisions ────────────────────────────────────────────
    if meeting_data.get("decisions"):
        story.append(Paragraph("✅ Decisions Made", h2_style))
        for d in meeting_data["decisions"]:
            story.append(Paragraph(f"• {d}", bullet_style))
        story.append(Spacer(1, 6))

    # ── Best Idea ────────────────────────────────────────────
    if meeting_data.get("best_idea"):
        story.append(Paragraph("🏆 Best Idea", h2_style))
        story.append(Paragraph(meeting_data["best_idea"], body_style))
        story.append(Spacer(1, 6))

    # ── Action Items ─────────────────────────────────────────
    if meeting_data.get("action_items"):
        story.append(Paragraph("🎯 Action Items", h2_style))
        table_data = [["Task", "Assigned To", "Status"]]
        for item in meeting_data["action_items"]:
            table_data.append([
                item.get("task", ""),
                item.get("assigned_to", "Unassigned"),
                item.get("status", "pending").upper(),
            ])
        t = Table(table_data, colWidths=[9*cm, 4*cm, 3*cm])
        t.setStyle(TableStyle([
            ("BACKGROUND",  (0,0), (-1,0),  colors.HexColor("#6366f1")),
            ("TEXTCOLOR",   (0,0), (-1,0),  colors.white),
            ("FONTSIZE",    (0,0), (-1,-1), 9),
            ("ROWBACKGROUNDS", (0,1), (-1,-1), [colors.white, colors.HexColor("#f5f3ff")]),
            ("GRID",        (0,0), (-1,-1), 0.5, colors.HexColor("#e5e7eb")),
            ("PADDING",     (0,0), (-1,-1), 6),
        ]))
        story.append(t)
        story.append(Spacer(1, 8))

    # ── Participants ─────────────────────────────────────────
    if meeting_data.get("participants"):
        story.append(Paragraph("🧑‍🤝‍🧑 Participants", h2_style))
        table_data = [["Name", "Speaking Time", "Word Count", "Attention"]]
        for p in meeting_data["participants"]:
            mins = int(p.get("speaking_duration", 0) // 60)
            secs = int(p.get("speaking_duration", 0) % 60)
            table_data.append([
                p.get("name", "Unknown"),
                f"{mins}m {secs}s",
                str(p.get("word_count", 0)),
                f"{p.get('attention_score', 100):.0f}%",
            ])
        t = Table(table_data, colWidths=[5*cm, 4*cm, 4*cm, 3*cm])
        t.setStyle(TableStyle([
            ("BACKGROUND",  (0,0), (-1,0), colors.HexColor("#4f46e5")),
            ("TEXTCOLOR",   (0,0), (-1,0), colors.white),
            ("FONTSIZE",    (0,0), (-1,-1), 9),
            ("ROWBACKGROUNDS",(0,1),(-1,-1),[colors.white, colors.HexColor("#f5f3ff")]),
            ("GRID",        (0,0), (-1,-1), 0.5, colors.HexColor("#e5e7eb")),
            ("PADDING",     (0,0), (-1,-1), 6),
        ]))
        story.append(t)
        story.append(Spacer(1, 8))

    # ── Topics ───────────────────────────────────────────────
    if meeting_data.get("topics"):
        story.append(Paragraph("🗂 Topic Segments", h2_style))
        for i, topic in enumerate(meeting_data["topics"], 1):
            label = topic.get("label", f"Topic {i}")
            desc  = topic.get("description", "")
            story.append(Paragraph(f"<b>{i}. {label}</b> — {desc}", bullet_style))
        story.append(Spacer(1, 6))

    # ── Transcript ───────────────────────────────────────────
    if meeting_data.get("transcript"):
        story.append(Paragraph("📝 Full Transcript (English)", h2_style))
    for line in meeting_data["transcript"][:50]:
        speaker = line.get("speaker", "Unknown")
        text    = line.get("translated_text") or line.get("original_text", "")

        # 🔥 highlight important lines
        if any(word in text.lower() for word in ["important", "decision", "deadline"]):
            text = f"<b>{text}</b>"

        ts = int(line.get("timestamp_sec", 0))
        m, s = divmod(ts, 60)

        story.append(Paragraph(
            f'<font color="#6366f1"><b>[{m:02d}:{s:02d}] {speaker}:</b></font> {text}',
            body_style
        ))

    # ── Footer ───────────────────────────────────────────────
    story.append(Spacer(1, 20))
    story.append(HRFlowable(width="100%", thickness=0.5, color=colors.grey))
    story.append(Paragraph(
        f"Generated by NeroMeet AI • {datetime.now().strftime('%B %d, %Y at %H:%M')}",
        ParagraphStyle("Footer", parent=meta_style, alignment=TA_CENTER)
    ))

    doc.build(story)
    return buffer.getvalue()