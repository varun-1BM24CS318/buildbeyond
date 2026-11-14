"""
Logical Clock — deterministic step counter for the simulation.

No wall-clock dependency; the clock advances only via explicit ``tick()`` calls
so that runs are fully reproducible.
"""

from __future__ import annotations


class LogicalClock:
    """A monotonically-increasing step counter.

    Parameters
    ----------
    start : int, optional
        Initial step value (default ``0``).

    Examples
    --------
    >>> clock = LogicalClock()
    >>> clock.current_step
    0
    >>> clock.tick()
    1
    >>> clock.tick()
    2
    >>> clock.reset()
    >>> clock.current_step
    0
    """

    __slots__ = ("_step",)

    def __init__(self, start: int = 0) -> None:
        self._step: int = start

    # ── public API ────────────────────────────────────────────────────

    @property
    def current_step(self) -> int:
        """Return the current step without advancing the clock."""
        return self._step

    def tick(self) -> int:
        """Advance the clock by one step and return the new value."""
        self._step += 1
        return self._step

    def reset(self) -> None:
        """Reset the clock back to step ``0``."""
        self._step = 0

    # ── dunder helpers ────────────────────────────────────────────────

    def __repr__(self) -> str:
        return f"LogicalClock(step={self._step})"
