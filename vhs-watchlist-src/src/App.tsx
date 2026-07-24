import {
  closestCenter,
  DndContext,
  KeyboardSensor,
  PointerSensor,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  arrayMove,
  rectSortingStrategy,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
  CalendarDays,
  Check,
  ChevronDown,
  ChevronUp,
  Clock,
  Download,
  Eye,
  Film,
  Filter,
  FolderPlus,
  GripVertical,
  Heart,
  LayoutGrid,
  List,
  Menu,
  Pencil,
  Plus,
  RotateCcw,
  Rows3,
  Search,
  Settings,
  Star,
  Trash2,
  Undo2,
  Upload,
  X,
} from "lucide-react";
import {
  type ChangeEvent,
  type CSSProperties,
  type FormEvent,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { createDefaultState } from "./data";
import type {
  CollectionFilter,
  LibraryState,
  Movie,
  RentalLabel,
  Shelf,
  SortMode,
  ViewMode,
} from "./types";

const STORAGE_KEY = "vhs-watchlist-library-v1";
const labels: RentalLabel[] = [
  "None",
  "Staff Pick",
  "Be Kind Rewind",
  "Late Return",
  "Cult Classic",
  "Do Not Tape Over",
];

const collectionItems: Array<{
  id: CollectionFilter;
  label: string;
  icon: typeof Film;
}> = [
  { id: "all", label: "All Tapes", icon: Film },
  { id: "new", label: "New Rentals", icon: Clock },
  { id: "watchNext", label: "Watch Next", icon: Eye },
  { id: "watched", label: "Watched", icon: Check },
  { id: "rewound", label: "Rewound", icon: RotateCcw },
  { id: "favorites", label: "Favorites", icon: Heart },
];

type MovieDraft = Omit<Movie, "id" | "dateAdded" | "watchedDates" | "rewound" | "favorite" | "watchNext" | "returned"> & {
  id?: string;
  watched: boolean;
};

const emptyDraft: MovieDraft = {
  title: "",
  year: new Date().getFullYear(),
  genres: [],
  director: "",
  runtime: 100,
  coverUrl: "",
  shelfId: "staff-picks",
  notes: "",
  review: "",
  rating: 0,
  label: "None",
  rentalDate: new Date().toISOString().slice(0, 10),
  watched: false,
};

function loadState(): LibraryState {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || "null") as LibraryState | null;
    if (saved?.movies && saved?.shelves) {
      return {
        ...createDefaultState(),
        ...saved,
        filters: {
          ...createDefaultState().filters,
          ...(saved.filters || {}),
        },
      };
    }
  } catch {
    localStorage.removeItem(STORAGE_KEY);
  }
  return createDefaultState();
}

function idFromTitle(title: string) {
  const stem = title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "tape";
  return `${stem}-${Date.now().toString(36)}`;
}

function formatDate(value: string) {
  if (!value) return "Not recorded";
  return new Intl.DateTimeFormat(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  }).format(new Date(`${value}T12:00:00`));
}

function movieMatchesCollection(movie: Movie, collection: CollectionFilter) {
  if (collection === "new") {
    return Date.now() - new Date(movie.dateAdded).getTime() < 1000 * 60 * 60 * 24 * 45;
  }
  if (collection === "watchNext") return movie.watchNext;
  if (collection === "watched") return movie.watchedDates.length > 0;
  if (collection === "rewound") return movie.rewound;
  if (collection === "favorites") return movie.favorite;
  return true;
}

function sortMovies(movies: Movie[], sort: SortMode) {
  return [...movies].sort((a, b) => {
    if (sort === "year") return b.year - a.year;
    if (sort === "rating") return b.rating - a.rating || a.title.localeCompare(b.title);
    if (sort === "dateAdded") return new Date(b.dateAdded).getTime() - new Date(a.dateAdded).getTime();
    if (sort === "recentlyWatched") {
      const aDate = a.watchedDates[0] || "";
      const bDate = b.watchedDates[0] || "";
      return bDate.localeCompare(aDate);
    }
    return a.title.localeCompare(b.title);
  });
}

function atlasStyle(index: number): CSSProperties {
  const column = index % 4;
  const row = Math.floor(index / 4);
  return {
    backgroundImage: "url('/vhs-watchlist/assets/vhs-cover-atlas.png')",
    backgroundPosition: `${column * 33.333}% ${row * 50}%`,
    backgroundSize: "400% 300%",
  };
}

function Stars({
  rating,
  onChange,
  compact = false,
}: {
  rating: number;
  onChange?: (rating: number) => void;
  compact?: boolean;
}) {
  return (
    <div className={`stars ${compact ? "compact" : ""}`} aria-label={`${rating} out of 5 stars`}>
      {[1, 2, 3, 4, 5].map((value) => (
        <button
          key={value}
          type="button"
          className={value <= rating ? "filled" : ""}
          aria-label={`Rate ${value} stars`}
          disabled={!onChange}
          onClick={() => onChange?.(value)}
        >
          <Star size={compact ? 12 : 17} fill={value <= rating ? "currentColor" : "none"} />
        </button>
      ))}
    </div>
  );
}

