"""Rule alerts are separate from ML inference. JSON is generated from backend/config."""
import json
import math
from pathlib import Path

RULES = json.loads(Path(__file__).with_name('monitoring_rules.json').read_text(encoding='utf-8'))

def assess(health):
    values = {}
    for level in RULES['levels']:
        for key, _, _ in level['conditions']:
            raw = (health or {}).get(key)
            try:
                number = float(raw) if raw is not None and raw != '' else None
                values[key] = number if number is not None and math.isfinite(number) else None
            except (ValueError, TypeError):
                values[key] = None
    compare = {'>': lambda a, b: a > b, '<': lambda a, b: a < b, '>=': lambda a, b: a >= b}
    for level in RULES['levels']:
        if any(values[key] is not None and compare[op](values[key], threshold) for key, op, threshold in level['conditions']):
            return level['label']
    return RULES['stableLabel'] if any(value is not None for value in values.values()) else RULES['missingLabel']
