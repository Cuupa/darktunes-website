import csv
import re

SQL_FIELDS = [
    'id', 'asset_id', 'title', 'alias', 'introtext', 'fulltext',
    'state', 'catid', 'created', 'created_by', 'created_by_alias',
    'modified', 'modified_by', 'checked_out', 'checked_out_time',
    'publish_up', 'publish_down', 'images', 'urls', 'attribs',
    'version', 'ordering', 'metakey', 'metadesc', 'access',
    'hits', 'metadata', 'featured', 'language', 'note'
]

CSV_FIELDS = ['id', 'title', 'alias', 'introtext', 'fulltext', 'created']

BLACKLIST_TITLES = []
BLACKLIST_ALIASES = ['welcome-to-darktunes',
                     'digital-distribution',
                     'pressing',
                     'physical-distribution',
                     'marketing',
                     'management',
                     'imprint',
                     'about-us',
                     'darktunes-label'
                     'marketing-and-promotion',
                     'great-new-release',
                     'legal-notice',
                     'artists',
                     'promo-agency',
                     'darktunes-label',
                     'release-packages'
                     ]


def clean_value(val):
    val = val.strip()
    if val.upper() == 'NULL':
        return ''
    if val.startswith("'") and val.endswith("'"):
        val = val[1:-1]
        val = val.replace("\\'", "'").replace('\\"', '"').replace('\\\\', '\\').replace('\\n', '\n').replace('\\r',
                                                                                                             '\r').replace(
            '\\t', '\t')
    return val


def is_only_iframe(text):
    text = text.strip()
    text = re.sub(r'^<p>', '', text, flags=re.IGNORECASE)
    text = re.sub(r'</p>$', '', text, flags=re.IGNORECASE)
    text = text.strip()
    return bool(re.match(r'^<iframe\b[^>]*>.*?</iframe>$', text, re.IGNORECASE | re.DOTALL))


def extract_first_paragraph(text):
    match = re.search(r'<p\b[^>]*>.*?</p>', text, re.IGNORECASE | re.DOTALL)
    if match:
        return match.group(0)
    return text


def parse_sql_to_csv(sql_file_path, csv_file_path):
    indices = [SQL_FIELDS.index(f) for f in CSV_FIELDS]
    title_idx = SQL_FIELDS.index('title')
    alias_idx = SQL_FIELDS.index('alias')
    intro_idx = SQL_FIELDS.index('introtext')
    full_idx = SQL_FIELDS.index('fulltext')

    insert_count = 0
    row_count = 0
    blacklist_iframe_count = 0
    blacklist_meta_count = 0

    with open(sql_file_path, 'r', encoding='utf-8') as infile, \
            open(csv_file_path, 'w', encoding='utf-8', newline='') as outfile:

        writer = csv.writer(outfile, delimiter=';')
        writer.writerow(CSV_FIELDS)

        is_inside_values = False
        looking_for_values = False
        current_row = []
        current_val = []
        in_string = False
        escape_next = False
        in_parentheses = False

        for line in infile:
            if not is_inside_values and (line.startswith('--') or not line.strip()):
                continue

            if not is_inside_values:
                if looking_for_values:
                    if re.search(r'\bvalues\b', line, re.IGNORECASE):
                        is_inside_values = True
                        looking_for_values = False
                        remainder = re.split(r'\bvalues\b', line, maxsplit=1, flags=re.IGNORECASE)[1]
                    else:
                        continue
                elif re.search(r'into\s+`dtmg_content`', line, re.IGNORECASE):
                    insert_count += 1
                    if re.search(r'\bvalues\b', line, re.IGNORECASE):
                        is_inside_values = True
                        remainder = re.split(r'\bvalues\b', line, maxsplit=1, flags=re.IGNORECASE)[1]
                    else:
                        looking_for_values = True
                        continue
                else:
                    continue
            else:
                remainder = line

            for char in remainder:
                if escape_next:
                    current_val.append(char)
                    escape_next = False
                    continue

                if char == '\\':
                    current_val.append(char)
                    escape_next = True
                    continue

                if char == "'":
                    in_string = not in_string
                    current_val.append(char)
                    continue

                if not in_string:
                    if char == '(':
                        in_parentheses = True
                        current_row = []
                        current_val = []
                        continue
                    elif char == ')':
                        in_parentheses = False
                        val_str = "".join(current_val)
                        current_row.append(val_str)
                        if len(current_row) == len(SQL_FIELDS):
                            original_title = clean_value(current_row[title_idx])
                            original_alias = clean_value(current_row[alias_idx])
                            original_intro = clean_value(current_row[intro_idx])
                            original_full = clean_value(current_row[full_idx])

                            if original_title in BLACKLIST_TITLES or original_alias in BLACKLIST_ALIASES:
                                blacklist_meta_count += 1
                            elif is_only_iframe(original_intro + original_full):
                                blacklist_iframe_count += 1
                            else:
                                csv_data = {}
                                for idx in indices:
                                    col_name = SQL_FIELDS[idx]
                                    csv_data[col_name] = clean_value(current_row[idx])

                                csv_data['introtext'] = extract_first_paragraph(original_intro)
                                csv_data['fulltext'] = original_intro

                                filtered_row = [csv_data[f] for f in CSV_FIELDS]
                                writer.writerow(filtered_row)
                                row_count += 1
                        current_row = []
                        current_val = []
                        continue
                    elif char == ',':
                        if in_parentheses:
                            val_str = "".join(current_val)
                            current_row.append(val_str)
                            current_val = []
                        continue
                    elif char == ';':
                        is_inside_values = False
                        continue

                if in_parentheses:
                    current_val.append(char)

    print(f"Verarbeitung abgeschlossen. {insert_count} INSERT-Blöcke gefunden.")
    print(f"{row_count} Datensätze exportiert.")
    print(f"{blacklist_iframe_count} Datensätze wegen Blacklist (nur iframe) übersprungen.")
    print(f"{blacklist_meta_count} Datensätze wegen Blacklist (Title/Alias) übersprungen.")

if __name__ == '__main__':
    parse_sql_to_csv('data.sql', 'export.csv')
