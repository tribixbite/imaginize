# Model Comparison Results - Optimized Unified Prompt

**Test Date:** $(date +%Y-%m-%d)
**Test Book:** All Systems Red by Martha Wells
**Test Strategy:** Single chapter per model (Chapter One only)
**Objective:** Compare free tier model performance with optimized prompt

---

## Test Configuration

- **Optimized Prompt:** Few-shot example + structured sections
- **Wait between models:** 60 seconds
- **Retries on rate limit:** 3 attempts with 30s backoff
- **Chapter tested:** Chapter 5 (Chapter One - first story chapter)

---

## Results Summary

| Model | Scenes | Elements | Tokens | Status |
|-------|--------|----------|--------|--------|
| kwaipilot/kat-coder-pro:free | 0 | 0 | 4678 | ⚠️ No scenes |
| z-ai/glm-4.5-air:free | 0 | 0 | 4678 | ⚠️ No scenes |
| tngtech/deepseek-r1t2-chimera:free | 0 | 0 | 4678 | ⚠️ No scenes |

---

## Detailed Analysis


### Performance Comparison

Models ranked by combined scenes + elements extracted:


#### kwaipilot/kat-coder-pro:free

```

```


#### z-ai/glm-4.5-air:free

```

```


#### tngtech/deepseek-r1t2-chimera:free

```

```

