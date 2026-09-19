import sys
import os
import json

# Add backend directory to sys.path
sys.path.insert(0, os.path.abspath("."))

from fastapi.testclient import TestClient
from backend import app

client = TestClient(app)

def test_versioning_and_grouping():
    print("Testing User Agents Grouping & Versioning...")
    res = client.get("/api/user/agents", headers={"X-User-Id": "2"})
    assert res.status_code == 200, f"Error {res.status_code}: {res.text}"
    data = res.json()
    agents = data.get("agents", [])
    print(f"-> Returned {len(agents)} unique agent instances.")
    
    for a in agents:
        name = a.get("agent_name")
        vers = a.get("versions", [])
        latest_ver = a.get("latest_version")
        imp = a.get("score_improvement")
        print(f"   Agent: {name} | Latest: {latest_ver} ({a.get('latest_score')}%) | Iterations: {[v['version'] + ': ' + str(v['trust_score']) + '%' for v in vers]} | Gain: {imp}%")
        assert len(vers) > 0, f"Agent {name} has no versions"

    print("\nTesting Admin Agents Grouping...")
    res = client.get("/api/admin/agents")
    assert res.status_code == 200
    admin_agents = res.json().get("agents", [])
    print(f"-> Returned {len(admin_agents)} unique fleet agent instances.")

    print("\nTesting User Test History Grouping...")
    res = client.get("/api/user/tests?group_by_agent=true", headers={"X-User-Id": "2"})
    assert res.status_code == 200
    grouped_tests = res.json().get("grouped_agents", [])
    print(f"-> Grouped tests returned {len(grouped_tests)} agent groups.")

    print("\nTesting Admin Testing Activity Grouping...")
    res = client.get("/api/admin/activity?group_by_agent=true")
    assert res.status_code == 200
    act_grouped = res.json().get("grouped_agents", [])
    print(f"-> Activity grouped returned {len(act_grouped)} agent groups.")

    print("\nTesting User Reports Version Enrichment...")
    res = client.get("/api/user/reports", headers={"X-User-Id": "2"})
    assert res.status_code == 200
    reports = res.json().get("reports", [])
    print(f"-> User reports returned {len(reports)} items. Sample version: {reports[0].get('version')}, is_latest: {reports[0].get('is_latest')}")

    print("\nTesting Admin Reports Version Enrichment...")
    res = client.get("/api/admin/reports")
    assert res.status_code == 200
    admin_reports = res.json().get("reports", [])
    print(f"-> Admin reports returned {len(admin_reports)} items. Sample version: {admin_reports[0].get('version')}")

    print("\n ALL VERSIONING & GROUPING TESTS PASSED 100%!")

if __name__ == "__main__":
    test_versioning_and_grouping()
