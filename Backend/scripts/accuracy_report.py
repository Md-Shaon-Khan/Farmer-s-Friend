"""Reads data/prediction_log.jsonl and prints accuracy.

Usage (from Backend/):  python scripts/accuracy_report.py
"""
import json
from collections import defaultdict
from pathlib import Path

LOG = Path(__file__).resolve().parent.parent / "data" / "prediction_log.jsonl"

if not LOG.exists():
    raise SystemExit(f"No log file yet: {LOG}")

preds, actual = {}, {}
for line in LOG.read_text(encoding="utf-8").splitlines():
    if not line.strip():
        continue
    r = json.loads(line)
    if r["type"] == "prediction":
        preds[r["id"]] = r
    elif r["type"] == "feedback":
        actual[r["id"]] = r          # later feedback overwrites earlier

rows = [(preds[i], a) for i, a in actual.items() if i in preds]
print(f"Predictions logged : {len(preds)}")
print(f"With actual label  : {len(rows)}")
if not rows:
    raise SystemExit("No feedback yet.")

correct = sum(p["predicted_key"] == a["actual_key"] for p, a in rows)
print(f"Accuracy           : {correct}/{len(rows)} = {100 * correct / len(rows):.1f}%\n")

per = defaultdict(lambda: [0, 0])    # actual_key -> [correct, total]
for p, a in rows:
    per[a["actual_key"]][1] += 1
    per[a["actual_key"]][0] += p["predicted_key"] == a["actual_key"]
print("Per actual class:")
for k, (c, t) in sorted(per.items()):
    print(f"  {k:24s} {c}/{t}  ({100 * c / t:.0f}%)")

print("\nWrong predictions:")
for p, a in rows:
    if p["predicted_key"] != a["actual_key"]:
        conf = p["confidence"] if p["confidence"] is not None else 0
        print(f"  predicted={p['predicted_key']:22s} actual={a['actual_key']:22s} "
              f"conf={conf:.2f}  {p['image']}")