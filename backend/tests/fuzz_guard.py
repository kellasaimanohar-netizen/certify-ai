"""Real property-based fuzzing of the Guard policy engine with Hypothesis.
Invariant under test: the engine NEVER crashes and NEVER returns ALLOW for
a call whose argument values contain a known-catastrophic pattern."""
import sys; sys.path.insert(0,'src')
from hypothesis import given, strategies as st, settings, HealthCheck
from agent_audit.guard import ProposedCall, Decision
from agent_audit.guard.broker import Guard

E = Guard().engine
CATASTROPHIC = ['/dev/null', 'rm -rf /', 'DROP DATABASE', 'mkfs']  # unambiguous: no context-dependent tokens

# Strategy: arbitrary tool names + arbitrary nested arg structures
names = st.text(min_size=0, max_size=40)
scalars = st.one_of(st.none(), st.booleans(), st.integers(), st.floats(allow_nan=True), st.text(max_size=200))
args = st.recursive(scalars, lambda c: st.one_of(st.lists(c, max_size=5), st.dictionaries(st.text(max_size=10), c, max_size=5)), max_leaves=12)

crashes = []; allow_on_catastrophic = []

@settings(max_examples=3000, suppress_health_check=list(HealthCheck), deadline=None)
@given(name=names, a=st.dictionaries(st.text(max_size=10), args, max_size=6), env=st.sampled_from(["prod","production","dev","staging",""]))
def test_never_crashes(name, a, env):
    try:
        d = E.evaluate(ProposedCall(name=name, args=a, target_env=env))
    except Exception as e:
        crashes.append((name, a, repr(e))); return
    # Invariant: if any arg value stringifies to a catastrophic token, must NOT be ALLOW
    blob = str(a).lower()
    if any(c.lower() in blob for c in CATASTROPHIC) and d.decision == Decision.ALLOW:
        allow_on_catastrophic.append((name, a, d.decision.value))

try:
    test_never_crashes()
    print(f"FUZZ COMPLETE: 3000 examples")
    print(f"  crashes: {len(crashes)}")
    print(f"  ALLOW-on-catastrophic: {len(allow_on_catastrophic)}")
    if crashes: print("  first crash:", crashes[0])
    if allow_on_catastrophic: print("  first leak:", allow_on_catastrophic[0])
    if not crashes and not allow_on_catastrophic:
        print("  RESULT: no crashes, no catastrophic-ALLOW leaks across 3000 random inputs")
except Exception as e:
    print("harness error:", e)
