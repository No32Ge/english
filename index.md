---
title: "Schala's Magic Book"
layout: default
---

# Schala's Magic Book

Sup, bro, this is Schala's Magic Book. You can click the links below to visit the pages:

- **version 1:** [https://english.ge32.site/mb/b1](https://english.ge32.site/mb/b1)
- **version 2:** [https://english.ge32.site/mb/b2](https://english.ge32.site/mb/b2)
- **version 2-1:** [https://english.ge32.site/mb/b21](https://english.ge32.site/mb/b21)

---

## What is it?

Basically, this is a tool to help you improve your English. Some data is already included, but it doesn't matter—you can switch it whenever you want.  

**Important:** The current versions (v1, v2, v21) **only support `cn` as the translation field**. Using any other field name for translation is not supported.

The main focus is on the JSON data. If you follow the format rules, everything will work. Here's an example you can follow:

### JSON Template

```json
[
    {
        "id": "example_article",
        "title": "Article Title (customizable)",
        "info": {
            "author": "Author Name (optional)",
            "source": "Source (optional)",
            "level": "Difficulty level, e.g., A1/B2/C1",
            "tags": ["tag1", "tag2"],
            "link": "[Original link](https://example.com)",
            "variants": null
        },
        "paras": [
            {
                "id": 1,
                "en": "Place the English sentence or paragraph here.",
                "cn": "Place the corresponding translation or explanation here.",
                "vocab": [
                    {
                        "word": "Word or phrase",
                        "ph": "/pronunciation/",
                        "pos": "Part of speech, e.g., n/v/adj/phr",
                        "mean": "Meaning",
                        "ex": "Example sentence"
                    }
                ],
                "gram": [
                    {
                        "id": "unique_grammar_id",
                        "name": "Grammar point name",
                        "category": "S (sentence), P (phrase), W (word), etc.",
                        "level": "Recommended language level",
                        "pattern": "Grammar pattern template, e.g., SUBJ + be + not + X + but + Y",
                        "components": [
                            { "slot": "Position name", "role": "Function", "pos": ["list of possible POS"] }
                        ],
                        "function": "Explanation of what this grammar point does",
                        "example": { "en": "Example in English", "cn": "Example translation" },
                        "variants": ["Optional grammar variants"],
                        "constraints": "Usage constraints or notes"
                    }
                ]
            }
        ]
    }
]
````

---

## How to use

1. Create a JSON file following the above structure.
2. Open the page (`index.html`) in the corresponding version folder (`b1`, `b2`, `b21`).
3. Import the JSON file to this tool.
4. The page will automatically render the JSON data as articles.

---

## Example Render

![Schala Magic Book Example](README.assets/image-20251120193109172.png)

---

Focus on the **JSON data** and follow the format rules—everything else is handled by the page automatically.
Remember: **only `cn` is supported for translations** in all current versions.



