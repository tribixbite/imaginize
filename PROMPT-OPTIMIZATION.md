# Unified Prompt Optimization for Free Tier AI Models

**Date:** 2025-11-26
**Expert Review:** Gemini 2.5 Pro
**Status:** Implemented, awaiting validation

---

## Problem Analysis

### Root Cause: Cognitive Overload

Free-tier AI models (like google/gemini-2.0-flash-exp:free) are optimized for speed and cost, not deep multi-part reasoning. The original unified prompt was experiencing:

1. **Task Complexity & Prioritization**
   - Task 1 (Scenes): Interpretive and synthetic - requires creative analysis
   - Task 2 (Elements): Extractive and descriptive - more straightforward
   - Model defaults to easier task (elements), fails on harder task (scenes)

2. **Instruction Dilution**
   - Long, detailed prompt
   - By output generation phase, early instructions lose saliency
   - Model focuses on most recent instructions and JSON structure

3. **Implicit vs. Explicit Instructions**
   - Original prompt *described* what to do
   - Lacked concrete example of complete successful output
   - For smaller models, showing > telling (few-shot prompting)

---

## Solution: Optimized Prompt Structure

### Key Improvements

1. **Few-Shot Example** (Most Critical)
   - Provides concrete template to follow
   - Demonstrates that BOTH scenes and elements must be populated
   - More effective than describing the format

2. **Step-by-Step Instructions**
   - Clear workflow: "First... Second... Finally..."
   - Reduces cognitive load
   - Creates mental checklist for model

3. **Structured Sections**
   - Uses `###` headers for logical chunks
   - Helps model parse request
   - Reduces risk of "forgetting" earlier parts

4. **Explicit Requirements**
   - Direct command: "The 'scenes' array must not be empty"
   - Addresses specific failure mode observed

### Before (Original Prompt)

```
You are analyzing a book chapter to accomplish TWO tasks in a single pass:

TASK 1: Identify ${numImages} key visual scenes for illustration
TASK 2: Extract ALL story elements (characters, places, items)

Chapter: ${chapter.chapterTitle}
Page Range: ${chapter.pageRange}
Content:
${chapter.content}

TASK 1 - VISUAL SCENES:
Identify ${numImages} visually interesting moments...
[detailed instructions]

TASK 2 - STORY ELEMENTS:
Extract ALL important story elements...
[detailed instructions]

Return as JSON:
{
  "scenes": [...],
  "elements": [...]
}
```

**Issues:**
- No concrete example
- Instructions mixed with content
- No clear prioritization
- Long descriptive blocks

### After (Optimized Prompt)

```
### PRIMARY GOAL
Analyze the provided chapter content to extract key visual scenes and story elements.

### STEP-BY-STEP INSTRUCTIONS
1. **First, identify ${numImages} key visual scenes.** These should be moments with strong, clear imagery suitable for illustration.
2. **Second, extract ALL important story elements.** These include characters, places, items, etc.
3. **Finally, format ALL collected information** into a single JSON object. It is critical that BOTH the "scenes" and "elements" arrays are populated.

### HIGH-QUALITY OUTPUT EXAMPLE
Here is an example of a perfect response for a fictional sci-fi chapter:
{
  "scenes": [
    {
      "quote": "The SecUnit crouched on the rusted gantry, its armor plating dripping with acidic rain as the twin suns of Kepler-186f set behind the jagged, purple mountains.",
      "description": "A lone, armored android (SecUnit) is perched on a high, industrial walkway overlooking an alien landscape at sunset. The scene is moody, with rain and a dramatic sky.",
      "reasoning": "This moment establishes the main character's isolation and the harsh, alien environment. The contrast between the high-tech armor and the decaying infrastructure is visually compelling."
    }
  ],
  "elements": [
    {
      "type": "character",
      "name": "SecUnit",
      "quotes": [
        {"text": "Its helmet was a smooth, dark gray plate, devoid of features except for a single red optical sensor.", "page": "p. 12"}
      ],
      "description": "A humanoid android construct in full body armor. The armor is dark gray and utilitarian, showing signs of wear."
    }
  ]
}

### CHAPTER DETAILS
Chapter: ${chapter.chapterTitle}
Page Range: ${chapter.pageRange}

### CHAPTER CONTENT
${chapter.content}

### REQUIRED JSON OUTPUT
Return your full analysis in the JSON format demonstrated in the example above. The "scenes" array must not be empty if the text contains any visual moments. Both "scenes" and "elements" arrays must be populated.
```

**Improvements:**
- Clear sections with headers
- Sequential workflow (First, Second, Finally)
- Concrete few-shot example
- Explicit requirement for both arrays
- Example uses All Systems Red context (SecUnit)

---

## System Message Update

### Before
```
You are a literary analyst specializing in visual storytelling and element extraction. Analyze the chapter once and provide both visual scenes and story elements. Return only valid JSON.
```

