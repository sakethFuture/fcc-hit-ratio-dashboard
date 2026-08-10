// Canonical tooltip/label copy — every InfoTip call site should pull from
// here rather than hand-copying strings, so wording never drifts between
// screens.

export const COPY = {
  finishedTradesOnly: {
    label: 'Finished trades only',
    tooltip: "Only counts tranches you've fully exited.",
  },
  everyTrade: {
    label: 'Every trade',
    tooltip: 'Counts every tranche ever entered, including ones still open.',
  },
  tranche: {
    tooltip:
      "One buy = one tranche. Every time you add to a position, even without selling first, it's tracked as its own separate trade with its own entry date.",
  },
  hit: {
    tooltip:
      "Hit means the stock's closing price reached at least 15% above what we paid, at any point since entry — whether or not we actually sold at that point.",
  },
} as const;
