import { useState, useEffect } from 'react';
import { initializeApp } from 'firebase/app';
import { 
  getAuth, 
  signInWithCustomToken, 
  signInAnonymously, 
  onAuthStateChanged,
  User 
} from 'firebase/auth';
import { 
  getFirestore, 
  collection, 
  doc, 
  getDocs, 
  addDoc,
  deleteDoc, 
  writeBatch
} from 'firebase/firestore';
import { 
  Trophy, 
  Users, 
  Calendar, 
  Shield, 
  Activity, 
  Swords, 
  ChevronRight, 
  Plus, 
  Check, 
  Lock, 
  RefreshCw, 
  TrendingUp, 
  TrendingDown, 
  Minus, 
  Crown, 
  MapPin,
  Dumbbell,
  Search,
  Trash2,
  X,
  AlertTriangle,
  EyeOff
} from 'lucide-react';

// --- Global Declarations for Environment Variables ---
declare const __app_id: string | undefined;
declare const __firebase_config: string;
declare const __initial_auth_token: string | undefined;

// --- Firebase Initialization ---
const firebaseConfig = {
  apiKey: "AIzaSyBa569XqOnIsyVStplj2zWRKH9tFQBeYLw",
  authDomain: "bayou-fight-night-b09f2.firebaseapp.com",
  projectId: "bayou-fight-night-b09f2",
  storageBucket: "bayou-fight-night-b09f2.firebasestorage.app",
  messagingSenderId: "362593331938",
  appId: "1:362593331938:web:3cc3e3babeccb7127e4cbb"
};
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const appId = typeof __app_id !== 'undefined' ? __app_id : 'default-app-id';

// --- Types & Interfaces ---

type Sport = 'mma' | 'kickboxing' | 'grappling' | 'bare_knuckle_boxing';
type Gender = 'men' | 'women';
type FighterLevel = 'pro' | 'am';
type BoutMethod = 'ko_tko' | 'submission' | 'ud' | 'md_td' | 'sd' | 'dq_doctor' | 'draw' | 'nc';

interface Fighter {
  id: string;
  first_name: string;
  last_name: string;
  fighter_name: string; // generated
  slug: string;
  sport: Sport;
  gender: Gender;
  weight_class: string;
  gym_id?: string;
  hometown?: string;
  active_status: 'active' | 'inactive';
  fighter_level: FighterLevel;
  photo_url?: string;
  is_published: boolean;
}

interface Gym {
  id: string;
  name: string;
  slug: string;
  city: string;
  state: string;
}

interface Promotion {
  id: string;
  name: string;
  slug: string;
  region: string;
}

interface Event {
  id: string;
  promotion_id: string;
  name: string;
  slug: string;
  event_date: string; // ISO date string
  venue: string;
  city: string;
  state: string;
  is_published: boolean;
}

interface Belt {
    id: string;
    promotion_id: string;
    name: string; // e.g. "World Lightweight Championship"
    sport: Sport;
    gender: Gender;
    weight_class: string;
    current_champion_id?: string | null;
    is_active: boolean;
}

interface Bout {
  id: string;
  event_id: string;
  bout_order: number;
  sport: Sport;
  gender: Gender;
  weight_class: string;
  red_fighter_id: string;
  blue_fighter_id: string;
  winner_id?: string | null; // null if draw/nc
  method?: BoutMethod;
  round?: number;
  time?: string;
  is_title_bout: boolean;
  belt_id?: string | null; // Reference to belt if title bout
  is_published: boolean; // inherited from event
}

interface RankingSnapshot {
  id: string;
  as_of_date: string;
  sport: Sport;
  gender: Gender;
  weight_class: string;
  rank: number;
  fighter_id: string;
  score: number;
  previous_rank?: number;
}

// --- Constants ---

const START_RATING_PRO = 1500;
const START_RATING_AM = 1450;
const MIN_RATED_FIGHTS = 2;

const K_FACTORS = {
  0: 38, // 0-1 fights
  2: 28, // 2-4 fights
  5: 18, // 5-9 fights
  10: 14 // 10+ fights
};

const METHOD_MULTIPLIERS: Record<BoutMethod, number> = {
  'ko_tko': 1.18,
  'submission': 1.18,
  'ud': 1.08,
  'md_td': 1.03,
  'sd': 1.00,
  'dq_doctor': 1.00,
  'draw': 1.00, // Should be handled by draw logic, but keeping for safety
  'nc': 0
};

const WEIGHT_CLASSES: Record<Sport, Record<Gender, string[]>> = {
  mma: {
    men: ['Flyweight (125)', 'Bantamweight (135)', 'Featherweight (145)', 'Lightweight (155)', 'Welterweight (170)', 'Middleweight (185)', 'Light Heavyweight (205)', 'Heavyweight (265)'],
    women: ['Strawweight (115)', 'Flyweight (125)', 'Bantamweight (135)', 'Featherweight (145)']
  },
  kickboxing: {
    men: ['125 lbs', '135 lbs', '145 lbs', '155 lbs', '170 lbs', '185 lbs', '205 lbs', 'Heavyweight'],
    women: ['115 lbs', '125 lbs', '135 lbs', '145 lbs']
  },
  grappling: {
    men: ['Light', 'Middle', 'Heavy'],
    women: ['Light', 'Middle', 'Heavy']
  },
  bare_knuckle_boxing: {
    men: ['135', '145', '155', '175', '205', 'HVY'],
    women: ['125', '135', '145']
  }
};

const SPORTS_LABELS: Record<Sport, string> = {
  mma: 'MMA',
  kickboxing: 'Kickboxing',
  grappling: 'Grappling',
  bare_knuckle_boxing: 'Bare Knuckle'
};

// --- Helper Functions ---

const slugify = (text: string) => {
  return text
    .toString()
    .toLowerCase()
    .trim()
    .replace(/\s+/g, '-')     // Replace spaces with -
    .replace(/[^\w\-]+/g, '') // Remove all non-word chars
    .replace(/\-\-+/g, '-');  // Replace multiple - with single -
};

const generateFighterName = (first: string, last: string) => `${first.trim()} ${last.trim()}`;

const getKFactor = (fightCount: number) => {
  if (fightCount >= 10) return K_FACTORS[10]; // @ts-ignore
  if (fightCount >= 5) return K_FACTORS[5]; // @ts-ignore
  if (fightCount >= 2) return K_FACTORS[2]; // @ts-ignore
  return K_FACTORS[0]; // @ts-ignore
};

const calculateNewRatings = (
  ratingA: number, 
  ratingB: number, 
  actualScoreA: number, // 1 for win, 0.5 for draw, 0 for loss
  kFactorA: number,
  kFactorB: number,
  methodMultiplier: number,
  isTitleBout: boolean
) => {
  const expectedA = 1 / (1 + Math.pow(10, (ratingB - ratingA) / 400));
  const expectedB = 1 / (1 + Math.pow(10, (ratingA - ratingB) / 400));

  let changeA = kFactorA * (actualScoreA - expectedA) * methodMultiplier;
  let changeB = kFactorB * ((1 - actualScoreA) - expectedB) * methodMultiplier;

  // Title bout bonus (Spec: +5 for winner)
  if (isTitleBout && actualScoreA === 1) changeA += 5;
  if (isTitleBout && actualScoreA === 0) changeB += 5;

  // Opponent quality bonuses (Spec)
  if (actualScoreA === 1) {
    if (ratingB >= 1700) changeA += 8;
    else if (ratingB >= 1650) changeA += 6;
    else if (ratingB >= 1600) changeA += 3;
  } else if (actualScoreA === 0) {
     if (ratingA >= 1700) changeB += 8;
    else if (ratingA >= 1650) changeB += 6;
    else if (ratingA >= 1600) changeB += 3;
  }

  return {
    newRatingA: ratingA + changeA,
    newRatingB: ratingB + changeB
  };
};

const calculateFighterRecord = (fighterId: string, allBouts: Bout[]) => {
  let wins = 0;
  let losses = 0;
  let draws = 0;
  let nc = 0;

  allBouts.forEach(b => {
    if (!b.is_published) return;
    if (b.red_fighter_id !== fighterId && b.blue_fighter_id !== fighterId) return;
    
    // Check for NC
    if (b.method === 'nc') {
      nc++;
      return;
    }
    
    // Check for Draw
    if (b.winner_id === 'draw' || (!b.winner_id && b.method === 'draw')) {
      draws++;
      return;
    }

    // Win/Loss
    if (b.winner_id === fighterId) {
      wins++;
    } else if (b.winner_id) {
      losses++;
    }
  });

  return { wins, losses, draws, nc };
};

// --- Components ---

const LoadingSpinner = () => (
  <div className="flex justify-center items-center h-64 text-yellow-500">
    <RefreshCw className="animate-spin h-8 w-8" />
  </div>
);

// Custom Modal Component to replace window.confirm
const ConfirmModal = ({ 
    isOpen, 
    message, 
    onConfirm, 
    onCancel 
}: { 
    isOpen: boolean; 
    message: string; 
    onConfirm: () => void; 
    onCancel: () => void 
}) => {
    if (!isOpen) return null;
    return (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-[100] backdrop-blur-sm p-4">
            <div className="bg-slate-800 border border-slate-600 rounded-xl p-6 max-w-sm w-full shadow-2xl">
                <div className="flex items-center gap-3 text-yellow-500 mb-4">
                    <AlertTriangle className="w-6 h-6"/>
                    <h3 className="text-lg font-bold text-white">Confirm Action</h3>
                </div>
                <p className="text-slate-300 mb-6">{message}</p>
                <div className="flex justify-end gap-3">
                    <button onClick={onCancel} className="px-4 py-2 rounded bg-slate-700 text-white font-medium hover:bg-slate-600 transition-colors">Cancel</button>
                    <button onClick={onConfirm} className="px-4 py-2 rounded bg-red-600 text-white font-bold hover:bg-red-500 transition-colors">Confirm</button>
                </div>
            </div>
        </div>
    );
};

// Custom Toast Component to replace window.alert
const NotificationToast = ({ 
    message, 
    type, 
    onClose 
}: { 
    message: string; 
    type: 'success' | 'error'; 
    onClose: () => void 
}) => {
    useEffect(() => {
        const timer = setTimeout(onClose, 3000);
        return () => clearTimeout(timer);
    }, [onClose]);

    return (
        <div className={`fixed bottom-4 right-4 px-6 py-3 rounded-lg shadow-2xl z-[100] flex items-center gap-3 animate-in slide-in-from-bottom-2 fade-in duration-300 ${type === 'success' ? 'bg-green-600 text-white' : 'bg-red-600 text-white'}`}>
            {type === 'success' ? <Check className="w-5 h-5"/> : <AlertTriangle className="w-5 h-5"/>}
            <span className="font-bold">{message}</span>
        </div>
    );
};