### After
```
You are a literary analyst AI specializing in visual storytelling and element extraction. Your task is to analyze a book chapter in a single pass and perform two distinct tasks: identifying key visual scenes and extracting all story elements. You must return a single, valid JSON object containing the results of both tasks.
```

**Changes:**
- More explicit about "single pass"
- Emphasizes "two distinct tasks"
- Reinforces "must return... both tasks"

---

## Prompt Engineering Techniques Applied

1. **Few-Shot Prompting**
   - HIGH-QUALITY OUTPUT EXAMPLE section
   - Shows exact format and content expectations
   - Most critical improvement

2. **Instructional Scaffolding**
   - Numbered steps create workflow
   - Headers break into digestible chunks
   - Reduces parsing complexity

3. **Reordering & Prioritization**
   - "First, identify scenes... Second, extract elements..."
   - Explicit sequence prevents task confusion

4. **Direct Failure Prevention**
   - "The 'scenes' array must not be empty"
   - Addresses observed failure mode

5. **Structured Format**
   - Markdown headers (###) for clear sections
   - Logical flow: Goal → Instructions → Example → Data → Requirements

---

## Model-Specific Considerations

### Gemini Flash (Free Tier)

**Strengths:**
- Excels at structured tasks
- Good with unambiguous instructions
- Fast and cost-effective

**Weaknesses:**
- Struggles with complex multi-part reasoning
- May skip difficult creative tasks
- Limited by speed/cost optimizations

**Optimizations:**
- Simplified structure over conversational tone
- Concrete examples over descriptions
- Lower temperature for deterministic output (0.5-0.6)

### Temperature Setting

Current: `0.6` (reasonable)

Recommendations:
- Keep at 0.6 for creative scene selection
- If still inconsistent, try 0.4-0.5 for more focus
- Don't go below 0.4 (may lose creativity)

---

## Alternative Approach: Sequential Chaining

If optimized unified prompt still fails, implement two-call chain:

### Two-Call Approach

**Call 1: Extract Scenes Only**
- Focused prompt asking only for scenes array
- Model dedicates all processing to creative task
- Higher quality scene descriptions

**Call 2: Extract Elements Only**
- Separate focused prompt for elements array
- Straightforward extraction task

**Application Logic:**
- Make both calls sequentially
- Merge results into single object
- Store in state as if from unified call

### Trade-offs

**Pros:**
- Significantly higher reliability
- Likely higher quality for each task
- Guaranteed success path

**Cons:**
- Doubles API calls (defeats optimization goal)
- Increases latency
- Higher token costs

**When to Use:**
- Optimized unified prompt proves unreliable
- Quality is more important than efficiency
- Working with free tier that can't handle unified task

---

## Testing Plan

### Phase 1: Optimized Unified Prompt
1. Test with All Systems Red (Chapter One)
2. Check if scenes array is populated
3. Verify element extraction still works
4. Compare token usage to original

### Phase 2: Extended Testing
1. Test with multiple chapters
2. Try different book genres
3. Measure success rate across book types
4. Compare paid vs free tier performance

### Phase 3: Fallback Decision
1. If success rate < 80% on free tier:
   - Implement two-call chain as fallback
   - Add config option: `unifiedAnalysis: boolean`
   - Auto-detect and switch based on model tier

### Phase 4: Model Recommendations
1. Document which models work well with unified
2. Recommend paid tiers for reliability
3. Add warnings for free tier limitations

---

## Expected Outcomes

### Best Case
- Free tier successfully uses optimized prompt
- 80%+ success rate on scene extraction
- Maintains 50% API call reduction
- Quality matches or exceeds separate calls

### Likely Case
- Improved but not perfect success rate (50-70%)
- Better than original but still inconsistent
- May need fallback for some books/chapters

### Worst Case
- Free tier fundamentally can't handle unified task
- Implement two-call chain as default
- Keep unified for paid tier only
- Document model requirements clearly

---

## Success Metrics

Track these before/after metrics:

1. **Scene Extraction Rate**
   - Before: 0% (empty arrays)
   - Target: 80%+ populated arrays

2. **Elements Extraction**
   - Before: Inconsistent
   - Target: Maintain or improve

3. **Quality Comparison**
   - Compare scene descriptions vs separate calls
   - Measure element completeness

4. **Token Efficiency**
   - Measure actual token usage
   - Compare to two-call approach

---

## Implementation Status

- ✅ Optimized prompt implemented
- ✅ System message updated
- ✅ Code built successfully
- ⏳ Testing blocked by API rate limits
- ⏳ Awaiting validation results
- ⏳ Fallback approach pending test results

---

## Next Steps

1. Wait for API rate limit reset
2. Test with single chapter from All Systems Red
3. Check state file for populated scenes array
4. If successful: test with full book
5. If unsuccessful: implement two-call fallback
6. Document final recommendation

---

**Document Version:** 1.0
**Created:** 2025-11-26
**Expert Consultant:** Gemini 2.5 Pro
**Implementation:** Complete
**Validation:** Pending (rate limits)
