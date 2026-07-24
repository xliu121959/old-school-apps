export type ViewMode = "shelf" | "grid" | "list";
export type AppTheme = "classic" | "dark";
export type SortMode = "title" | "year" | "rating" | "dateAdded" | "recentlyWatched";
export type CollectionFilter = "all" | "new" | "watchNext" | "watched" | "rewound" | "favorites";

export type RentalLabel =
  | "None"
  | "Staff Pick"
  | "Be Kind Rewind"
  | "Late Return"
  | "Cult Classic"
  | "Do Not Tape Over";

export interface Shelf {
  id: string;
  name: string;
  custom: boolean;
  order: number;
}

export interface Movie {
  id: string;
  title: string;
  year: number;
  genres: string[];
  director: string;
  runtime: number;
  coverUrl: string;
  atlasIndex?: number;
  shelfId: string;
  notes: string;
  review: string;
  rating: number;
  label: RentalLabel;
  watchedDates: string[];
  rentalDate: string;
  rewound: boolean;
  favorite: boolean;
  watchNext: boolean;
  returned: boolean;
  dateAdded: string;
}

export interface LibraryState {
  movies: Movie[];
  shelves: Shelf[];
  theme: AppTheme;
  view: ViewMode;
  sort: SortMode;
  activeCollection: CollectionFilter;
  activeShelfId: string;
  search: string;
  filters: {
    genre: string;
    rating: number;
    watched: "all" | "watched" | "unwatched";
    rewound: "all" | "rewound" | "notRewound";
  };
  onboardingDismissed: boolean;
  clientUpdatedAt: number;
}
