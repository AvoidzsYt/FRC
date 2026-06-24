"""Unit tests for autofarm helper functions (pure logic only)."""

import math
import sys
import unittest
from unittest.mock import MagicMock

# Mock pyautogui before importing autofarm since tkinter may not be available
sys.modules["pyautogui"] = MagicMock()

import numpy as np

from autofarm import (
    angle_diff,
    angle_from_center,
    detect_colored_zone_angle,
    detect_white_line_angle,
    find_circle,
)

import cv2


class TestAngleFromCenter(unittest.TestCase):
    def test_right(self):
        self.assertAlmostEqual(angle_from_center(0, 0, 10, 0), 0, places=1)

    def test_down(self):
        self.assertAlmostEqual(angle_from_center(0, 0, 0, 10), 90, places=1)

    def test_left(self):
        self.assertAlmostEqual(angle_from_center(0, 0, -10, 0), 180, places=1)

    def test_up(self):
        self.assertAlmostEqual(angle_from_center(0, 0, 0, -10), 270, places=1)

    def test_diagonal(self):
        a = angle_from_center(0, 0, 10, 10)
        self.assertAlmostEqual(a, 45, places=1)

    def test_offset_center(self):
        a = angle_from_center(100, 100, 110, 100)
        self.assertAlmostEqual(a, 0, places=1)


class TestAngleDiff(unittest.TestCase):
    def test_same(self):
        self.assertEqual(angle_diff(90, 90), 0)

    def test_small_diff(self):
        self.assertAlmostEqual(angle_diff(10, 20), 10, places=1)

    def test_wrap_around(self):
        self.assertAlmostEqual(angle_diff(350, 10), 20, places=1)

    def test_opposite(self):
        self.assertAlmostEqual(angle_diff(0, 180), 180, places=1)

    def test_large_values(self):
        self.assertAlmostEqual(angle_diff(720, 0), 0, places=1)

    def test_symmetry(self):
        self.assertEqual(angle_diff(30, 60), angle_diff(60, 30))


class TestFindCircle(unittest.TestCase):
    def _make_circle_frame(self, cx, cy, r, w=640, h=350):
        frame = np.zeros((h, w, 3), dtype=np.uint8)
        cv2.circle(frame, (cx, cy), r, (200, 200, 200), 2)
        return frame

    def test_detects_centered_circle(self):
        frame = self._make_circle_frame(320, 175, 60)
        result = find_circle(frame)
        self.assertIsNotNone(result)
        cx, cy, r = result
        self.assertAlmostEqual(cx, 320, delta=10)
        self.assertAlmostEqual(cy, 175, delta=10)
        self.assertAlmostEqual(r, 60, delta=10)

    def test_returns_none_for_blank_frame(self):
        frame = np.zeros((350, 640, 3), dtype=np.uint8)
        result = find_circle(frame)
        self.assertIsNone(result)

    def test_prefers_horizontally_centered_circle(self):
        frame = np.zeros((350, 640, 3), dtype=np.uint8)
        cv2.circle(frame, (50, 175), 50, (200, 200, 200), 2)
        cv2.circle(frame, (320, 175), 50, (200, 200, 200), 2)
        result = find_circle(frame)
        if result:
            cx, _, _ = result
            self.assertAlmostEqual(cx, 320, delta=30)


class TestDetectWhiteLineAngle(unittest.TestCase):
    def _make_line_frame(self, cx, cy, r, angle_deg, w=640, h=350):
        frame = np.zeros((h, w, 3), dtype=np.uint8)
        cv2.circle(frame, (cx, cy), r, (80, 80, 80), 2)
        rad = math.radians(angle_deg)
        ex = int(cx + r * math.cos(rad))
        ey = int(cy + r * math.sin(rad))
        cv2.line(frame, (cx, cy), (ex, ey), (255, 255, 255), 3)
        return frame

    def test_detects_line_at_0_degrees(self):
        frame = self._make_line_frame(320, 175, 60, 0)
        angle = detect_white_line_angle(frame, 320, 175, 60)
        self.assertIsNotNone(angle)
        self.assertLess(angle_diff(angle, 0), 20)

    def test_detects_line_at_90_degrees(self):
        frame = self._make_line_frame(320, 175, 60, 90)
        angle = detect_white_line_angle(frame, 320, 175, 60)
        self.assertIsNotNone(angle)
        self.assertLess(angle_diff(angle, 90), 20)

    def test_detects_line_at_270_degrees(self):
        frame = self._make_line_frame(320, 175, 60, 270)
        angle = detect_white_line_angle(frame, 320, 175, 60)
        self.assertIsNotNone(angle)
        self.assertLess(angle_diff(angle, 270), 20)

    def test_returns_none_for_dark_frame(self):
        frame = np.zeros((350, 640, 3), dtype=np.uint8)
        result = detect_white_line_angle(frame, 320, 175, 60)
        self.assertIsNone(result)


class TestDetectColoredZoneAngle(unittest.TestCase):
    def _make_zone_frame(self, cx, cy, r, zone_center_deg, zone_span_deg, color_bgr, w=640, h=350):
        frame = np.zeros((h, w, 3), dtype=np.uint8)
        sample_r = int(r * 0.85)
        start = int(zone_center_deg - zone_span_deg / 2)
        end = int(zone_center_deg + zone_span_deg / 2)
        for d in range(start, end + 1):
            rad = math.radians(d % 360)
            px = int(cx + sample_r * math.cos(rad))
            py = int(cy + sample_r * math.sin(rad))
            if 0 <= px < w and 0 <= py < h:
                for dx in range(-2, 3):
                    for dy in range(-2, 3):
                        nx, ny = px + dx, py + dy
                        if 0 <= nx < w and 0 <= ny < h:
                            frame[ny, nx] = color_bgr
        return frame

    def test_detects_red_zone(self):
        frame = self._make_zone_frame(320, 175, 60, 45, 30, (0, 0, 255))
        result = detect_colored_zone_angle(frame, 320, 175, 60)
        self.assertIsNotNone(result)
        center_angle, span, color = result
        self.assertLess(angle_diff(center_angle, 45), 20)

    def test_detects_green_zone(self):
        frame = self._make_zone_frame(320, 175, 60, 180, 40, (0, 255, 0))
        result = detect_colored_zone_angle(frame, 320, 175, 60)
        self.assertIsNotNone(result)
        center_angle, _, _ = result
        self.assertLess(angle_diff(center_angle, 180), 20)

    def test_returns_none_for_blank_frame(self):
        frame = np.zeros((350, 640, 3), dtype=np.uint8)
        result = detect_colored_zone_angle(frame, 320, 175, 60)
        self.assertIsNone(result)

    def test_returns_none_for_grayscale_frame(self):
        frame = np.full((350, 640, 3), 128, dtype=np.uint8)
        result = detect_colored_zone_angle(frame, 320, 175, 60)
        self.assertIsNone(result)


if __name__ == "__main__":
    unittest.main()
