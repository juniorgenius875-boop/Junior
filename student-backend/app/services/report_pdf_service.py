from __future__ import annotations

from datetime import datetime
from io import BytesIO
from typing import Any

from reportlab.lib import colors
from reportlab.lib.enums import TA_LEFT
from reportlab.lib.pagesizes import A4, landscape
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import mm
from reportlab.platypus import KeepTogether, Paragraph, SimpleDocTemplate, Spacer, Table, TableStyle

INK = colors.HexColor('#151821')
MUTED = colors.HexColor('#626A7A')
LINE = colors.HexColor('#E2E5EA')
ACCENT = colors.HexColor('#4F46E5')
SOFT = colors.HexColor('#F5F6FA')
DANGER = colors.HexColor('#B42318')


def _safe(value: Any, fallback: str = '—') -> str:
    if value is None or value == '':
        return fallback
    if isinstance(value, float):
        return f'{value:.1f}'.rstrip('0').rstrip('.')
    return str(value)


def _date(value: Any) -> str:
    if not value:
        return '—'
    if isinstance(value, datetime):
        dt = value
    else:
        try:
            dt = datetime.fromisoformat(str(value).replace('Z', '+00:00'))
        except Exception:
            return str(value)
    return dt.strftime('%d %b %Y, %H:%M')


def _pct(score: Any, total: Any) -> str:
    try:
        total = float(total)
        return f'{(float(score) / total) * 100:.1f}%' if total else '—'
    except Exception:
        return '—'


def _styles():
    base = getSampleStyleSheet()
    return {
        'title': ParagraphStyle('title', parent=base['Title'], fontName='Helvetica-Bold', fontSize=20, leading=24, textColor=INK, spaceAfter=3),
        'meta': ParagraphStyle('meta', parent=base['BodyText'], fontName='Helvetica', fontSize=8.5, leading=12, textColor=MUTED),
        'h2': ParagraphStyle('h2', parent=base['Heading2'], fontName='Helvetica-Bold', fontSize=11.5, leading=14, textColor=INK, spaceBefore=10, spaceAfter=7),
        'body': ParagraphStyle('body', parent=base['BodyText'], fontName='Helvetica', fontSize=8.5, leading=12, textColor=INK),
        'small': ParagraphStyle('small', parent=base['BodyText'], fontName='Helvetica', fontSize=7.2, leading=9.5, textColor=MUTED),
        'cell': ParagraphStyle('cell', parent=base['BodyText'], fontName='Helvetica', fontSize=7.3, leading=9, textColor=INK, alignment=TA_LEFT),
        'head': ParagraphStyle('head', parent=base['BodyText'], fontName='Helvetica-Bold', fontSize=7.2, leading=9, textColor=colors.white),
    }


def _header_footer(canvas, doc):
    canvas.saveState()
    width, height = doc.pagesize
    canvas.setStrokeColor(LINE)
    canvas.line(doc.leftMargin, 13 * mm, width - doc.rightMargin, 13 * mm)
    canvas.setFont('Helvetica', 7)
    canvas.setFillColor(MUTED)
    canvas.drawString(doc.leftMargin, 8.5 * mm, 'Junior Genius')
    canvas.drawRightString(width - doc.rightMargin, 8.5 * mm, f'Page {doc.page}')
    canvas.restoreState()


def _table(headers: list[str], rows: list[list[Any]], widths=None, styles=None):
    styles = styles or _styles()
    data = [[Paragraph(str(h), styles['head']) for h in headers]]
    for row in rows:
        data.append([Paragraph(_safe(v), styles['cell']) for v in row])
    table = Table(data, colWidths=widths, repeatRows=1, hAlign='LEFT')
    table.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, 0), INK),
        ('TEXTCOLOR', (0, 0), (-1, 0), colors.white),
        ('VALIGN', (0, 0), (-1, -1), 'TOP'),
        ('LEFTPADDING', (0, 0), (-1, -1), 5),
        ('RIGHTPADDING', (0, 0), (-1, -1), 5),
        ('TOPPADDING', (0, 0), (-1, -1), 5),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 5),
        ('GRID', (0, 0), (-1, -1), 0.35, LINE),
        ('ROWBACKGROUNDS', (0, 1), (-1, -1), [colors.white, SOFT]),
    ]))
    return table


