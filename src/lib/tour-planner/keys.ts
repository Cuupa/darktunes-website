export const tourPlannerKeys = {
  all: ['tour-planner'] as const,
  tours: (artistId: string) => ['tour-planner', 'tours', artistId] as const,
  stops: (artistId: string, tourId: string | null) => ['tour-planner', 'stops', artistId, tourId] as const,
  tasks: (artistId: string, tourId: string | null) => ['tour-planner', 'tasks', artistId, tourId] as const,
  contacts: (artistId: string) => ['tour-planner', 'contacts', artistId] as const,
  crew: (artistId: string, tourId: string | null) => ['tour-planner', 'crew', artistId, tourId] as const,
  merch: (artistId: string) => ['tour-planner', 'merch', artistId] as const,
}