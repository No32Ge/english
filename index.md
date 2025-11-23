---
title: "Schala's Magic Book / 莎拉的魔法书"
layout: default
---


# Schala's Magic Book / 莎拉的魔法书

Sup, bro, this is Schala's Magic Book. You can click the links below to visit the pages:  
嘿，兄弟，这是莎拉的魔法书。你可以点击下面的链接访问各个版本：

<div class="version-grid">
    <div class="version-card">
        <a href="https://english.ge32.site/mb/b1">Version 0.1 / 版本 1 (加载速度最快)</a>
    </div>
    <div class="version-card">
        <a href="https://english.ge32.site/mb/b2">Version 0.2 / 版本 2(内容不完善)</a>
    </div>
    <div class="version-card">
        <a href="https://english.ge32.site/mb/b21">Version 0.2-1 / 版本 2-1 (只适合电脑)</a>
    </div>
</div>

---

## What is it? / 这是什么？

Basically, this is a tool to help you improve your English. Some data is already included, but it doesn't matter—you can switch it whenever you want.  
基本上，这是一个帮助你提高英语水平的工具。已经包含了一些数据，但这不重要——你可以随时切换数据。


**Important / 重要提示:** The current versions (v1, v2, v21) **only support `cn` as the translation field**. Using any other field name for translation is not supported.  
当前版本 (v1, v2, v21) **仅支持 `cn` 作为翻译字段**。不支持使用其他字段名作为翻译。


The main focus is on the JSON data. If you follow the format rules, everything will work. Here's an example you can follow:  
主要关注的是 JSON 数据。只要你遵循格式规则，一切都会正常工作。以下是一个你可以参考的示例：

### JSON Template / JSON 模板

```json
[
    {
        "id": "example_article",
        "title": "Article Title (customizable) / 文章标题（可自定义）",
        "info": {
            "author": "Author Name (optional) / 作者姓名（可选）",
            "source": "Source (optional) / 来源（可选）",
            "level": "Difficulty level, e.g., A1/B2/C1 / 难度级别，例如：A1/B2/C1",
            "tags": ["tag1", "tag2"],
            "link": "[Original link](https://example.com) / [原文链接](https://example.com)",
            "variants": null
        },
        "paras": [
            {
                "id": 1,
                "en": "Place the English sentence or paragraph here. / 在此处放置英文句子或段落",
                "cn": "Place the corresponding translation or explanation here. / 在此处放置相应的翻译或解释",
                "vocab": [
                    {
                        "word": "Word or phrase / 单词或短语",
                        "ph": "/pronunciation/ / 发音",
                        "pos": "Part of speech, e.g., n/v/adj/phr / 词性，例如：名词/动词/形容词/短语",
                        "mean": "Meaning / 意思",
                        "ex": "Example sentence / 例句"
                    }
                ],
                "gram": [
                    {
                        "id": "unique_grammar_id",
                        "name": "Grammar point name / 语法点名称",
                        "category": "S (sentence), P (phrase), W (word), etc. / S（句子）, P（短语）, W（单词）等",
                        "level": "Recommended language level / 推荐语言水平",
                        "pattern": "Grammar pattern template, e.g., SUBJ + be + not + X + but + Y / 语法模式模板，例如：主语 + be + not + X + but + Y",
                        "components": [
                            { "slot": "Position name / 位置名称", "role": "Function / 功能", "pos": ["list of possible POS / 可能的词性列表"] }
                        ],
                        "function": "Explanation of what this grammar point does / 解释此语法点的功能",
                        "example": { "en": "Example in English / 英文示例", "cn": "Example translation / 示例翻译" },
                        "variants": ["Optional grammar variants / 可选的语法变体"],
                        "constraints": "Usage constraints or notes / 使用限制或注意事项"
                    }
                ]
            }
        ]
    }
]
```



## How to use / 使用方法

1. Create a JSON file following the above structure.  
   按照上述结构创建一个 JSON 文件。

2. Open the page (`index.html`) in the corresponding version folder (`b1`, `b2`, `b21`).  
   打开相应版本文件夹（`b1`, `b2`, `b21`）中的页面（`index.html`）。

3. Import the JSON file to this tool.  
   将 JSON 文件导入到此工具中。

4. The page will automatically render the JSON data as articles.  
   页面将自动将 JSON 数据渲染为文章。


**Pro Tip / 专业提示:** Make sure your JSON is valid! You can use online JSON validators to check your file before importing.  
确保你的 JSON 是有效的！你可以在导入前使用在线 JSON 验证器检查你的文件。


---

## Example Render / 示例渲染

![Schala Magic Book Example / 莎拉魔法书示例](README.assets/image-20251120193109172.png)

---

Focus on the **JSON data** and follow the format rules—everything else is handled by the page automatically.  
专注于 **JSON 数据** 并遵循格式规则——其他所有内容都由页面自动处理。

Remember: **only `cn` is supported for translations** in all current versions.  
记住：在所有当前版本中，**仅支持 `cn` 作为翻译字段**。

