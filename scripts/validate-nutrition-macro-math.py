#!/usr/bin/env python3
"""Deterministic regression checks for Fifty Fit custom nutrition macro math."""

from math import isclose

KCAL_PER_GRAM = {"carbs": 4.0, "protein": 4.0, "fat": 9.0}


def calculate(calories, carbs_pct, protein_pct=None, fat_pct=0.0):
    if protein_pct is None:
        protein_pct = 100.0 - carbs_pct - fat_pct
    total = carbs_pct + protein_pct + fat_pct
    assert isclose(total, 100.0, abs_tol=1e-9), total
    grams = {
        "carbs": calories * (carbs_pct / 100.0) / KCAL_PER_GRAM["carbs"],
        "protein": calories * (protein_pct / 100.0) / KCAL_PER_GRAM["protein"],
        "fat": calories * (fat_pct / 100.0) / KCAL_PER_GRAM["fat"],
    }
    return grams


def assert_case(calories, carbs, protein, fat, expected):
    actual = calculate(calories, carbs, protein, fat)
    for key, value in expected.items():
        assert isclose(actual[key], value, abs_tol=1e-9), (key, actual[key], value)
    reconstructed = sum(actual[k] * KCAL_PER_GRAM[k] for k in actual)
    assert isclose(reconstructed, calories, abs_tol=1e-9), (reconstructed, calories)


# User-requested 3000 kcal examples.
assert_case(
    3000, 55, 20, 25,
    {"carbs": 412.5, "protein": 150.0, "fat": 83.33333333333333},
)
assert_case(
    3000, 65, None, 16,
    {"carbs": 487.5, "protein": 142.5, "fat": 53.333333333333336},
)

# Additional edge cases for the remainder mode and non-3000 targets.
assert_case(
    2200, 50, None, 30,
    {"carbs": 275.0, "protein": 110.0, "fat": 73.33333333333333},
)
assert_case(
    1800, 40, 30, 30,
    {"carbs": 180.0, "protein": 135.0, "fat": 60.0},
)

print("Nutrition macro math regression tests passed")
