"""
Autofarm Bot - Circle Spinner Mini-Game
========================================
Detects a circular mini-game at the bottom of the screen where:
  - A circle contains a number (1-4) in the center
  - A white line rotates around the circle
  - A colored target zone appears on the circle's edge (changes color each cycle)
  - The player must click/press when the white line overlaps the colored zone
  - The mini-game resets roughly every ~33 seconds

Dependencies:
    pip install pyautogui mss opencv-python numpy Pillow

Usage:
    python autofarm.py                 # run with defaults
    python autofarm.py --key space     # use spacebar instead of click
    python autofarm.py --debug         # save debug screenshots to ./debug/
    python autofarm.py --region 400    # search bottom 400px of screen
"""

import argparse
import math
import os
import sys
import time
from datetime import datetime

import cv2
import mss
import numpy as np
import pyautogui

pyautogui.FAILSAFE = True
pyautogui.PAUSE = 0.05

# ---------------------------------------------------------------------------
# Configuration
# ---------------------------------------------------------------------------
DEFAULT_SCAN_REGION_HEIGHT = 350   # pixels from bottom of screen to scan
CIRCLE_MIN_RADIUS = 30
CIRCLE_MAX_RADIUS = 120
WHITE_LINE_THRESHOLD = 220         # brightness threshold for the white line
COLORED_ZONE_SAT_MIN = 80         # minimum saturation to be "colored"
ANGLE_TOLERANCE_DEG = 12          # degrees of tolerance for line-on-zone match
FARM_CYCLE_SECONDS = 33           # approximate cycle time
SCAN_INTERVAL = 0.05              # seconds between scans (~20 fps)
DEBUG_DIR = "debug"


def parse_args():
    parser = argparse.ArgumentParser(description="Autofarm bot for circle-spinner mini-game")
    parser.add_argument("--key", type=str, default=None,
                        help="Keyboard key to press instead of mouse click (e.g. 'space', 'e')")
    parser.add_argument("--debug", action="store_true",
                        help="Save debug screenshots to ./debug/")
    parser.add_argument("--region", type=int, default=DEFAULT_SCAN_REGION_HEIGHT,
                        help="Height in pixels from screen bottom to scan")
    parser.add_argument("--cycles", type=int, default=0,
                        help="Number of farm cycles to run (0 = unlimited)")
    parser.add_argument("--monitor", type=int, default=1,
                        help="Monitor number to capture (default: 1 = primary)")
    return parser.parse_args()


# ---------------------------------------------------------------------------
# Screen capture
# ---------------------------------------------------------------------------
def capture_region(sct, monitor_num, region_height):
    """Capture the bottom portion of the screen."""
    mon = sct.monitors[monitor_num]
    region = {
        "top": mon["top"] + mon["height"] - region_height,
        "left": mon["left"],
        "width": mon["width"],
        "height": region_height
    }
    img = np.array(sct.grab(region))
    return cv2.cvtColor(img, cv2.COLOR_BGRA2BGR), region


# ---------------------------------------------------------------------------
# Circle detection
# ---------------------------------------------------------------------------
def find_circle(frame):
    """Find the mini-game circle in the frame. Returns (cx, cy, radius) or None."""
    gray = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)
    blurred = cv2.GaussianBlur(gray, (9, 9), 2)

    circles = cv2.HoughCircles(
        blurred,
        cv2.HOUGH_GRADIENT,
        dp=1.2,
        minDist=80,
        param1=100,
        param2=40,
        minRadius=CIRCLE_MIN_RADIUS,
        maxRadius=CIRCLE_MAX_RADIUS
    )

    if circles is None:
        return None

    circles = np.round(circles[0]).astype(int)
    # pick the circle closest to the horizontal center of the frame
    frame_cx = frame.shape[1] // 2
    best = min(circles, key=lambda c: abs(c[0] - frame_cx))
    return int(best[0]), int(best[1]), int(best[2])


# ---------------------------------------------------------------------------
# Angle helpers
# ---------------------------------------------------------------------------
def angle_from_center(cx, cy, px, py):
    """Return angle in degrees (0 = right, 90 = down, CCW) from center to point."""
    return math.degrees(math.atan2(py - cy, px - cx)) % 360