function CoverArt({ movie, large = false }: { movie: Movie; large?: boolean }) {
  const [imageFailed, setImageFailed] = useState(false);
  const hasExternal = Boolean(movie.coverUrl && !imageFailed);
  return (
    <div className={`cover-art ${large ? "large" : ""} ${!hasExternal && movie.atlasIndex == null ? "missing" : ""}`}>
      {hasExternal ? (
        <img src={movie.coverUrl} alt="" onError={() => setImageFailed(true)} />
      ) : movie.atlasIndex != null ? (
        <span className="atlas-cover" style={atlasStyle(movie.atlasIndex)} aria-hidden="true" />
      ) : (
        <span className="missing-cover" aria-hidden="true">
          <Film size={32} />
          NO COVER
        </span>
      )}
      <span className="cover-title">{movie.title}</span>
      <span className="cover-year">{movie.year}</span>
    </div>
  );
}

function StatusMarks({ movie }: { movie: Movie }) {
  return (
    <div className="status-marks">
      {movie.watchedDates.length > 0 && <span><Check size={11} /> Watched</span>}
      {movie.rewound && <span><RotateCcw size={11} /> Rewound</span>}
      {movie.favorite && <span><Heart size={11} fill="currentColor" /> Favorite</span>}
    </div>
  );
}

function TapeCard({
  movie,
  onSelect,
  onQuick,
}: {
  movie: Movie;
  onSelect: (movie: Movie) => void;
  onQuick: (id: string, action: "watchNext" | "watched" | "rewound" | "favorite") => void;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: `movie:${movie.id}`, data: { type: "movie", movieId: movie.id, shelfId: movie.shelfId } });
  const style: CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 20 : undefined,
  };

  return (
    <article ref={setNodeRef} style={style} className={`tape-case ${isDragging ? "dragging" : ""}`}>
      <button className="drag-handle" type="button" title="Drag tape to another shelf" aria-label={`Move ${movie.title}`} {...attributes} {...listeners}>
        <GripVertical size={15} />
      </button>
      <button className="tape-open" type="button" onClick={() => onSelect(movie)} aria-label={`Open ${movie.title} details`}>
        <span className="case-spine" aria-hidden="true">{movie.title}</span>
        <CoverArt movie={movie} />
        <span className={`rental-sticker label-${movie.label.toLowerCase().replaceAll(" ", "-")}`}>
          {movie.label === "None" ? "RENTAL" : movie.label}
        </span>
      </button>
      <div className="tape-meta">
        <strong>{movie.title}</strong>
        <span>{movie.year} / {movie.genres[0]}</span>
        <Stars rating={movie.rating} compact />
      </div>
      <div className="quick-actions" aria-label={`${movie.title} quick actions`}>
        <button type="button" className={movie.watchNext ? "active" : ""} title="Toggle Watch Next" aria-label="Toggle Watch Next" onClick={() => onQuick(movie.id, "watchNext")}><Eye size={14} /></button>
        <button type="button" className={movie.watchedDates.length ? "active" : ""} title="Toggle Watched" aria-label="Toggle Watched" onClick={() => onQuick(movie.id, "watched")}><Check size={14} /></button>
        <button type="button" className={movie.rewound ? "active" : ""} title="Toggle Rewound" aria-label="Toggle Rewound" onClick={() => onQuick(movie.id, "rewound")}><RotateCcw size={14} /></button>
        <button type="button" className={movie.favorite ? "active" : ""} title="Toggle Favorite" aria-label="Toggle Favorite" onClick={() => onQuick(movie.id, "favorite")}><Heart size={14} /></button>
      </div>
    </article>
  );
}

function ShelfSection({
  shelf,
  movies,
  onSelect,
  onQuick,
}: {
  shelf: Shelf;
  movies: Movie[];
  onSelect: (movie: Movie) => void;
  onQuick: (id: string, action: "watchNext" | "watched" | "rewound" | "favorite") => void;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: `shelf:${shelf.id}`, data: { type: "shelf", shelfId: shelf.id } });
  return (
    <section ref={setNodeRef} className={`rental-shelf ${isOver ? "drop-target" : ""}`}>
      <header className="shelf-heading">
        <span className="aisle-marker">{shelf.order + 1}</span>
        <div><h2>{shelf.name}</h2><p>{movies.length} {movies.length === 1 ? "tape" : "tapes"}</p></div>
      </header>
      <div className="shelf-run">
        <SortableContext items={movies.map((movie) => `movie:${movie.id}`)} strategy={rectSortingStrategy}>
          {movies.length ? movies.map((movie) => (
            <TapeCard key={movie.id} movie={movie} onSelect={onSelect} onQuick={onQuick} />
          )) : <div className="empty-shelf"><Film size={24} /><span>Empty shelf. Drag a tape here.</span></div>}
        </SortableContext>
      </div>
      <div className="wood-shelf" aria-hidden="true"><span /></div>
    </section>
  );
}

function MovieRow({
  movie,
  shelf,
  onSelect,
  onQuick,
}: {
  movie: Movie;
  shelf: Shelf | undefined;
  onSelect: (movie: Movie) => void;
  onQuick: (id: string, action: "watchNext" | "watched" | "rewound" | "favorite") => void;
}) {
  return (
    <article className="movie-row">
      <button type="button" className="row-cover" onClick={() => onSelect(movie)} aria-label={`Open ${movie.title} details`}><CoverArt movie={movie} /></button>
      <button type="button" className="row-title" onClick={() => onSelect(movie)}>
        <strong>{movie.title}</strong>
        <span>{movie.year} / {movie.director}</span>
      </button>
      <span>{shelf?.name || "Unfiled"}</span>
      <span>{movie.genres.join(", ")}</span>
      <Stars rating={movie.rating} compact />
      <StatusMarks movie={movie} />
      <div className="row-actions">
        <button type="button" title="Toggle Watched" aria-label="Toggle Watched" className={movie.watchedDates.length ? "active" : ""} onClick={() => onQuick(movie.id, "watched")}><Check size={15} /></button>
        <button type="button" title="Toggle Rewound" aria-label="Toggle Rewound" className={movie.rewound ? "active" : ""} onClick={() => onQuick(movie.id, "rewound")}><RotateCcw size={15} /></button>
      </div>
    </article>
  );
}

