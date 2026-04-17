from collections import defaultdict
from typing import List

def compute_participation(transcripts: list) -> dict:
    """Compute speaking stats per participant."""
    speaker_words    = defaultdict(int)
    speaker_duration = defaultdict(float)
    speaker_turns    = defaultdict(int)

    for t in transcripts:
        speaker  = t.get("speaker", "Unknown")
        text     = t.get("original_text", "")
        duration = t.get("end_sec", 0) - t.get("start_sec", 0)
        speaker_words[speaker]    += len(text.split())
        speaker_duration[speaker] += max(0, duration)
        speaker_turns[speaker]    += 1

    total_words    = max(sum(speaker_words.values()), 1)
    total_duration = max(sum(speaker_duration.values()), 1)

    result = {}
    for speaker in speaker_words:
        result[speaker] = {
            "word_count":       speaker_words[speaker],
            "speaking_duration":speaker_duration[speaker],
            "participation_pct":round(speaker_duration[speaker] / total_duration * 100, 1),
            "turns":            speaker_turns[speaker],
        }

    # Rank
    ranked = sorted(result.items(), key=lambda x: x[1]["speaking_duration"], reverse=True)
    for i, (spk, _) in enumerate(ranked):
        result[spk]["rank"] = i + 1
        if   i == 0:                                   result[spk]["label"] = "Most Active"
        elif i == len(ranked) - 1 and len(ranked) > 1: result[spk]["label"] = "Least Active"
        else:                                           result[spk]["label"] = "Contributor"

    return result

def compute_performance_score(data: dict) -> dict:
    """
    Score the meeting 0-10 across dimensions.
    data keys: num_participants, num_decisions, num_action_items,
               duration_sec, num_conflicts, participation_breakdown
    """
    scores = {}

    # Participation balance (lower variance = better)
    pcts = [v["participation_pct"] for v in data.get("participation_breakdown", {}).values()]
    if pcts:
        avg  = sum(pcts) / len(pcts)
        variance = sum((p - avg) ** 2 for p in pcts) / len(pcts)
        balance_score = max(0, 10 - variance / 10)
    else:
        balance_score = 5.0
    scores["participation"] = round(balance_score, 1)

    # Decisions made
    num_decisions = data.get("num_decisions", 0)
    scores["decisions"] = min(10, num_decisions * 2.5)

    # Action items
    num_actions = data.get("num_action_items", 0)
    scores["action_items"] = min(10, num_actions * 2.0)

    # Conflict penalty
    num_conflicts = data.get("num_conflicts", 0)
    scores["harmony"] = max(0, 10 - num_conflicts * 2)

    # Duration efficiency (30-60 min = ideal)
    duration_min = data.get("duration_sec", 0) / 60
    if   duration_min < 10:  scores["efficiency"] = 5.0
    elif duration_min <= 60: scores["efficiency"] = 10.0
    elif duration_min <= 90: scores["efficiency"] = 7.0
    else:                    scores["efficiency"] = 4.0

    overall = round(sum(scores.values()) / len(scores), 1)

    feedback = []
    if scores["participation"] >= 8:   feedback.append("✔ Strong participation balance")
    else:                               feedback.append("⚠ Unbalanced participation")
    if scores["decisions"] >= 7:       feedback.append("✔ Clear decisions made")
    if scores["action_items"] >= 6:    feedback.append("✔ Action items assigned")
    if scores["harmony"] < 6:         feedback.append("⚠ Conflicts detected")
    if scores["efficiency"] >= 8:      feedback.append("✔ Good time efficiency")

    return {
        "overall":        overall,
        "breakdown":      scores,
        "feedback":       feedback,
    }

def build_speaking_graph(transcripts: list) -> dict:
    """Build a time-series speaking graph {speaker: [seconds spoken per minute]}."""
    graph = defaultdict(lambda: defaultdict(float))
    for t in transcripts:
        speaker   = t.get("speaker", "Unknown")
        start_sec = t.get("start_sec", 0)
        end_sec   = t.get("end_sec", start_sec)
        minute    = int(start_sec // 60)
        graph[speaker][minute] += max(0, end_sec - start_sec)

    return {spk: dict(minutes) for spk, minutes in graph.items()}

def detect_interruptions(transcripts: list) -> list:
    """Detect when a speaker starts within 0.5s of the previous ending."""
    interruptions = []
    for i in range(1, len(transcripts)):
        prev = transcripts[i - 1]
        curr = transcripts[i]
        gap  = curr.get("start_sec", 0) - prev.get("end_sec", 0)
        if -0.5 <= gap <= 0.3 and curr.get("speaker") != prev.get("speaker"):
            interruptions.append({
                "time_sec":    curr.get("start_sec", 0),
                "interrupter": curr.get("speaker", "Unknown"),
                "interrupted": prev.get("speaker", "Unknown"),
            })
    return interruptions