def angle_diff(a, b):
    """Shortest angular distance between two angles in degrees."""
    d = abs(a - b) % 360
    return min(d, 360 - d)


# ---------------------------------------------------------------------------
# White line detection
# ---------------------------------------------------------------------------
def detect_white_line_angle(frame, cx, cy, radius):
    """
    Detect the angle of the white rotating line by scanning pixels on an
    annulus just outside the circle edge.
    Returns angle in degrees or None.
    """
    gray = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)
    h, w = gray.shape

    inner_r = max(int(radius * 0.5), 5)
    outer_r = int(radius * 1.15)

    bright_angles = []

    for angle_deg in range(360):
        rad = math.radians(angle_deg)
        sample_r = (inner_r + outer_r) // 2
        px = int(cx + sample_r * math.cos(rad))
        py = int(cy + sample_r * math.sin(rad))

        if 0 <= px < w and 0 <= py < h:
            val = int(gray[py, px])
            if val >= WHITE_LINE_THRESHOLD:
                bright_angles.append(angle_deg)

    if not bright_angles:
        return None

    # cluster the bright angles and pick the center of the largest cluster
    clusters = []
    current = [bright_angles[0]]
    for i in range(1, len(bright_angles)):
        if bright_angles[i] - bright_angles[i - 1] <= 3:
            current.append(bright_angles[i])
        else:
            clusters.append(current)
            current = [bright_angles[i]]
    clusters.append(current)

    # handle wrap-around: merge first and last if close
    if len(clusters) > 1 and (360 - clusters[-1][-1] + clusters[0][0]) <= 3:
        clusters[0] = clusters[-1] + clusters[0]
        clusters.pop()

    largest = max(clusters, key=len)
    # use circular mean for the cluster
    sin_sum = sum(math.sin(math.radians(a)) for a in largest)
    cos_sum = sum(math.cos(math.radians(a)) for a in largest)
    return math.degrees(math.atan2(sin_sum, cos_sum)) % 360