def _summary_table(pairs: list[tuple[str, Any]], styles):
    cells = []
    for label, value in pairs:
        cells.append([
            Paragraph(label, styles['small']),
            Paragraph(f'<b>{_safe(value)}</b>', styles['body']),
        ])
    # Two metrics per row, each metric uses label/value pair.
    rows = []
    for i in range(0, len(cells), 2):
        left = cells[i]
        right = cells[i + 1] if i + 1 < len(cells) else ['', '']
        rows.append([left[0], left[1], right[0], right[1]])
    t = Table(rows, colWidths=[34*mm, 39*mm, 34*mm, 39*mm], hAlign='LEFT')
    t.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, -1), SOFT),
        ('BOX', (0, 0), (-1, -1), 0.4, LINE),
        ('INNERGRID', (0, 0), (-1, -1), 0.25, LINE),
        ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
        ('LEFTPADDING', (0, 0), (-1, -1), 7),
        ('RIGHTPADDING', (0, 0), (-1, -1), 7),
        ('TOPPADDING', (0, 0), (-1, -1), 7),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 7),
    ]))
    return t


def student_report_pdf(data: dict, *, admin_copy: bool = False) -> bytes:
    styles = _styles()
    buffer = BytesIO()
    doc = SimpleDocTemplate(
        buffer,
        pagesize=A4,
        rightMargin=15 * mm,
        leftMargin=15 * mm,
        topMargin=16 * mm,
        bottomMargin=19 * mm,
        title='Student Learning Report',
        author='Junior Genius',
    )
    story = []
    user = data.get('user', {})
    profile = user.get('profile', {}) or {}
    summary = data.get('summary', {}) or {}
    progress = data.get('progress', []) or []
    tests = data.get('tests', []) or []
    chats = data.get('chats', []) or []
    activity = data.get('activity', []) or []

    name = profile.get('name') or user.get('email') or 'Student'
    story += [
        Paragraph('Student Learning Report', styles['title']),
        Paragraph(f'{name}  |  {_safe(user.get("email"))}  |  Generated {_date(datetime.now())}', styles['meta']),
        Spacer(1, 6 * mm),
    ]

    profile_pairs = [
        ('Grade', profile.get('grade')),
        ('School', profile.get('school')),
        ('Favorite subject', profile.get('favorite_subject')),
        ('Dream job', profile.get('dream_job')),
        ('Hobbies', profile.get('hobbies')),
        ('Account created', _date(user.get('created_at'))),
    ]
    story += [Paragraph('Student profile', styles['h2']), _summary_table(profile_pairs, styles)]

    if not summary:
        percentages = [(r.get('score', 0) / r.get('total_marks', 1)) * 100 for r in tests if r.get('total_marks', 0)]
        latest = progress[0] if progress else {}
        summary = {
            'total_tests': len(percentages),
            'best_score': round(max(percentages), 1) if percentages else 0,
            'average_score': round(sum(percentages) / len(percentages), 1) if percentages else 0,
            'total_predictions': len(progress),
            'ai_questions': len(chats),
            'latest_risk': latest.get('risk_level'),
            'latest_predicted_marks': latest.get('total_predicted_marks'),
            'latest_attendance': latest.get('attendance'),
            'latest_study_hours': latest.get('study_hours'),
        }

    summary_pairs = [
        ('Latest predicted marks', summary.get('latest_predicted_marks')),
        ('Current risk', summary.get('latest_risk')),
        ('Average assessment', f"{_safe(summary.get('average_score'), '0')}%"),
        ('Best assessment', f"{_safe(summary.get('best_score'), '0')}%"),
        ('Tests completed', summary.get('total_tests')),
        ('Predictions saved', summary.get('total_predictions')),
        ('Attendance', f"{_safe(summary.get('latest_attendance'))}%" if summary.get('latest_attendance') is not None else '—'),
        ('Daily study hours', summary.get('latest_study_hours')),
        ('AI Tutor questions', summary.get('ai_questions')),
    ]
    story += [Paragraph('Learning summary', styles['h2']), _summary_table(summary_pairs, styles)]

    latest = progress[0] if progress else None
    if latest:
        story += [Paragraph('Latest academic snapshot', styles['h2'])]
        story.append(_table(
            ['Math', 'Reading', 'Writing', 'Internal 1', 'Internal 2', 'Assignment', 'Attendance', 'Study h/day'],
            [[latest.get('math_score'), latest.get('reading_score'), latest.get('writing_score'), latest.get('internal_test_1'), latest.get('internal_test_2'), latest.get('assignment_score'), latest.get('attendance'), latest.get('study_hours')]],
            widths=[20*mm, 20*mm, 20*mm, 20*mm, 20*mm, 20*mm, 22*mm, 22*mm], styles=styles,
        ))

    story += [Paragraph('Prediction history', styles['h2'])]
    if progress:
        rows = [[
            _date(r.get('created_at')), r.get('math_score'), r.get('reading_score'), r.get('writing_score'),
            r.get('attendance'), r.get('study_hours'), r.get('total_predicted_marks'), r.get('risk_level')
        ] for r in progress[:100]]
        story.append(_table(['Date', 'Math', 'Read', 'Write', 'Attend.', 'Study h', 'Predicted', 'Risk'], rows,
                            widths=[33*mm, 16*mm, 16*mm, 16*mm, 18*mm, 18*mm, 20*mm, 20*mm], styles=styles))
    else:
        story.append(Paragraph('No saved predictions.', styles['body']))

    story += [Paragraph('Assessment history', styles['h2'])]
    if tests:
        rows = [[_date(t.get('created_at')), t.get('test_type'), t.get('difficulty'), f"{_safe(t.get('score'))}/{_safe(t.get('total_marks'))}", _pct(t.get('score'), t.get('total_marks')), ', '.join((t.get('wrong_answers') or [])[:2]) or 'None'] for t in tests[:100]]
        story.append(_table(['Date', 'Assessment', 'Difficulty', 'Score', 'Percent', 'Review areas'], rows,
                            widths=[32*mm, 29*mm, 22*mm, 18*mm, 18*mm, 49*mm], styles=styles))
    else:
        story.append(Paragraph('No completed assessments.', styles['body']))

    story += [Paragraph('AI Tutor usage', styles['h2'])]
    if chats:
        rows = [[_date(c.get('created_at')), (c.get('provider') or '—'), (c.get('question') or '')[:95], (c.get('reply') or '')[:130]] for c in chats[:40]]
        story.append(_table(['Date', 'Provider', 'Question', 'Response'], rows, widths=[30*mm, 22*mm, 54*mm, 62*mm], styles=styles))
    else:
        story.append(Paragraph('No AI Tutor history.', styles['body']))

    if admin_copy and activity:
        story += [Paragraph('Recent activity', styles['h2'])]
        rows = [[_date(a.get('created_at')), a.get('action'), a.get('page'), str(a.get('metadata') or '')[:120]] for a in activity[:80]]
        story.append(_table(['Date', 'Action', 'Page', 'Details'], rows, widths=[34*mm, 32*mm, 34*mm, 68*mm], styles=styles))

    doc.build(story, onFirstPage=_header_footer, onLaterPages=_header_footer)
    return buffer.getvalue()