function IconButton({
  label,
  children,
  onClick,
  active = false,
}: {
  label: string;
  children: React.ReactNode;
  onClick?: () => void;
  active?: boolean;
}) {
  return <button className={`icon-button ${active ? "active" : ""}`} type="button" title={label} aria-label={label} onClick={onClick}>{children}</button>;
}

function DetailsDrawer({
  movie,
  shelf,
  onClose,
  onUpdate,
  onEdit,
  onDelete,
}: {
  movie: Movie;
  shelf: Shelf | undefined;
  onClose: () => void;
  onUpdate: (movie: Movie) => void;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const update = (changes: Partial<Movie>) => onUpdate({ ...movie, ...changes });
  const markWatched = () => {
    const today = new Date().toISOString().slice(0, 10);
    update({
      watchedDates: movie.watchedDates.length ? [] : [today],
      watchNext: movie.watchedDates.length ? movie.watchNext : false,
    });
  };
  return (
    <aside className="details-drawer" aria-label={`${movie.title} details`}>
      <div className="drawer-titlebar">
        <span>Rental Record</span>
        <IconButton label="Close details" onClick={onClose}><X size={17} /></IconButton>
      </div>
      <div className="drawer-scroll">
        <div className="drawer-hero">
          <CoverArt movie={movie} large />
          <div>
            <span className="drawer-kicker">{shelf?.name || "Unfiled"} / #{movie.id.slice(-4).toUpperCase()}</span>
            <h2>{movie.title}</h2>
            <p>{movie.year} / {movie.runtime} min</p>
            <p>{movie.genres.join(" / ")}</p>
            <Stars rating={movie.rating} onChange={(rating) => update({ rating })} />
          </div>
        </div>

        <div className="drawer-actions">
          <button type="button" className={movie.watchNext ? "active" : ""} onClick={() => update({ watchNext: !movie.watchNext })}><Eye size={15} /> Watch Next</button>
          <button type="button" className={movie.watchedDates.length ? "active" : ""} onClick={markWatched}><Check size={15} /> {movie.watchedDates.length ? "Unmark Watched" : "Mark Watched"}</button>
          <button type="button" className={movie.rewound ? "active" : ""} onClick={() => update({ rewound: !movie.rewound })}><RotateCcw size={15} /> Rewind</button>
          <button type="button" className={movie.favorite ? "active" : ""} onClick={() => update({ favorite: !movie.favorite })}><Heart size={15} /> Favorite</button>
        </div>

        <section className="rental-label">
          <div className="label-head"><span>VIDEO CLUB RATING</span><strong>{movie.label}</strong></div>
          <label>
            Rental label
            <select value={movie.label} onChange={(event) => update({ label: event.target.value as RentalLabel })}>
              {labels.map((label) => <option key={label}>{label}</option>)}
            </select>
          </label>
          <div className="label-dates">
            <span>Rented <b>{formatDate(movie.rentalDate)}</b></span>
            <span>Last watched <b>{formatDate(movie.watchedDates[0] || "")}</b></span>
          </div>
          <label>
            Handwritten review
            <textarea value={movie.review} maxLength={280} onChange={(event) => update({ review: event.target.value })} />
          </label>
        </section>

        <section className="drawer-section">
          <h3>Director</h3>
          <p>{movie.director || "Not recorded"}</p>
        </section>
        <section className="drawer-section">
          <h3>Clerk Notes</h3>
          <p>{movie.notes || "No notes on this rental."}</p>
        </section>
        <section className="drawer-section">
          <h3>Viewing History</h3>
          {movie.watchedDates.length ? (
            <ol className="history-dates">{movie.watchedDates.map((date, index) => <li key={`${date}-${index}`}><CalendarDays size={14} /> {formatDate(date)}</li>)}</ol>
          ) : <p>Not watched yet.</p>}
          <button type="button" className="text-action" onClick={() => update({ watchedDates: [new Date().toISOString().slice(0, 10), ...movie.watchedDates] })}>
            <Plus size={14} /> Add watched date
          </button>
        </section>
        {movie.returned && (
          <button type="button" className="return-action" onClick={() => update({ returned: false, watchNext: true })}><Undo2 size={15} /> Return to Shelf</button>
        )}
        <div className="drawer-footer">
          <button type="button" onClick={onEdit}><Pencil size={15} /> Edit Tape</button>
          <button type="button" className="danger" onClick={onDelete}><Trash2 size={15} /> Delete</button>
        </div>
      </div>
    </aside>
  );
}

function MovieDialog({
  open,
  movie,
  shelves,
  onClose,
  onSave,
}: {
  open: boolean;
  movie: Movie | null;
  shelves: Shelf[];
  onClose: () => void;
  onSave: (draft: MovieDraft) => void;
}) {
  const [draft, setDraft] = useState<MovieDraft>(emptyDraft);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!open) return;
    setError("");
    setDraft(movie ? {
      ...movie,
      id: movie.id,
      watched: movie.watchedDates.length > 0,
    } : { ...emptyDraft, shelfId: shelves[0]?.id || "staff-picks" });
  }, [open, movie, shelves]);

  if (!open) return null;
  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (!draft.title.trim()) return setError("Title is required.");
    if (draft.year < 1888 || draft.year > 2100) return setError("Enter a valid release year.");
    if (draft.runtime < 1 || draft.runtime > 1000) return setError("Runtime must be between 1 and 1000 minutes.");
    if (!shelves.some((shelf) => shelf.id === draft.shelfId)) return setError("Choose a valid shelf.");
    onSave({ ...draft, title: draft.title.trim(), director: draft.director.trim() });
  };

  return (
    <div className="modal-backdrop" role="presentation">
      <section className="modal-window movie-modal" role="dialog" aria-modal="true" aria-labelledby="movie-dialog-title">
        <div className="modal-titlebar">
          <strong id="movie-dialog-title">{movie ? "Edit Tape" : "Add Movie"}</strong>
          <IconButton label="Close movie form" onClick={onClose}><X size={17} /></IconButton>
        </div>
        <form onSubmit={submit}>
          <div className="form-grid">
            <label>Title<input value={draft.title} maxLength={120} autoFocus onChange={(event) => setDraft({ ...draft, title: event.target.value })} /></label>
            <label>Release year<input type="number" min="1888" max="2100" value={draft.year} onChange={(event) => setDraft({ ...draft, year: Number(event.target.value) })} /></label>
            <label>Director<input value={draft.director} maxLength={100} onChange={(event) => setDraft({ ...draft, director: event.target.value })} /></label>
            <label>Runtime (minutes)<input type="number" min="1" max="1000" value={draft.runtime} onChange={(event) => setDraft({ ...draft, runtime: Number(event.target.value) })} /></label>
            <label className="span-two">Genres<input value={draft.genres.join(", ")} placeholder="Horror, Sci-Fi" onChange={(event) => setDraft({ ...draft, genres: event.target.value.split(",").map((value) => value.trim()).filter(Boolean).slice(0, 6) })} /></label>
            <label>Shelf<select value={draft.shelfId} onChange={(event) => setDraft({ ...draft, shelfId: event.target.value })}>{shelves.map((shelf) => <option key={shelf.id} value={shelf.id}>{shelf.name}</option>)}</select></label>
            <label>Rental label<select value={draft.label} onChange={(event) => setDraft({ ...draft, label: event.target.value as RentalLabel })}>{labels.map((label) => <option key={label}>{label}</option>)}</select></label>
            <label>Personal rating<select value={draft.rating} onChange={(event) => setDraft({ ...draft, rating: Number(event.target.value) })}>{[0, 1, 2, 3, 4, 5].map((rating) => <option key={rating} value={rating}>{rating ? `${rating} star${rating === 1 ? "" : "s"}` : "Unrated"}</option>)}</select></label>
            <label>Rental date<input type="date" value={draft.rentalDate} onChange={(event) => setDraft({ ...draft, rentalDate: event.target.value })} /></label>
            <label className="span-two">Cover image URL<input type="url" value={draft.coverUrl} placeholder="https://example.com/cover.jpg" onChange={(event) => setDraft({ ...draft, coverUrl: event.target.value })} /></label>
            <label className="span-two">Clerk notes<textarea value={draft.notes} maxLength={500} onChange={(event) => setDraft({ ...draft, notes: event.target.value })} /></label>
            <label className="span-two">Short review<textarea value={draft.review} maxLength={280} onChange={(event) => setDraft({ ...draft, review: event.target.value })} /></label>
            <label className="check-field"><input type="checkbox" checked={draft.watched} onChange={(event) => setDraft({ ...draft, watched: event.target.checked })} /> Already watched</label>
          </div>
          <p className="form-error" role="alert">{error}</p>
          <div className="modal-actions"><button type="button" onClick={onClose}>Cancel</button><button type="submit" className="primary">{movie ? "Save Changes" : "Add to Library"}</button></div>
        </form>
      </section>
    </div>
  );
}