# ---------------------------------------------------------------------------
# Colored zone detection
# ---------------------------------------------------------------------------
def detect_colored_zone_angle(frame, cx, cy, radius):
    """
    Detect the angle span of the colored target zone on the circle edge.
    Returns (center_angle, span_degrees, dominant_color_bgr) or None.
    """
    hsv = cv2.cvtColor(frame, cv2.COLOR_BGR2HSV)
    h, w = hsv.shape[:2]

    sample_r = int(radius * 0.85)
    colored_angles = []

    for angle_deg in range(360):
        rad = math.radians(angle_deg)
        px = int(cx + sample_r * math.cos(rad))
        py = int(cy + sample_r * math.sin(rad))

        if 0 <= px < w and 0 <= py < h:
            _, s, v = hsv[py, px]
            if int(s) >= COLORED_ZONE_SAT_MIN and int(v) >= 60:
                colored_angles.append(angle_deg)

    if len(colored_angles) < 5:
        return None

    # cluster
    clusters = []
    current = [colored_angles[0]]
    for i in range(1, len(colored_angles)):
        if colored_angles[i] - colored_angles[i - 1] <= 5:
            current.append(colored_angles[i])
        else:
            clusters.append(current)
            current = [colored_angles[i]]
    clusters.append(current)

    if len(clusters) > 1 and (360 - clusters[-1][-1] + clusters[0][0]) <= 5:
        clusters[0] = clusters[-1] + clusters[0]
        clusters.pop()

    largest = max(clusters, key=len)
    sin_sum = sum(math.sin(math.radians(a)) for a in largest)
    cos_sum = sum(math.cos(math.radians(a)) for a in largest)
    center_angle = math.degrees(math.atan2(sin_sum, cos_sum)) % 360
    span = len(largest)

    # sample dominant color
    mid = largest[len(largest) // 2]
    rad = math.radians(mid)
    sx = int(cx + sample_r * math.cos(rad))
    sy = int(cy + sample_r * math.sin(rad))
    sx = max(0, min(sx, w - 1))
    sy = max(0, min(sy, h - 1))
    dominant_color = tuple(int(c) for c in frame[sy, sx])

    return center_angle, span, dominant_color


# ---------------------------------------------------------------------------
# Action: press or click
# ---------------------------------------------------------------------------
def perform_action(key, circle_screen_x, circle_screen_y):
    """Press key or click at the circle location."""
    if key:
        pyautogui.press(key)
    else:
        pyautogui.click(circle_screen_x, circle_screen_y)


# ---------------------------------------------------------------------------
# Debug helpers
# ---------------------------------------------------------------------------
def save_debug_frame(frame, cx, cy, radius, white_angle, zone_info, hit, cycle):
    os.makedirs(DEBUG_DIR, exist_ok=True)
    dbg = frame.copy()
    cv2.circle(dbg, (cx, cy), radius, (0, 255, 0), 2)

    if white_angle is not None:
        wr = math.radians(white_angle)
        wx = int(cx + radius * math.cos(wr))
        wy = int(cy + radius * math.sin(wr))
        cv2.line(dbg, (cx, cy), (wx, wy), (255, 255, 255), 2)

    if zone_info:
        za, zs, zc = zone_info
        for d in range(int(za - zs / 2), int(za + zs / 2)):
            r = math.radians(d % 360)
            zx = int(cx + radius * math.cos(r))
            zy = int(cy + radius * math.sin(r))
            cv2.circle(dbg, (zx, zy), 2, zc, -1)

    label = "HIT" if hit else "scanning"
    cv2.putText(dbg, label, (10, 30), cv2.FONT_HERSHEY_SIMPLEX, 1, (0, 255, 0) if hit else (0, 0, 255), 2)

    ts = datetime.now().strftime("%H%M%S_%f")
    cv2.imwrite(f"{DEBUG_DIR}/cycle{cycle}_{ts}.png", dbg)


# ---------------------------------------------------------------------------
# Main loop
# ---------------------------------------------------------------------------
def main():
    args = parse_args()
    print("=" * 50)
    print(" Autofarm Bot - Circle Spinner Mini-Game")
    print("=" * 50)
    print(f" Action     : {'press ' + args.key if args.key else 'mouse click'}")
    print(f" Scan region: bottom {args.region}px")
    print(f" Debug mode : {'ON' if args.debug else 'OFF'}")
    print(f" Cycles     : {'unlimited' if args.cycles == 0 else args.cycles}")
    print("=" * 50)
    print("\nMove mouse to top-left corner to abort (failsafe).")
    print("Starting in 3 seconds...\n")
    time.sleep(3)

    cycle = 0
    last_hit_time = 0

    with mss.mss() as sct:
        while True:
            if args.cycles > 0 and cycle >= args.cycles:
                print(f"\nCompleted {cycle} cycles. Exiting.")
                break

            frame, region = capture_region(sct, args.monitor, args.region)
            circle = find_circle(frame)

            if circle is None:
                time.sleep(SCAN_INTERVAL)
                continue

            cx, cy, radius = circle
            white_angle = detect_white_line_angle(frame, cx, cy, radius)
            zone_info = detect_colored_zone_angle(frame, cx, cy, radius)

            if white_angle is None or zone_info is None:
                time.sleep(SCAN_INTERVAL)
                continue

            zone_center, zone_span, zone_color = zone_info
            diff = angle_diff(white_angle, zone_center)

            tolerance = max(ANGLE_TOLERANCE_DEG, zone_span / 2)
            now = time.time()
            hit = diff <= tolerance and (now - last_hit_time) > 1.0

            if args.debug:
                save_debug_frame(frame, cx, cy, radius, white_angle, zone_info, hit, cycle)

            if hit:
                screen_x = region["left"] + cx
                screen_y = region["top"] + cy
                perform_action(args.key, screen_x, screen_y)
                last_hit_time = now
                cycle += 1
                print(f"[{datetime.now().strftime('%H:%M:%S')}] HIT #{cycle}  "
                      f"line={white_angle:.0f}°  zone={zone_center:.0f}°  "
                      f"diff={diff:.1f}°  color=({zone_color[2]},{zone_color[1]},{zone_color[0]})")

                # wait for the cycle to reset (~33s) before scanning again
                cooldown = FARM_CYCLE_SECONDS - 2
                print(f"  Waiting {cooldown}s for next cycle...")
                time.sleep(cooldown)

            time.sleep(SCAN_INTERVAL)


if __name__ == "__main__":
    main()
