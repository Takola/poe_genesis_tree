import requests
import pandas as pd
import json

def get_cargo_data():
    wiki_url = "https://www.poewiki.net/w/api.php"
    all_items = []
    limit = 500
    offset = 0
    
    while True:
        params = {
            "action": "cargoquery",
            "format": "json",
            "tables": "items",
            "fields": "items.name=name, items.drop_enabled=drop_enabled, items.is_drop_restricted=is_drop_restricted",
            "where": "items.rarity='Unique'",
            "limit": limit,
            "offset": offset
        }
        
        try:
            response = requests.get(wiki_url, params=params)
            data = response.json()
            
            if "cargoquery" not in data:
                break
                
            batch = data["cargoquery"]
            if not batch:
                break
                
            for item in batch:
                all_items.append(item["title"])
                
            if len(batch) < limit:
                break
            
            offset += limit
        except Exception as e:
            print(f"Error: {e}")
            break
            
    return pd.DataFrame(all_items)

df_wiki = get_cargo_data()

if df_wiki.empty:
    print("No data retrieved from Wiki.")
    # Debug info
    print(df_wiki)
    exit()

# Print columns to debug
print("Wiki Columns:", df_wiki.columns.tolist())

# Fix possible case sensitivity or naming
df_wiki.columns = [c.lower() for c in df_wiki.columns]

if 'drop_enabled' in df_wiki.columns:
    df_wiki['drop_enabled'] = pd.to_numeric(df_wiki['drop_enabled'], errors='coerce').fillna(0).astype(int)
if 'is_drop_restricted' in df_wiki.columns:
    df_wiki['is_drop_restricted'] = pd.to_numeric(df_wiki['is_drop_restricted'], errors='coerce').fillna(0).astype(int)

total_distinct = df_wiki['name'].nunique()
enabled_uniques = df_wiki[df_wiki['drop_enabled'] == 1]['name'].nunique()
disabled_uniques = df_wiki[df_wiki['drop_enabled'] == 0]['name'].nunique()
unrestricted_enabled_df = df_wiki[(df_wiki['drop_enabled'] == 1) & (df_wiki['is_drop_restricted'] == 0)]
unrestricted_enabled_set = set(unrestricted_enabled_df['name'].unique())
unrestricted_enabled_count = len(unrestricted_enabled_set)

csv_path = r'C:\Users\Jacob\Documents\GitHub\poe_genesis_tree\uniques.csv'
df_csv = pd.read_csv(csv_path)
csv_name_col = None
for col in df_csv.columns:
    if col.lower() in ['name', 'item']:
        csv_name_col = col
        break
csv_names = set(df_csv[csv_name_col if csv_name_col else df_csv.columns[0]].astype(str).unique())

missing_names = unrestricted_enabled_set - csv_names
missing_names = {n for n in missing_names if n and str(n).lower() != 'nan'}

print(f"Total Distinct Wiki Uniques: {total_distinct}")
print(f"Distinct drop_enabled=1: {enabled_uniques}")
print(f"Distinct drop_enabled=0: {disabled_uniques}")
print(f"Distinct drop_enabled=1 & is_drop_restricted=0: {unrestricted_enabled_count}")
print(f"Number of unrestricted enabled uniques missing from CSV: {len(missing_names)}")
if missing_names:
    print("Missing names list:")
    for name in sorted(list(missing_names)):
        print(name)
