export interface RingSwatch {
  id: string;
  label: string;
  color: string;
}

export interface RingBuilderConfig {
  enabled?: boolean;
  headline?: string;
  subhead?: string;
  metals?: RingSwatch[];
  gems?: RingSwatch[];
  defaultMetalId?: string;
  defaultGemId?: string;
}

export interface AuditData {
  lead_id?: string;
  auditMeta: {
    generatedDate: string;
    reportId: string;
    confidentialityLabel: string;
    preparedForLabel: string;
    currencyCode: string;
    currencySymbol: string;
    locale: string;
  };
  business: {
    name: string;
    location: string;
    logoUrl: string;
    /**
     * Optional apollo-only cover image. Neuro payloads omit this.
     * UI must fall back to branding.clientLogoUrl then business.logoUrl.
     */
    heroImageUrl?: string;
    industry: string;
    storeCount: number;
    teamSize: number | null;
    website: string;
    primaryPhone: string;
  };
  reviews: {
    rating: number;
    count: number;
    starsDisplay: string;
    quote1: string;
    quote2: string;
    themes: string[];
  };
  traffic: {
    sources: Array<{
      label: string;
      percent: number;
      colorKey: string;
    }>;
  };
  callModel: {
    inboundCallsPerWeekMin: number;
    inboundCallsPerWeekMax: number;
    answerRateMin: number;
    answerRateMax: number;
    missedCallsPerWeekMin: number;
    missedCallsPerWeekMax: number;
    answeredCallsPerWeekMin: number;
    answeredCallsPerWeekMax: number;
    missedCallTypeSplit: Array<{
      label: string;
      percent: number;
    }>;
  };
  revenueModel: {
    monthlyLossMin: number;
    monthlyLossMax: number;
    monthlyLossMidpoint: number;
    sixMonthCumulativeLeak: number;
    lineSeries: number[];
  };
  breakdown: {
    rows: Array<{
      callType: string;
      weeklyMissedMin: number;
      weeklyMissedMax: number;
      monthlyImpactMin: number;
      monthlyImpactMax: number;
    }>;
    riskBadge: string;
    opportunityCards: Array<{
      title: string;
      subtitle: string;
      valueNote: string;
      impactTier: string;
      mobileWidthPercent: number;
    }>;
  };
  comparison: {
    currentAnsweredRate: number;
    currentMonthlyLoss: number;
    projectedAnsweredRate: number;
    projectedMonthlyLoss: number;
    comparisonFootnote: string;
  };
  projection90d: {
    answerRateProjected: string;
    monthlyRecoveredProjected: string;
    paybackPeriodProjected: string;
    barWidths: {
      answerRate: string;
      monthlyRecovered: string;
      paybackPeriod: string;
    };
  };
  recoveryPlan: {
    headline: string;
    body: string;
    capabilities: string[];
    supportingMediaUrl: string;
  };
  liveDemo: {
    ctaLabel: string;
    helperCopy: string;
    phoneCountryDefault: string;
    demoDurationHint: string;
    /** Optional alias. Prefer top-level `ringBuilder`. */
    ringBuilder?: RingBuilderConfig;
  };
  /**
   * Optional. Neuro payloads that omit this still work.
   * Set `enabled: false` to hide the studio. See DYNAMIC-JSON.md.
   */
  ringBuilder?: RingBuilderConfig;
  branding: {
    theme: {
      primary: string;
      secondary: string;
      accentGold: string;
      accentSilver: string;
    };
    logoWordmarkUrl: string;
    clientLogoUrl: string;
    fontHeading: string;
    fontBody: string;
  };
  compliance: {
    dataSourceLine: string;
    disclaimerShort: string;
    disclaimerLong: string;
    allowedClaims: string[];
  };
}
