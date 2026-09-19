from database import get_db_connection

def migrate_postgres():
    conn = get_db_connection()
    cur = conn.cursor()
    print("Migrating Postgres database...")
    
    # 1. Update users table
    cur.execute("UPDATE users SET name = 'Ismeet', email = 'ismeet@certifyai.in' WHERE name ILIKE '%manohar%' OR email ILIKE '%manohar%'")
    print("Updated users")
    
    # 2. Update test_runs table
    cur.execute("UPDATE test_runs SET tested_by_name = 'Ismeet', tested_by_email = 'ismeet@certifyai.in' WHERE tested_by_name ILIKE '%manohar%' OR tested_by_email ILIKE '%manohar%'")
    print("Updated test_runs")
    
    # 3. Update activity_logs table
    cur.execute("UPDATE activity_logs SET user_name = 'Ismeet', user_email = 'ismeet@certifyai.in' WHERE user_name ILIKE '%manohar%' OR user_email ILIKE '%manohar%'")
    print("Updated activity_logs")
    
    # Replace in details or JSON if any
    cur.execute("UPDATE activity_logs SET details = REPLACE(details, 'Manohar', 'Ismeet') WHERE details LIKE '%Manohar%'")
    cur.execute("UPDATE test_runs SET notes = REPLACE(notes, 'Manohar', 'Ismeet') WHERE notes LIKE '%Manohar%'")
    cur.execute("UPDATE test_runs SET full_result_json = REPLACE(full_result_json, 'manohar@certifyai.in', 'ismeet@certifyai.in') WHERE full_result_json LIKE '%manohar@certifyai.in%'")
    cur.execute("UPDATE test_runs SET full_result_json = REPLACE(full_result_json, 'Manohar', 'Ismeet') WHERE full_result_json LIKE '%Manohar%'")
    
    conn.commit()
    conn.close()
    print("Postgres Migration successfully completed!")

if __name__ == "__main__":
    migrate_postgres()
