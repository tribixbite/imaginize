/**
 * Extraction Quality Metrics and Analytics
 * Tracks element extraction, entity resolution, and description enrichment performance
 */

export interface ExtractionMetrics {
  // Element extraction stats
  extraction: {
    totalElements: number;
    byType: Record<string, number>;
    avgQuotesPerElement: number;
    elementsWithDescriptions: number;
    elementsWithoutDescriptions: number;
  };

  // Entity resolution stats
  entityResolution: {
    totalAttempts: number;
    successfulMerges: number;
    failedMerges: number;
    avgConfidence: number;
    confidenceDistribution: {
      high: number; // > 0.8
      medium: number; // 0.6-0.8
      low: number; // < 0.6
    };
    aliasesDetected: number;
  };

  // Description enrichment stats
  enrichment: {
    totalEnrichments: number;
    simpleEnrichments: number;
    aiEnrichments: number;
    avgDescriptionLength: number;
    redundanciesSkipped: number;
  };

  // Performance stats
  performance: {
    totalTimeMs: number;
    avgTimePerChapterMs: number;
    tokensUsed: number;
    apiCalls: number;
  };

  // Quality indicators
  quality: {
    coverageScore: number; // 0-1: elements extracted vs estimated expected
    consistencyScore: number; // 0-1: alias detection success rate
    enrichmentScore: number; // 0-1: elements with good descriptions
  };
}

export class ExtractionMetricsCollector {
  private metrics: ExtractionMetrics;
  private startTime: number = 0;
  private confidenceScores: number[] = [];
  private descriptionLengths: number[] = [];
  private estimatedElementCount: number = 0;

  constructor() {
    this.metrics = {
      extraction: {
        totalElements: 0,
        byType: {},
        avgQuotesPerElement: 0,
        elementsWithDescriptions: 0,
        elementsWithoutDescriptions: 0,
      },
      entityResolution: {
        totalAttempts: 0,
        successfulMerges: 0,
        failedMerges: 0,
        avgConfidence: 0,
        confidenceDistribution: {
          high: 0,
          medium: 0,
          low: 0,
        },
        aliasesDetected: 0,
      },
      enrichment: {
        totalEnrichments: 0,
        simpleEnrichments: 0,
        aiEnrichments: 0,
        avgDescriptionLength: 0,
        redundanciesSkipped: 0,
      },
      performance: {
        totalTimeMs: 0,
        avgTimePerChapterMs: 0,
        tokensUsed: 0,
        apiCalls: 0,
      },
      quality: {
        coverageScore: 0,
        consistencyScore: 0,
        enrichmentScore: 0,
      },
    };
  }

  /**
   * Start timing extraction process
   */
  startTimer(): void {
    this.startTime = Date.now();
  }

  /**
   * Stop timing and calculate performance metrics
   */
  stopTimer(chaptersProcessed: number): void {
    this.metrics.performance.totalTimeMs = Date.now() - this.startTime;
    this.metrics.performance.avgTimePerChapterMs =
      this.metrics.performance.totalTimeMs / Math.max(1, chaptersProcessed);
  }

  /**
   * Set estimated element count for coverage calculation
   */
  setEstimatedElementCount(count: number): void {
    this.estimatedElementCount = count;
  }

  /**
   * Record element extraction
   */
  recordElementExtraction(
    type: string,
    hasDescription: boolean,
    quotesCount: number
  ): void {
    this.metrics.extraction.totalElements++;
    this.metrics.extraction.byType[type] =
      (this.metrics.extraction.byType[type] || 0) + 1;

    if (hasDescription) {
      this.metrics.extraction.elementsWithDescriptions++;
    } else {
      this.metrics.extraction.elementsWithoutDescriptions++;
    }

    // Update average quotes per element
    const totalQuotes =
      this.metrics.extraction.avgQuotesPerElement *
        (this.metrics.extraction.totalElements - 1) +
      quotesCount;
    this.metrics.extraction.avgQuotesPerElement =
      totalQuotes / this.metrics.extraction.totalElements;
  }

  /**
   * Record entity resolution attempt
   */
  recordEntityResolution(
    isMatch: boolean,
    confidence: number,
    aliasDetected: boolean
  ): void {
    this.metrics.entityResolution.totalAttempts++;

    if (isMatch) {
      this.metrics.entityResolution.successfulMerges++;
      if (aliasDetected) {
        this.metrics.entityResolution.aliasesDetected++;
      }
    } else {
      this.metrics.entityResolution.failedMerges++;
    }

    // Track confidence score
    this.confidenceScores.push(confidence);

    // Update confidence distribution
    if (confidence > 0.8) {
      this.metrics.entityResolution.confidenceDistribution.high++;
    } else if (confidence >= 0.6) {
      this.metrics.entityResolution.confidenceDistribution.medium++;
    } else {
      this.metrics.entityResolution.confidenceDistribution.low++;
    }

    // Calculate average confidence
    this.metrics.entityResolution.avgConfidence =
      this.confidenceScores.reduce((a, b) => a + b, 0) / this.confidenceScores.length;
  }