const App = () => {
  const [user, setUser] = useState<User | null>(null);
  const [isAdminMode, setIsAdminMode] = useState(false);
  const [activeTab, setActiveTab] = useState('rankings'); // rankings, events, admin_dashboard
  const [searchQuery, setSearchQuery] = useState('');
  
  // Modal & Notification State
  const [modalConfig, setModalConfig] = useState<{isOpen: boolean, message: string, onConfirm: () => void} | null>(null);
  const [notification, setNotification] = useState<{message: string, type: 'success' | 'error'} | null>(null);

  // Navigation State
  const [publicEventId, setPublicEventId] = useState<string | null>(null); 
  const [viewingFighterId, setViewingFighterId] = useState<string | null>(null);
  const [viewingGymId, setViewingGymId] = useState<string | null>(null);
  const [viewingPromoId, setViewingPromoId] = useState<string | null>(null);

  // Data State
  const [fighters, setFighters] = useState<Fighter[]>([]);
  const [events, setEvents] = useState<Event[]>([]);
  const [bouts, setBouts] = useState<Bout[]>([]);
  const [rankings, setRankings] = useState<RankingSnapshot[]>([]);
  const [promotions, setPromotions] = useState<Promotion[]>([]);
  const [gyms, setGyms] = useState<Gym[]>([]);
  const [belts, setBelts] = useState<Belt[]>([]);
  const [loading, setLoading] = useState(true);

  // Filters
  const [selectedSport, setSelectedSport] = useState<Sport>('mma');
  const [selectedGender, setSelectedGender] = useState<Gender>('men');
  const [selectedWeightClass, setSelectedWeightClass] = useState<string>(WEIGHT_CLASSES['mma']['men'][3]); 

  // --- Helpers ---
  const showNotification = (message: string, type: 'success' | 'error' = 'success') => {
      setNotification({ message, type });
  };

  const requestConfirmation = (message: string, action: () => void) => {
      setModalConfig({
          isOpen: true,
          message,
          onConfirm: () => {
              action();
              setModalConfig(null);
          }
      });
  };

  // --- Auth & Data Fetching ---

  useEffect(() => {
    const initAuth = async () => {
      if (typeof __initial_auth_token !== 'undefined' && __initial_auth_token) {
        await signInWithCustomToken(auth, __initial_auth_token);
      } else {
        await signInAnonymously(auth);
      }
    };
    initAuth();
    const unsubscribe = onAuthStateChanged(auth, setUser);
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (!user) return;

    // Fetch Public Data
    const fetchData = async () => {
      setLoading(true);
      try {
        const [fightersSnap, eventsSnap, boutsSnap, rankingsSnap, promotionsSnap, gymsSnap, beltsSnap] = await Promise.all([
            getDocs(collection(db, 'artifacts', appId, 'public', 'data', 'fighters')),
            getDocs(collection(db, 'artifacts', appId, 'public', 'data', 'events')),
            getDocs(collection(db, 'artifacts', appId, 'public', 'data', 'bouts')),
            getDocs(collection(db, 'artifacts', appId, 'public', 'data', 'rankings_snapshots')),
            getDocs(collection(db, 'artifacts', appId, 'public', 'data', 'promotions')),
            getDocs(collection(db, 'artifacts', appId, 'public', 'data', 'gyms')),
            getDocs(collection(db, 'artifacts', appId, 'public', 'data', 'belts'))
        ]);

        // Added 'any' type casting to avoid implicit any errors in map functions
        setFighters(fightersSnap.docs.map((d: any) => ({ id: d.id, ...d.data() } as Fighter)));
        setEvents(eventsSnap.docs.map((d: any) => ({ id: d.id, ...d.data() } as Event)).sort((a: any, b: any) => new Date(b.event_date).getTime() - new Date(a.event_date).getTime()));
        setBouts(boutsSnap.docs.map((d: any) => ({ id: d.id, ...d.data() } as Bout)));
        setRankings(rankingsSnap.docs.map((d: any) => ({ id: d.id, ...d.data() } as RankingSnapshot)));
        setPromotions(promotionsSnap.docs.map((d: any) => ({ id: d.id, ...d.data() } as Promotion)));
        setGyms(gymsSnap.docs.map((d: any) => ({ id: d.id, ...d.data() } as Gym)));
        setBelts(beltsSnap.docs.map((d: any) => ({ id: d.id, ...d.data() } as Belt))); 
      } catch (err) {
        console.error("Error fetching data", err);
      }
      setLoading(false);
    };

    fetchData();
  }, [user]);

  // --- Actions ---

  const handleCreateFighter = async (data: Partial<Fighter>) => {
    if (!user) return;
    const name = generateFighterName(data.first_name!, data.last_name!);
    const newFighter: any = {
      first_name: data.first_name!,
      last_name: data.last_name!,
      fighter_name: name,
      slug: slugify(name),
      sport: data.sport || 'mma',
      gender: data.gender || 'men',
      weight_class: data.weight_class!,
      hometown: data.hometown || '',
      active_status: 'active',
      fighter_level: data.fighter_level || 'am', // Default to Amateur per spec
      is_published: true // Simplified for prototype
    };

    if (data.gym_id) newFighter.gym_id = data.gym_id;
    if (data.photo_url) newFighter.photo_url = data.photo_url;
    
    const docRef = await addDoc(collection(db, 'artifacts', appId, 'public', 'data', 'fighters'), newFighter);
    setFighters([...fighters, { ...newFighter, id: docRef.id } as Fighter]);
    showNotification("Fighter added successfully!");
  };

  const handleDeleteFighter = (id: string) => {
      requestConfirmation("Are you sure you want to delete this fighter? This action cannot be undone.", async () => {
          if (!user) return;
          await deleteDoc(doc(db, 'artifacts', appId, 'public', 'data', 'fighters', id));
          setFighters(fighters.filter(f => f.id !== id));
          showNotification("Fighter deleted.");
      });
  };

  const handleCreateEvent = async (data: Partial<Event>) => {
    if (!user) return;
    const newEvent: Omit<Event, 'id'> = {
      promotion_id: data.promotion_id!,
      name: data.name!,
      slug: slugify(data.name!),
      event_date: data.event_date!,
      venue: data.venue || '',
      city: data.city || '',
      state: data.state || 'LA',
      is_published: false // Events start unpublished
    };
    const docRef = await addDoc(collection(db, 'artifacts', appId, 'public', 'data', 'events'), newEvent);
    setEvents([...events, { ...newEvent, id: docRef.id } as Event]);
    showNotification("Event draft created.");
  };

  const handleDeleteEvent = (id: string) => {
      requestConfirmation("Delete this event? Bouts linked to it will remain in the database but be hidden.", async () => {
          if(!user) return;
          await deleteDoc(doc(db, 'artifacts', appId, 'public', 'data', 'events', id));
          setEvents(events.filter(e => e.id !== id));
          showNotification("Event deleted.");
      });
  };

  const handleCreateBelt = async (data: Partial<Belt>) => {
      if(!user) return;
      const newBelt: Omit<Belt, 'id'> = {
          promotion_id: data.promotion_id!,
          name: data.name!,
          sport: data.sport!,
          gender: data.gender!,
          weight_class: data.weight_class!,
          current_champion_id: null,
          is_active: true
      };
      const docRef = await addDoc(collection(db, 'artifacts', appId, 'public', 'data', 'belts'), newBelt);
      setBelts([...belts, { ...newBelt, id: docRef.id }]);
      showNotification("Belt Created Successfully!");
  };

  const handleDeleteBelt = (id: string) => {
      requestConfirmation("Delete this championship belt?", async () => {
          if(!user) return;
          await deleteDoc(doc(db, 'artifacts', appId, 'public', 'data', 'belts', id));
          setBelts(belts.filter(b => b.id !== id));
          showNotification("Belt deleted.");
      });
  }

  const handleAddBout = async (boutData: Partial<Bout>) => {
    if(!user) return;
    if (!boutData.red_fighter_id || !boutData.blue_fighter_id) return;
    
    const newBout: any = {
        event_id: boutData.event_id!,
        bout_order: bouts.filter(b => b.event_id === boutData.event_id).length + 1,
        sport: boutData.sport!,
        gender: boutData.gender!,
        weight_class: boutData.weight_class!,
        red_fighter_id: boutData.red_fighter_id!,
        blue_fighter_id: boutData.blue_fighter_id!,
        is_title_bout: boutData.is_title_bout || false,
        is_published: false
    };

    if (boutData.winner_id) newBout.winner_id = boutData.winner_id;
    if (boutData.method) newBout.method = boutData.method;
    if (boutData.round) newBout.round = boutData.round;
    if (boutData.time) newBout.time = boutData.time;
    if (boutData.belt_id) newBout.belt_id = boutData.belt_id; // Store belt ID if selected

    const docRef = await addDoc(collection(db, 'artifacts', appId, 'public', 'data', 'bouts'), newBout);
    setBouts([...bouts, { ...newBout, id: docRef.id } as Bout]);
    showNotification("Bout added to card.");
  };

  const handleDeleteBout = (id: string) => {
      requestConfirmation("Remove this bout from the card?", async () => {
          if(!user) return;
          await deleteDoc(doc(db, 'artifacts', appId, 'public', 'data', 'bouts', id));
          setBouts(bouts.filter(b => b.id !== id));
          showNotification("Bout removed.");
      });
  };

  const handlePublishEvent = async (event: Event) => {
    if(!user) return;
    const batch = writeBatch(db);

    // 1. Publish Event
    batch.update(doc(db, 'artifacts', appId, 'public', 'data', 'events', event.id), { is_published: true });
    
    // 2. Publish Bouts & Handle Belt Transfers
    const eventBouts = bouts.filter(b => b.event_id === event.id);
    const updatedBouts = [...bouts];
    const updatedBelts = [...belts];

    eventBouts.forEach(b => {
        // Publish bout
        const boutRef = doc(db, 'artifacts', appId, 'public', 'data', 'bouts', b.id);
        batch.update(boutRef, { is_published: true });

        // AUTOMATION: Belt Update Logic
        // If it is a title bout, has a belt_id, and has a winner
        if (b.is_title_bout && b.belt_id && b.winner_id) {
            // Find the belt
            const beltIndex = updatedBelts.findIndex(belt => belt.id === b.belt_id);
            if (beltIndex !== -1) {
                // Update belt champion in Firestore
                const beltRef = doc(db, 'artifacts', appId, 'public', 'data', 'belts', b.belt_id);
                batch.update(beltRef, { current_champion_id: b.winner_id });
                
                // Update local state copy
                updatedBelts[beltIndex] = { ...updatedBelts[beltIndex], current_champion_id: b.winner_id };
            }
        }
    });

    await batch.commit();

    // Local State updates
    setEvents(events.map(e => e.id === event.id ? { ...e, is_published: true } : e));
    setBouts(updatedBouts.map(b => b.event_id === event.id ? { ...b, is_published: true } : b));
    setBelts(updatedBelts); // Update belts state to reflect new champions immediately
    showNotification("Event Published! Rankings and Champions updated.");
  };

  const handleUnpublishEvent = (event: Event) => {
      requestConfirmation("Unpublish this event? It will be hidden from the public and excluded from ranking calculations until republished. This allows you to edit the card.", async () => {
          if(!user) return;
          const batch = writeBatch(db);

          // 1. Unpublish Event
          batch.update(doc(db, 'artifacts', appId, 'public', 'data', 'events', event.id), { is_published: false });

          // 2. Unpublish Bouts
          const eventBouts = bouts.filter(b => b.event_id === event.id);
          const updatedBouts = [...bouts];

          eventBouts.forEach(b => {
              const boutRef = doc(db, 'artifacts', appId, 'public', 'data', 'bouts', b.id);
              batch.update(boutRef, { is_published: false });
          });

          await batch.commit();

          // Local State Update
          setEvents(events.map(e => e.id === event.id ? { ...e, is_published: false } : e));
          setBouts(updatedBouts.map(b => b.event_id === event.id ? { ...b, is_published: false } : b));
          showNotification("Event Unpublished. You can now edit the card.");
      });
  };

  // --- THE RANKING ENGINE ---
  const recomputeRankings = async () => {
    if (!user) return;
    setLoading(true);

    const previousRankMap = new Map<string, number>();
    rankings.forEach(r => {
      const key = `${r.fighter_id}_${r.sport}_${r.gender}_${r.weight_class}`;
      previousRankMap.set(key, r.rank);
    });

    const fighterStats = new Map<string, { rating: number, fights: number, lastFightDate: Date | null, sport: Sport, gender: Gender, weight: string }>();

    fighters.forEach(f => {
      fighterStats.set(f.id, {
        rating: f.fighter_level === 'pro' ? START_RATING_PRO : START_RATING_AM,
        fights: 0,
        lastFightDate: null,
        sport: f.sport,
        gender: f.gender,
        weight: f.weight_class
      });
    });

    const publishedBouts = bouts.filter(b => b.is_published && b.method !== 'nc');
    const boutsWithDate = publishedBouts.map(b => {
      const evt = events.find(e => e.id === b.event_id);
      return { ...b, date: evt ? new Date(evt.event_date) : new Date(0) };
    }).sort((a, b) => a.date.getTime() - b.date.getTime() || a.bout_order - b.bout_order);

    boutsWithDate.forEach(bout => {
        const red = fighterStats.get(bout.red_fighter_id);
        const blue = fighterStats.get(bout.blue_fighter_id);

        if (!red || !blue) return; 

        let scoreA = 0.5;
        if (bout.winner_id === bout.red_fighter_id) scoreA = 1;
        else if (bout.winner_id === bout.blue_fighter_id) scoreA = 0;

        const kA = getKFactor(red.fights);
        const kB = getKFactor(blue.fights);
        const methodMult = bout.method ? METHOD_MULTIPLIERS[bout.method] : 1.0;

        const { newRatingA, newRatingB } = calculateNewRatings(
            red.rating, blue.rating, scoreA, kA, kB, methodMult, bout.is_title_bout
        );

        red.rating = newRatingA;
        red.fights += 1;
        red.lastFightDate = bout.date;

        blue.rating = newRatingB;
        blue.fights += 1;
        blue.lastFightDate = bout.date;

        fighterStats.set(bout.red_fighter_id, red);
        fighterStats.set(bout.blue_fighter_id, blue);
    });

    const today = new Date();
    // Removed unused 'id' parameter from forEach
    fighterStats.forEach((stats) => {
        if (!stats.lastFightDate) return;
        const diffTime = Math.abs(today.getTime() - stats.lastFightDate.getTime());
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)); 
        
        let penalty = 0;
        if (diffDays > 365) penalty = 20;
        else if (diffDays > 270) penalty = 10;
        else if (diffDays > 180) penalty = 5;

        stats.rating -= penalty;
    });

    const batch = writeBatch(db);
    const snapshotDate = new Date().toISOString().split('T')[0];
    const newSnapshots: RankingSnapshot[] = [];

    let rankCounter: Record<string, number> = {}; 

    const sortedFighters = Array.from(fighterStats.entries()).sort((a, b) => b[1].rating - a[1].rating);

    for (const [fId, stats] of sortedFighters) {
        if (stats.fights < MIN_RATED_FIGHTS) continue;

        const key = `${stats.sport}_${stats.gender}_${stats.weight}`;
        if (!rankCounter[key]) rankCounter[key] = 1;
        
        const rank = rankCounter[key]++;
        
        if (rank > 50) continue;

        const prevRankKey = `${fId}_${stats.sport}_${stats.gender}_${stats.weight}`;
        const prevRank = previousRankMap.get(prevRankKey);

        const snapRef = doc(collection(db, 'artifacts', appId, 'public', 'data', 'rankings_snapshots'));
        const snap: any = {
            id: snapRef.id,
            as_of_date: snapshotDate,
            sport: stats.sport,
            gender: stats.gender,
            weight_class: stats.weight,
            rank: rank,
            fighter_id: fId,
            score: parseFloat(stats.rating.toFixed(1)),
        };

        if (prevRank !== undefined) {
            snap.previous_rank = prevRank;
        }

        batch.set(snapRef, snap);
        newSnapshots.push(snap);
    }

    await batch.commit();
    setRankings(newSnapshots);
    setLoading(false);
    showNotification("Rankings Updated: Movement indicators calculated.");
  };

  const seedData = async () => {
      requestConfirmation("This will RESET and SEED demo data. Continue?", async () => {
          if(!user) return;
          const batch = writeBatch(db);
          const promoId = "promo-1";
          const gymId = "gym-1";
          const beltId = "belt-lightweight";
          
          batch.set(doc(db, 'artifacts', appId, 'public', 'data', 'promotions', promoId), {
              id: promoId, name: 'Bayou Fight Night', slug: 'bayou-fight-night', region: 'Louisiana'
          });
          batch.set(doc(db, 'artifacts', appId, 'public', 'data', 'gyms', gymId), {
              id: gymId, name: 'Gladiators Academy', slug: 'gladiators-academy', city: 'Lafayette', state: 'LA'
          });

          const fightersList = [
            { id: 'f1', first: 'Dustin', last: 'Poirier' },
            { id: 'f2', first: 'Justin', last: 'Gaethje' },
            { id: 'f3', first: 'Charles', last: 'Oliveira' },
            { id: 'f4', first: 'Islam', last: 'Makhachev' },
          ];

          fightersList.forEach(f => {
             const name = `${f.first} ${f.last}`;
             batch.set(doc(db, 'artifacts', appId, 'public', 'data', 'fighters', f.id), {
                  id: f.id, first_name: f.first, last_name: f.last, fighter_name: name, slug: slugify(name),
                  sport: 'mma', gender: 'men', weight_class: 'Lightweight (155)', gym_id: gymId, active_status: 'active', fighter_level: 'pro', is_published: true
             });
          });

          // Create Belt - Islam (f4) wins it in Bout 3 below
          batch.set(doc(db, 'artifacts', appId, 'public', 'data', 'belts', beltId), {
              id: beltId,
              promotion_id: promoId,
              name: 'BFN Lightweight World Championship',
              sport: 'mma',
              gender: 'men',
              weight_class: 'Lightweight (155)',
              current_champion_id: 'f4',
              is_active: true
          });

          const evt1Id = 'evt-seed-1';
          batch.set(doc(db, 'artifacts', appId, 'public', 'data', 'events', evt1Id), {
              id: evt1Id, promotion_id: promoId, name: 'BFN 1: Origins', slug: 'bfn-1', event_date: '2023-06-01', venue: 'Cajundome', city: 'Lafayette', state: 'LA', is_published: true
          });
          batch.set(doc(db, 'artifacts', appId, 'public', 'data', 'bouts', 'b1'), {
              id: 'b1', event_id: evt1Id, bout_order: 1, sport: 'mma', gender: 'men', weight_class: 'Lightweight (155)',
              red_fighter_id: 'f1', blue_fighter_id: 'f2', winner_id: 'f1', method: 'ko_tko', is_title_bout: false, is_published: true
          });
          batch.set(doc(db, 'artifacts', appId, 'public', 'data', 'bouts', 'b2'), {
              id: 'b2', event_id: evt1Id, bout_order: 2, sport: 'mma', gender: 'men', weight_class: 'Lightweight (155)',
              red_fighter_id: 'f3', blue_fighter_id: 'f4', winner_id: 'f4', method: 'submission', is_title_bout: false, is_published: true
          });

          const evt2Id = 'evt-seed-2';
          batch.set(doc(db, 'artifacts', appId, 'public', 'data', 'events', evt2Id), {
              id: evt2Id, promotion_id: promoId, name: 'BFN 2: Heat', slug: 'bfn-2', event_date: '2023-09-01', venue: 'UNO Lakefront', city: 'New Orleans', state: 'LA', is_published: true
          });
          batch.set(doc(db, 'artifacts', appId, 'public', 'data', 'bouts', 'b3'), {
              id: 'b3', event_id: evt2Id, bout_order: 1, sport: 'mma', gender: 'men', weight_class: 'Lightweight (155)',
              red_fighter_id: 'f1', blue_fighter_id: 'f4', winner_id: 'f4', method: 'ud', 
              is_title_bout: true, belt_id: beltId, // Link belt to the title fight
              is_published: true
          });
          batch.set(doc(db, 'artifacts', appId, 'public', 'data', 'bouts', 'b4'), {
              id: 'b4', event_id: evt2Id, bout_order: 2, sport: 'mma', gender: 'men', weight_class: 'Lightweight (155)',
              red_fighter_id: 'f2', blue_fighter_id: 'f3', winner_id: 'f3', method: 'submission', is_title_bout: false, is_published: true
          });
          
          await batch.commit();
          showNotification("Seed Data Injected. Reloading...");
          setTimeout(() => window.location.reload(), 1000);
      });
  };


  // --- Renderers ---

  const renderRankings = () => {
    // Check for drill-down views
    if (viewingFighterId) return renderFighterProfile(viewingFighterId);
    if (viewingGymId) return renderGymProfile(viewingGymId);

    const filtered = rankings
        .filter(r => r.sport === selectedSport && r.gender === selectedGender && r.weight_class === selectedWeightClass)
        .sort((a,b) => a.rank - b.rank);

    return (
      <div className="space-y-6">
        <div className="bg-slate-800 p-6 rounded-xl border border-slate-700 shadow-lg">
          <div className="flex flex-col md:flex-row gap-4 justify-between items-center mb-6">
            <h2 className="text-2xl font-bold text-white flex items-center gap-2">
              <Trophy className="text-yellow-500" />
              Official Rankings
            </h2>
            <div className="flex gap-2 flex-wrap justify-center">
              <select 
                value={selectedSport} 
                onChange={(e) => {
                    setSelectedSport(e.target.value as Sport);
                    setSelectedWeightClass(WEIGHT_CLASSES[e.target.value as Sport][selectedGender][0]);
                }}
                className="bg-slate-700 text-white p-2 rounded border border-slate-600 outline-none focus:border-yellow-500"
              >
                {Object.entries(SPORTS_LABELS).map(([k,v]) => <option key={k} value={k}>{v}</option>)}
              </select>
              <select 
                value={selectedGender} 
                onChange={(e) => {
                    const g = e.target.value as Gender;
                    setSelectedGender(g);
                    setSelectedWeightClass(WEIGHT_CLASSES[selectedSport][g][0]);
                }}
                className="bg-slate-700 text-white p-2 rounded border border-slate-600 outline-none focus:border-yellow-500"
              >
                <option value="men">Men's</option>
                <option value="women">Women's</option>
              </select>
              <select 
                value={selectedWeightClass} 
                onChange={(e) => setSelectedWeightClass(e.target.value)}
                className="bg-slate-700 text-white p-2 rounded border border-slate-600 outline-none focus:border-yellow-500"
              >
                {WEIGHT_CLASSES[selectedSport][selectedGender].map(w => <option key={w} value={w}>{w}</option>)}
              </select>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="text-slate-400 border-b border-slate-700">
                  <th className="p-4 font-semibold w-16">Rank</th>
                  <th className="p-4 font-semibold w-16 text-center">Trend</th>
                  <th className="p-4 font-semibold">Fighter</th>
                  <th className="p-4 font-semibold text-right">Rating</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-700">
                {filtered.length > 0 ? filtered.map((row) => {
                  const fighter = fighters.find(f => f.id === row.fighter_id);
                  const gym = gyms.find(g => g.id === fighter?.gym_id);
                  
                  // Check for Belt Ownership
                  const heldBelt = belts.find(b => b.current_champion_id === fighter?.id && b.sport === selectedSport && b.weight_class === selectedWeightClass);

                  // Phase 2: Movement Logic
                  let moveIcon = <Minus className="w-4 h-4 text-slate-500" />;
                  let moveText = "";
                  
                  if (!row.previous_rank) {
                      moveIcon = <div className="text-xs font-bold text-blue-400 uppercase">New</div>;
                  } else {
                      const diff = row.previous_rank - row.rank; 
                      if (diff > 0) {
                          moveIcon = <TrendingUp className="w-4 h-4 text-green-500" />;
                          moveText = `+${diff}`;
                      } else if (diff < 0) {
                          moveIcon = <TrendingDown className="w-4 h-4 text-red-500" />;
                          moveText = `${diff}`;
                      }
                  }

                  return (
                    <tr 
                        key={row.id} 
                        className="hover:bg-slate-700/50 transition-colors cursor-pointer group"
                    >
                      <td className="p-4 font-bold text-white text-lg group-hover:text-yellow-500 transition-colors">#{row.rank}</td>
                      <td className="p-4 text-center">
                          <div className="flex flex-col items-center justify-center">
                              {moveIcon}
                              {moveText && <span className="text-[10px] font-mono text-slate-400">{moveText}</span>}
                          </div>
                      </td>
                      <td className="p-4">
                        <div className="flex items-center gap-3">
                          <div className={`w-10 h-10 rounded-full flex items-center justify-center overflow-hidden border ${heldBelt ? 'border-yellow-500 ring-2 ring-yellow-500/50' : 'border-slate-500 group-hover:border-yellow-500'} bg-slate-600`}>
                             {fighter?.photo_url ? <img src={fighter.photo_url} alt={fighter.fighter_name} className="w-full h-full object-cover"/> : <Users className="w-5 h-5 text-slate-400"/>}
                          </div>
                          <div>
                            <div onClick={() => setViewingFighterId(row.fighter_id)} className="font-bold text-white text-lg hover:underline cursor-pointer flex items-center gap-2">
                                {fighter?.fighter_name}
                                {heldBelt && <Crown className="w-4 h-4 text-yellow-500 fill-yellow-500 animate-pulse" />}
                            </div>
                            <div onClick={(e) => { e.stopPropagation(); if(gym) setViewingGymId(gym.id); }} className="text-xs text-slate-400 hover:text-yellow-500 cursor-pointer">
                                {gym?.name || 'Independent'}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="p-4 text-right font-mono text-yellow-500 font-bold">{row.score.toFixed(0)}</td>
                    </tr>
                  );
                }) : (
                  <tr>
                    <td colSpan={4} className="p-8 text-center text-slate-500">
                      No ranked fighters in this division yet. (Need min 2 fights)
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    );
  };

  // --- PROFILE RENDERERS ---

  const renderFighterProfile = (fId: string) => {
      const f = fighters.find(ft => ft.id === fId);
      if (!f) return null;

      const gym = gyms.find(g => g.id === f.gym_id);
      const heldBelts = belts.filter(b => b.current_champion_id === fId);

      const record = calculateFighterRecord(fId, bouts);
      const history = bouts
        .filter(b => (b.red_fighter_id === fId || b.blue_fighter_id === fId) && b.is_published)
        .sort((a,b) => {
             const dateA = events.find(e => e.id === a.event_id)?.event_date || '';
             const dateB = events.find(e => e.id === b.event_id)?.event_date || '';
             return new Date(dateB).getTime() - new Date(dateA).getTime();
        });

      return (
          <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
              <button onClick={() => setViewingFighterId(null)} className="text-slate-400 hover:text-white flex items-center gap-1 group mb-2">
                  <ChevronRight className="w-4 h-4 rotate-180 group-hover:-translate-x-1 transition-transform"/> Back
              </button>

              {/* Profile Header */}
              <div className="bg-slate-800 rounded-xl p-8 border border-slate-700 flex flex-col md:flex-row gap-8 items-center md:items-start relative overflow-hidden">
                  <div className="w-32 h-32 md:w-48 md:h-48 bg-slate-700 rounded-full flex-shrink-0 border-4 border-slate-600 overflow-hidden shadow-2xl z-10">
                       {f.photo_url ? <img src={f.photo_url} className="w-full h-full object-cover" /> : <Users className="w-full h-full p-8 text-slate-500"/>}
                  </div>
                  
                  {/* Background Accents for Champions */}
                  {heldBelts.length > 0 && (
                      <div className="absolute top-0 right-0 p-32 bg-yellow-500/10 blur-3xl rounded-full translate-x-1/2 -translate-y-1/2"></div>
                  )}

                  <div className="flex-1 text-center md:text-left z-10">
                      <div className="flex flex-col md:flex-row items-center gap-4 mb-2">
                          <h1 className="text-4xl font-black text-white uppercase italic">{f.first_name} <span className="text-yellow-500">{f.last_name}</span></h1>
                          <div className="flex gap-2">
                             {f.fighter_level === 'pro' && <span className="bg-black text-yellow-500 border border-yellow-500 text-xs px-2 py-1 rounded font-bold uppercase tracking-wider">Pro</span>}
                             <span className="bg-slate-700 text-slate-300 text-xs px-2 py-1 rounded font-bold uppercase tracking-wider">{f.weight_class}</span>
                          </div>
                      </div>

                      {heldBelts.length > 0 && (
                          <div className="mb-4 flex flex-wrap gap-2 justify-center md:justify-start">
                              {heldBelts.map(belt => (
                                  <div key={belt.id} className="inline-flex items-center gap-2 bg-yellow-500 text-black px-3 py-1 rounded-full font-bold text-xs shadow-lg shadow-yellow-500/20">
                                      <Crown className="w-3 h-3 fill-black"/> {belt.name} Champion
                                  </div>
                              ))}
                          </div>
                      )}
                      
                      <div className="text-xl text-slate-400 mb-6 flex flex-col md:flex-row items-center gap-2 md:gap-6">
                          <span 
                            className={`flex items-center gap-2 ${gym ? 'cursor-pointer hover:text-white' : ''}`}
                            onClick={() => {
                                if (gym) {
                                    setViewingGymId(gym.id);
                                    setViewingFighterId(null);
                                }
                            }}
                          >
                              <Shield className="w-4 h-4"/> {gym?.name || 'Independent'}
                          </span>
                          {f.hometown && <span className="flex items-center gap-2"><div className="w-1 h-1 bg-slate-500 rounded-full"/> {f.hometown}</span>}
                      </div>

                      <div className="grid grid-cols-3 gap-4 max-w-md mx-auto md:mx-0">
                          <div className="bg-slate-900/50 p-3 rounded border border-slate-700 text-center">
                              <div className="text-2xl font-bold text-white">{record.wins}-{record.losses}-{record.draws}</div>
                              <div className="text-[10px] uppercase text-slate-500 font-bold tracking-widest">Record</div>
                          </div>
                           <div className="bg-slate-900/50 p-3 rounded border border-slate-700 text-center">
                              <div className="text-2xl font-bold text-yellow-500">
                                  {rankings.find(r => r.fighter_id === fId)?.score.toFixed(0) || 'N/A'}
                              </div>
                              <div className="text-[10px] uppercase text-slate-500 font-bold tracking-widest">Rating</div>
                          </div>
                           <div className="bg-slate-900/50 p-3 rounded border border-slate-700 text-center">
                              <div className="text-2xl font-bold text-white">#{rankings.find(r => r.fighter_id === fId)?.rank || '-'}</div>
                              <div className="text-[10px] uppercase text-slate-500 font-bold tracking-widest">Rank</div>
                          </div>
                      </div>
                  </div>
              </div>

              <div className="space-y-4">
                  <h3 className="text-xl font-bold text-white flex items-center gap-2"><Activity className="text-yellow-500"/> Fight History</h3>
                  {history.length > 0 ? history.map((bout) => {
                      const opponentId = bout.red_fighter_id === fId ? bout.blue_fighter_id : bout.red_fighter_id;
                      const opponent = fighters.find(ft => ft.id === opponentId);
                      const evt = events.find(e => e.id === bout.event_id);
                      const isWin = bout.winner_id === fId;
                      const isTitle = bout.is_title_bout;
                      
                      let resultBadge = <span className="bg-red-900 text-red-200 px-2 py-1 rounded text-xs font-bold w-12 text-center inline-block">LOSS</span>;
                      if (isWin) resultBadge = <span className="bg-green-900 text-green-200 px-2 py-1 rounded text-xs font-bold w-12 text-center inline-block">WIN</span>;
                      if (bout.winner_id === 'draw' || (!bout.winner_id && bout.method === 'draw')) resultBadge = <span className="bg-slate-600 text-slate-200 px-2 py-1 rounded text-xs font-bold w-12 text-center inline-block">DRAW</span>;

                      return (
                          <div key={bout.id} className={`bg-slate-800 p-4 rounded-lg border ${isTitle ? 'border-yellow-500/50 shadow-lg shadow-yellow-500/10' : 'border-slate-700'} flex items-center justify-between hover:bg-slate-750 transition-colors`}>
                              <div className="flex items-center gap-6">
                                  {resultBadge}
                                  <div>
                                      <div className="font-bold text-white text-lg flex items-center gap-2">
                                          vs. {opponent?.fighter_name}
                                          {isTitle && <Crown className="w-3 h-3 text-yellow-500"/>}
                                      </div>
                                      <div className="text-xs text-slate-400">{evt?.name} • {evt?.event_date}</div>
                                  </div>
                              </div>
                              <div className="text-right">
                                  <div className="text-sm font-medium text-slate-300 uppercase">{bout.method?.replace('_', ' ')}</div>
                                  <div className="text-xs text-slate-500">
                                      {bout.round ? `R${bout.round}` : ''} {bout.time ? `@ ${bout.time}` : ''}
                                  </div>
                              </div>
                          </div>
                      );
                  }) : (
                      <div className="p-8 text-center text-slate-500 bg-slate-800/50 rounded border border-slate-700 border-dashed">No fight history available.</div>
                  )}
              </div>
          </div>
      );
  };

  const renderGymProfile = (gymId: string) => {
      const gym = gyms.find(g => g.id === gymId);
      if (!gym) return null;

      const roster = fighters.filter(f => f.gym_id === gymId && f.active_status === 'active');
      
      // Calculate Gym Stats
      let totalWins = 0;
      let totalLosses = 0;
      let totalDraws = 0;

      roster.forEach(f => {
          const rec = calculateFighterRecord(f.id, bouts);
          totalWins += rec.wins;
          totalLosses += rec.losses;
          totalDraws += rec.draws;
      });

      return (
          <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
              <button onClick={() => setViewingGymId(null)} className="text-slate-400 hover:text-white flex items-center gap-1 group mb-2">
                  <ChevronRight className="w-4 h-4 rotate-180 group-hover:-translate-x-1 transition-transform"/> Back
              </button>

              <div className="bg-slate-800 rounded-xl overflow-hidden border border-slate-700 shadow-2xl">
                  <div className="bg-slate-700 h-32 relative">
                      <div className="absolute inset-0 bg-black/40"></div>
                      <div className="absolute bottom-0 left-0 p-6 flex items-end gap-6 translate-y-10">
                          <div className="w-24 h-24 bg-slate-900 rounded-xl border-4 border-slate-800 flex items-center justify-center shadow-xl">
                              <Shield className="w-12 h-12 text-slate-500"/>
                          </div>
                          <div className="pb-2">
                              <h1 className="text-3xl font-black text-white italic uppercase">{gym.name}</h1>
                              <div className="flex items-center gap-2 text-slate-300 text-sm">
                                  <MapPin className="w-4 h-4 text-yellow-500"/> {gym.city}, {gym.state}
                              </div>
                          </div>
                      </div>
                  </div>
                  <div className="mt-12 px-6 pb-6">
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
                          <div className="bg-slate-900/50 p-4 rounded border border-slate-700">
                              <div className="text-slate-400 text-xs font-bold uppercase mb-1">Active Roster</div>
                              <div className="text-2xl font-bold text-white flex items-center gap-2"><Users className="w-5 h-5 text-yellow-500"/> {roster.length}</div>
                          </div>
                          <div className="bg-slate-900/50 p-4 rounded border border-slate-700">
                              <div className="text-slate-400 text-xs font-bold uppercase mb-1">Total Wins</div>
                              <div className="text-2xl font-bold text-green-400 flex items-center gap-2"><TrendingUp className="w-5 h-5"/> {totalWins}</div>
                          </div>
                          <div className="bg-slate-900/50 p-4 rounded border border-slate-700">
                              <div className="text-slate-400 text-xs font-bold uppercase mb-1">Win %</div>
                              <div className="text-2xl font-bold text-white font-mono">
                                  {(totalWins + totalLosses) > 0 ? ((totalWins / (totalWins + totalLosses)) * 100).toFixed(0) : 0}%
                              </div>
                          </div>
                      </div>

                      <h3 className="text-white font-bold mb-4 flex items-center gap-2"><Users className="w-4 h-4 text-yellow-500"/> Team Roster</h3>
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                          {roster.map(f => {
                              const rec = calculateFighterRecord(f.id, bouts);
                              return (
                                  <div key={f.id} onClick={() => setViewingFighterId(f.id)} className="bg-slate-700/50 p-3 rounded flex items-center gap-4 hover:bg-slate-700 cursor-pointer border border-transparent hover:border-slate-600 transition-colors">
                                      <div className="w-10 h-10 bg-slate-600 rounded-full overflow-hidden">
                                          {f.photo_url ? <img src={f.photo_url} className="w-full h-full object-cover"/> : <Users className="w-5 h-5 text-slate-400 m-2"/>}
                                      </div>
                                      <div>
                                          <div className="font-bold text-white">{f.fighter_name}</div>
                                          <div className="text-xs text-slate-400">{rec.wins}-{rec.losses}-{rec.draws} • {f.weight_class}</div>
                                      </div>
                                  </div>
                              )
                          })}
                      </div>
                  </div>
              </div>
          </div>
      );
  };

  const renderPromotionProfile = (promoId: string) => {
      const promo = promotions.find(p => p.id === promoId);
      if (!promo) return null;

      const promoEvents = events.filter(e => e.promotion_id === promoId && e.is_published).sort((a,b) => new Date(b.event_date).getTime() - new Date(a.event_date).getTime());
      const promoBelts = belts.filter(b => b.promotion_id === promoId && b.is_active && b.current_champion_id);

      return (
          <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
              <button onClick={() => setViewingPromoId(null)} className="text-slate-400 hover:text-white flex items-center gap-1 group mb-2">
                  <ChevronRight className="w-4 h-4 rotate-180 group-hover:-translate-x-1 transition-transform"/> Back
              </button>

              <div className="bg-slate-800 rounded-xl overflow-hidden border border-slate-700 shadow-2xl">
                  <div className="h-40 bg-gradient-to-r from-slate-900 to-slate-800 flex items-center px-8 relative overflow-hidden">
                      <div className="absolute right-0 top-0 h-full w-1/2 bg-yellow-500/5 skew-x-12"></div>
                      <div>
                          <div className="text-yellow-500 text-sm font-bold uppercase tracking-widest mb-1">{promo.region}</div>
                          <h1 className="text-4xl font-black text-white italic">{promo.name}</h1>
                          <div className="flex items-center gap-4 mt-4 text-slate-400">
                              <span className="flex items-center gap-2"><Calendar className="w-4 h-4"/> {promoEvents.length} Events</span>
                              <span className="flex items-center gap-2"><Crown className="w-4 h-4"/> {promoBelts.length} Champions</span>
                          </div>
                      </div>
                  </div>

                  <div className="p-6">
                      {/* Hall of Champions */}
                      {promoBelts.length > 0 && (
                          <div className="mb-8">
                              <h3 className="text-white font-bold mb-4 flex items-center gap-2"><Crown className="w-4 h-4 text-yellow-500"/> Current Champions</h3>
                              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                  {promoBelts.map(b => {
                                      const champ = fighters.find(f => f.id === b.current_champion_id);
                                      return (
                                          <div key={b.id} onClick={() => champ && setViewingFighterId(champ.id)} className="bg-gradient-to-br from-yellow-900/20 to-slate-800 p-4 rounded border border-yellow-900/30 flex items-center gap-4 cursor-pointer hover:border-yellow-500/50 transition-colors">
                                              <div className="w-12 h-12 rounded-full border-2 border-yellow-500 overflow-hidden bg-black">
                                                  {champ?.photo_url ? <img src={champ.photo_url} className="w-full h-full object-cover"/> : <Users className="w-6 h-6 text-slate-500 m-2"/>}
                                              </div>
                                              <div>
                                                  <div className="text-[10px] text-yellow-500 uppercase font-bold tracking-wider">{b.weight_class}</div>
                                                  <div className="font-bold text-white">{champ?.fighter_name}</div>
                                              </div>
                                          </div>
                                      )
                                  })}
                              </div>
                          </div>
                      )}

                      <h3 className="text-white font-bold mb-4 flex items-center gap-2"><Calendar className="w-4 h-4 text-yellow-500"/> Event History</h3>
                      <div className="space-y-3">
                          {promoEvents.map(e => (
                              <div key={e.id} onClick={() => setPublicEventId(e.id)} className="bg-slate-700/30 p-4 rounded flex items-center justify-between hover:bg-slate-700/50 cursor-pointer border border-slate-700 transition-colors">
                                  <div>
                                      <div className="font-bold text-white text-lg">{e.name}</div>
                                      <div className="text-xs text-slate-400">{e.event_date} • {e.venue}, {e.city}</div>
                                  </div>
                                  <ChevronRight className="text-slate-500"/>
                              </div>
                          ))}
                      </div>
                  </div>
              </div>
          </div>
      );
  };

  const renderEvents = () => {
    // Check for drill-down views
    if (viewingPromoId) return renderPromotionProfile(viewingPromoId);
    
    // --- Detail View Logic ---
    if (publicEventId) {
        const evt = events.find(e => e.id === publicEventId);
        if (!evt) return null;
        const evtBouts = bouts.filter(b => b.event_id === evt.id).sort((a,b) => a.bout_order - b.bout_order);

        return (
            <div className="space-y-6">
                <div className="flex items-center gap-4 mb-4">
                    <button onClick={() => setPublicEventId(null)} className="text-slate-400 hover:text-white flex items-center gap-1 group">
                        <ChevronRight className="w-4 h-4 rotate-180 group-hover:-translate-x-1 transition-transform"/> Back to Events
                    </button>
                </div>
                
                {/* Event Header */}
                <div className="bg-slate-800 rounded-xl overflow-hidden border border-slate-700 shadow-2xl relative">
                     <div className="h-48 bg-slate-700 relative">
                        <img src={`https://placehold.co/1200x400/1e293b/fbbf24?text=${evt.name.toUpperCase()}`} className="w-full h-full object-cover opacity-50" alt="Banner"/>
                        <div className="absolute bottom-0 left-0 p-6 bg-gradient-to-t from-slate-900 via-slate-900/80 to-transparent w-full">
                            <div onClick={() => setViewingPromoId(evt.promotion_id)} className="text-yellow-500 font-bold uppercase tracking-widest text-sm mb-1 cursor-pointer hover:underline">{promotions.find(p => p.id === evt.promotion_id)?.name}</div>
                            <h1 className="text-4xl font-black text-white">{evt.name}</h1>
                            <div className="flex gap-4 text-slate-300 mt-2">
                                <span className="flex items-center gap-2"><Calendar className="w-4 h-4"/> {evt.event_date}</span>
                                <span className="flex items-center gap-2"><Dumbbell className="w-4 h-4"/> {evt.venue}, {evt.city}</span>
                            </div>
                        </div>
                     </div>
                </div>

                {/* Bouts List */}
                <div className="space-y-4">
                    <h3 className="text-xl font-bold text-white flex items-center gap-2"><Swords className="text-yellow-500"/> Fight Card</h3>
                    {evtBouts.map((bout, idx) => {
                        const red = fighters.find(f => f.id === bout.red_fighter_id);
                        const blue = fighters.find(f => f.id === bout.blue_fighter_id);
                        const isRedWin = bout.winner_id === red?.id;
                        const isBlueWin = bout.winner_id === blue?.id;
                        
                        return (
                            <div key={bout.id} className="bg-slate-800 rounded-lg border border-slate-700 overflow-hidden flex flex-col md:flex-row">
                                <div className="p-4 bg-slate-900/50 flex flex-col justify-center items-center md:w-24 border-r border-slate-700">
                                    <span className="text-slate-500 font-bold text-lg">#{idx + 1}</span>
                                    <span className="text-xs text-slate-400 text-center mt-1 leading-tight">{bout.weight_class}</span>
                                </div>
                                <div className="flex-1 p-4 flex items-center justify-between relative">
                                    {/* Red Corner */}
                                    <div className={`flex-1 flex flex-col items-start ${isRedWin ? 'opacity-100' : 'opacity-70'}`}>
                                        <span className="text-xs font-bold text-red-500 uppercase mb-1">Red Corner</span>
                                        <span className="text-xl font-bold text-white">{red?.fighter_name}</span>
                                        {isRedWin && <span className="text-xs bg-yellow-500 text-black px-2 py-0.5 rounded font-bold mt-1">WINNER</span>}
                                    </div>

                                    {/* VS / Result */}
                                    <div className="px-8 flex flex-col items-center">
                                        <span className="text-slate-600 font-black italic text-2xl">VS</span>
                                        {bout.method && (
                                            <div className="text-xs text-slate-400 mt-1 uppercase tracking-wide border border-slate-600 px-2 rounded">
                                                {bout.method.replace('_', ' ')}
                                            </div>
                                        )}
                                        {bout.is_title_bout && <Crown className="w-5 h-5 text-yellow-500 mt-2"/>}
                                    </div>

                                    {/* Blue Corner */}
                                    <div className={`flex-1 flex flex-col items-end ${isBlueWin ? 'opacity-100' : 'opacity-70'}`}>
                                        <span className="text-xs font-bold text-blue-500 uppercase mb-1">Blue Corner</span>
                                        <span className="text-xl font-bold text-white text-right">{blue?.fighter_name}</span>
                                        {isBlueWin && <span className="text-xs bg-yellow-500 text-black px-2 py-0.5 rounded font-bold mt-1">WINNER</span>}
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>
        );
    }

    // --- List View Logic ---
    return (
      <div className="space-y-6">
        <h2 className="text-2xl font-bold text-white flex items-center gap-2">
          <Calendar className="text-yellow-500" />
          Upcoming Events
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {events.filter(e => e.is_published).map(evt => (
            <div key={evt.id} className="bg-slate-800 rounded-xl overflow-hidden border border-slate-700 shadow-lg hover:border-yellow-500 transition-colors group">
              <div className="h-32 bg-slate-700 flex items-center justify-center">
                 <img src={`https://placehold.co/600x400/1e293b/fbbf24?text=${evt.slug.toUpperCase()}`} alt="Poster" className="w-full h-full object-cover opacity-80 group-hover:opacity-100 transition-opacity"/>
              </div>
              <div className="p-5">
                <div 
                    onClick={() => setViewingPromoId(evt.promotion_id)}
                    className="text-xs font-bold text-yellow-500 mb-2 uppercase tracking-wide cursor-pointer hover:underline"
                >
                  {promotions.find(p => p.id === evt.promotion_id)?.name}
                </div>
                <h3 className="text-xl font-bold text-white mb-2">{evt.name}</h3>
                <div className="text-slate-400 text-sm flex items-center gap-2 mb-1">
                  <Calendar className="w-4 h-4"/> {evt.event_date}
                </div>
                <div className="text-slate-400 text-sm flex items-center gap-2">
                  <Dumbbell className="w-4 h-4"/> {evt.venue}, {evt.city}
                </div>
              </div>
              <div className="px-5 pb-5 pt-0">
                  <button 
                    onClick={() => setPublicEventId(evt.id)}
                    className="w-full bg-slate-700 hover:bg-slate-600 text-white py-2 rounded font-medium transition-colors"
                  >
                      View Fight Card
                  </button>
              </div>
            </div>
          ))}
          {events.filter(e => e.is_published).length === 0 && (
              <div className="col-span-full text-center p-12 bg-slate-800 rounded-xl border border-slate-700 border-dashed">
                  <p className="text-slate-400">No upcoming events scheduled.</p>
              </div>
          )}
        </div>
      </div>
    );
  };

  const SearchResults = () => {
      const results = {
          fighters: fighters.filter(f => f.fighter_name.toLowerCase().includes(searchQuery.toLowerCase())),
          events: events.filter(e => e.name.toLowerCase().includes(searchQuery.toLowerCase())),
          gyms: gyms.filter(g => g.name.toLowerCase().includes(searchQuery.toLowerCase()))
      };

      if (!searchQuery) return null;

      return (
          <div className="space-y-6">
              <h2 className="text-2xl font-bold text-white flex items-center gap-2"><Search className="text-yellow-500"/> Search Results: "{searchQuery}"</h2>
              
              {results.fighters.length > 0 && (
                  <div className="space-y-2">
                      <h3 className="text-slate-400 uppercase font-bold text-sm">Fighters</h3>
                      {results.fighters.map(f => (
                          <div key={f.id} onClick={() => { setViewingFighterId(f.id); setSearchQuery(''); }} className="bg-slate-800 p-4 rounded flex items-center justify-between cursor-pointer hover:bg-slate-700">
                              <div className="font-bold text-white">{f.fighter_name}</div>
                              <div className="text-xs text-slate-400">{f.weight_class}</div>
                          </div>
                      ))}
                  </div>
              )}

              {results.events.length > 0 && (
                  <div className="space-y-2">
                      <h3 className="text-slate-400 uppercase font-bold text-sm">Events</h3>
                      {results.events.map(e => (
                          <div key={e.id} onClick={() => { setPublicEventId(e.id); setSearchQuery(''); }} className="bg-slate-800 p-4 rounded flex items-center justify-between cursor-pointer hover:bg-slate-700">
                              <div className="font-bold text-white">{e.name}</div>
                              <div className="text-xs text-slate-400">{e.event_date}</div>
                          </div>
                      ))}
                  </div>
              )}

              {results.gyms.length > 0 && (
                  <div className="space-y-2">
                      <h3 className="text-slate-400 uppercase font-bold text-sm">Gyms</h3>
                      {results.gyms.map(g => (
                          <div key={g.id} onClick={() => { setViewingGymId(g.id); setSearchQuery(''); }} className="bg-slate-800 p-4 rounded flex items-center justify-between cursor-pointer hover:bg-slate-700">
                              <div className="font-bold text-white">{g.name}</div>
                              <div className="text-xs text-slate-400">{g.city}</div>
                          </div>
                      ))}
                  </div>
              )}

              {results.fighters.length === 0 && results.events.length === 0 && results.gyms.length === 0 && (
                  <div className="p-8 text-center text-slate-500">No results found.</div>
              )}
          </div>
      );
  }

  // --- ADMIN COMPONENTS ---

  const AdminDashboard = () => (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
       {/* Stats */}
       <div className="bg-slate-800 p-6 rounded-xl border border-slate-700">
           <h3 className="text-slate-400 text-sm font-semibold uppercase mb-4">Database Stats</h3>
           <div className="space-y-4">
               <div className="flex justify-between items-center">
                   <span className="text-white">Fighters</span>
                   <span className="bg-slate-700 text-yellow-500 px-2 py-1 rounded text-sm font-mono">{fighters.length}</span>
               </div>
               <div className="flex justify-between items-center">
                   <span className="text-white">Promotions</span>
                   <span className="bg-slate-700 text-yellow-500 px-2 py-1 rounded text-sm font-mono">{promotions.length}</span>
               </div>
               <div className="flex justify-between items-center">
                   <span className="text-white">Events</span>
                   <span className="bg-slate-700 text-yellow-500 px-2 py-1 rounded text-sm font-mono">{events.length}</span>
               </div>
               <div className="flex justify-between items-center">
                   <span className="text-white">Recorded Bouts</span>
                   <span className="bg-slate-700 text-yellow-500 px-2 py-1 rounded text-sm font-mono">{bouts.length}</span>
               </div>
           </div>
       </div>

       {/* Actions */}
       <div className="bg-slate-800 p-6 rounded-xl border border-slate-700">
           <h3 className="text-slate-400 text-sm font-semibold uppercase mb-4">Quick Actions</h3>
           <div className="space-y-3">
               <button onClick={() => setActiveTab('admin_fighters')} className="w-full flex items-center gap-3 p-3 bg-slate-700 hover:bg-slate-600 rounded text-white transition-colors text-left">
                   <Users className="w-5 h-5 text-yellow-500"/>
                   <div>
                       <div className="font-bold">Add Fighter</div>
                       <div className="text-xs text-slate-400">Register new talent</div>
                   </div>
               </button>
               <button onClick={() => setActiveTab('admin_events')} className="w-full flex items-center gap-3 p-3 bg-slate-700 hover:bg-slate-600 rounded text-white transition-colors text-left">
                   <Calendar className="w-5 h-5 text-yellow-500"/>
                   <div>
                       <div className="font-bold">Create Event</div>
                       <div className="text-xs text-slate-400">Schedule a new fight card</div>
                   </div>
               </button>
               <button onClick={() => setActiveTab('admin_belts')} className="w-full flex items-center gap-3 p-3 bg-slate-700 hover:bg-slate-600 rounded text-white transition-colors text-left">
                   <Crown className="w-5 h-5 text-yellow-500"/>
                   <div>
                       <div className="font-bold">Belt Manager</div>
                       <div className="text-xs text-slate-400">Create & Assign Titles</div>
                   </div>
               </button>
           </div>
       </div>

       {/* System */}
       <div className="bg-slate-800 p-6 rounded-xl border border-slate-700">
           <h3 className="text-slate-400 text-sm font-semibold uppercase mb-4">System Actions</h3>
           <div className="space-y-3">
               <button onClick={recomputeRankings} className="w-full flex items-center gap-3 p-3 bg-blue-600 hover:bg-blue-500 rounded text-white transition-colors text-left">
                   <RefreshCw className="w-5 h-5 text-white"/>
                   <div>
                       <div className="font-bold">Recompute Rankings</div>
                       <div className="text-xs text-blue-200">Execute Elo Engine</div>
                   </div>
               </button>
               <button onClick={seedData} className="w-full flex items-center gap-3 p-3 bg-red-900/50 hover:bg-red-900 rounded text-white transition-colors text-left border border-red-800">
                   <Activity className="w-5 h-5 text-red-500"/>
                   <div>
                       <div className="font-bold">Seed Initial Data</div>
                       <div className="text-xs text-red-300">Resets/Adds demo content</div>
                   </div>
               </button>
           </div>
       </div>
    </div>
  );

  const AdminFighterManager = () => {
    const [form, setForm] = useState<Partial<Fighter>>({ sport: 'mma', gender: 'men', weight_class: WEIGHT_CLASSES['mma']['men'][0] });
    return (
        <div className="bg-slate-800 rounded-xl border border-slate-700 p-6">
             <div className="flex justify-between items-center mb-6">
                <h2 className="text-xl font-bold text-white">Fighter Registry</h2>
                <button onClick={() => setForm({})} className="text-sm text-yellow-500 hover:underline">Reset Form</button>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
                <div className="space-y-4">
                    <input className="w-full bg-slate-700 border border-slate-600 text-white rounded p-2" placeholder="First Name" value={form.first_name || ''} onChange={e => setForm({...form, first_name: e.target.value})} />
                    <input className="w-full bg-slate-700 border border-slate-600 text-white rounded p-2" placeholder="Last Name" value={form.last_name || ''} onChange={e => setForm({...form, last_name: e.target.value})} />
                    <select className="w-full bg-slate-700 border border-slate-600 text-white rounded p-2" value={form.gym_id || ''} onChange={e => setForm({...form, gym_id: e.target.value})}>
                        <option value="">Select Gym (Optional)</option>
                        {gyms.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}
                    </select>
                </div>
                <div className="space-y-4">
                     <div className="grid grid-cols-2 gap-4">
                        <select className="bg-slate-700 border border-slate-600 text-white rounded p-2" value={form.sport} onChange={e => {
                            const s = e.target.value as Sport;
                            setForm({...form, sport: s, weight_class: WEIGHT_CLASSES[s][form.gender || 'men'][0]});
                        }}>
                             {Object.entries(SPORTS_LABELS).map(([k,v]) => <option key={k} value={k}>{v}</option>)}
                        </select>
                        <select className="bg-slate-700 border border-slate-600 text-white rounded p-2" value={form.gender} onChange={e => {
                            const g = e.target.value as Gender;
                            setForm({...form, gender: g, weight_class: WEIGHT_CLASSES[form.sport || 'mma'][g][0]});
                        }}>
                            <option value="men">Men</option>
                            <option value="women">Women</option>
                        </select>
                     </div>
                     <select className="w-full bg-slate-700 border border-slate-600 text-white rounded p-2" value={form.weight_class} onChange={e => setForm({...form, weight_class: e.target.value})}>
                        {WEIGHT_CLASSES[form.sport || 'mma'][form.gender || 'men'].map(w => <option key={w} value={w}>{w}</option>)}
                     </select>
                     <select className="w-full bg-slate-700 border border-slate-600 text-white rounded p-2" value={form.fighter_level || 'am'} onChange={e => setForm({...form, fighter_level: e.target.value as FighterLevel})}>
                        <option value="am">Amateur (Start 1450)</option>
                        <option value="pro">Professional (Start 1500)</option>
                     </select>
                </div>
            </div>
            <button onClick={() => { handleCreateFighter(form); setForm({ sport: 'mma', gender: 'men' }); }} className="bg-yellow-500 hover:bg-yellow-400 text-black font-bold py-2 px-6 rounded flex items-center gap-2">
                <Plus className="w-4 h-4"/> Register Fighter
            </button>

            <div className="mt-8 pt-8 border-t border-slate-700">
                <h3 className="text-white font-bold mb-4">Recent Registrations</h3>
                <div className="space-y-2">
                    {fighters.slice(-5).reverse().map(f => (
                        <div key={f.id} className="flex justify-between items-center bg-slate-700/50 p-3 rounded group">
                            <div>
                                <span className="text-white font-medium">{f.fighter_name}</span>
                                <span className="text-xs text-slate-400 block">{f.sport.toUpperCase()} • {f.weight_class}</span>
                            </div>
                            <button onClick={() => handleDeleteFighter(f.id)} className="text-slate-500 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity">
                                <Trash2 className="w-4 h-4"/>
                            </button>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
  };

  const AdminBeltManager = () => {
    const [form, setForm] = useState<Partial<Belt>>({ sport: 'mma', gender: 'men', weight_class: WEIGHT_CLASSES['mma']['men'][0] });
    return (
        <div className="bg-slate-800 rounded-xl border border-slate-700 p-6">
             <div className="flex justify-between items-center mb-6">
                <h2 className="text-xl font-bold text-white">Championship Titles</h2>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
                <div className="space-y-4">
                     <select className="w-full bg-slate-700 border border-slate-600 text-white rounded p-2" value={form.promotion_id || ''} onChange={e => setForm({...form, promotion_id: e.target.value})}>
                        <option value="">Select Promotion</option>
                        {promotions.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                    </select>
                    <input className="w-full bg-slate-700 border border-slate-600 text-white rounded p-2" placeholder="Belt Name (e.g. World Lightweight Title)" value={form.name || ''} onChange={e => setForm({...form, name: e.target.value})} />
                </div>
                <div className="space-y-4">
                     <div className="grid grid-cols-2 gap-4">
                        <select className="bg-slate-700 border border-slate-600 text-white rounded p-2" value={form.sport} onChange={e => {
                            const s = e.target.value as Sport;
                            setForm({...form, sport: s, weight_class: WEIGHT_CLASSES[s][form.gender || 'men'][0]});
                        }}>
                             {Object.entries(SPORTS_LABELS).map(([k,v]) => <option key={k} value={k}>{v}</option>)}
                        </select>
                        <select className="bg-slate-700 border border-slate-600 text-white rounded p-2" value={form.gender} onChange={e => {
                            const g = e.target.value as Gender;
                            setForm({...form, gender: g, weight_class: WEIGHT_CLASSES[form.sport || 'mma'][g][0]});
                        }}>
                            <option value="men">Men</option>
                            <option value="women">Women</option>
                        </select>
                     </div>
                     <select className="w-full bg-slate-700 border border-slate-600 text-white rounded p-2" value={form.weight_class} onChange={e => setForm({...form, weight_class: e.target.value})}>
                        {WEIGHT_CLASSES[form.sport || 'mma'][form.gender || 'men'].map(w => <option key={w} value={w}>{w}</option>)}
                     </select>
                </div>
            </div>
            <button onClick={() => { handleCreateBelt(form); setForm({ sport: 'mma', gender: 'men' }); }} className="bg-yellow-500 hover:bg-yellow-400 text-black font-bold py-2 px-6 rounded flex items-center gap-2">
                <Plus className="w-4 h-4"/> Create Belt
            </button>

            <div className="mt-8 pt-8 border-t border-slate-700">
                <h3 className="text-white font-bold mb-4">Active Titles</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {belts.map(b => (
                        <div key={b.id} className="flex justify-between items-center bg-slate-700/50 p-4 rounded border border-slate-600 group">
                            <div>
                                <div className="text-yellow-500 font-bold flex items-center gap-2"><Crown className="w-4 h-4"/> {b.name}</div>
                                <div className="text-xs text-slate-400">{b.sport.toUpperCase()} • {b.weight_class}</div>
                            </div>
                            <div className="flex items-center gap-4">
                                {b.current_champion_id ? (
                                    <div className="text-right">
                                        <div className="text-xs text-slate-400 uppercase">Champion</div>
                                        <div className="text-white font-bold">{fighters.find(f => f.id === b.current_champion_id)?.fighter_name}</div>
                                    </div>
                                ) : (
                                    <span className="text-xs bg-slate-800 text-slate-400 px-2 py-1 rounded">VACANT</span>
                                )}
                                <button onClick={() => handleDeleteBelt(b.id)} className="text-slate-500 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity">
                                    <Trash2 className="w-4 h-4"/>
                                </button>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
  };

  const AdminEventManager = () => {
      const [newEvent, setNewEvent] = useState<Partial<Event>>({ state: 'LA' });
      const [viewingEvent, setViewingEvent] = useState<string | null>(null);

      if (viewingEvent) {
          const evt = events.find(e => e.id === viewingEvent);
          if (!evt) return null;
          const evtBouts = bouts.filter(b => b.event_id === evt.id).sort((a,b) => a.bout_order - b.bout_order);

          return (
              <div className="space-y-6">
                  <div className="flex items-center gap-4 mb-4">
                      <button onClick={() => setViewingEvent(null)} className="text-slate-400 hover:text-white flex items-center gap-1">
                          <ChevronRight className="w-4 h-4 rotate-180"/> Back
                      </button>
                      <h2 className="text-2xl font-bold text-white">{evt.name} Fight Card</h2>
                      {evt.is_published ? (
                          <div className="flex items-center gap-2">
                              <span className="bg-green-500/20 text-green-400 px-2 py-1 rounded text-xs border border-green-500/30">PUBLISHED</span>
                              <button onClick={() => handleUnpublishEvent(evt)} className="text-slate-400 hover:text-yellow-500 transition-colors" title="Unpublish Event">
                                  <EyeOff className="w-4 h-4"/>
                              </button>
                          </div>
                      ) : (
                          <button onClick={() => handlePublishEvent(evt)} className="bg-green-600 hover:bg-green-500 text-white px-3 py-1 rounded text-sm flex items-center gap-2">
                              <Check className="w-3 h-3"/> Publish Event
                          </button>
                      )}
                  </div>

                  {/* Bout Entry - Only visible if unpublished */}
                  {!evt.is_published && (
                      <div className="bg-slate-800 p-6 rounded-xl border border-slate-700">
                          <h3 className="text-white font-bold mb-4">Add Bout</h3>
                          <BoutEntryForm event={evt} onAdd={handleAddBout} fighters={fighters} existingBouts={evtBouts} />
                      </div>
                  )}

                  {/* Bout List */}
                  <div className="space-y-3">
                      {evtBouts.map((bout, idx) => {
                          const red = fighters.find(f => f.id === bout.red_fighter_id);
                          const blue = fighters.find(f => f.id === bout.blue_fighter_id);
                          return (
                              <div key={bout.id} className="bg-slate-800 p-4 rounded-xl border border-slate-700 flex items-center justify-between group">
                                  <div className="flex items-center gap-4">
                                      <span className="text-slate-500 font-mono font-bold text-lg">#{idx + 1}</span>
                                      <div className="flex flex-col">
                                          <span className="text-xs text-slate-400">{bout.weight_class}</span>
                                          <div className="flex items-center gap-2 text-white font-bold">
                                              <span className="text-red-400">{red?.fighter_name}</span>
                                              <span className="text-slate-600 text-xs">VS</span>
                                              <span className="text-blue-400">{blue?.fighter_name}</span>
                                          </div>
                                      </div>
                                  </div>
                                  <div className="flex items-center gap-4">
                                      <div className="text-right flex flex-col items-end">
                                          <div className="text-white text-sm font-medium">{bout.method ? bout.method.toUpperCase().replace('_', '/') : 'PENDING'}</div>
                                          {bout.winner_id && <div className="text-xs text-yellow-500">Winner: {bout.winner_id === red?.id ? red?.fighter_name : blue?.fighter_name}</div>}
                                          {bout.is_title_bout && <span className="text-[10px] flex items-center gap-1 text-yellow-500 mt-1"><Crown className="w-3 h-3"/> Title Fight</span>}
                                      </div>
                                      {!evt.is_published && (
                                          <button onClick={() => handleDeleteBout(bout.id)} className="text-slate-500 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity">
                                              <Trash2 className="w-4 h-4"/>
                                          </button>
                                      )}
                                  </div>
                              </div>
                          )
                      })}
                  </div>
              </div>
          )
      }

      return (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              <div className="space-y-6">
                <div className="bg-slate-800 p-6 rounded-xl border border-slate-700">
                    <h3 className="text-white font-bold mb-4">Create New Event</h3>
                    <div className="space-y-4">
                        <select className="w-full bg-slate-700 border border-slate-600 text-white rounded p-2" value={newEvent.promotion_id || ''} onChange={e => setNewEvent({...newEvent, promotion_id: e.target.value})}>
                            <option value="">Select Promotion</option>
                            {promotions.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                        </select>
                        <input className="w-full bg-slate-700 border border-slate-600 text-white rounded p-2" placeholder="Event Name (e.g. BFN 34)" value={newEvent.name || ''} onChange={e => setNewEvent({...newEvent, name: e.target.value})} />
                        <input type="date" className="w-full bg-slate-700 border border-slate-600 text-white rounded p-2" value={newEvent.event_date || ''} onChange={e => setNewEvent({...newEvent, event_date: e.target.value})} />
                        <input className="w-full bg-slate-700 border border-slate-600 text-white rounded p-2" placeholder="Venue" value={newEvent.venue || ''} onChange={e => setNewEvent({...newEvent, venue: e.target.value})} />
                        <div className="grid grid-cols-2 gap-4">
                            <input className="bg-slate-700 border border-slate-600 text-white rounded p-2" placeholder="City" value={newEvent.city || ''} onChange={e => setNewEvent({...newEvent, city: e.target.value})} />
                            <input className="bg-slate-700 border border-slate-600 text-white rounded p-2" placeholder="State" value={newEvent.state || ''} onChange={e => setNewEvent({...newEvent, state: e.target.value})} />
                        </div>
                        <button onClick={() => handleCreateEvent(newEvent)} className="w-full bg-yellow-500 hover:bg-yellow-400 text-black font-bold py-2 rounded">Create Event Draft</button>
                    </div>
                </div>
              </div>

              <div className="space-y-4">
                  <h3 className="text-white font-bold">Draft Events</h3>
                  {events.filter(e => !e.is_published).map(e => (
                      <div key={e.id} className="bg-slate-800 p-4 rounded-xl border border-slate-700 hover:border-yellow-500 cursor-pointer transition-colors flex justify-between items-center group">
                          <div onClick={() => setViewingEvent(e.id)} className="flex-1">
                              <div className="font-bold text-white">{e.name}</div>
                              <div className="text-xs text-slate-400">{e.event_date} • {e.venue}</div>
                          </div>
                          <div className="flex items-center gap-2">
                              <button onClick={(ev) => { ev.stopPropagation(); handleDeleteEvent(e.id); }} className="text-slate-500 hover:text-red-500 p-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                  <Trash2 className="w-4 h-4"/>
                              </button>
                              <ChevronRight className="text-slate-600"/>
                          </div>
                      </div>
                  ))}
                  
                  <h3 className="text-white font-bold pt-6">Published Events</h3>
                  {events.filter(e => e.is_published).map(e => (
                      <div key={e.id} className="bg-slate-800 p-4 rounded-xl border border-slate-700 hover:border-yellow-500 cursor-pointer transition-colors opacity-75">
                          <div onClick={() => setViewingEvent(e.id)} className="flex justify-between items-center flex-1">
                            <div>
                                <div className="font-bold text-white">{e.name}</div>
                                <div className="text-xs text-slate-400">{e.event_date}</div>
                            </div>
                            <span className="text-xs bg-green-900 text-green-300 px-2 py-1 rounded mr-4">Live</span>
                          </div>
                          <button onClick={(ev) => { ev.stopPropagation(); handleDeleteEvent(e.id); }} className="text-slate-500 hover:text-red-500 p-2 opacity-0 group-hover:opacity-100 transition-opacity">
                              <Trash2 className="w-4 h-4"/>
                          </button>
                      </div>
                  ))}
              </div>
          </div>
      );
  };

  const BoutEntryForm = ({ event, onAdd, fighters, existingBouts }: { event: Event, onAdd: (b: Partial<Bout>) => void, fighters: Fighter[], existingBouts: Bout[] }) => {
      const [bout, setBout] = useState<Partial<Bout>>({ 
          sport: 'mma', gender: 'men', weight_class: WEIGHT_CLASSES['mma']['men'][0],
          event_id: event.id
      });

      // 1. Get IDs of fighters already booked on this card
      const bookedFighterIds = new Set(existingBouts.flatMap(b => [b.red_fighter_id, b.blue_fighter_id]));

      // 2. Filter base list: Match criteria AND not already booked
      const availableFighters = fighters.filter(f => 
          f.sport === bout.sport && 
          f.gender === bout.gender &&
          !bookedFighterIds.has(f.id)
      );
      
      // 3. Filter specific dropdowns to prevent self-match
      const availableRedFighters = availableFighters.filter(f => f.id !== bout.blue_fighter_id);
      const availableBlueFighters = availableFighters.filter(f => f.id !== bout.red_fighter_id);
      
      // Filter available belts
      const availableBelts = belts.filter(b => b.promotion_id === event.promotion_id && b.sport === bout.sport && b.gender === bout.gender && b.weight_class === bout.weight_class);

      return (
          <div className="space-y-4">
              <div className="grid grid-cols-3 gap-4">
                   <select className="bg-slate-700 border border-slate-600 text-white rounded p-2" value={bout.sport} onChange={e => setBout({...bout, sport: e.target.value as Sport})}>
                       {Object.entries(SPORTS_LABELS).map(([k,v]) => <option key={k} value={k}>{v}</option>)}
                   </select>
                   <select className="bg-slate-700 border border-slate-600 text-white rounded p-2" value={bout.gender} onChange={e => setBout({...bout, gender: e.target.value as Gender})}>
                       <option value="men">Men</option>
                       <option value="women">Women</option>
                   </select>
                   <select className="bg-slate-700 border border-slate-600 text-white rounded p-2" value={bout.weight_class} onChange={e => setBout({...bout, weight_class: e.target.value})}>
                        {WEIGHT_CLASSES[bout.sport || 'mma'][bout.gender || 'men'].map(w => <option key={w} value={w}>{w}</option>)}
                   </select>
              </div>

              {/* Title Fight Toggle */}
              <div className="flex items-center gap-2 p-2 bg-slate-700/50 rounded border border-slate-600">
                  <input type="checkbox" id="is_title" checked={bout.is_title_bout || false} onChange={e => setBout({...bout, is_title_bout: e.target.checked})} className="w-5 h-5 text-yellow-500 rounded focus:ring-yellow-500 bg-slate-800 border-slate-600"/>
                  <label htmlFor="is_title" className="text-white font-bold flex items-center gap-2"><Crown className="w-4 h-4 text-yellow-500"/> Title Fight?</label>
                  
                  {bout.is_title_bout && (
                      <select className="ml-auto bg-slate-800 border border-slate-600 text-white rounded p-1 text-sm max-w-[200px]" value={bout.belt_id || ''} onChange={e => setBout({...bout, belt_id: e.target.value})}>
                          <option value="">Select Belt...</option>
                          {availableBelts.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
                      </select>
                  )}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-center">
                  <div className="bg-red-900/20 p-4 rounded border border-red-900/50">
                      <label className="text-red-400 text-xs font-bold uppercase mb-1 block">Red Corner</label>
                      <select className="w-full bg-slate-700 border border-slate-600 text-white rounded p-2" value={bout.red_fighter_id || ''} onChange={e => setBout({...bout, red_fighter_id: e.target.value})}>
                          <option value="">Select Fighter</option>
                          {availableRedFighters.map(f => <option key={f.id} value={f.id}>{f.fighter_name}</option>)}
                      </select>
                  </div>
                  <div className="bg-blue-900/20 p-4 rounded border border-blue-900/50">
                      <label className="text-blue-400 text-xs font-bold uppercase mb-1 block">Blue Corner</label>
                      <select className="w-full bg-slate-700 border border-slate-600 text-white rounded p-2" value={bout.blue_fighter_id || ''} onChange={e => setBout({...bout, blue_fighter_id: e.target.value})}>
                          <option value="">Select Fighter</option>
                          {availableBlueFighters.map(f => <option key={f.id} value={f.id}>{f.fighter_name}</option>)}
                      </select>
                  </div>
              </div>
              
              <div className="p-4 bg-slate-700/30 rounded border border-slate-700">
                  <label className="text-slate-400 text-xs font-bold uppercase mb-2 block">Outcome (Optional - can be added later)</label>
                  <div className="grid grid-cols-2 gap-4">
                      <select className="w-full bg-slate-700 border border-slate-600 text-white rounded p-2" value={bout.winner_id || ''} onChange={e => setBout({...bout, winner_id: e.target.value})}>
                          <option value="">No Result Yet</option>
                          {bout.red_fighter_id && <option value={bout.red_fighter_id}>Red Win</option>}
                          {bout.blue_fighter_id && <option value={bout.blue_fighter_id}>Blue Win</option>}
                          <option value="draw">Draw</option>
                      </select>
                      <select className="w-full bg-slate-700 border border-slate-600 text-white rounded p-2" value={bout.method || ''} onChange={e => setBout({...bout, method: e.target.value as BoutMethod})}>
                          <option value="">Method</option>
                          <option value="ko_tko">KO/TKO</option>
                          <option value="submission">Submission</option>
                          <option value="ud">Unanimous Decision</option>
                          <option value="md_td">Majority/Tech Decision</option>
                          <option value="sd">Split Decision</option>
                      </select>
                  </div>
              </div>

              <button onClick={() => onAdd(bout)} className="w-full bg-slate-600 hover:bg-slate-500 text-white font-bold py-2 rounded">
                  Add Bout to Card
              </button>
          </div>
      )
  };


  // --- Layout ---

  return (
    <div className="min-h-screen bg-slate-900 text-slate-200 font-sans selection:bg-yellow-500/30 relative">
      {/* Global Modal & Notification */}
      {modalConfig && <ConfirmModal isOpen={modalConfig.isOpen} message={modalConfig.message} onConfirm={modalConfig.onConfirm} onCancel={() => setModalConfig(null)} />}
      {notification && <NotificationToast message={notification.message} type={notification.type} onClose={() => setNotification(null)} />}

      {/* Navigation */}
      <nav className="bg-slate-900 border-b border-slate-800 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4">
          <div className="flex justify-between h-20">
            <div className="flex items-center gap-6 flex-1">
               {/* Logo & Branding */}
              <div className="flex items-center gap-3 cursor-pointer" onClick={() => { setSearchQuery(''); setActiveTab('rankings'); setPublicEventId(null); setViewingFighterId(null); }}>
                 <div className="w-12 h-12 bg-black rounded-full border border-slate-700 overflow-hidden flex items-center justify-center">
                    {/* Updated Logo URL */}
                    <img src="https://drive.google.com/uc?export=view&id=1ucjGjhPycGWUhkgNUujXeExL0ZlgBAmO" alt="BFN Logo" className="w-full h-full object-cover" onError={(e) => {
                        // Fallback if image not found
                        e.currentTarget.style.display='none';
                        e.currentTarget.parentElement?.classList.add('bg-yellow-500');
                    }}/>
                    <Shield className="w-6 h-6 text-black hidden" fill="currentColor" /> 
                 </div>
                 <div className="flex flex-col">
                    <span className="text-2xl font-black tracking-tighter text-white italic leading-none hidden md:block">BAYOU FIGHT NIGHT</span>
                    <span className="text-[10px] text-yellow-500 uppercase tracking-widest font-bold hidden md:block">Built on the Bayou. Proven in the Cage.</span>
                 </div>
              </div>
              
              {!isAdminMode && (
                <div className="hidden md:flex gap-1 ml-8">
                  <button 
                    onClick={() => {
                        setActiveTab('rankings');
                        setViewingFighterId(null);
                        setViewingGymId(null);
                        setSearchQuery('');
                    }} 
                    className={`px-4 py-2 rounded-full text-sm font-medium transition-colors ${activeTab === 'rankings' && !searchQuery ? 'bg-slate-800 text-white' : 'text-slate-400 hover:text-white'}`}
                  >
                    Rankings
                  </button>
                  <button 
                    onClick={() => {
                        setActiveTab('events');
                        setPublicEventId(null);
                        setViewingPromoId(null);
                        setSearchQuery('');
                    }} 
                    className={`px-4 py-2 rounded-full text-sm font-medium transition-colors ${activeTab === 'events' && !searchQuery ? 'bg-slate-800 text-white' : 'text-slate-400 hover:text-white'}`}
                  >
                    Events
                  </button>
                </div>
              )}

              {/* SEARCH BAR */}
              <div className="flex-1 max-w-md ml-4 relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                      <Search className="h-4 w-4 text-slate-500" />
                  </div>
                  <input 
                      type="text"
                      className="bg-slate-800 border border-slate-700 text-white text-sm rounded-full block w-full pl-10 p-2.5 focus:border-yellow-500 outline-none transition-colors"
                      placeholder="Search fighters, events, gyms..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                  />
                  {searchQuery && (
                      <button onClick={() => setSearchQuery('')} className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-500 hover:text-white">
                          <X className="h-4 w-4"/>
                      </button>
                  )}
              </div>
            </div>

            <div className="flex items-center gap-4 ml-4">
               {isAdminMode ? (
                   <button onClick={() => { setIsAdminMode(false); setActiveTab('rankings'); setSearchQuery(''); }} className="text-xs bg-red-600 hover:bg-red-500 text-white px-3 py-1 rounded font-bold transition-colors">
                       EXIT ADMIN
                   </button>
               ) : (
                   <button onClick={() => { setIsAdminMode(true); setActiveTab('admin_dashboard'); setSearchQuery(''); }} className="flex items-center gap-2 text-slate-400 hover:text-white transition-colors">
                       <Lock className="w-4 h-4"/> <span className="text-xs font-bold hidden md:inline">STAFF</span>
                   </button>
               )}
            </div>
          </div>
        </div>
      </nav>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 py-8">
        {loading ? (
            <LoadingSpinner />
        ) : searchQuery ? (
            <SearchResults />
        ) : (
            <>
                {/* Admin Mode Header */}
                {isAdminMode && (
                    <div className="mb-8 flex gap-4 overflow-x-auto pb-2 border-b border-slate-800">
                        <button onClick={() => setActiveTab('admin_dashboard')} className={`flex items-center gap-2 px-4 py-2 rounded font-bold whitespace-nowrap ${activeTab === 'admin_dashboard' ? 'bg-yellow-500 text-black' : 'bg-slate-800 text-slate-400'}`}>
                            <Activity className="w-4 h-4"/> Dashboard
                        </button>
                        <button onClick={() => setActiveTab('admin_events')} className={`flex items-center gap-2 px-4 py-2 rounded font-bold whitespace-nowrap ${activeTab === 'admin_events' ? 'bg-yellow-500 text-black' : 'bg-slate-800 text-slate-400'}`}>
                            <Calendar className="w-4 h-4"/> Event Manager
                        </button>
                        <button onClick={() => setActiveTab('admin_fighters')} className={`flex items-center gap-2 px-4 py-2 rounded font-bold whitespace-nowrap ${activeTab === 'admin_fighters' ? 'bg-yellow-500 text-black' : 'bg-slate-800 text-slate-400'}`}>
                            <Users className="w-4 h-4"/> Fighter Manager
                        </button>
                        <button onClick={() => setActiveTab('admin_belts')} className={`flex items-center gap-2 px-4 py-2 rounded font-bold whitespace-nowrap ${activeTab === 'admin_belts' ? 'bg-yellow-500 text-black' : 'bg-slate-800 text-slate-400'}`}>
                            <Crown className="w-4 h-4"/> Belt Manager
                        </button>
                    </div>
                )}

                {/* Views */}
                {activeTab === 'rankings' && renderRankings()}
                {activeTab === 'events' && renderEvents()}
                {activeTab === 'admin_dashboard' && <AdminDashboard />}
                {activeTab === 'admin_fighters' && <AdminFighterManager />}
                {activeTab === 'admin_events' && <AdminEventManager />}
                {activeTab === 'admin_belts' && <AdminBeltManager />}
            </>
        )}
      </main>
      
      {/* Footer Branding */}
      <footer className="mt-20 border-t border-slate-800 py-12 text-center text-slate-500">
          <div className="flex justify-center items-center gap-2 mb-4 opacity-50">
             <div className="h-px bg-slate-700 w-12"></div>
             <Shield className="w-4 h-4"/>
             <div className="h-px bg-slate-700 w-12"></div>
          </div>
          <h3 className="text-white font-black italic text-lg mb-2">BAYOU FIGHT NIGHT</h3>
          <p className="max-w-md mx-auto text-sm mb-6">Louisiana MMA, regional fighters, and combat sports culture across the Gulf South. No hype. Just fights.</p>
          <div className="flex justify-center gap-6 text-xs uppercase tracking-widest font-bold">
              <span>Clips & Highlights</span>
              <span>•</span>
              <span>Fighter Profiles</span>
              <span>•</span>
              <span>Louisiana Culture</span>
          </div>
      </footer>
    </div>
  );
};

export default App;