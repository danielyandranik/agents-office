---
name: analyze-data
description: "Answer data questions -- from quick lookups to full analyses. Use when looking up a single metric, investigating what's driving a trend or drop, comparing segments over time, or preparing a formal data report for stakeholders. Works from data files in the mission workspace or data the owner provides."
license: Apache-2.0
---

# Analyze Data - Answer Data Questions

Answer a data question, from a quick lookup to a full analysis to a formal report.

## Workflow

### 1. Understand the Question

Parse the question (from the owner or whichever colleague asked) and determine:

- **Complexity level**:
  - **Quick answer**: Single metric, simple filter, factual lookup (e.g., "How many users signed up last week?")
  - **Full analysis**: Multi-dimensional exploration, trend analysis, comparison (e.g., "What's driving the drop in conversion rate?")
  - **Formal report**: Comprehensive investigation with methodology, caveats, and recommendations (e.g., "Prepare a quarterly business review of our subscription metrics")
- **Data requirements**: Which files or tables, metrics, dimensions, and time ranges are needed
- **Output format**: Number, table, chart, narrative, or combination

If the question is ambiguous (which metric definition, which time range, which population), state your interpretation as an assumption, or ask before spending effort on the wrong question.

### 2. Gather Data

Data comes from files in the mission workspace or from what the owner provides. There is no live warehouse connection.

1. Use `list_files` to find candidate data files (CSV, TSV, JSON, Parquet, Excel, SQLite, SQL dumps) and `read_file` to look at their structure.
2. If you have a shell (`run_command`), load and query the files with whatever is installed in the workspace (Python with pandas, `sqlite3`, `duckdb`, etc.). Check what is available before relying on it.
3. If the data you need is not in the workspace, ask the owner to provide it:
   - Paste query results directly
   - Put a CSV or Excel file in the workspace
   - Describe the schema so you can write queries for them to run on their system
4. When writing queries for someone else to run, name the SQL dialect, keep them readable (CTEs, explicit column lists), and say what result shape you expect back.
5. If a query or script fails, debug and retry (check column names, file paths, dialect syntax). If results look unexpected, run sanity checks before proceeding.

For an unfamiliar dataset, profile it first with the `explore-data` skill.

### 3. Analyze

- Calculate relevant metrics, aggregations, and comparisons
- Identify patterns, trends, outliers, and anomalies
- Compare across dimensions (time periods, segments, categories)
- For complex analyses, break the problem into sub-questions and address each
- For hypothesis tests, significance and confidence intervals, use the `statistical-analysis` skill; for experiments, use the `ab-test-analysis` skill

### 4. Validate Before Presenting

Before sharing results, run through validation checks:

- **Row count sanity**: Does the number of records make sense?
- **Null check**: Are there unexpected nulls that could skew results?
- **Magnitude check**: Are the numbers in a reasonable range?
- **Trend continuity**: Do time series have unexpected gaps?
- **Aggregation logic**: Do subtotals sum to totals correctly?

If any check raises concerns, investigate and note caveats. For anything going to stakeholders, run the fuller review in the `validate-data` skill.

### 5. Present Findings

**For quick answers:**
- State the answer directly with relevant context
- Include the query or script used (in a code block) for reproducibility

**For full analyses:**
- Lead with the key finding or insight
- Support with data tables and/or visualizations
- Note methodology and any caveats
- Suggest follow-up questions

**For formal reports:**
- Executive summary with key takeaways
- Methodology section explaining approach and data sources
- Detailed findings with supporting evidence
- Caveats, limitations, and data quality notes
- Recommendations and suggested next steps

Save longer outputs (reports, result tables, scripts) to the workspace with `write_file` and say where they are.

### 6. Visualize Where Helpful

When a chart would communicate results more effectively than a table:

- Pick the chart type from the question: trend over time → line; comparison across categories → bar (sorted); part of a whole → stacked bar or a simple table; distribution → histogram or box plot; relationship → scatter
- If Python is available in the workspace, generate the chart with a script (e.g. matplotlib) and save the image to the workspace; or build it into a self-contained HTML file
- Follow visualization best practices: labeled axes with units, bar charts starting at zero, no 3D or dual axes that mislead, a title that states the takeaway

## Examples

**Quick answer:**
"How many new users signed up in December?"

**Full analysis:**
"What's causing the increase in support ticket volume over the past 3 months? Break down by category and priority."

**Formal report:**
"Prepare a data quality assessment of our customer table -- completeness, consistency, and any issues we should address."

## Tips

- Be specific about time ranges, segments, or metrics when possible
- If you know the file or table names, use them to speed up the process
- For complex questions, break them into multiple queries
- Results are always validated before presentation -- if something looks off, flag it