  /**
   * Record description enrichment
   */
  recordEnrichment(
    type: 'simple' | 'ai',
    descriptionLength: number,
    wasRedundant: boolean
  ): void {
    if (wasRedundant) {
      this.metrics.enrichment.redundanciesSkipped++;
      return;
    }

    this.metrics.enrichment.totalEnrichments++;

    if (type === 'simple') {
      this.metrics.enrichment.simpleEnrichments++;
    } else {
      this.metrics.enrichment.aiEnrichments++;
    }

    // Track description length
    this.descriptionLengths.push(descriptionLength);
    this.metrics.enrichment.avgDescriptionLength =
      this.descriptionLengths.reduce((a, b) => a + b, 0) / this.descriptionLengths.length;
  }

  /**
   * Record token usage
   */
  recordTokenUsage(tokens: number): void {
    this.metrics.performance.tokensUsed += tokens;
  }

  /**
   * Record API call
   */
  recordApiCall(): void {
    this.metrics.performance.apiCalls++;
  }

  /**
   * Calculate quality scores
   */
  calculateQualityScores(): void {
    // Coverage score: actual elements / estimated elements
    this.metrics.quality.coverageScore =
      this.estimatedElementCount > 0
        ? Math.min(1, this.metrics.extraction.totalElements / this.estimatedElementCount)
        : 0;

    // Consistency score: successful merges / total attempts
    this.metrics.quality.consistencyScore =
      this.metrics.entityResolution.totalAttempts > 0
        ? this.metrics.entityResolution.successfulMerges /
          this.metrics.entityResolution.totalAttempts
        : 0;

    // Enrichment score: elements with good descriptions / total elements
    this.metrics.quality.enrichmentScore =
      this.metrics.extraction.totalElements > 0
        ? this.metrics.extraction.elementsWithDescriptions /
          this.metrics.extraction.totalElements
        : 0;
  }

  /**
   * Get current metrics
   */
  getMetrics(): ExtractionMetrics {
    this.calculateQualityScores();
    return { ...this.metrics };
  }

  /**
   * Generate human-readable report
   */
  generateReport(): string {
    this.calculateQualityScores();

    const lines: string[] = [];
    lines.push('=== Extraction Quality Metrics ===\n');

    // Element extraction
    lines.push('📊 Element Extraction:');
    lines.push(`  Total Elements: ${this.metrics.extraction.totalElements}`);
    lines.push('  By Type:');
    for (const [type, count] of Object.entries(this.metrics.extraction.byType)) {
      lines.push(`    - ${type}: ${count}`);
    }
    lines.push(
      `  Avg Quotes/Element: ${this.metrics.extraction.avgQuotesPerElement.toFixed(1)}`
    );
    lines.push(
      `  With Descriptions: ${this.metrics.extraction.elementsWithDescriptions} (${((this.metrics.extraction.elementsWithDescriptions / Math.max(1, this.metrics.extraction.totalElements)) * 100).toFixed(1)}%)`
    );
    lines.push('');

    // Entity resolution
    lines.push('🔍 Entity Resolution:');
    lines.push(`  Total Attempts: ${this.metrics.entityResolution.totalAttempts}`);
    lines.push(`  Successful Merges: ${this.metrics.entityResolution.successfulMerges}`);
    lines.push(`  Failed Merges: ${this.metrics.entityResolution.failedMerges}`);
    lines.push(`  Aliases Detected: ${this.metrics.entityResolution.aliasesDetected}`);
    lines.push(
      `  Avg Confidence: ${this.metrics.entityResolution.avgConfidence.toFixed(3)}`
    );
    lines.push('  Confidence Distribution:');
    lines.push(
      `    High (>0.8): ${this.metrics.entityResolution.confidenceDistribution.high}`
    );
    lines.push(
      `    Medium (0.6-0.8): ${this.metrics.entityResolution.confidenceDistribution.medium}`
    );
    lines.push(
      `    Low (<0.6): ${this.metrics.entityResolution.confidenceDistribution.low}`
    );
    lines.push('');

    // Description enrichment
    lines.push('✨ Description Enrichment:');
    lines.push(`  Total Enrichments: ${this.metrics.enrichment.totalEnrichments}`);
    lines.push(`  Simple: ${this.metrics.enrichment.simpleEnrichments}`);
    lines.push(`  AI-Powered: ${this.metrics.enrichment.aiEnrichments}`);
    lines.push(
      `  Avg Description Length: ${Math.round(this.metrics.enrichment.avgDescriptionLength)} chars`
    );
    lines.push(`  Redundancies Skipped: ${this.metrics.enrichment.redundanciesSkipped}`);
    lines.push('');

    // Performance
    lines.push('⚡ Performance:');
    lines.push(
      `  Total Time: ${(this.metrics.performance.totalTimeMs / 1000).toFixed(1)}s`
    );
    lines.push(
      `  Avg Time/Chapter: ${(this.metrics.performance.avgTimePerChapterMs / 1000).toFixed(1)}s`
    );
    lines.push(`  Tokens Used: ${this.metrics.performance.tokensUsed.toLocaleString()}`);
    lines.push(`  API Calls: ${this.metrics.performance.apiCalls}`);
    lines.push('');

    // Quality scores
    lines.push('🎯 Quality Scores:');
    lines.push(
      `  Coverage: ${(this.metrics.quality.coverageScore * 100).toFixed(1)}% ${this.getScoreEmoji(this.metrics.quality.coverageScore)}`
    );
    lines.push(
      `  Consistency: ${(this.metrics.quality.consistencyScore * 100).toFixed(1)}% ${this.getScoreEmoji(this.metrics.quality.consistencyScore)}`
    );
    lines.push(
      `  Enrichment: ${(this.metrics.quality.enrichmentScore * 100).toFixed(1)}% ${this.getScoreEmoji(this.metrics.quality.enrichmentScore)}`
    );
    lines.push('');

    // Recommendations
    lines.push('💡 Recommendations:');
    const recommendations = this.generateRecommendations();
    if (recommendations.length === 0) {
      lines.push('  All metrics look good! ✅');
    } else {
      recommendations.forEach((rec) => lines.push(`  - ${rec}`));
    }

    return lines.join('\n');
  }

