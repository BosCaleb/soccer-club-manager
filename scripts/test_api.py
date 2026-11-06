"""Compatibility entry point: P1 replaces the old infrastructure-only checks."""
import runpy
from pathlib import Path
runpy.run_path(str(Path(__file__).with_name('test_p1.py')), run_name='__main__')