def admin_students_pdf(data: dict) -> bytes:
    styles = _styles()
    buffer = BytesIO()
    doc = SimpleDocTemplate(
        buffer,
        pagesize=landscape(A4),
        rightMargin=12 * mm,
        leftMargin=12 * mm,
        topMargin=15 * mm,
        bottomMargin=18 * mm,
        title='Student Portfolio Report',
        author='Junior Genius',
    )
    overview = data.get('overview', {}) or {}
    students = data.get('students', []) or []
    story = [
        Paragraph('Student Portfolio Report', styles['title']),
        Paragraph(f"Generated {_date(data.get('generated_at') or datetime.now())}", styles['meta']),
        Spacer(1, 5 * mm),
        _summary_table([
            ('Students', overview.get('total_users')),
            ('Active in 24h', overview.get('active_24h')),
            ('Online now', overview.get('online_now')),
            ('High risk', overview.get('high_risk')),
            ('Tests in 24h', overview.get('tests_24h')),
            ('AI questions in 24h', overview.get('chats_24h')),
        ], styles),
        Paragraph('Students', styles['h2']),
    ]
    rows = []
    for s in students:
        p = s.get('profile', {}) or {}
        lp = s.get('latest_progress') or {}
        ts = s.get('test_stats') or {}
        cs = s.get('chat_stats') or {}
        rows.append([
            p.get('name') or 'Unnamed', s.get('email'), p.get('grade'), p.get('school'), lp.get('risk_level'),
            lp.get('total_predicted_marks'), ts.get('count', 0), f"{_safe(ts.get('average_score'), '0')}%", cs.get('count', 0), _date(s.get('last_seen_at'))
        ])
    story.append(_table(
        ['Student', 'Email', 'Grade', 'School', 'Risk', 'Predicted', 'Tests', 'Test avg', 'AI chats', 'Last seen'],
        rows,
        widths=[34*mm, 48*mm, 17*mm, 43*mm, 20*mm, 22*mm, 17*mm, 21*mm, 19*mm, 34*mm], styles=styles,
    ))
    doc.build(story, onFirstPage=_header_footer, onLaterPages=_header_footer)
    return buffer.getvalue()