function ConfirmDialog({
  movie,
  onCancel,
  onConfirm,
}: {
  movie: Movie | null;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  if (!movie) return null;
  return (
    <div className="modal-backdrop">
      <section className="modal-window confirm-dialog" role="alertdialog" aria-modal="true" aria-labelledby="delete-title">
        <div className="modal-titlebar"><strong id="delete-title">Delete Tape?</strong></div>
        <div className="confirm-body"><Trash2 size={34} /><p>Remove <strong>{movie.title}</strong> and its viewing history? This cannot be undone.</p></div>
        <div className="modal-actions"><button type="button" onClick={onCancel}>Keep Tape</button><button type="button" className="danger" onClick={onConfirm}>Delete Permanently</button></div>
      </section>
    </div>
  );
}

function ShelfManager({
  shelves,
  movies,
  onClose,
  onChange,
}: {
  shelves: Shelf[];
  movies: Movie[];
  onClose: () => void;
  onChange: (shelves: Shelf[], replacement?: { removedId: string; targetId: string }) => void;
}) {
  const [name, setName] = useState("");
  const [editingId, setEditingId] = useState("");
  const [editingName, setEditingName] = useState("");
  const ordered = [...shelves].sort((a, b) => a.order - b.order);
  const addShelf = () => {
    const clean = name.trim();
    if (!clean) return;
    const next = [...ordered, { id: idFromTitle(clean), name: clean, custom: true, order: ordered.length }];
    onChange(next);
    setName("");
  };
  const move = (index: number, direction: -1 | 1) => {
    const target = index + direction;
    if (target < 0 || target >= ordered.length) return;
    onChange(arrayMove(ordered, index, target).map((shelf, order) => ({ ...shelf, order })));
  };
  const remove = (shelf: Shelf) => {
    const target = ordered.find((item) => item.id !== shelf.id)?.id;
    if (!target) return;
    onChange(ordered.filter((item) => item.id !== shelf.id).map((item, order) => ({ ...item, order })), { removedId: shelf.id, targetId: target });
  };

  return (
    <div className="modal-backdrop">
      <section className="modal-window shelf-modal" role="dialog" aria-modal="true" aria-labelledby="shelf-manager-title">
        <div className="modal-titlebar"><strong id="shelf-manager-title">Manage Shelves</strong><IconButton label="Close shelf manager" onClick={onClose}><X size={17} /></IconButton></div>
        <div className="new-shelf-row"><input value={name} maxLength={40} placeholder="New shelf name" onChange={(event) => setName(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") addShelf(); }} /><button type="button" onClick={addShelf}><FolderPlus size={15} /> Create Shelf</button></div>
        <div className="shelf-manager-list">
          {ordered.map((shelf, index) => (
            <div className="shelf-manager-row" key={shelf.id}>
              <span className="shelf-order">{index + 1}</span>
              {editingId === shelf.id ? (
                <input value={editingName} autoFocus onChange={(event) => setEditingName(event.target.value)} />
              ) : <strong>{shelf.name}</strong>}
              <span>{movies.filter((movie) => movie.shelfId === shelf.id).length} tapes</span>
              <div>
                {editingId === shelf.id ? (
                  <IconButton label="Save shelf name" onClick={() => {
                    const clean = editingName.trim();
                    if (clean) onChange(ordered.map((item) => item.id === shelf.id ? { ...item, name: clean } : item));
                    setEditingId("");
                  }}><Check size={15} /></IconButton>
                ) : (
                  <IconButton label={`Rename ${shelf.name}`} onClick={() => { setEditingId(shelf.id); setEditingName(shelf.name); }}><Pencil size={15} /></IconButton>
                )}
                <IconButton label={`Move ${shelf.name} up`} onClick={() => move(index, -1)}><ChevronUp size={15} /></IconButton>
                <IconButton label={`Move ${shelf.name} down`} onClick={() => move(index, 1)}><ChevronDown size={15} /></IconButton>
                {shelf.custom && <IconButton label={`Delete ${shelf.name}`} onClick={() => remove(shelf)}><Trash2 size={15} /></IconButton>}
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

function App() {
  const [state, setState] = useState<LibraryState>(loadState);
  const [selectedId, setSelectedId] = useState("");
  const [movieDialogOpen, setMovieDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState("");
  const [deleteId, setDeleteId] = useState("");
  const [shelfManagerOpen, setShelfManagerOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [toast, setToast] = useState("");
  const importInputRef = useRef<HTMLInputElement>(null);
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 7 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  }, [state]);

  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(""), 2800);
    return () => window.clearTimeout(timer);
  }, [toast]);

  const orderedShelves = useMemo(() => [...state.shelves].sort((a, b) => a.order - b.order), [state.shelves]);
  const genres = useMemo(() => [...new Set(state.movies.flatMap((movie) => movie.genres))].sort(), [state.movies]);
  const counts = useMemo(() => Object.fromEntries(collectionItems.map((item) => [
    item.id,
    state.movies.filter((movie) => movieMatchesCollection(movie, item.id)).length,
  ])), [state.movies]);

  const visibleMovies = useMemo(() => {
    const query = state.search.trim().toLowerCase();
    const filtered = state.movies.filter((movie) => {
      if (!movieMatchesCollection(movie, state.activeCollection)) return false;
      if (state.activeShelfId !== "all" && movie.shelfId !== state.activeShelfId) return false;
      if (state.filters.genre !== "all" && !movie.genres.includes(state.filters.genre)) return false;
      if (state.filters.rating && movie.rating < state.filters.rating) return false;
      if (state.filters.watched === "watched" && !movie.watchedDates.length) return false;
      if (state.filters.watched === "unwatched" && movie.watchedDates.length) return false;
      if (state.filters.rewound === "rewound" && !movie.rewound) return false;
      if (state.filters.rewound === "notRewound" && movie.rewound) return false;
      if (query) {
        const searchable = [movie.title, movie.director, movie.genres.join(" "), movie.label, movie.notes, movie.review].join(" ").toLowerCase();
        if (!searchable.includes(query)) return false;
      }
      return !movie.returned || state.activeCollection === "all";
    });
    return sortMovies(filtered, state.sort);
  }, [state]);

  const selectedMovie = state.movies.find((movie) => movie.id === selectedId) || null;
  const editingMovie = state.movies.find((movie) => movie.id === editingId) || null;
  const deleteMovie = state.movies.find((movie) => movie.id === deleteId) || null;
  const activeTitle = state.activeShelfId !== "all"
    ? orderedShelves.find((shelf) => shelf.id === state.activeShelfId)?.name || "Shelf"
    : collectionItems.find((item) => item.id === state.activeCollection)?.label || "All Tapes";

  const updateMovie = (nextMovie: Movie) => {
    setState((current) => ({ ...current, movies: current.movies.map((movie) => movie.id === nextMovie.id ? nextMovie : movie) }));
  };

  const quickAction = (id: string, action: "watchNext" | "watched" | "rewound" | "favorite") => {
    setState((current) => ({
      ...current,
      movies: current.movies.map((movie) => {
        if (movie.id !== id) return movie;
        if (action === "watchNext") return { ...movie, watchNext: !movie.watchNext, returned: false };
        if (action === "rewound") return { ...movie, rewound: !movie.rewound };
        if (action === "favorite") return { ...movie, favorite: !movie.favorite };
        return {
          ...movie,
          watchedDates: movie.watchedDates.length ? [] : [new Date().toISOString().slice(0, 10)],
          watchNext: movie.watchedDates.length ? movie.watchNext : false,
        };
      }),
    }));
  };

  const saveMovie = (draft: MovieDraft) => {
    if (editingMovie) {
      const watchedDates = draft.watched
        ? (editingMovie.watchedDates.length ? editingMovie.watchedDates : [new Date().toISOString().slice(0, 10)])
        : [];
      updateMovie({
        ...editingMovie,
        ...draft,
        genres: draft.genres,
        watchedDates,
      });
      setSelectedId(editingMovie.id);
      setToast("Tape record updated.");
    } else {
      const movie: Movie = {
        ...draft,
        id: idFromTitle(draft.title),
        dateAdded: new Date().toISOString(),
        watchedDates: draft.watched ? [new Date().toISOString().slice(0, 10)] : [],
        rewound: false,
        favorite: false,
        watchNext: !draft.watched,
        returned: false,
      };
      setState((current) => ({ ...current, movies: [movie, ...current.movies], onboardingDismissed: true }));
      setSelectedId(movie.id);
      setToast(`${movie.title} added to the rental floor.`);
    }
    setMovieDialogOpen(false);
    setEditingId("");
  };

  const confirmDelete = () => {
    if (!deleteMovie) return;
    setState((current) => ({ ...current, movies: current.movies.filter((movie) => movie.id !== deleteMovie.id) }));
    if (selectedId === deleteMovie.id) setSelectedId("");
    setDeleteId("");
    setToast("Tape deleted.");
  };

  const selectCollection = (collection: CollectionFilter) => {
    setState((current) => ({ ...current, activeCollection: collection, activeShelfId: "all" }));
    setMobileNavOpen(false);
  };

  const selectShelf = (shelfId: string) => {
    setState((current) => ({ ...current, activeShelfId: shelfId, activeCollection: "all" }));
    setMobileNavOpen(false);
  };

  const handleDragEnd = ({ active, over }: DragEndEvent) => {
    if (!over || active.id === over.id) return;
    const movieId = String(active.id).replace("movie:", "");
    const targetMovieId = String(over.id).startsWith("movie:") ? String(over.id).replace("movie:", "") : "";
    const targetShelfId = String(over.id).startsWith("shelf:")
      ? String(over.id).replace("shelf:", "")
      : String(over.data.current?.shelfId || "");
    if (!targetShelfId) return;
    setState((current) => {
      const sourceIndex = current.movies.findIndex((movie) => movie.id === movieId);
      if (sourceIndex < 0) return current;
      const moved = { ...current.movies[sourceIndex], shelfId: targetShelfId };
      const without = current.movies.filter((movie) => movie.id !== movieId);
      const targetIndex = targetMovieId ? without.findIndex((movie) => movie.id === targetMovieId) : without.length;
      without.splice(targetIndex < 0 ? without.length : targetIndex, 0, moved);
      return { ...current, movies: without };
    });
    setToast("Tape moved to a new shelf.");
  };

  const updateShelves = (shelves: Shelf[], replacement?: { removedId: string; targetId: string }) => {
    setState((current) => ({
      ...current,
      shelves,
      activeShelfId: replacement?.removedId === current.activeShelfId ? replacement.targetId : current.activeShelfId,
      movies: replacement
        ? current.movies.map((movie) => movie.shelfId === replacement.removedId ? { ...movie, shelfId: replacement.targetId } : movie)
        : current.movies,
    }));
  };

  const exportLibrary = () => {
    const blob = new Blob([JSON.stringify(state, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `vhs-watchlist-${new Date().toISOString().slice(0, 10)}.json`;
    anchor.click();
    URL.revokeObjectURL(url);
    setToast("Library exported.");
  };

  const importLibrary = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    try {
      const parsed = JSON.parse(await file.text()) as LibraryState;
      if (!Array.isArray(parsed.movies) || !Array.isArray(parsed.shelves)) throw new Error("Missing movies or shelves");
      if (!parsed.movies.every((movie) => movie.id && movie.title && movie.shelfId && Array.isArray(movie.genres))) throw new Error("Invalid movie record");
      if (!parsed.shelves.every((shelf) => shelf.id && shelf.name)) throw new Error("Invalid shelf record");
      const shelfIds = new Set(parsed.shelves.map((shelf) => shelf.id));
      if (!parsed.movies.every((movie) => shelfIds.has(movie.shelfId))) throw new Error("Movie references a missing shelf");
      setState({ ...createDefaultState(), ...parsed, onboardingDismissed: true });
      setSelectedId("");
      setSettingsOpen(false);
      setToast(`Imported ${parsed.movies.length} tapes successfully.`);
    } catch {
      setToast("Invalid import file. No library data was changed.");
    }
  };

  const resetLibrary = () => {
    if (!window.confirm("Reset the entire VHS library to sample data?")) return;
    setState({ ...createDefaultState(), onboardingDismissed: true });
    setSelectedId("");
    setSettingsOpen(false);
    setToast("Sample library restored.");
  };

  const clearFilters = () => setState((current) => ({
    ...current,
    search: "",
    activeShelfId: "all",
    activeCollection: "all",
    filters: { genre: "all", rating: 0, watched: "all", rewound: "all" },
  }));

  return (
    <div className="video-store-app">
      <header className="topbar">
        <button className="mobile-menu" type="button" aria-label="Open navigation" onClick={() => setMobileNavOpen(true)}><Menu size={20} /></button>
        <a className="brand" href="../index.html">
          <span className="brand-tape" aria-hidden="true"><i /><i /></span>
          <span><strong>VHS WATCHLIST</strong><small>Track movies like a rental-store shelf.</small></span>
        </a>
        <label className="search-control">
          <Search size={17} />
          <input aria-label="Search movie library" value={state.search} placeholder="Search title, genre, director, label..." onChange={(event) => setState({ ...state, search: event.target.value })} />
          {state.search && <button type="button" aria-label="Clear search" onClick={() => setState({ ...state, search: "" })}><X size={15} /></button>}
        </label>
        <button className="add-movie-button" type="button" onClick={() => { setEditingId(""); setMovieDialogOpen(true); }}><Plus size={17} /> Add Movie</button>
        <div className="view-controls" role="group" aria-label="Library view">
          <IconButton label="Shelf view" active={state.view === "shelf"} onClick={() => setState({ ...state, view: "shelf" })}><Rows3 size={17} /></IconButton>
          <IconButton label="Grid view" active={state.view === "grid"} onClick={() => setState({ ...state, view: "grid" })}><LayoutGrid size={17} /></IconButton>
          <IconButton label="List view" active={state.view === "list"} onClick={() => setState({ ...state, view: "list" })}><List size={17} /></IconButton>
        </div>
        <IconButton label="Filter library" active={filtersOpen} onClick={() => setFiltersOpen(!filtersOpen)}><Filter size={18} /></IconButton>
        <IconButton label="Settings" onClick={() => setSettingsOpen(true)}><Settings size={18} /></IconButton>
      </header>

      {filtersOpen && (
        <section className="filter-bar" aria-label="Movie filters">
          <label>Genre<select value={state.filters.genre} onChange={(event) => setState({ ...state, filters: { ...state.filters, genre: event.target.value } })}><option value="all">All genres</option>{genres.map((genre) => <option key={genre}>{genre}</option>)}</select></label>
          <label>Rating<select value={state.filters.rating} onChange={(event) => setState({ ...state, filters: { ...state.filters, rating: Number(event.target.value) } })}><option value="0">Any rating</option>{[5, 4, 3, 2, 1].map((rating) => <option key={rating} value={rating}>{rating}+ stars</option>)}</select></label>
          <label>Watched<select value={state.filters.watched} onChange={(event) => setState({ ...state, filters: { ...state.filters, watched: event.target.value as LibraryState["filters"]["watched"] } })}><option value="all">Any status</option><option value="watched">Watched</option><option value="unwatched">Unwatched</option></select></label>
          <label>Rewound<select value={state.filters.rewound} onChange={(event) => setState({ ...state, filters: { ...state.filters, rewound: event.target.value as LibraryState["filters"]["rewound"] } })}><option value="all">Any status</option><option value="rewound">Rewound</option><option value="notRewound">Not rewound</option></select></label>
          <button type="button" onClick={clearFilters}><X size={14} /> Clear filters</button>
        </section>
      )}

      <div className={`mobile-scrim ${mobileNavOpen ? "open" : ""}`} onClick={() => setMobileNavOpen(false)} />
      <aside className={`sidebar ${mobileNavOpen ? "open" : ""}`}>
        <div className="mobile-sidebar-head"><strong>Video Store</strong><IconButton label="Close navigation" onClick={() => setMobileNavOpen(false)}><X size={18} /></IconButton></div>
        <section>
          <h2>Membership Lists</h2>
          <nav>{collectionItems.map(({ id, label, icon: Icon }) => (
            <button key={id} type="button" className={state.activeCollection === id && state.activeShelfId === "all" ? "active" : ""} onClick={() => selectCollection(id)}>
              <Icon size={15} /><span>{label}</span><b>{counts[id]}</b>
            </button>
          ))}</nav>
        </section>
        <section>
          <div className="sidebar-heading"><h2>Store Shelves</h2><IconButton label="Manage shelves" onClick={() => setShelfManagerOpen(true)}><FolderPlus size={15} /></IconButton></div>
          <nav>{orderedShelves.map((shelf) => (
            <button key={shelf.id} type="button" className={state.activeShelfId === shelf.id ? "active" : ""} onClick={() => selectShelf(shelf.id)}>
              <span className="shelf-tab" aria-hidden="true" /><span>{shelf.name}</span><b>{state.movies.filter((movie) => movie.shelfId === shelf.id).length}</b>
            </button>
          ))}</nav>
        </section>
        <div className="membership-card">
          <span>MEMBER 084-1985</span>
          <strong>OLD SCHOOL VIDEO</strong>
          <small>NO LATE FEES ON REWOUND TAPES</small>
        </div>
      </aside>

      <main className={`library ${selectedMovie ? "drawer-open" : ""}`}>
        <header className="library-heading">
          <div><span className="section-stamp">AISLE DIRECTORY</span><h1>{activeTitle}</h1><p>{visibleMovies.length} of {state.movies.length} tapes on display</p></div>
          <label>Sort by<select value={state.sort} onChange={(event) => setState({ ...state, sort: event.target.value as SortMode })}><option value="title">Title</option><option value="year">Release year</option><option value="rating">Rating</option><option value="dateAdded">Date added</option><option value="recentlyWatched">Recently watched</option></select></label>
        </header>

        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
          {visibleMovies.length === 0 ? (
            <section className="empty-library">
              <Film size={42} />
              <h2>{state.movies.length ? "No tapes found" : "The rental floor is empty"}</h2>
              <p>{state.movies.length ? "Try another search, shelf, or filter." : "Add your first movie to start the library."}</p>
              <button type="button" onClick={state.movies.length ? clearFilters : () => setMovieDialogOpen(true)}>{state.movies.length ? "Clear Filters" : "Add First Movie"}</button>
            </section>
          ) : state.view === "shelf" ? (
            <div className="shelf-view">
              {orderedShelves
                .filter((shelf) => state.activeShelfId === "all" || shelf.id === state.activeShelfId)
                .map((shelf) => (
                  <ShelfSection key={shelf.id} shelf={shelf} movies={visibleMovies.filter((movie) => movie.shelfId === shelf.id)} onSelect={(movie) => setSelectedId(movie.id)} onQuick={quickAction} />
                ))}
            </div>
          ) : state.view === "grid" ? (
            <SortableContext items={visibleMovies.map((movie) => `movie:${movie.id}`)} strategy={rectSortingStrategy}>
              <div className="tape-grid">{visibleMovies.map((movie) => <TapeCard key={movie.id} movie={movie} onSelect={(item) => setSelectedId(item.id)} onQuick={quickAction} />)}</div>
            </SortableContext>
          ) : (
            <div className="list-view">
              <div className="list-head"><span>Tape</span><span>Title</span><span>Shelf</span><span>Genre</span><span>Rating</span><span>Status</span><span>Actions</span></div>
              {visibleMovies.map((movie) => <MovieRow key={movie.id} movie={movie} shelf={orderedShelves.find((shelf) => shelf.id === movie.shelfId)} onSelect={(item) => setSelectedId(item.id)} onQuick={quickAction} />)}
            </div>
          )}
        </DndContext>
      </main>

      {selectedMovie && (
        <DetailsDrawer
          movie={selectedMovie}
          shelf={orderedShelves.find((shelf) => shelf.id === selectedMovie.shelfId)}
          onClose={() => setSelectedId("")}
          onUpdate={updateMovie}
          onEdit={() => { setEditingId(selectedMovie.id); setMovieDialogOpen(true); }}
          onDelete={() => setDeleteId(selectedMovie.id)}
        />
      )}

      {!state.onboardingDismissed && (
        <div className="onboarding-banner">
          <div className="onboarding-tape"><Film size={34} /></div>
          <div><strong>Your membership is active.</strong><span>Open a tape for its rental record, or drag it onto another shelf.</span></div>
          <button type="button" onClick={() => setState({ ...state, onboardingDismissed: true })}>Enter Store</button>
        </div>
      )}

      <MovieDialog open={movieDialogOpen} movie={editingMovie} shelves={orderedShelves} onClose={() => { setMovieDialogOpen(false); setEditingId(""); }} onSave={saveMovie} />
      <ConfirmDialog movie={deleteMovie} onCancel={() => setDeleteId("")} onConfirm={confirmDelete} />
      {shelfManagerOpen && <ShelfManager shelves={orderedShelves} movies={state.movies} onClose={() => setShelfManagerOpen(false)} onChange={updateShelves} />}
      {settingsOpen && (
        <div className="modal-backdrop">
          <section className="modal-window settings-modal" role="dialog" aria-modal="true" aria-labelledby="settings-title">
            <div className="modal-titlebar"><strong id="settings-title">Store Settings</strong><IconButton label="Close settings" onClick={() => setSettingsOpen(false)}><X size={17} /></IconButton></div>
            <div className="settings-body">
              <section><h2>Library Data</h2><p>Move your complete movie library between browsers.</p><div><button type="button" onClick={exportLibrary}><Download size={16} /> Export JSON</button><button type="button" onClick={() => importInputRef.current?.click()}><Upload size={16} /> Import JSON</button></div></section>
              <section><h2>Store Floor</h2><p>Manage shelf names, order, and custom collections.</p><button type="button" onClick={() => { setSettingsOpen(false); setShelfManagerOpen(true); }}><FolderPlus size={16} /> Manage Shelves</button></section>
              <section className="danger-zone"><h2>Reset Library</h2><p>Restore all twelve sample tapes and default shelves.</p><button type="button" onClick={resetLibrary}><Trash2 size={16} /> Reset Sample Library</button></section>
            </div>
          </section>
        </div>
      )}
      <input ref={importInputRef} type="file" accept="application/json,.json" hidden onChange={importLibrary} />
      <div className={`toast ${toast ? "visible" : ""}`} role="status" aria-live="polite">{toast}</div>
    </div>
  );
}

export default App;
