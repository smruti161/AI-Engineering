# Test Cases: [Product Name] — [Feature]

**Project:** [Project Key]  
**Generated:** [Date]

---

## Pre-Generation Source Review

- **Description:** [Reviewed / Not provided]
- **Acceptance Criteria:** [Reviewed / Not provided]
- **Comments:** [N found and reviewed / None found]
- **Subtasks:** [N found and reviewed / None found]
- **Screenshots:** [N attached and reviewed / None provided]

> ⚠️ Conflict detected: [source A] says X, [source B] says Y — used most recent. *(remove if no conflicts)*

---

## Reasoning

Based on [X functional areas] and [Y edge cases], I've written [N] test cases.

---

## Test Cases

| Test Case ID | Summary | Objective | Preconditions | Test Steps | Test Data | Expected Result | Test Type | Priority | Status | Labels / Component |
|---|---|---|---|---|---|---|---|---|---|---|
| TC_[KEY]_001 | [One-line title] | [Test goal] | [Required system/data state] | 1. [Action]<br>2. [Action]<br>3. [Action] | [Input values / data sets] | [Verifiable outcome per requirements] | Positive | High | Not Executed | [Component / Label] |
| TC_[KEY]_002 | [One-line title] | [Test goal] | [Required system/data state] | 1. [Action]<br>2. [Action] | [Invalid / edge data] | [Error message or expected behavior] | Negative | Medium | Not Executed | [Component / Label] |
| TC_[KEY]_003 | [One-line title] | [Test goal] | [Required system/data state] | 1. [Action]<br>2. [Action] | [Boundary values] | [Verifiable outcome] | Edge Case | Low | Not Executed | [Component / Label] |

---

### Field Reference (Zephyr Scale Mapping)

| Field | Zephyr Scale Field | Notes |
|---|---|---|
| Test Case ID | Name / Key | Format: `TC_[ISSUE-KEY]_001`. Zephyr auto-generates key on import. |
| Summary | Summary | One-line title of what is being tested |
| Objective | Objective | Brief statement of the test goal |
| Preconditions | Precondition | System/data state required before execution |
| Test Steps | Test Steps (Step / Action) | Numbered steps. Use `<br>` between steps in table cells. |
| Test Data | Test Data | Input values or data sets used in the test |
| Expected Result | Expected Result | Verifiable outcome per step, based strictly on requirements |
| Test Type | Custom Field / Label | `Positive` / `Negative` / `Edge Case` / `Boundary` |
| Priority | Priority | `High` / `Medium` / `Low` |
| Status | Status | Always `Not Executed` for new test cases |
| Labels / Component | Labels, Component | JIRA component or feature label. Tag source if from comment/subtask. |
