#!/usr/bin/env python3
"""Export each 1440x810 HTML screen to docs/mockups/frames/."""
import os
import signal
import subprocess
import time
from pathlib import Path

ROOT = Path(__file__).resolve().parent
FRAMES = ROOT / "frames"
SCREENS = [
    ("01-landing.html", "01-landing-hero.png"),
    ("02-audit.html", "02-audit-lost-revenue.png"),
    ("03-portal.html", "03-portal-hud.png"),
    ("04-ring-studio.html", "04-ring-studio.png"),
    ("05-ops-calls.html", "05-ops-calls.png"),
    ("06-onboarding.html", "06-onboarding.png"),
    ("07-handover.html", "07-handover.png"),
    ("08-ring-scroll.html", "08-ring-scroll.png"),
]


def capture(html: str, out_name: str) -> None:
    dest = FRAMES / out_name
    if dest.exists():
        dest.unlink()
    cmd = [
        "google-chrome",
        "--headless=new",
        "--disable-gpu",
        "--no-first-run",
        "--no-default-browser-check",
        "--disable-background-networking",
        "--disable-sync",
        "--disable-extensions",
        "--hide-scrollbars",
        "--window-size=1440,810",
        "--force-device-scale-factor=2",
        "--virtual-time-budget=6000",
        f"--user-data-dir=/tmp/chrome-mock-{out_name}",
        f"--screenshot={dest}",
        f"file://{ROOT / html}",
    ]
    proc = subprocess.Popen(cmd, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    for _ in range(50):
        if dest.exists() and dest.stat().st_size > 10_000:
            time.sleep(0.6)
            proc.send_signal(signal.SIGTERM)
            try:
                proc.wait(timeout=3)
            except subprocess.TimeoutExpired:
                proc.kill()
            print(f"wrote {out_name} ({dest.stat().st_size} bytes)")
            return
        time.sleep(0.4)
    proc.kill()
    raise SystemExit(f"failed to capture {html}")


def main() -> None:
    FRAMES.mkdir(exist_ok=True)
    for html, out_name in SCREENS:
        capture(html, out_name)


if __name__ == "__main__":
    main()
