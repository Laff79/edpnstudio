import React, { useState, useEffect } from 'react';
import { 
  Plus, Trash2, Guitar, Drum, Music2, Headphones, Activity, User, 
  Clock, FileText, Coffee, Share2, AlignLeft, Sparkles, X, Power,
  ChevronDown, ChevronUp, Wifi, WifiOff, Mic2
} from 'lucide-react';
import { initializeApp } from 'firebase/app';
import { 
  getAuth, signInAnonymously, onAuthStateChanged, User as FirebaseUser 
} from 'firebase/auth';
import { 
  getFirestore, collection, doc, addDoc, updateDoc, deleteDoc, onSnapshot, setDoc 
} from 'firebase/firestore';

// --- FIREBASE SETUP ---
const firebaseConfig = {
  apiKey: "AIzaSyCl2o4FtwSfqgoEZiVMQC-VW8cxLw5JVxM",
  authDomain: "edpnstudio.firebaseapp.com",
  projectId: "edpnstudio",
  storageBucket: "edpnstudio.firebasestorage.app",
  messagingSenderId: "711525242568",
  appId: "1:711525242568:web:882d454c26efbb6386b7fd",
  measurementId: "G-W4JJYE7CLZ"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

const appId = "edpn-production"; 

// --- TYPES ---
// La til 'skipped' status
type Status = 'todo' | 'recording' | 'done' | 'skipped' | 'mix_v1' | 'mix_v2' | 'master';

interface SongParts {
  [key: string]: Status;
}

interface Song {
  id: string;
  title: string;
  bpm: string;
  key: string;
  notes: string;
  lyrics: string;
  isCollapsed: boolean;
  parts: SongParts;
}

interface Consumption {
  coffee: number;
  snus: number;
}

// --- CONSTANTS ---
// Oppdatert liste med instrumenter
const TRACKS = [
  { key: 'drums', label: 'Trommer', icon: Drum },
  { key: 'bass', label: 'Bass', icon: Activity },
  { key: 'torbjorn_akustisk', label: 'Tor Ak.', icon: Guitar },
  { key: 'laff_akustisk', label: 'Laff Ak.', icon: Guitar },
  { key: 'laff_elektrisk', label: 'Laff El.', icon: Guitar },
  { key: 'keys', label: 'Keys', icon: Music2 },
  { key: 'lars_kor', label: 'Lars Kor', icon: Mic2 },
  { key: 'laff_kor', label: 'Laff Kor', icon: Mic2 },
  { key: 'torbjorn_vokal', label: 'Tor Vok', icon: User },
  { key: 'mixing', label: 'Mix', icon: Headphones },
];

const DEFAULT_PARTS: SongParts = {
  drums: 'todo',
  bass: 'todo',
  torbjorn_akustisk: 'todo',
  laff_akustisk: 'todo',
  laff_elektrisk: 'todo',
  keys: 'todo',
  lars_kor: 'todo',
  laff_kor: 'todo',
  torbjorn_vokal: 'todo',
  mixing: 'todo',
};

const STRATEGIES = [
  "Less is more.", "Hva er fokuset?", "Ta en pause.", "Fjern, ikke legg til.",
  "Er tempoet riktig?", "Gjør det enklere.", "Stol på prosessen.", 
  "Tenk dynamikk.", "Hva ville Rick Rubin gjort?", "Kill your darlings."
];

// --- COMPONENTS ---

const DigitalDisplay = ({ value, onChange, placeholder, isCollapsed }: { value: string, onChange: (val: string) => void, placeholder: string, isCollapsed: boolean }) => (
  <div className={`relative group bg-gradient-to-r from-black via-slate-950 to-black border border-slate-700/50 rounded-lg flex items-center overflow-hidden transition-all shadow-inner ${isCollapsed ? 'h-11' : 'h-16'}`}>
    <div className="absolute inset-0 bg-gradient-to-r from-cyan-500/5 via-transparent to-cyan-500/5 pointer-events-none"></div>
    <div className="absolute left-0 w-1 h-full bg-gradient-to-b from-cyan-600 to-cyan-400 shadow-[0_0_10px_rgba(34,211,238,0.4)]"></div>
    <input
      className={`relative z-10 w-full bg-transparent border-none focus:ring-0 px-5 text-slate-100 font-mono font-bold tracking-wider placeholder:text-slate-700 transition-all focus:text-cyan-100 ${isCollapsed ? 'text-lg' : 'text-xl sm:text-2xl'}`}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
    />
  </div>
);

const LedLight = ({ status }: { status: Status }) => {
  let colorClass = 'bg-slate-800';
  let shadowClass = '';
  
  if (status === 'done' || status === 'master') {
    colorClass = 'bg-cyan-400'; shadowClass = 'shadow-[0_0_8px_rgba(34,211,238,0.8)]';
  } else if (status === 'recording') {
    colorClass = 'bg-red-500 animate-pulse'; shadowClass = 'shadow-[0_0_8px_rgba(239,68,68,0.8)]';
  } else if (status === 'mix_v1') {
    colorClass = 'bg-yellow-400'; shadowClass = 'shadow-[0_0_8px_rgba(250,204,21,0.6)]';
  } else if (status === 'mix_v2') {
    colorClass = 'bg-orange-500'; shadowClass = 'shadow-[0_0_8px_rgba(249,115,22,0.6)]';
  } else if (status === 'skipped') {
    return <div className="w-1.5 h-1.5 rounded-full bg-black border border-slate-700"></div>;
  }

  return <div className={`w-1.5 h-1.5 rounded-full ${colorClass} ${shadowClass} transition-all duration-300`}></div>;
};

// --- MAIN APP ---
export default function StudioTracker() {
  const [user, setUser] = useState<FirebaseUser | null>(null);
  const [songs, setSongs] = useState<Song[]>([]);
  const [consumption, setConsumption] = useState<Consumption>({ coffee: 0, snus: 0 });
  const [newSongTitle, setNewSongTitle] = useState('');
  const [expandedSong, setExpandedSong] = useState<string | null>(null);
  const [expandedType, setExpandedType] = useState<'notes' | 'lyrics' | null>(null);
  const [recordingMode, setRecordingMode] = useState(false);
  const [copyFeedback, setCopyFeedback] = useState(false);
  const [oracleMsg, setOracleMsg] = useState<string | null>(null);
  const [sessionTime, setSessionTime] = useState(0);

  // 1. AUTHENTICATION
  useEffect(() => {
    signInAnonymously(auth).catch((error: any) => {
      console.error("Auth failed:", error);
    });
    
    const unsubscribe = onAuthStateChanged(auth, setUser);
    return () => unsubscribe();
  }, []);

  // 2. DATA SYNC - SONGS
  useEffect(() => {
    if (!user) return;
    const songsQuery = collection(db, 'artifacts', appId, 'public', 'data', 'songs');
    
    const unsubscribe = onSnapshot(songsQuery, (snapshot: any) => {
      const loadedSongs: Song[] = snapshot.docs.map((doc: any) => ({
        id: doc.id,
        ...doc.data()
      } as Song));
      
      loadedSongs.sort((a, b) => a.title.localeCompare(b.title));
      setSongs(loadedSongs);
    }, (error: any) => {
      console.error("Sync error songs:", error);
    });

    return () => unsubscribe();
  }, [user]);

  // 3. DATA SYNC - CONSUMPTION
  useEffect(() => {
    if (!user) return;
    const consumRef = doc(db, 'artifacts', appId, 'public', 'data', 'consumption', 'global_stats');
    
    const unsubscribe = onSnapshot(consumRef, (docSnap: any) => {
      if (docSnap.exists()) {
        setConsumption(docSnap.data() as Consumption);
      } else {
        setDoc(consumRef, { coffee: 0, snus: 0 });
      }
    }, (error: any) => {
      console.error("Sync error consumption:", error);
    });

    return () => unsubscribe();
  }, [user]);

  useEffect(() => {
    const timer = setInterval(() => setSessionTime(t => t + 1), 1000);
    return () => clearInterval(timer);
  }, []);

  // --- ACTIONS ---

  const addSong = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newSongTitle.trim() || !user) return;
    
    const newSong: Omit<Song, 'id'> = {
      title: newSongTitle,
      bpm: '', key: '', notes: '', lyrics: '', 
      isCollapsed: false, 
      parts: { ...DEFAULT_PARTS },
    };

    try {
      await addDoc(collection(db, 'artifacts', appId, 'public', 'data', 'songs'), newSong);
      setNewSongTitle('');
    } catch (e) {
      console.error("Error adding song:", e);
    }
  };

  const deleteSong = async (id: string) => {
    if (!user || !window.confirm('Slette dette sporet fra databasen?')) return;
    try {
      await deleteDoc(doc(db, 'artifacts', appId, 'public', 'data', 'songs', id));
    } catch (e) {
      console.error("Error deleting song:", e);
    }
  };

  const updateSongField = async (id: string, field: keyof Song, value: any) => {
    if (!user) return;
    try {
      await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'songs', id), {
        [field]: value
      });
    } catch (e) { console.error("Update error:", e); }
  };

  const updateSongPart = async (id: string, parts: SongParts) => {
    if (!user) return;
    try {
      await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'songs', id), {
        parts: parts
      });
    } catch (e) { console.error("Part update error:", e); }
  };

  const updateConsumption = async (type: 'coffee' | 'snus') => {
    if (!user) return;
    const newVal = consumption[type] + 1;
    try {
      await updateDoc(doc(db, 'artifacts', appId, 'public', 'data', 'consumption', 'global_stats'), {
        [type]: newVal
      });
    } catch (e) { console.error("Consumption error:", e); }
  };

  const cycleStatus = (song: Song, part: string) => {
    const current = song.parts[part] || 'todo';
    let next: Status = 'todo';
    
    if (part === 'mixing') {
       if (current === 'todo') next = 'mix_v1';
       else if (current === 'mix_v1') next = 'mix_v2';
       else if (current === 'mix_v2') next = 'master'; 
       else if (current === 'master') next = 'todo';
       else next = 'todo';
    } else {
      if (current === 'todo') next = 'recording';
      else if (current === 'recording') next = 'done';
      else if (current === 'done') next = 'skipped'; // Lagt til "Ikke i bruk"
      else if (current === 'skipped') next = 'todo';
      else next = 'todo';
    }

    updateSongPart(song.id, { ...song.parts, [part]: next });
  };

  const formatTime = (seconds: number) => {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    return `${h.toString().padStart(2,'0')}:${m.toString().padStart(2,'0')}`;
  };

  const askOracle = () => {
    const random = STRATEGIES[Math.floor(Math.random() * STRATEGIES.length)];
    setOracleMsg(random);
    setTimeout(() => setOracleMsg(null), 5000);
  };

  const copyReport = () => {
    const totalProgress = calculateProgress();
    let report = `🎚️ DELTA STUDIO STATUS\n`;
    report += `Status: ${totalProgress}% | Kaffe: ${consumption.coffee} | Snus: ${consumption.snus}\n`;
    songs.forEach(song => {
      // Filtrerer bort 'skipped' fra tellingen
      const activeParts = Object.values(song.parts).filter(s => s !== 'skipped');
      const partsDone = activeParts.filter(s => s === 'done' || s === 'master').length;
      const isComplete = partsDone === activeParts.length && activeParts.length > 0;
      
      report += `${isComplete ? '✅' : '🚧'} ${song.title}\n`;
    });
    navigator.clipboard.writeText(report);
    setCopyFeedback(true);
    setTimeout(() => setCopyFeedback(false), 2000);
  };

  const calculateProgress = () => {
    if (songs.length === 0) return 0;
    
    let totalActiveParts = 0;
    let totalCompletedValue = 0;

    songs.forEach(song => {
      TRACKS.forEach(track => {
        const status = song.parts[track.key] || 'todo';
        
        if (status !== 'skipped') {
          totalActiveParts += 1;
          
          if (status === 'done' || status === 'master') totalCompletedValue += 1;
          else if (status === 'recording' || status === 'mix_v1') totalCompletedValue += 0.5;
          else if (status === 'mix_v2') totalCompletedValue += 0.8;
        }
      });
    });

    if (totalActiveParts === 0) return 0;
    return Math.round((totalCompletedValue / totalActiveParts) * 100);
  };

  const getStatusLabel = (track: string, status: Status) => {
    if (status === 'skipped') return '-';
    if (track !== 'mixing') return track.substring(0, 3);
    if (status === 'todo') return 'MIX';
    if (status === 'mix_v1') return 'V.1';
    if (status === 'mix_v2') return 'V.2';
    if (status === 'master') return 'MST';
    return 'MIX';
  };

  const getButtonClass = (status: Status) => {
    const base = "relative flex flex-col items-center justify-center p-3 rounded-lg transition-all duration-200 border hover:scale-105";
    switch (status) {
      case 'master':
      case 'done': return `${base} bg-gradient-to-br from-cyan-500/15 to-cyan-600/10 border-cyan-500/40 text-cyan-400 hover:border-cyan-400 hover:shadow-[0_0_15px_rgba(34,211,238,0.3)]`;
      case 'recording': return `${base} bg-gradient-to-br from-red-500/15 to-red-600/10 border-red-500/40 text-red-400 hover:border-red-400 hover:shadow-[0_0_15px_rgba(239,68,68,0.3)]`;
      case 'mix_v1': return `${base} bg-gradient-to-br from-yellow-500/15 to-yellow-600/10 border-yellow-500/40 text-yellow-400 hover:border-yellow-400 hover:shadow-[0_0_15px_rgba(250,204,21,0.3)]`;
      case 'mix_v2': return `${base} bg-gradient-to-br from-orange-500/15 to-orange-600/10 border-orange-500/40 text-orange-400 hover:border-orange-400 hover:shadow-[0_0_15px_rgba(249,115,22,0.3)]`;
      case 'skipped': return `${base} bg-slate-900/30 border-slate-800/50 text-slate-700 opacity-50`;
      default: return `${base} bg-gradient-to-br from-slate-800/50 to-slate-900/50 border-slate-700 text-slate-400 hover:border-slate-500 hover:text-slate-300`;
    }
  };

  return (
    <div className={`min-h-screen font-sans pb-40 transition-colors duration-1000 ${recordingMode ? 'bg-gradient-to-br from-[#1a0505] via-[#0a0000] to-black' : 'bg-gradient-to-br from-[#0a0a0a] via-[#121212] to-black'}`}>
      
      {/* RECORDING OVERLAY */}
      <div className={`fixed inset-0 pointer-events-none z-[100] transition-opacity duration-500 ${recordingMode ? 'opacity-100' : 'opacity-0'}`}>
          <div className="absolute top-0 w-full h-0.5 bg-gradient-to-r from-transparent via-red-500 to-transparent shadow-[0_0_30px_rgba(239,68,68,0.8)]"></div>
          <div className="absolute top-6 right-6 flex items-center gap-2.5 bg-gradient-to-r from-red-600 to-red-500 text-white font-bold px-5 py-2 rounded-full shadow-[0_0_30px_rgba(220,38,38,0.6)] animate-pulse border border-red-400/30">
            <div className="w-2.5 h-2.5 bg-white rounded-full shadow-[0_0_8px_white]"></div>
            <span className="text-sm tracking-wider">REC</span>
          </div>
      </div>

      {/* ORACLE */}
      {oracleMsg && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/90 backdrop-blur-xl animate-in fade-in" onClick={() => setOracleMsg(null)}>
          <div className="bg-gradient-to-br from-[#1a1a1a] to-[#0a0a0a] border border-cyan-500/30 p-10 rounded-2xl max-w-lg text-center shadow-[0_0_80px_rgba(6,182,212,0.3)] relative overflow-hidden">
            <div className="absolute inset-0 bg-gradient-to-br from-cyan-500/5 to-transparent"></div>
            <Sparkles className="w-10 h-10 text-cyan-400 mx-auto mb-6 relative z-10 drop-shadow-[0_0_10px_rgba(34,211,238,0.5)]" />
            <p className="text-2xl font-medium text-slate-100 leading-relaxed tracking-wide relative z-10 drop-shadow-lg">"{oracleMsg}"</p>
          </div>
        </div>
      )}

      {/* HEADER */}
      <header className="sticky top-0 z-50 bg-black/80 backdrop-blur-2xl border-b border-slate-800/50 shadow-lg">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-4">
          <div className="flex justify-between items-center gap-4">

            <div className="flex flex-col">
              <h1 className="text-xl sm:text-2xl font-black text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-cyan-300 tracking-[0.25em] uppercase flex items-center gap-3">
                <Activity className="text-cyan-400 w-6 h-6 drop-shadow-[0_0_8px_rgba(34,211,238,0.5)]" /> EDPN
              </h1>
              <div className="flex items-center gap-2.5 text-[10px] font-mono text-slate-400 mt-1">
                <span className="font-semibold tracking-wider">DELTA STUDIO</span>
                <span className="text-slate-700">•</span>
                <span className="text-red-400 flex items-center gap-1.5 font-semibold"><Clock className="w-3 h-3" /> {formatTime(sessionTime)}</span>
                <span className="text-slate-700">•</span>
                {user ? <span className="flex items-center gap-1.5 text-emerald-400 font-semibold"><Wifi className="w-3 h-3"/> ONLINE</span> : <span className="flex items-center gap-1.5 text-red-400 font-semibold"><WifiOff className="w-3 h-3"/> OFFLINE</span>}
              </div>
            </div>

            <div className="flex-1 max-w-md mx-4 hidden sm:block">
              <div className="flex justify-between text-[10px] font-mono text-cyan-400 mb-1.5 font-semibold tracking-wider">
                <span>PROGRESS</span>
                <span>{calculateProgress()}%</span>
              </div>
              <div className="h-2 bg-slate-900 rounded-full overflow-hidden border border-slate-800/50 shadow-inner">
                <div className="h-full bg-gradient-to-r from-cyan-600 to-cyan-400 shadow-[0_0_15px_rgba(34,211,238,0.5)] transition-all duration-500" style={{ width: `${calculateProgress()}%` }}></div>
              </div>
            </div>

            <div className="flex items-center gap-3">
               <button onClick={askOracle} className="p-2.5 rounded-full bg-gradient-to-br from-slate-900 to-slate-800 border border-slate-700 hover:border-cyan-500/50 hover:text-cyan-400 text-slate-400 transition-all hover:shadow-[0_0_20px_rgba(34,211,238,0.2)] hover:scale-105" title="Strategy">
                <Sparkles className="w-4 h-4" />
               </button>
               <button
                  onClick={() => setRecordingMode(!recordingMode)}
                  className={`w-11 h-11 rounded-full border flex items-center justify-center transition-all hover:scale-105 ${recordingMode ? 'bg-gradient-to-br from-red-600 to-red-500 border-red-400 text-white shadow-[0_0_25px_rgba(239,68,68,0.5)]' : 'bg-gradient-to-br from-slate-900 to-slate-800 border-slate-700 text-slate-400 hover:text-slate-200 hover:border-slate-500'}`}
                >
                  <Power className="w-5 h-5" />
                </button>
            </div>
          </div>
        </div>
      </header>

      {/* CONTENT */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-8 space-y-5">
        
        {/* CONSUMPTION */}
        <div className="flex justify-end gap-3 mb-8">
           <button onClick={() => updateConsumption('coffee')} className="flex items-center gap-2.5 px-4 py-2 rounded-lg bg-gradient-to-br from-slate-900 to-slate-800 border border-slate-700 hover:border-orange-600/50 hover:shadow-[0_0_20px_rgba(234,88,12,0.2)] transition-all group hover:scale-105">
             <Coffee className="w-4 h-4 text-orange-400/80 group-hover:text-orange-400 transition-colors" />
             <span className="text-sm font-mono font-bold text-slate-300">{consumption.coffee}</span>
           </button>
           <button onClick={() => updateConsumption('snus')} className="flex items-center gap-2.5 px-4 py-2 rounded-lg bg-gradient-to-br from-slate-900 to-slate-800 border border-slate-700 hover:border-blue-600/50 hover:shadow-[0_0_20px_rgba(59,130,246,0.2)] transition-all group hover:scale-105">
             <div className="w-4 h-4 rounded-full border-2 border-slate-500 group-hover:border-slate-300 transition-colors"></div>
             <span className="text-sm font-mono font-bold text-slate-300">{consumption.snus}</span>
           </button>
           <button onClick={copyReport} className="ml-2 flex items-center gap-2.5 px-4 py-2 rounded-lg bg-gradient-to-br from-slate-900 to-slate-800 border border-slate-700 hover:border-cyan-600/50 hover:text-cyan-400 text-slate-400 transition-all hover:scale-105 hover:shadow-[0_0_20px_rgba(34,211,238,0.2)]">
             <Share2 className="w-4 h-4" />
             <span className="text-xs font-bold uppercase hidden sm:inline tracking-wider">{copyFeedback ? 'Kopiert!' : 'Rapport'}</span>
           </button>
        </div>

        {/* SONG LIST */}
        {songs.map((song) => {
          // Progress calculation per song (excluding skipped)
          const activeParts = Object.values(song.parts).filter(p => p !== 'skipped');
          const partsDone = activeParts.filter(p => p === 'done' || p === 'master').length;
          const totalActive = activeParts.length;
          const percent = totalActive > 0 ? Math.round((partsDone/totalActive)*100) : 0;

          return (
            <div key={song.id} className="bg-gradient-to-br from-slate-900/50 to-slate-900/30 backdrop-blur-sm rounded-xl border border-slate-800/50 shadow-xl transition-all hover:border-slate-700 hover:shadow-2xl">
              
              <div className="p-4 sm:p-5 flex items-center justify-between gap-4">
                <button
                  onClick={() => updateSongField(song.id, 'isCollapsed', !song.isCollapsed)}
                  className="p-2 rounded-lg hover:bg-slate-800/50 text-slate-500 hover:text-slate-300 transition-all hover:scale-110"
                >
                  {song.isCollapsed ? <ChevronDown className="w-5 h-5" /> : <ChevronUp className="w-5 h-5" />}
                </button>

                <div className="flex-1">
                  <DigitalDisplay 
                    value={song.title} 
                    onChange={(val) => updateSongField(song.id, 'title', val)} 
                    placeholder="Låtnavn"
                    isCollapsed={song.isCollapsed}
                  />
                </div>

                {song.isCollapsed && (
                  <div className="hidden sm:flex items-center gap-4 text-xs font-mono text-slate-400">
                    <span className={`font-bold ${percent === 100 ? 'text-cyan-400' : 'text-slate-400'}`}>{percent}%</span>
                    <div className="w-24 h-2 bg-slate-900 rounded-full overflow-hidden border border-slate-800/50">
                      <div className="h-full bg-gradient-to-r from-cyan-600 to-cyan-400 shadow-[0_0_10px_rgba(34,211,238,0.4)] transition-all duration-300" style={{width: `${percent}%`}}></div>
                    </div>
                  </div>
                )}
                
                {!song.isCollapsed && (
                  <div className="hidden lg:flex gap-3">
                    <div className="flex flex-col bg-slate-900/80 px-4 py-2 rounded-lg border border-slate-700/50 backdrop-blur-sm">
                      <span className="text-[9px] text-slate-500 font-bold uppercase tracking-wider mb-0.5">BPM</span>
                      <input
                        className="bg-transparent text-sm font-mono text-cyan-400 font-bold focus:outline-none w-12"
                        value={song.bpm}
                        onChange={(e) => updateSongField(song.id, 'bpm', e.target.value)}
                        placeholder="---"
                      />
                    </div>
                    <div className="flex flex-col bg-slate-900/80 px-4 py-2 rounded-lg border border-slate-700/50 backdrop-blur-sm">
                      <span className="text-[9px] text-slate-500 font-bold uppercase tracking-wider mb-0.5">Key</span>
                      <input
                        className="bg-transparent text-sm font-mono text-cyan-400 font-bold focus:outline-none w-8"
                        value={song.key}
                        onChange={(e) => updateSongField(song.id, 'key', e.target.value)}
                        placeholder="-"
                      />
                    </div>
                  </div>
                )}
              </div>

              {!song.isCollapsed && (
                <div className="px-4 pb-4 sm:px-5 sm:pb-5 border-t border-slate-800/50 pt-5 animate-in slide-in-from-top-2">
                  <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-5">
                    {TRACKS.map((track) => {
                      const Icon = track.icon;
                      const status = song.parts[track.key];
                      const label = getStatusLabel(track.key, status);
                      return (
                        <button
                          key={track.key}
                          onClick={() => cycleStatus(song, track.key)}
                          className={getButtonClass(status)}
                        >
                          <div className="flex items-center justify-between w-full mb-1"><LedLight status={status} /></div>
                          <Icon className={`w-4 h-4 mb-2 ${status === 'skipped' ? 'opacity-20' : 'opacity-80'}`} />
                          <span className={`text-[10px] font-black uppercase tracking-widest ${status === 'skipped' && 'line-through decoration-slate-600'}`}>{label}</span>
                          <span className="text-[8px] font-bold text-slate-600 uppercase mt-1">{track.label}</span>
                        </button>
                      );
                    })}
                  </div>

                  <div className="flex items-center justify-between pt-4 border-t border-slate-800/50 mt-1">
                    <div className="flex gap-3">
                       <button onClick={() => { setExpandedSong(expandedSong === song.id ? null : song.id); setExpandedType('lyrics'); }} className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold uppercase transition-all ${song.lyrics ? 'text-cyan-400 bg-cyan-900/20 border border-cyan-700/30' : 'text-slate-400 hover:text-slate-300 border border-slate-700/50 hover:border-slate-600'}`}>
                         <AlignLeft className="w-3.5 h-3.5" /> Tekst
                       </button>
                       <button onClick={() => { setExpandedSong(expandedSong === song.id ? null : song.id); setExpandedType('notes'); }} className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold uppercase transition-all ${song.notes ? 'text-yellow-400 bg-yellow-900/20 border border-yellow-700/30' : 'text-slate-400 hover:text-slate-300 border border-slate-700/50 hover:border-slate-600'}`}>
                         <FileText className="w-3.5 h-3.5" /> Notater
                       </button>
                    </div>
                    <button onClick={() => deleteSong(song.id)} className="text-slate-600 hover:text-red-500 transition-all p-2 hover:scale-110"><Trash2 className="w-4 h-4" /></button>
                  </div>
                </div>
              )}

              {expandedSong === song.id && (
                <div className="bg-gradient-to-br from-slate-900/80 to-slate-900/50 border-t border-slate-800/50 p-5 backdrop-blur-sm">
                   <div className="flex justify-between items-center mb-4">
                     <span className="text-[10px] font-bold text-cyan-400 uppercase tracking-[0.2em]">{expandedType === 'lyrics' ? 'LYRICS / TEKST' : 'PRODUKSJONSNOTATER'}</span>
                     <button onClick={() => setExpandedSong(null)} className="hover:scale-110 transition-transform"><X className="w-4 h-4 text-slate-500 hover:text-slate-200"/></button>
                   </div>
                   <textarea
                    value={expandedType === 'lyrics' ? song.lyrics : song.notes}
                    onChange={(e) => updateSongField(song.id, expandedType === 'lyrics' ? 'lyrics' : 'notes', e.target.value)}
                    className={`w-full bg-slate-900/60 text-slate-200 border border-slate-700 p-5 font-mono text-sm leading-relaxed focus:outline-none focus:border-cyan-500/50 focus:ring-2 focus:ring-cyan-500/20 rounded-lg min-h-[240px] transition-all ${expandedType === 'lyrics' ? 'text-center' : ''}`}
                    placeholder={expandedType === 'lyrics' ? "Lim inn tekst..." : "Skriv notater..."}
                  />
                </div>
              )}
            </div>
          );
        })}

        {/* ADD SONG FORM */}
        <form onSubmit={addSong} className="mt-10">
          <div className="relative group max-w-lg mx-auto">
            <input
              type="text"
              value={newSongTitle}
              onChange={(e) => setNewSongTitle(e.target.value)}
              placeholder="NYTT SPOR..."
              className="w-full bg-gradient-to-br from-slate-900/50 to-slate-900/30 border border-slate-700 rounded-xl px-8 py-4 text-slate-200 placeholder:text-slate-600 focus:outline-none focus:border-cyan-500 focus:ring-2 focus:ring-cyan-500/20 font-bold uppercase tracking-[0.3em] text-center transition-all shadow-lg"
            />
            <button type="submit" className="absolute right-3 top-3 p-2 bg-gradient-to-br from-cyan-600 to-cyan-500 rounded-lg text-white hover:from-cyan-500 hover:to-cyan-400 transition-all hover:scale-110 shadow-lg hover:shadow-cyan-500/30">
              <Plus className="w-5 h-5" />
            </button>
          </div>
        </form>

        <div className="text-center pt-12 pb-6 opacity-30">
            <p className="text-[10px] font-mono tracking-[0.3em] text-slate-600">DELTA STUDIO CLOUD SYNC</p>
        </div>

      </main>
    </div>
  );
}
