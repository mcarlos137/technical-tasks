/**
 * Example queries GraphiQL opens with, one tab each; GraphiQL names a tab after its operation.
 * graphiql-examples.test.ts runs every tab against the app, so they can't drift from the schema.
 */
export const graphiqlTabs: Array<{ query: string; variables?: string }> = [
  {
    query: `# What "today" is in the mock data, and the games tomorrow morning.
# Run with the ▶ button or Cmd/Ctrl+Enter. The other tabs hold more examples.
query TomorrowMorning {
  referenceDate { today weekday city firstGameDate lastGameDate }
  games(filter: { date: "2026-08-26", startTimeFrom: "06:00", startTimeTo: "12:00" }) {
    totalCount
    games { id startTime venue { name } format spotsAvailable availability }
  }
}
`,
  },
  {
    query: `# Open spots at a venue over a date range. The name match ignores case and accents.
query SpotsAtLaCatalana {
  games(filter: { dateFrom: "2026-08-29", dateTo: "2026-08-31", venueName: "catalana", minSpotsAvailable: 1 }) {
    totalCount
    games { date startTime endTime priceEur spotsAvailable organizer { displayName } }
    appliedFilter { dateFrom dateTo venueName minSpotsAvailable }
  }
}
`,
  },
  {
    query: `# One game by id. The id comes from the Variables pane below.
query GameById($id: ID!) {
  game(id: $id) { startsAt venue { name address } format priceEur isRecorded spotsTaken spotsTotal }
}
`,
    variables: JSON.stringify({ id: 'g-0826-0915-agapito' }, null, 2),
  },
  {
    query: `# Bad input gets a clear error instead of an empty list.
query BadDate {
  games(filter: { date: "26/08/2026" }) { totalCount }
}
`,
  },
];