  /**
   * Get emoji for score visualization
   */
  private getScoreEmoji(score: number): string {
    if (score >= 0.8) return '🟢';
    if (score >= 0.6) return '🟡';
    return '🔴';
  }

  /**
   * Generate recommendations based on metrics
   */
  private generateRecommendations(): string[] {
    const recommendations: string[] = [];

    // Coverage recommendations
    if (this.metrics.quality.coverageScore < 0.7) {
      recommendations.push(
        `Low coverage (${(this.metrics.quality.coverageScore * 100).toFixed(1)}%). Consider enabling iterativeExtraction or lowering entityMatchConfidence.`
      );
    }

    // Consistency recommendations
    if (this.metrics.quality.consistencyScore < 0.5) {
      recommendations.push(
        `Low consistency (${(this.metrics.quality.consistencyScore * 100).toFixed(1)}%). Consider lowering entityMatchConfidence to detect more aliases.`
      );
    } else if (this.metrics.quality.consistencyScore > 0.9) {
      recommendations.push(
        `Very high consistency (${(this.metrics.quality.consistencyScore * 100).toFixed(1)}%). May be over-merging. Consider raising entityMatchConfidence.`
      );
    }

    // Enrichment recommendations
    if (this.metrics.quality.enrichmentScore < 0.6) {
      recommendations.push(
        `Low enrichment (${(this.metrics.quality.enrichmentScore * 100).toFixed(1)}%). Many elements lack descriptions. Review extraction prompts.`
      );
    }

    // Confidence distribution recommendations
    const lowConfidenceRatio =
      this.metrics.entityResolution.confidenceDistribution.low /
      Math.max(1, this.metrics.entityResolution.totalAttempts);
    if (lowConfidenceRatio > 0.3) {
      recommendations.push(
        `${(lowConfidenceRatio * 100).toFixed(1)}% of matches have low confidence. Consider raising confidence threshold.`
      );
    }

    // AI enrichment recommendation
    if (
      this.metrics.enrichment.totalEnrichments > 10 &&
      this.metrics.enrichment.aiEnrichments === 0
    ) {
      recommendations.push(
        'Consider enabling aiDescriptionEnrichment for better description quality.'
      );
    }

    // Redundancy recommendation
    const redundancyRatio =
      this.metrics.enrichment.redundanciesSkipped /
      Math.max(
        1,
        this.metrics.enrichment.totalEnrichments +
          this.metrics.enrichment.redundanciesSkipped
      );
    if (redundancyRatio > 0.5) {
      recommendations.push(
        `${(redundancyRatio * 100).toFixed(1)}% of enrichments were redundant. Element normalization is working well.`
      );
    }

    return recommendations;
  }

  /**
   * Export metrics as JSON
   */
  toJSON(): string {
    this.calculateQualityScores();
    return JSON.stringify(this.metrics, null, 2);
  }
}
